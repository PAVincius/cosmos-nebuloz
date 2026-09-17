"use client";

import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  allocatePersonAction,
  listCapacity,
  type PessoaCapacidade,
} from "@/app/actions/capacity";
import type { EngagementRow } from "@/app/actions/engagements";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { formatarDataBr } from "@/lib/empresa/periodo";
import { FormularioDeCapacidade } from "./formulario";

/**
 * Capacidade por pessoa.
 *
 * A barra é a leitura principal: a pergunta que abre esta tela é "quem tem
 * espaço", e responder isso lendo doze percentuais em texto é trabalho que a
 * barra faz de relance.
 */

const ALOCACAO_VAZIA = {
  engagementId: "",
  percentual: "50",
  inicioEm: "",
  fimEm: "",
  motivo: "",
};

function tomDaOcupacao(pct: number): Tone {
  if (pct > 100) {
    return "red";
  }
  if (pct >= 85) {
    return "amber";
  }
  if (pct === 0) {
    return "neutral";
  }
  return "green";
}

function BarraDeOcupacao({ pct }: { pct: number }) {
  return (
    <span
      style={{
        display: "block",
        height: 6,
        borderRadius: 99,
        background: "var(--surface-3)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          // Acima de 100% a barra enche e a cor muda — esticar além da caixa
          // esconderia o excesso justamente onde ele importa.
          width: `${Math.min(pct, 100)}%`,
          height: "100%",
          background: `var(--${tomDaOcupacao(pct)})`,
        }}
      />
    </span>
  );
}

function Pessoa({
  p,
  primeira,
  podeEscrever,
  onAlocar,
  formulario,
  confirmacao,
}: {
  p: PessoaCapacidade;
  primeira: boolean;
  podeEscrever: boolean;
  onAlocar: (id: string) => void;
  /** O formulário de alocação, quando é esta a pessoa sendo alocada. */
  formulario: ReactNode;
  /** A última alocação gravada, quando foi nesta pessoa. */
  confirmacao: string | null;
}) {
  return (
    <li
      style={{
        padding: "13px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
        opacity: p.ativo ? 1 : 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "var(--fs-base)",
              fontWeight: 600,
            }}
          >
            {p.nome}
          </span>
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            {p.email} · {p.horasSemana}h/semana
            {p.saiEm ? ` · sai em ${formatarDataBr(p.saiEm.slice(0, 10))}` : ""}
          </span>
          {p.observacao ? (
            <span
              style={{
                display: "block",
                fontSize: "var(--fs-nota)",
                color: "var(--ink-muted)",
              }}
            >
              {p.observacao}
            </span>
          ) : null}
        </span>
        {/* Inativa continua na lista, esmaecida — e com a palavra: opacidade
            sozinha não diz a quem lê por que a linha está apagada. */}
        {p.ativo ? null : <Badge tone="neutral">Inativa</Badge>}
        {/* Ter data de saída é o que faz alguém terceiro — não há coluna. */}
        {p.saiEm ? <Badge tone="blue">terceiro</Badge> : null}
        {p.habilidades.map((h) => (
          <Badge key={h} tone="neutral">
            {h}
          </Badge>
        ))}
        <Badge dot tone={tomDaOcupacao(p.ocupacaoAtual)}>
          {p.ocupacaoAtual}%
        </Badge>
        {podeEscrever ? (
          <button
            className="btn"
            onClick={() => onAlocar(p.id)}
            style={{
              padding: "4px 10px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--hairline)",
              background: "none",
              color: "var(--ink-muted)",
              fontSize: "var(--fs-nota)",
              fontWeight: 600,
              cursor: "pointer",
            }}
            type="button"
          >
            Alocar
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 8 }}>
        <BarraDeOcupacao pct={p.ocupacaoAtual} />
      </div>

      {p.alocacoes.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 8,
          }}
        >
          {p.alocacoes.map((a) => (
            <span
              className="mono"
              key={`${a.engajamento}-${a.inicioEm}`}
              style={{
                fontSize: "var(--fs-micro)",
                padding: "2px 7px",
                borderRadius: "var(--r-pill)",
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
                color: "var(--ink-faint)",
              }}
            >
              {a.percentual}% · {a.engajamento}
            </span>
          ))}
        </div>
      ) : null}

      {/* Formulário e confirmação nascem na linha que agiu: quem clicou
          "Alocar" está olhando para esta pessoa, não para o topo da página. */}
      {formulario}
      {confirmacao ? (
        <div style={{ marginTop: 10 }}>
          <Confirmacao>{confirmacao}</Confirmacao>
        </div>
      ) : null}
    </li>
  );
}

