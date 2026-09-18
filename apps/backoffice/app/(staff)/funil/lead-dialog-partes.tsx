"use client";

import type { ProductModule } from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import type { Tone } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { LeadRow } from "@/app/actions/leads";
import { BotaoPrimario, BotaoSecundario, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { WriteButton } from "@/components/write-button";
import { formatarBRL } from "@/lib/comercial/formato";
import {
  type ConfigEstagio,
  ESTAGIOS,
  type Estagio,
  INFO_ESTAGIO,
  type LeadFunil,
  MOTIVOS_PERDA,
  type MotivoPerda,
  PORTAS,
  podeConverter,
  podeMover,
  valorDoLead,
} from "@/lib/comercial/funil";
import { tomCss } from "@/lib/tom";

/**
 * Peças do diálogo do lead — extraídas de lead-dialog.tsx para o arquivo
 * principal não crescer para o tamanho do board (spec §4, design `LeadModal`
 * de backoffice-funnel.jsx).
 */

const NOTA_MINIMA = 12;

export function notaValida(nota: string): boolean {
  return nota.trim().length >= NOTA_MINIMA;
}

const LINK_PRIMARIO: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 15px",
  borderRadius: "var(--r-md)",
  fontSize: "var(--fs-forte)",
  fontWeight: 600,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "var(--accent-fg)",
  textDecoration: "none",
};

/** Tom do passo do stepper: perda vence tudo; senão o tom do estágio, com
 *  "neutral" (LEAD) mapeado para azul por `tomCss` — dois casos
 *  independentes, não uma escala (por isso `if`, não ternário encadeado). */
function tomDoPasso(perdeuAqui: boolean, tomDoEstagio: Tone): Tone {
  if (perdeuAqui) {
    return "red";
  }
  return tomCss(tomDoEstagio);
}

function PassoDoStepper({
  codigo,
  indice,
  pesoPercent,
  feito,
  perdeuAqui,
  destaque,
}: {
  codigo: Estagio;
  indice: number;
  pesoPercent: number;
  feito: boolean;
  perdeuAqui: boolean;
  destaque: boolean;
}) {
  const info = INFO_ESTAGIO[codigo];
  const tom = tomDoPasso(perdeuAqui, info.tom);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "8px 10px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${destaque ? `var(--${tom})` : "var(--hairline)"}`,
        background: destaque ? "var(--surface-2)" : "transparent",
      }}
    >
      <span
        className="mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10.5,
          fontWeight: 700,
          color: destaque ? `var(--${tom}-text)` : "var(--ink-faint)",
        }}
      >
        {feito ? (
          <Icon name="check" size={10} strokeWidth={3} />
        ) : (
          `0${indice + 1}`
        )}
        {" · "}
        {pesoPercent}%
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: destaque ? `var(--${tom}-text)` : "var(--ink-muted)",
        }}
      >
        {info.rotulo}
        {perdeuAqui ? " · perdido" : ""}
      </span>
    </div>
  );
}

/** Stepper dos 4 estágios com peso — o atual (ou o da perda) com borda no
 *  tom; os anteriores marcados como feitos. */
export function Stepper({
  estagio,
  estagios,
  perdidoNoEstagio,
}: {
  estagio: Estagio;
  estagios: ConfigEstagio[];
  perdidoNoEstagio: string | null;
}) {
  const atual = (perdidoNoEstagio ?? estagio) as Estagio;
  const indiceAtual = ESTAGIOS.indexOf(atual);

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {ESTAGIOS.map((codigo, i) => {
        const perdeuAqui = perdidoNoEstagio === codigo;
        return (
          <PassoDoStepper
            codigo={codigo}
            destaque={i === indiceAtual || perdeuAqui}
            feito={i < indiceAtual}
            indice={i}
            key={codigo}
            perdeuAqui={perdeuAqui}
            pesoPercent={
              estagios.find((e) => e.codigo === codigo)?.pesoPercent ?? 0
            }
          />
        );
      })}
    </div>
  );
}

