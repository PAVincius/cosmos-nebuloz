"use client";

import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import { type FormEvent, useCallback, useState, useTransition } from "react";
import type { TenantOpcao } from "@/app/actions/audit";
import {
  createEngagementAction,
  type EngagementRow,
  listEngagements,
  setEngagementStatusAction,
} from "@/app/actions/engagements";
import type { ServiceRow } from "@/app/actions/services";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { formatarBRL } from "@/lib/comercial/formato";
import { ROTULO_STATUS, type StatusEngajamento } from "@/lib/delivery";

const TOM: Record<string, Tone> = {
  PROPOSTO: "accent",
  ATIVO: "green",
  PAUSADO: "amber",
  CONCLUIDO: "blue",
  CANCELADO: "red",
};

const NAO_DIGITO = /[^\d]/g;

const FORM_VAZIO = {
  nome: "",
  codigo: "",
  clienteTenantId: "",
  serviceId: "",
  valor: "",
  inicioEm: "",
  fimEm: "",
  escopo: "",
};

function paraCentavos(texto: string): number {
  const so = texto.replace(NAO_DIGITO, "");
  return so ? Number.parseInt(so, 10) : 0;
}

function periodo(inicio: string | null, fim: string | null): string {
  if (!(inicio || fim)) {
    return "sem período definido";
  }
  const d = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "…";
  return `${d(inicio)} → ${d(fim)}`;
}

/** O que o servidor faz ao fechar — a verdade de `lib/delivery.ts`: os dois
 *  são terminais, e reabrir é criar outro. Concluído não sai da capacidade:
 *  as alocações não olham o status do engajamento, então não se promete
 *  isso aqui. */
const CONSEQUENCIA_TERMINAL: Record<"CANCELADO" | "CONCLUIDO", string> = {
  CANCELADO:
    "O engajamento fecha como cancelado e não pode ser reaberto; para retomar, cria-se outro.",
  CONCLUIDO:
    "O engajamento fecha como concluído e não pode ser reaberto; para retomar, cria-se outro.",
};

/** Botão de uma transição da linha. Fora de `LinhaEngajamento` porque, com o
 *  pendente, o ternário dentro do `.map` passava o teto de complexidade. */
function BotaoDeTransicao({
  para,
  travada,
  pendente,
  onClick,
}: {
  para: StatusEngajamento;
  travada: boolean;
  pendente: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="btn"
      disabled={travada}
      onClick={onClick}
      style={{
        padding: "4px 9px",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--hairline)",
        background: "none",
        color: "var(--ink-muted)",
        fontSize: "var(--fs-nota)",
        fontWeight: 600,
        opacity: travada ? 0.5 : 1,
        cursor: travada ? "not-allowed" : "pointer",
      }}
      type="button"
    >
      {pendente ? "Mudando…" : `→ ${ROTULO_STATUS[para] ?? para}`}
    </button>
  );
}

function LinhaEngajamento({
  e,
  primeira,
  podeEscrever,
  mudando,
  onStatus,
}: {
  e: EngagementRow;
  primeira: boolean;
  podeEscrever: boolean;
  /** Transição em curso nesta linha, se houver — os outros botões da linha
   *  travam junto, só o clicado diz "Mudando…". */
  mudando: StatusEngajamento | null;
  onStatus: (id: string, status: StatusEngajamento) => void;
}) {
  const terminal = e.proximos.length === 0;
  const travada = mudando !== null;

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "11px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
        opacity: terminal ? 0.7 : 1,
      }}
    >
      <span
        className="mono"
        style={{ fontSize: "var(--fs-nota)", fontWeight: 700, width: 72 }}
      >
        {e.codigo}
      </span>
      <span style={{ flex: 1, minWidth: 160 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
          }}
        >
          {e.nome}
        </span>
        <span
          className="mono"
          style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
        >
          {e.clienteSlug} · {periodo(e.inicioEm, e.fimEm)}
        </span>
      </span>
      <span
        className="mono"
        style={{ fontSize: "var(--fs-base)", color: "var(--accent-text)" }}
      >
        {formatarBRL(e.valorCentavos)}
      </span>
      <Badge dot tone={TOM[e.status] ?? "neutral"}>
        {ROTULO_STATUS[e.status as StatusEngajamento] ?? e.status}
      </Badge>
      {/* Terminal fica esmaecido — e com a palavra: opacidade sozinha não diz
          que a linha não tem mais para onde ir. */}
      {terminal ? <Badge tone="neutral">Encerrado</Badge> : null}

      {/* Só as transições que a action aceita. Oferecer uma que ela recusa é
          pior que não oferecer nada. */}
      {podeEscrever
        ? e.proximos.map((p) =>
            p === "CANCELADO" || p === "CONCLUIDO" ? (
              // Os dois terminais (`lib/delivery.ts`): a action não deixa
              // reabrir nenhum. Concluído não destrói, então o tom é o da
              // ação primária — mas é tão sem volta quanto cancelar.
              <ConfirmarAcao
                alvo={`${e.codigo} · ${e.nome}`}
                consequencia={CONSEQUENCIA_TERMINAL[p]}
                desabilitado={travada}
                executando={mudando === p}
                key={p}
                onConfirmar={() => onStatus(e.id, p)}
                rotulo={`→ ${ROTULO_STATUS[p]}`}
                tom={p === "CANCELADO" ? "red" : "accent"}
              />
            ) : (
              <BotaoDeTransicao
                key={p}
                onClick={() => onStatus(e.id, p as StatusEngajamento)}
                para={p as StatusEngajamento}
                pendente={mudando === p}
                travada={travada}
              />
            )
          )
        : null}
    </li>
  );
}