const BOTAO_FECHAR = {
  padding: "9px 15px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline)",
  background: "none",
  color: "var(--ink-muted)",
  fontSize: "var(--fs-base)",
  fontWeight: 600,
  cursor: "pointer",
} as const;

type Alocacao = typeof ALOCACAO_VAZIA;

/** O formulário de alocação, montado dentro da linha da pessoa. Foca o
 *  primeiro campo ao abrir: sem isso o clique em "Alocar" não movia nada, e
 *  quem navega por teclado ficava no botão sem saber que algo abriu. */
function FormularioDeAlocacao({
  nome,
  aloc,
  engajamentos,
  pendente,
  onMudar,
  onEnviar,
  onFechar,
}: {
  nome: string;
  aloc: Alocacao;
  engajamentos: EngagementRow[];
  pendente: boolean;
  onMudar: (parcial: Partial<Alocacao>) => void;
  onEnviar: (event: FormEvent) => void;
  onFechar: () => void;
}) {
  const primeiroCampo = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    primeiroCampo.current?.focus();
  }, []);
  // Fora do JSX: o `&&` inline vira valor vazando para o render aos olhos do
  // lint, e nomear a condição diz o que ela significa.
  const podeAlocar = Boolean(aloc.engagementId && aloc.inicioEm) && !pendente;
  const titulo = `Nova alocação — ${nome}`;

  return (
    <form
      aria-label={titulo}
      onSubmit={onEnviar}
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline-strong)",
        background: "var(--surface-2)",
      }}
    >
      <p
        style={{
          margin: "0 0 10px",
          fontSize: "var(--fs-base)",
          fontWeight: 700,
        }}
      >
        {titulo}
      </p>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
        }}
      >
        <Campo htmlFor="a-eng" label="Engajamento">
          <select
            id="a-eng"
            onChange={(e) => onMudar({ engagementId: e.target.value })}
            ref={primeiroCampo}
            style={{ ...INPUT, cursor: "pointer" }}
            value={aloc.engagementId}
          >
            <option value="">Escolha…</option>
            {engajamentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo} · {e.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo htmlFor="a-pct" label="Percentual">
          <input
            id="a-pct"
            max={100}
            min={1}
            onChange={(e) => onMudar({ percentual: e.target.value })}
            style={INPUT}
            type="number"
            value={aloc.percentual}
          />
        </Campo>
        <Campo htmlFor="a-ini" label="Início">
          <input
            id="a-ini"
            onChange={(e) => onMudar({ inicioEm: e.target.value })}
            style={INPUT}
            type="date"
            value={aloc.inicioEm}
          />
        </Campo>
        <Campo htmlFor="a-fim" label="Fim (opcional)">
          <input
            id="a-fim"
            onChange={(e) => onMudar({ fimEm: e.target.value })}
            style={INPUT}
            type="date"
            value={aloc.fimEm}
          />
        </Campo>
      </div>

      <div style={{ marginTop: 10 }}>
        <Campo
          hint="só é exigido se a soma no período passar de 100%"
          htmlFor="a-motivo"
          label="Motivo da sobrecarga"
        >
          <input
            id="a-motivo"
            onChange={(e) => onMudar({ motivo: e.target.value })}
            placeholder="ex.: cobertura de férias por duas semanas"
            style={INPUT}
            value={aloc.motivo}
          />
        </Campo>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <BotaoPrimario disabled={!podeAlocar} full={false} type="submit">
          {pendente ? "Alocando…" : "Alocar"}
        </BotaoPrimario>
        {/* "Fechar", não "Cancelar": só fecha o formulário; nada é
            desfeito nem apagado. */}
        <button
          className="btn"
          onClick={onFechar}
          style={BOTAO_FECHAR}
          type="button"
        >
          Fechar
        </button>
      </div>
    </form>
  );
}