/** Os 4 cartões: Valor, Ponderado, Entrada, Origem. */
export function CartoesResumo({
  lead,
  leadFunil,
  estagios,
}: {
  lead: LeadRow;
  leadFunil: LeadFunil;
  estagios: ConfigEstagio[];
}) {
  const cfg = estagios.find((e) => e.codigo === lead.estagio);
  const valor = valorDoLead(leadFunil);
  const ponderado = cfg ? Math.round((valor * cfg.pesoPercent) / 100) : 0;
  const porta = lead.entrada
    ? PORTAS[lead.entrada as ProductModule]
    : undefined;
  const cac = lead.canal?.cacMedioCentavos ?? null;

  const cartoes = [
    {
      rotulo: "Valor",
      valor: valor > 0 ? formatarBRL(valor) : "—",
      dica: lead.proposta ? "da proposta" : "estimado",
    },
    {
      rotulo: "Ponderado",
      valor: valor > 0 ? formatarBRL(ponderado) : "—",
      dica: cfg ? `${cfg.pesoPercent}%` : "—",
    },
    {
      rotulo: "Entrada",
      valor: porta ? `${porta.degrau} ${porta.rotulo}` : "—",
      dica: porta?.dica ?? "—",
    },
    {
      rotulo: "Origem",
      valor: lead.canal?.nome ?? lead.origem ?? "—",
      dica: cac === null ? "sem custo" : `CAC ${formatarBRL(cac)}`,
    },
  ];

  return (
    <div className="bo-kpis" style={{ gap: 10 }}>
      {cartoes.map((c) => (
        <div
          key={c.rotulo}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            padding: "9px 11px",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            {c.rotulo}
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>{c.valor}</span>
          <span style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>
            {c.dica}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Estágio Proposta: o funil não tem passo próprio aqui — lê a proposta. */
export function BlocoProposta({ lead }: { lead: LeadRow }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
        Neste estágio o funil não tem passo próprio — ele lê o status de{" "}
        {lead.proposta?.numero ?? "—"}.
      </span>
      {lead.proposta ? (
        <Link href={`/propostas/${lead.proposta.id}`} style={LINK_PRIMARIO}>
          Abrir proposta
        </Link>
      ) : null}
    </div>
  );
}

/** Bloco "Próximo passo": dias no estágio × teto, texto/data ou edição. */
export function BlocoProximoPasso({
  lead,
  dias,
  teto,
  vencido,
  podeEscrever,
  editando,
  texto,
  data,
  pendente,
  onTexto,
  onData,
  onIniciar,
  onCancelar,
  onSalvar,
}: {
  lead: LeadRow;
  dias: number;
  teto: number;
  vencido: boolean;
  podeEscrever: boolean;
  editando: boolean;
  texto: string;
  data: string;
  pendente: boolean;
  onTexto: (v: string) => void;
  onData: (v: string) => void;
  onIniciar: () => void;
  onCancelar: () => void;
  onSalvar: () => void;
}) {
  const cabecalho = (
    <span
      className="mono"
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: vencido ? "var(--red-text)" : "var(--ink-faint)",
      }}
    >
      {dias} d neste estágio (teto {teto} d)
    </span>
  );

  if (editando) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cabecalho}
        <input
          onChange={(e) => onTexto(e.target.value)}
          placeholder="O que fazer a seguir"
          style={INPUT}
          value={texto}
        />
        <input
          onChange={(e) => onData(e.target.value)}
          style={INPUT}
          type="date"
          value={data}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <BotaoSecundario disabled={pendente} onClick={onCancelar}>
            Cancelar
          </BotaoSecundario>
          <BotaoPrimario
            disabled={pendente || !texto.trim() || !data}
            full={false}
            onClick={onSalvar}
            type="button"
          >
            {pendente ? "Salvando…" : "Salvar"}
          </BotaoPrimario>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {cabecalho}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        {lead.proximaAcao ? (
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>
            {lead.proximaAcao}
            {lead.proximaAcaoEm
              ? ` — ${new Date(lead.proximaAcaoEm).toLocaleDateString("pt-BR")}`
              : ""}
          </span>
        ) : (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--amber-text)",
            }}
          >
            Sem próximo passo. Lead sem passo é lead parado.
          </span>
        )}
        {podeEscrever ? (
          <BotaoSecundario onClick={onIniciar}>Editar</BotaoSecundario>
        ) : null}
      </div>
    </div>
  );
}

