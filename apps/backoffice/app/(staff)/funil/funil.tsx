"use client";

import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  converterEmProposta,
  criarLead,
  type LeadRow,
  marcarPerdido,
  moverEstagio,
  registrarProximaAcao,
} from "@/app/actions/leads";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";

const ESTAGIOS = ["LEAD", "DISCOVERY", "EVALUATION"] as const;
type EstagioAberto = (typeof ESTAGIOS)[number];

const ROTULO: Record<string, string> = {
  LEAD: "Lead",
  DISCOVERY: "Descoberta",
  EVALUATION: "Avaliação",
};

const TOM: Record<string, Tone> = {
  LEAD: "neutral",
  DISCOVERY: "blue",
  EVALUATION: "amber",
};

const botaoSecundario = {
  padding: "4px 10px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  background: "none",
  color: "var(--ink-muted)",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  cursor: "pointer",
} as const;

function dataLocal(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "";
}

/** Vencida quando a data já passou e o lead ainda está aberto — perdido ou
 *  convertido não precisa mais de destaque, a ação já foi tomada. */
function acaoVencida(l: LeadRow): boolean {
  if (!(l.proximaAcaoEm && !l.propostaId && !l.perdidoEm)) {
    return false;
  }
  return new Date(l.proximaAcaoEm).getTime() < Date.now();
}

/** Estágio ou desfecho do lead. Componente à parte, e não um encadeamento de
 *  ternários: convertido, perdido, editável e só-leitura são quatro estados
 *  mutuamente exclusivos, não uma escala — se-else nomeia cada um. */
function EstagioIndicador({
  l,
  podeEscrever,
  onMover,
}: {
  l: LeadRow;
  podeEscrever: boolean;
  onMover: (id: string, estagio: EstagioAberto) => void;
}) {
  if (l.propostaId) {
    return (
      <Badge dot tone="green">
        Convertido
      </Badge>
    );
  }
  if (l.perdidoEm) {
    return (
      <Badge dot tone="red">
        Perdido
      </Badge>
    );
  }
  if (podeEscrever) {
    return (
      <select
        aria-label={`Estágio de ${l.nome}`}
        onChange={(e) => onMover(l.id, e.target.value as EstagioAberto)}
        style={{ ...INPUT, width: "auto", cursor: "pointer" }}
        value={l.estagio}
      >
        {ESTAGIOS.map((e) => (
          <option key={e} value={e}>
            {ROTULO[e]}
          </option>
        ))}
      </select>
    );
  }
  return (
    <Badge dot tone={TOM[l.estagio] ?? "neutral"}>
      {ROTULO[l.estagio] ?? l.estagio}
    </Badge>
  );
}

function FormAgendarAcao({
  inicialTexto,
  inicialData,
  onSalvar,
}: {
  inicialTexto: string;
  inicialData: string;
  onSalvar: (texto: string, quando: string) => void;
}) {
  const [texto, setTexto] = useState(inicialTexto);
  const [quando, setQuando] = useState(inicialData);

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input
        aria-label="Próxima ação"
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex.: ligar para o contato"
        style={{ ...INPUT, flex: 1, minWidth: 160 }}
        value={texto}
      />
      <input
        aria-label="Data da próxima ação"
        onChange={(e) => setQuando(e.target.value)}
        style={{ ...INPUT, width: "auto" }}
        type="date"
        value={quando}
      />
      <button
        className="btn"
        disabled={texto.trim().length === 0 || quando === ""}
        onClick={() => onSalvar(texto.trim(), quando)}
        style={botaoSecundario}
        type="button"
      >
        Salvar
      </button>
    </div>
  );
}

function FormMarcarPerdido({
  onConfirmar,
}: {
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input
        aria-label="Motivo da perda"
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Por que este lead não avança"
        style={{ ...INPUT, flex: 1, minWidth: 200 }}
        value={motivo}
      />
      <button
        className="btn"
        disabled={motivo.trim().length === 0}
        onClick={() => onConfirmar(motivo.trim())}
        style={botaoSecundario}
        type="button"
      >
        Confirmar perda
      </button>
    </div>
  );
}

/** Nome, contato e o estágio/desfecho — a parte de cima da linha. Separado de
 *  `RodapeLead` só para manter a complexidade de `LinhaLead` sob o teto do
 *  linter: cada metade já é uma árvore de JSX cheia por si só. */