export function Capacidade({
  iniciais,
  engajamentos,
  podeEscrever,
}: {
  iniciais: PessoaCapacidade[];
  engajamentos: EngagementRow[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  const [erro, setErro] = useState<string | null>(null);
  // Presa à pessoa: a frase aparece na linha de quem foi alocado.
  const [confirmacao, setConfirmacao] = useState<{
    personId: string;
    texto: string;
  } | null>(null);
  const [nova, setNova] = useState(false);
  const [alocando, setAlocando] = useState<string | null>(null);
  const [aloc, setAloc] = useState(ALOCACAO_VAZIA);
  const [pendente, iniciar] = useTransition();

  // Relê a lista pela action em vez de `window.location.reload()`: a ocupação
  // vem recalculada pelo servidor (somar aqui duplicaria a regra de
  // sobreposição de períodos), e a tela não perde o scroll nem o que estava
  // digitado em outro lugar.
  const recarregar = useCallback(async () => {
    const res = await listCapacity();
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setLista(res.data);
  }, []);

  const alocar = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!alocando) {
        return;
      }
      setErro(null);
      setConfirmacao(null);
      const personId = alocando;
      iniciar(async () => {
        const res = await allocatePersonAction({
          personId,
          engagementId: aloc.engagementId,
          percentual: Number(aloc.percentual) || 0,
          inicioEm: aloc.inicioEm,
          fimEm: aloc.fimEm || undefined,
          motivoExcesso: aloc.motivo || undefined,
        });
        if (!res.ok) {
          setErro(res.error);
          return;
        }
        await recarregar();
        const quem = lista.find((p) => p.id === personId)?.nome ?? personId;
        const onde =
          engajamentos.find((e) => e.id === aloc.engagementId)?.codigo ??
          aloc.engagementId;
        setConfirmacao({
          personId,
          texto: `Alocação registrada — ${quem} em ${onde}, ${aloc.percentual}%.`,
        });
        setAlocando(null);
        setAloc(ALOCACAO_VAZIA);
      });
    },
    [alocando, aloc, lista, engajamentos, recarregar]
  );

  const abrirAlocacao = useCallback((id: string) => {
    setConfirmacao(null);
    setAlocando(id);
  }, []);

  const sobrecarregados = lista.filter((p) => p.ocupacaoAtual > 100).length;
  const pessoas = lista.length === 1 ? "1 pessoa" : `${lista.length} pessoas`;
  const subtituloDaEquipe =
    sobrecarregados > 0
      ? `${pessoas} · ${sobrecarregados} acima de 100%`
      : pessoas;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard
        action={
          podeEscrever ? (
            <BotaoPrimario
              full={false}
              onClick={() => setNova((v) => !v)}
              type="button"
            >
              {/* "Fechar": só recolhe o formulário, não desfaz nada. */}
              {nova ? "Fechar" : "Nova pessoa"}
            </BotaoPrimario>
          ) : null
        }
        icon="users"
        subtitle={subtituloDaEquipe}
        title="Equipe"
      >
        {nova ? (
          <FormularioDeCapacidade
            onCriada={(nv) => {
              setLista((atual) => [...atual, nv]);
              setNova(false);
            }}
            onErro={setErro}
          />
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
            Nenhuma pessoa cadastrada. Sem equipe registrada não dá para
            responder se um engajamento novo cabe.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lista.map((p, i) => (
              <Pessoa
                confirmacao={
                  confirmacao?.personId === p.id ? confirmacao.texto : null
                }
                formulario={
                  alocando === p.id ? (
                    <FormularioDeAlocacao
                      aloc={aloc}
                      engajamentos={engajamentos}
                      nome={p.nome}
                      onEnviar={alocar}
                      onFechar={() => setAlocando(null)}
                      onMudar={(parcial) =>
                        setAloc((a) => ({ ...a, ...parcial }))
                      }
                      pendente={pendente}
                    />
                  ) : null
                }
                key={p.id}
                onAlocar={abrirAlocacao}
                p={p}
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