/** Caixa fechada: perdido (vermelha, com motivo e nota) ou ganho (verde, com
 *  o cliente — ou a proposta, enquanto o tenant não foi provisionado). */
export function BlocoFechado({ lead }: { lead: LeadRow }) {
  if (lead.situacao === "PERDIDO") {
    const codigo = (lead.perdidoNoEstagio ?? lead.estagio) as Estagio;
    const motivo = lead.motivoPerda as MotivoPerda | null;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "11px 13px",
          borderRadius: "var(--r-md)",
          border: "1px solid rgba(var(--red-rgb),.3)",
          background: "var(--red-soft)",
          color: "var(--red-text)",
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>
          Perdido em {INFO_ESTAGIO[codigo]?.rotulo ?? codigo}
          {motivo ? ` · ${MOTIVOS_PERDA[motivo]}` : ""}
        </span>
        {lead.notaPerda ? (
          <span style={{ fontSize: 12, fontWeight: 500 }}>
            {lead.notaPerda}
          </span>
        ) : null}
      </div>
    );
  }

  if (lead.situacao === "GANHO") {
    const slug = lead.proposta?.tenantProvisionadoSlug ?? null;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "11px 13px",
          borderRadius: "var(--r-md)",
          border: "1px solid rgba(var(--green-rgb),.3)",
          background: "var(--green-soft)",
          color: "var(--green-text)",
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>
          {lead.proposta?.numero} virou cliente
        </span>
        <Link
          href={slug ? `/clientes/${slug}` : `/propostas/${lead.proposta?.id}`}
          style={{ fontSize: 12, fontWeight: 700, color: "inherit" }}
        >
          {slug
            ? "Abrir cliente"
            : "Aguardando provisionamento — abrir proposta"}
        </Link>
      </div>
    );
  }

  return null;
}

const ESTILO_CHIP_MOTIVO = (ativo: boolean): CSSProperties => ({
  padding: "5px 11px",
  borderRadius: 99,
  fontSize: "var(--fs-nota)",
  fontWeight: 700,
  fontFamily: "inherit",
  cursor: "pointer",
  background: ativo ? "var(--red-soft)" : "var(--surface-2)",
  border: `1px solid ${ativo ? "rgba(var(--red-rgb),.45)" : "var(--hairline)"}`,
  color: ativo ? "var(--red-text)" : "var(--ink-muted)",
});