function CabecalhoLead({
  l,
  podeEscrever,
  mostrarAcoesRapidas,
  onMover,
  onConverter,
  onTogglePerdendo,
}: {
  l: LeadRow;
  podeEscrever: boolean;
  mostrarAcoesRapidas: boolean;
  onMover: (id: string, estagio: EstagioAberto) => void;
  onConverter: (id: string) => void;
  onTogglePerdendo: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ flex: 1, minWidth: 160 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
          }}
        >
          {l.nome}
        </span>
        <span style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>
          {[l.contatoNome, l.contatoEmail].filter(Boolean).join(" · ") ||
            "sem contato registrado"}
          {l.origem ? ` · ${l.origem}` : ""}
          {l.donoNome ? ` · dono: ${l.donoNome}` : ""}
        </span>
      </span>

      <EstagioIndicador l={l} onMover={onMover} podeEscrever={podeEscrever} />

      {mostrarAcoesRapidas ? (
        <>
          <button
            className="btn"
            onClick={() => onConverter(l.id)}
            style={botaoSecundario}
            type="button"
          >
            Converter em proposta
          </button>
          <button
            className="btn"
            onClick={onTogglePerdendo}
            style={botaoSecundario}
            type="button"
          >
            Perdido
          </button>
        </>
      ) : null}
    </div>
  );
}

/** A frase de próxima ação com o botão "Definir"/"Cancelar" — extraída de
 *  `RodapeLead` pelo mesmo motivo de `CabecalhoLead`: manter cada peça sob o
 *  teto de complexidade do linter. */
function ParagrafoProximaAcao({
  l,
  podeEscrever,
  vencida,
  agendando,
  onToggleAgendando,
}: {
  l: LeadRow;
  podeEscrever: boolean;
  vencida: boolean;
  agendando: boolean;
  onToggleAgendando: () => void;
}) {
  const texto = l.proximaAcao
    ? `Próxima ação: ${l.proximaAcao} — ${dataLocal(l.proximaAcaoEm)}${vencida ? " (vencida)" : ""}`
    : "Sem próxima ação registrada.";

  return (
    <p
      style={{
        margin: 0,
        fontSize: "var(--fs-nota)",
        fontWeight: vencida ? 700 : 500,
        color: vencida ? "var(--red-text)" : "var(--ink-muted)",
      }}
    >
      {texto}
      {podeEscrever ? (
        <button
          className="btn"
          onClick={onToggleAgendando}
          style={{ ...botaoSecundario, marginLeft: 8 }}
          type="button"
        >
          {agendando ? "Cancelar" : "Definir"}
        </button>
      ) : null}
    </p>
  );
}

/** Motivo da perda, próxima ação e os dois formulários inline — a parte de
 *  baixo da linha. */
function RodapeLead({
  l,
  podeEscrever,
  vencida,
  mostrarLinhaDeAcao,
  agendando,
  perdendo,
  onToggleAgendando,
  onAgendar,
  onPerder,
}: {
  l: LeadRow;
  podeEscrever: boolean;
  vencida: boolean;
  mostrarLinhaDeAcao: boolean;
  agendando: boolean;
  perdendo: boolean;
  onToggleAgendando: () => void;
  onAgendar: (texto: string, quando: string) => void;
  onPerder: (motivo: string) => void;
}) {
  return (
    <>
      {l.perdidoEm ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-nota)",
            color: "var(--ink-muted)",
          }}
        >
          Perdido em {dataLocal(l.perdidoEm)} — {l.motivoPerda}
        </p>
      ) : null}

      {mostrarLinhaDeAcao ? (
        <ParagrafoProximaAcao
          agendando={agendando}
          l={l}
          onToggleAgendando={onToggleAgendando}
          podeEscrever={podeEscrever}
          vencida={vencida}
        />
      ) : null}

      {agendando ? (
        <FormAgendarAcao
          inicialData={l.proximaAcaoEm ? l.proximaAcaoEm.slice(0, 10) : ""}
          inicialTexto={l.proximaAcao ?? ""}
          onSalvar={onAgendar}
        />
      ) : null}

      {perdendo ? <FormMarcarPerdido onConfirmar={onPerder} /> : null}
    </>
  );
}

function LinhaLead({
  l,
  primeira,
  podeEscrever,
  onMover,
  onAgendar,
  onPerder,
  onConverter,
}: {
  l: LeadRow;
  primeira: boolean;
  podeEscrever: boolean;
  onMover: (id: string, estagio: EstagioAberto) => void;
  onAgendar: (id: string, texto: string, quando: string) => void;
  onPerder: (id: string, motivo: string) => void;
  onConverter: (id: string) => void;
}) {
  const [agendando, setAgendando] = useState(false);
  const [perdendo, setPerdendo] = useState(false);

  const fechado = Boolean(l.propostaId || l.perdidoEm);
  const vencida = acaoVencida(l);
  const mostrarAcoesRapidas = podeEscrever && !fechado;
  const mostrarLinhaDeAcao =
    !fechado && (Boolean(l.proximaAcao) || podeEscrever);

  return (
    <li
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
        opacity: fechado ? 0.75 : 1,
      }}
    >
      <CabecalhoLead
        l={l}
        mostrarAcoesRapidas={mostrarAcoesRapidas}
        onConverter={onConverter}
        onMover={onMover}
        onTogglePerdendo={() => setPerdendo((v) => !v)}
        podeEscrever={podeEscrever}
      />
      <RodapeLead
        agendando={agendando}
        l={l}
        mostrarLinhaDeAcao={mostrarLinhaDeAcao}
        onAgendar={(texto, quando) => {
          onAgendar(l.id, texto, quando);
          setAgendando(false);
        }}
        onPerder={(motivo) => {
          onPerder(l.id, motivo);
          setPerdendo(false);
        }}
        onToggleAgendando={() => setAgendando((v) => !v)}
        perdendo={perdendo}
        podeEscrever={podeEscrever}
        vencida={vencida}
      />
    </li>
  );
}