export function Engajamentos({
  iniciais,
  clientes,
  servicos,
  podeEscrever,
}: {
  iniciais: EngagementRow[];
  clientes: TenantOpcao[];
  servicos: ServiceRow[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  // Duas transições separadas: criar e mudar status são escritas diferentes,
  // e o pendente de uma não pode travar a outra. `mudando` guarda id e alvo
  // para só a linha (e o botão) clicada dizer "Mudando…".
  const [criandoPendente, iniciarCriacao] = useTransition();
  const [, iniciarMudanca] = useTransition();
  const [mudando, setMudando] = useState<{
    id: string;
    status: StatusEngajamento;
  } | null>(null);

  // Relê a lista pela action em vez de `window.location.reload()`: as
  // transições possíveis vêm do mapa do servidor (recalculá-las aqui
  // duplicaria o que já existe lá), e a tela não perde o scroll.
  const recarregar = useCallback(async () => {
    const res = await listEngagements();
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setLista(res.data);
  }, []);

  const criar = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      setErro(null);
      setConfirmacao(null);
      iniciarCriacao(async () => {
        const res = await createEngagementAction({
          nome: form.nome,
          codigo: form.codigo,
          clienteTenantId: form.clienteTenantId,
          serviceId: form.serviceId || undefined,
          escopo: form.escopo || undefined,
          valorCentavos: paraCentavos(form.valor),
          inicioEm: form.inicioEm || undefined,
          fimEm: form.fimEm || undefined,
        });
        if (!res.ok) {
          setErro(res.error);
          return;
        }
        const cliente = clientes.find((c) => c.id === form.clienteTenantId);
        setLista((atual) => [
          {
            id: res.data.id,
            codigo: res.data.codigo,
            nome: form.nome,
            clienteNome: cliente?.name ?? "—",
            clienteSlug: cliente?.slug ?? "—",
            status: "PROPOSTO",
            valorCentavos: paraCentavos(form.valor),
            inicioEm: form.inicioEm || null,
            fimEm: form.fimEm || null,
            proximos: ["ATIVO", "CANCELADO"],
          },
          ...atual,
        ]);
        setConfirmacao(`Engajamento ${res.data.codigo} criado como proposto.`);
        setCriando(false);
        setForm(FORM_VAZIO);
      });
    },
    [form, clientes]
  );

  const mudarStatus = useCallback(
    (id: string, status: StatusEngajamento) => {
      setErro(null);
      setConfirmacao(null);
      setMudando({ id, status });
      iniciarMudanca(async () => {
        const res = await setEngagementStatusAction({ id, status });
        if (res.ok) {
          await recarregar();
          const codigo = lista.find((e) => e.id === id)?.codigo ?? id;
          setConfirmacao(`${codigo} agora está ${ROTULO_STATUS[status]}.`);
        } else {
          setErro(res.error);
        }
        setMudando(null);
      });
    },
    [lista, recarregar]
  );

  const podeCriar =
    form.nome.trim().length >= 2 &&
    form.codigo.trim().length >= 2 &&
    form.clienteTenantId !== "" &&
    !criandoPendente;
  const total =
    lista.length === 1 ? "1 engajamento" : `${lista.length} engajamentos`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}
      {confirmacao ? (
        <output
          style={{
            display: "block",
            padding: "9px 11px",
            borderRadius: "var(--r-md)",
            background: "var(--green-soft)",
            border: "1px solid rgba(var(--green-rgb),.3)",
            color: "var(--green-text)",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
          }}
        >
          {confirmacao}
        </output>
      ) : null}

      <SectionCard
        action={
          podeEscrever ? (
            <BotaoPrimario
              full={false}
              onClick={() => setCriando((v) => !v)}
              type="button"
            >
              {criando ? "Cancelar" : "Novo engajamento"}
            </BotaoPrimario>
          ) : null
        }
        icon="handshake"
        subtitle={`${total} · escopo fechado`}
        title="Engajamentos"
      >
        {criando ? (
          // `<form>` e não `<div>`: é o que faz Enter num campo submeter.
          <form
            aria-label="Novo engajamento"
            onSubmit={criar}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingBottom: 14,
              marginBottom: 14,
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              }}
            >
              <Campo htmlFor="e-codigo" label="Código">
                <input
                  id="e-codigo"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, codigo: ev.target.value }))
                  }
                  placeholder="ENG-01"
                  style={INPUT}
                  value={form.codigo}
                />
              </Campo>
              <Campo htmlFor="e-nome" label="Nome">
                <input
                  id="e-nome"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, nome: ev.target.value }))
                  }
                  style={INPUT}
                  value={form.nome}
                />
              </Campo>
              <Campo htmlFor="e-cliente" label="Cliente">
                <select
                  id="e-cliente"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, clienteTenantId: ev.target.value }))
                  }
                  style={{ ...INPUT, cursor: "pointer" }}
                  value={form.clienteTenantId}
                >
                  <option value="">Escolha…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo htmlFor="e-servico" label="Serviço (opcional)">
                <select
                  id="e-servico"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, serviceId: ev.target.value }))
                  }
                  style={{ ...INPUT, cursor: "pointer" }}
                  value={form.serviceId}
                >
                  <option value="">Nenhum</option>
                  {servicos
                    .filter((s) => s.ativo)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.codigo} · {s.nome}
                      </option>
                    ))}
                </select>
              </Campo>
              {/* A unidade vai no rótulo e o placeholder tem centavos: sem
                  isso "5000" grava R$ 50,00 e a pessoa só descobre na dica —
                  que agora fica colada no campo, não no rodapé. */}
              <Campo
                hint={`grava ${formatarBRL(paraCentavos(form.valor))} — digite com centavos`}
                htmlFor="e-valor"
                label="Valor fechado (R$)"
              >
                <input
                  id="e-valor"
                  inputMode="numeric"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, valor: ev.target.value }))
                  }
                  placeholder="12.000,00"
                  style={INPUT}
                  value={form.valor}
                />
              </Campo>
              <Campo htmlFor="e-inicio" label="Início">
                <input
                  id="e-inicio"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, inicioEm: ev.target.value }))
                  }
                  style={INPUT}
                  type="date"
                  value={form.inicioEm}
                />
              </Campo>
              <Campo htmlFor="e-fim" label="Fim previsto">
                <input
                  id="e-fim"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, fimEm: ev.target.value }))
                  }
                  style={INPUT}
                  type="date"
                  value={form.fimEm}
                />
              </Campo>
            </div>

            <Campo
              hint="o que foi acordado entregar — é o que fecha o escopo"
              htmlFor="e-escopo"
              label="Escopo"
            >
              <textarea
                id="e-escopo"
                onChange={(ev) =>
                  setForm((f) => ({ ...f, escopo: ev.target.value }))
                }
                style={{ ...INPUT, minHeight: 70, resize: "vertical" }}
                value={form.escopo}
              />
            </Campo>

            <BotaoPrimario disabled={!podeCriar} full={false} type="submit">
              {criandoPendente ? "Criando…" : "Criar como proposto"}
            </BotaoPrimario>
          </form>
        ) : null}

        {lista.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 28,
              textAlign: "center",
              fontSize: "var(--fs-base)",
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            Nenhum engajamento. Um engajamento nasce proposto e só vira ativo
            quando alguém confirma — nascer ativo faria a receita entrar antes
            do aceite.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lista.map((e, i) => (
              <LinhaEngajamento
                e={e}
                key={e.id}
                mudando={mudando?.id === e.id ? mudando.status : null}
                onStatus={mudarStatus}
                podeEscrever={podeEscrever}
                primeira={i === 0}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