/** Modo perda: chips de motivo (seleção única) + nota com contador. */
export function ModoPerda({
  motivo,
  nota,
  onMotivo,
  onNota,
}: {
  motivo: MotivoPerda | null;
  nota: string;
  onMotivo: (m: MotivoPerda) => void;
  onNota: (v: string) => void;
}) {
  return (
    <fieldset
      style={{
        margin: 0,
        padding: 0,
        border: "none",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <legend
        className="mono"
        style={{
          padding: 0,
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        Motivo da perda
      </legend>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(Object.keys(MOTIVOS_PERDA) as MotivoPerda[]).map((codigo) => (
          <button
            aria-pressed={motivo === codigo}
            key={codigo}
            onClick={() => onMotivo(codigo)}
            style={ESTILO_CHIP_MOTIVO(motivo === codigo)}
            type="button"
          >
            {MOTIVOS_PERDA[codigo]}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label className="sr-only" htmlFor="lead-nota-perda">
          O que aconteceu
        </label>
        <textarea
          id="lead-nota-perda"
          onChange={(e) => onNota(e.target.value)}
          placeholder="O que aconteceu — mínimo 12 caracteres"
          rows={3}
          style={{ ...INPUT, fontWeight: 500, resize: "vertical" }}
          value={nota}
        />
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            alignSelf: "flex-end",
            color: notaValida(nota) ? "var(--ink-faint)" : "var(--red-text)",
          }}
        >
          {nota.trim().length}/{NOTA_MINIMA}
        </span>
      </div>
    </fieldset>
  );
}

/** Ação da direita: Abrir proposta (Proposta) · Converter (Avaliação) ·
 *  Avançar (senão) — três casos mutuamente exclusivos, não uma escala. */
function AcaoPrincipal({
  lead,
  leadFunil,
  proximo,
  podeEscrever,
  pendente,
  perguntandoConversao = false,
  onConverter,
  onAvancar,
}: {
  lead: LeadRow;
  leadFunil: LeadFunil;
  proximo: Estagio | null;
  podeEscrever: boolean;
  pendente: boolean;
  /** Soltar em Proposta no board abre o diálogo já na pergunta. */
  perguntandoConversao?: boolean;
  onConverter: () => void;
  onAvancar: () => void;
}) {
  if (lead.estagio === "PROPOSAL") {
    if (!lead.proposta) {
      return null;
    }
    return (
      <Link href={`/propostas/${lead.proposta.id}`} style={LINK_PRIMARIO}>
        Abrir proposta
      </Link>
    );
  }
  if (podeConverter(leadFunil)) {
    // Converter é sem volta: o servidor nunca mais deixa mover o lead. O
    // diálogo já está aberto, então a barreira é inline — alvo e consequência
    // na mesma prosa das outras.
    if (!podeEscrever) {
      return <WriteButton canWrite={false}>Converter em proposta</WriteButton>;
    }
    return (
      <ConfirmarAcao
        aberto={perguntandoConversao}
        alvo={lead.nome}
        consequencia="O lead sai do funil e vira rascunho de proposta; não volta."
        executando={pendente}
        onConfirmar={onConverter}
        rotulo={pendente ? "Convertendo…" : "Converter em proposta"}
        tom="accent"
      />
    );
  }
  if (podeMover(leadFunil) && proximo) {
    return (
      <WriteButton
        canWrite={podeEscrever}
        disabled={pendente}
        onClick={onAvancar}
      >
        {pendente
          ? "Avançando…"
          : `Avançar para ${INFO_ESTAGIO[proximo].rotulo}`}
      </WriteButton>
    );
  }
  return null;
}

/** Rodapé por estado: fechado → Fechar; modo perda → Cancelar/Registrar;
 *  normal → Marcar perdido + AcaoPrincipal. */
export function RodapeLeadDialog({
  lead,
  leadFunil,
  proximo,
  podeEscrever,
  pendente,
  modoPerda,
  perguntandoConversao,
  motivo,
  nota,
  onEntrarModoPerda,
  onSairModoPerda,
  onRegistrarPerda,
  onAvancar,
  onConverter,
  onFechar,
}: {
  lead: LeadRow;
  leadFunil: LeadFunil;
  proximo: Estagio | null;
  podeEscrever: boolean;
  pendente: boolean;
  modoPerda: boolean;
  perguntandoConversao?: boolean;
  motivo: MotivoPerda | null;
  nota: string;
  onEntrarModoPerda: () => void;
  onSairModoPerda: () => void;
  onRegistrarPerda: () => void;
  onAvancar: () => void;
  onConverter: () => void;
  onFechar: () => void;
}) {
  if (lead.situacao !== "ATIVO") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <BotaoSecundario onClick={onFechar}>Fechar</BotaoSecundario>
      </div>
    );
  }

  if (modoPerda) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <BotaoSecundario disabled={pendente} onClick={onSairModoPerda}>
          Cancelar
        </BotaoSecundario>
        <BotaoPrimario
          disabled={pendente || !motivo || !notaValida(nota)}
          full={false}
          onClick={onRegistrarPerda}
          type="button"
        >
          {pendente ? "Registrando…" : "Registrar perda"}
        </BotaoPrimario>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <WriteButton
        canWrite={podeEscrever}
        disabled={pendente}
        onClick={onEntrarModoPerda}
      >
        Marcar perdido
      </WriteButton>
      <AcaoPrincipal
        lead={lead}
        leadFunil={leadFunil}
        onAvancar={onAvancar}
        onConverter={onConverter}
        pendente={pendente}
        perguntandoConversao={perguntandoConversao}
        podeEscrever={podeEscrever}
        proximo={proximo}
      />
    </div>
  );
}