export function Funil({
  iniciais,
  podeEscrever,
}: {
  iniciais: LeadRow[];
  podeEscrever: boolean;
}) {
  const router = useRouter();
  const [lista, setLista] = useState(iniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    contatoNome: "",
    contatoEmail: "",
    origem: "",
  });

  // Toda mutação recarrega a lista do servidor em vez de remendar o item
  // localmente: `estagio`, `propostaId` e `perdidoEm` interagem demais entre
  // si (ver `buscarLeadAberto`) para reconstruir o resultado no cliente sem
  // arriscar divergir do que a action decidiu.
  const recarregar = useCallback(() => router.refresh(), [router]);

  const criar = useCallback(async () => {
    setErro(null);
    const res = await criarLead({
      nome: form.nome,
      contatoNome: form.contatoNome || undefined,
      contatoEmail: form.contatoEmail || undefined,
      origem: form.origem || undefined,
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setCriando(false);
    setForm({ nome: "", contatoNome: "", contatoEmail: "", origem: "" });
    recarregar();
  }, [form, recarregar]);

  const mover = useCallback(async (id: string, estagio: EstagioAberto) => {
    setErro(null);
    const res = await moverEstagio({ id, estagio });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setLista((atual) =>
      atual.map((l) => (l.id === id ? { ...l, estagio } : l))
    );
  }, []);

  const agendar = useCallback(
    async (id: string, texto: string, quando: string) => {
      setErro(null);
      const res = await registrarProximaAcao({
        id,
        proximaAcao: texto,
        proximaAcaoEm: quando,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setLista((atual) =>
        atual.map((l) =>
          l.id === id
            ? {
                ...l,
                proximaAcao: texto,
                proximaAcaoEm: new Date(quando).toISOString(),
              }
            : l
        )
      );
    },
    []
  );

  const perder = useCallback(async (id: string, motivo: string) => {
    setErro(null);
    const res = await marcarPerdido({ id, motivoPerda: motivo });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setLista((atual) =>
      atual.map((l) =>
        l.id === id
          ? { ...l, perdidoEm: new Date().toISOString(), motivoPerda: motivo }
          : l
      )
    );
  }, []);

  const converter = useCallback(
    async (id: string) => {
      setErro(null);
      const res = await converterEmProposta({ id });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      // A proposta nasce sem item — quem escolhe o que vender é o gerador.
      // Deixar o funil e abrir direto lá evita que a conversão termine numa
      // lista sem indicar o que fazer a seguir.
      router.push(`/propostas/${res.data.id}`);
    },
    [router]
  );

  const podeCriar = form.nome.trim().length >= 2;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard
        action={
          podeEscrever ? (
            <BotaoPrimario
              full={false}
              onClick={() => setCriando((v) => !v)}
              type="button"
            >
              {criando ? "Cancelar" : "Novo lead"}
            </BotaoPrimario>
          ) : null
        }
        icon="filter"
        subtitle={`${lista.length} lead(s)`}
        title="Funil"
      >
        {criando ? (
          <div
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
              <Campo htmlFor="l-nome" label="Organização">
                <input
                  id="l-nome"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nome: e.target.value }))
                  }
                  style={INPUT}
                  value={form.nome}
                />
              </Campo>
              <Campo htmlFor="l-contato" label="Contato (opcional)">
                <input
                  id="l-contato"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contatoNome: e.target.value }))
                  }
                  style={INPUT}
                  value={form.contatoNome}
                />
              </Campo>
              <Campo htmlFor="l-email" label="E-mail (opcional)">
                <input
                  id="l-email"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contatoEmail: e.target.value }))
                  }
                  style={INPUT}
                  type="email"
                  value={form.contatoEmail}
                />
              </Campo>
              <Campo htmlFor="l-origem" label="Origem (opcional)">
                <input
                  id="l-origem"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, origem: e.target.value }))
                  }
                  placeholder="indicação, evento, inbound…"
                  style={INPUT}
                  value={form.origem}
                />
              </Campo>
            </div>

            <BotaoPrimario
              disabled={!podeCriar}
              full={false}
              onClick={criar}
              type="button"
            >
              Criar lead
            </BotaoPrimario>
          </div>
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
            Nenhum lead ainda. Um lead nasce em LEAD e sai do funil de dois
            jeitos: convertido em proposta, ou perdido com o motivo registrado.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lista.map((l, i) => (
              <LinhaLead
                key={l.id}
                l={l}
                onAgendar={agendar}
                onConverter={converter}
                onMover={mover}
                onPerder={perder}
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
