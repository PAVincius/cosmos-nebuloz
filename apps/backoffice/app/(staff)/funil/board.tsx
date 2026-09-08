"use client";

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { Avatar, type Tone } from "@repo/design-system/cosmos/kit";
import { type DragEvent, useState } from "react";
import type { LeadRow } from "@/app/actions/leads";
import { Erro } from "@/components/campo";
import { formatarBRL } from "@/lib/comercial/formato";
import {
  type ConfigEstagio,
  diasNoEstagio,
  ESTAGIOS,
  type Estagio,
  type EstagioAberto,
  estagnado,
  INFO_ESTAGIO,
  paraLeadFunil,
  SEM_PROXIMO_PASSO,
  textoEntradaOrigem,
  valorDoLead,
} from "@/lib/comercial/funil";
import { tomCss } from "@/lib/tom";

/**
 * Pipeline board (spec §4, design `PipelineBoard` de backoffice-funnel.jsx).
 *
 * Componente de apresentação puro: recebe `leads`/`estagios`/`hoje` já lidos
 * pelo controlador (`funil.tsx`) e devolve intenção por callback — nenhuma
 * chamada de action mora aqui. `LeadRow` → `LeadFunil` é convertido por
 * `paraLeadFunil` (`lib/comercial/funil.ts`) porque as regras puras do funil
 * não conhecem a forma da leitura do servidor.
 */

type Coluna = {
  codigo: Estagio;
  rotulo: string;
  tom: Tone;
  leads: LeadRow[];
  somaCentavos: number;
  pesoPercent: number;
  ponderadoCentavos: number;
};

function construirColunas(
  leads: LeadRow[],
  estagios: ConfigEstagio[],
  hoje: Date
): Coluna[] {
  const ativos = leads.filter((l) => l.situacao === "ATIVO");
  return ESTAGIOS.map((codigo) => {
    const cfg = estagios.find((e) => e.codigo === codigo);
    const pesoPercent = cfg?.pesoPercent ?? 0;
    const doEstagio = ativos
      .filter((l) => l.estagio === codigo)
      .sort(
        (a, b) =>
          diasNoEstagio(b.estagioDesde, hoje) -
          diasNoEstagio(a.estagioDesde, hoje)
      );
    const somaCentavos = doEstagio.reduce(
      (soma, l) => soma + valorDoLead(paraLeadFunil(l)),
      0
    );
    return {
      codigo,
      rotulo: INFO_ESTAGIO[codigo].rotulo,
      tom: INFO_ESTAGIO[codigo].tom,
      leads: doEstagio,
      somaCentavos,
      pesoPercent,
      ponderadoCentavos: Math.round((somaCentavos * pesoPercent) / 100),
    };
  });
}

/** Tom do próximo passo: âmbar quando falta passo (fora de proposta), vermelho
 *  acima do teto, verde no resto — não é uma escala, são três casos
 *  mutuamente exclusivos (por isso `if`, não ternário encadeado). */
function tomProximoPasso(
  temPasso: boolean,
  codigo: Estagio,
  vencido: boolean
): Tone {
  if (!temPasso && codigo !== "PROPOSAL") {
    return "amber";
  }
  if (vencido) {
    return "red";
  }
  return "green";
}

function iconeProximoPasso(codigo: Estagio, tom: Tone): IconName {
  if (codigo === "PROPOSAL") {
    return "tag";
  }
  return tom === "amber" ? "alert" : "clock";
}

function textoProximoPasso(l: LeadRow): string {
  if (l.proximaAcaoEm) {
    return new Date(l.proximaAcaoEm).toLocaleDateString("pt-BR");
  }
  if (l.estagio === "PROPOSAL" && l.proposta) {
    return `lê ${l.proposta.numero}`;
  }
  return SEM_PROXIMO_PASSO;
}

function CartaoLead({
  lead,
  tomColuna,
  podeEscrever,
  arrastando,
  vencido,
  dias,
  valorTexto,
  onAbrirLead,
  onDragStartCard,
  onDragEndCard,
}: {
  lead: LeadRow;
  tomColuna: Tone;
  podeEscrever: boolean;
  arrastando: boolean;
  vencido: boolean;
  dias: number;
  valorTexto: string;
  onAbrirLead: (id: string) => void;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
}) {
  const codigo = lead.estagio as Estagio;
  const tomPasso = tomProximoPasso(
    Boolean(lead.proximaAcaoEm),
    codigo,
    vencido
  );
  const icone = iconeProximoPasso(codigo, tomPasso);
  // Um lead em PROPOSAL nunca sai de lá pelo board — o servidor sempre
  // recusa mover um lead que já tem proposta — então soltar o card nunca
  // teria efeito. Arrastável só induziria a pessoa a tentar.
  const podeArrastar = podeEscrever && codigo !== "PROPOSAL";

  return (
    <button
      aria-label={`Abrir lead ${lead.nome}`}
      className="btn"
      draggable={podeArrastar}
      onClick={() => onAbrirLead(lead.id)}
      onDragEnd={onDragEndCard}
      onDragStart={() => onDragStartCard(lead.id)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        width: "100%",
        padding: "10px 11px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${vencido ? "rgba(var(--red-rgb),.38)" : "var(--hairline)"}`,
        background: vencido ? "rgba(var(--red-rgb),.08)" : "var(--surface)",
        opacity: arrastando ? 0.45 : 1,
        cursor: podeEscrever ? "grab" : "pointer",
        font: "inherit",
        textAlign: "left",
        color: "inherit",
      }}
      type="button"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 12.5,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {lead.nome}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 10.5,
              color: "var(--ink-faint)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {textoEntradaOrigem(lead)}
          </span>
        </span>
        {vencido ? (
          <span
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: "var(--red-text)",
              flexShrink: 0,
            }}
          >
            {dias} d
          </span>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: valorTexto === "—" ? "var(--ink-faint)" : "var(--ink)",
          }}
        >
          {valorTexto}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10.5,
              fontWeight: 700,
              color: `var(--${tomPasso}-text)`,
            }}
          >
            <Icon name={icone} size={11} strokeWidth={2.2} />
            {textoProximoPasso(lead)}
          </span>
          <Avatar
            name={lead.donoNome ?? undefined}
            size={20}
            tone={tomColuna}
          />
        </span>
      </div>
    </button>
  );
}

function ColunaDoEstagio({
  coluna,
  podeEscrever,
  arrastando,
  sobreColuna,
  hoje,
  estagios,
  onAbrirEstagio,
  onAbrirLead,
  onDragStartCard,
  onDragEndCard,
  onDragOverColuna,
  onDragLeaveColuna,
  onDropColuna,
}: {
  coluna: Coluna;
  podeEscrever: boolean;
  arrastando: string | null;
  sobreColuna: boolean;
  hoje: Date;
  estagios: ConfigEstagio[];
  onAbrirEstagio: (codigo: Estagio) => void;
  onAbrirLead: (id: string) => void;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onDragOverColuna: () => void;
  onDragLeaveColuna: () => void;
  onDropColuna: () => void;
}) {
  // Handlers fora do JSX, não ternário inline: o `noLeakedRender` do biome
  // sinaliza qualquer ternário dentro de um atributo JSX, mesmo quando o
  // resultado nunca é renderizado (aqui é um handler de evento, não um nó).
  const aoArrastarSobre = podeEscrever
    ? (e: DragEvent<HTMLFieldSetElement>) => {
        e.preventDefault();
        onDragOverColuna();
      }
    : undefined;
  const aoSoltar = podeEscrever
    ? (e: DragEvent<HTMLFieldSetElement>) => {
        e.preventDefault();
        onDropColuna();
      }
    : undefined;

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: alvo nativo de drag-and-drop HTML5, sem equivalente de teclado — cartão e cabeçalho (buttons) cobrem o resto
    <fieldset
      aria-label={`Coluna ${coluna.rotulo}`}
      onDragLeave={onDragLeaveColuna}
      onDragOver={aoArrastarSobre}
      onDrop={aoSoltar}
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        margin: 0,
        padding: 0,
        borderRadius: "var(--r-lg)",
        border: `1px ${sobreColuna ? "dashed" : "solid"} var(--hairline)`,
        background: sobreColuna ? "var(--surface-3)" : "var(--surface-2)",
        transition: "border-color .15s, background .15s",
      }}
    >
      <button
        aria-label={`Abrir estágio ${coluna.rotulo}`}
        className="btn"
        onClick={() => onAbrirEstagio(coluna.codigo)}
        style={{
          textAlign: "left",
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg) var(--r-lg) 0 0",
          padding: "10px 12px 9px",
          color: "var(--ink)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
        type="button"
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: `var(--${tomCss(coluna.tom)})`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {coluna.rotulo}
            </span>
          </span>
          <span
            className="mono"
            style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)" }}
          >
            {coluna.leads.length}
          </span>
        </span>
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-muted)" }}
        >
          {formatarBRL(coluna.somaCentavos)}{" "}
          <span style={{ color: "var(--ink-faint)" }}>
            · {coluna.pesoPercent}% → {formatarBRL(coluna.ponderadoCentavos)}
          </span>
        </span>
      </button>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 8,
          minHeight: 120,
          flex: 1,
        }}
      >
        {coluna.leads.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              border: "1px dashed var(--hairline)",
              borderRadius: 10,
              fontSize: 11.5,
              color: "var(--ink-faint)",
              padding: 12,
              textAlign: "center",
            }}
          >
            {sobreColuna ? "Soltar aqui" : "Vazio"}
          </div>
        ) : null}
        {coluna.leads.map((l) => {
          const leadFunil = paraLeadFunil(l);
          const vencido = estagnado(leadFunil, estagios, hoje);
          const dias = diasNoEstagio(l.estagioDesde, hoje);
          const valor = valorDoLead(leadFunil);
          const valorTexto = valor > 0 ? formatarBRL(valor) : "—";
          return (
            <CartaoLead
              arrastando={arrastando === l.id}
              dias={dias}
              key={l.id}
              lead={l}
              onAbrirLead={onAbrirLead}
              onDragEndCard={onDragEndCard}
              onDragStartCard={onDragStartCard}
              podeEscrever={podeEscrever}
              tomColuna={coluna.tom}
              valorTexto={valorTexto}
              vencido={vencido}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

export function Board({
  leads,
  estagios,
  hoje,
  podeEscrever,
  onAbrirEstagio,
  onAbrirLead,
  onMover,
  onConverter,
  onPerder,
}: {
  leads: LeadRow[];
  estagios: ConfigEstagio[];
  hoje: Date;
  podeEscrever: boolean;
  onAbrirEstagio: (codigo: Estagio) => void;
  onAbrirLead: (id: string) => void;
  onMover: (id: string, estagio: EstagioAberto) => void;
  onConverter: (id: string) => void;
  onPerder: (id: string) => void;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const colunas = construirColunas(leads, estagios, hoje);

  function iniciarArraste(id: string) {
    setMensagem(null);
    setArrastando(id);
  }

  function finalizarArraste() {
    setArrastando(null);
    setSobre(null);
  }

  function soltarEmColuna(codigo: Estagio) {
    setSobre(null);
    if (!arrastando) {
      return;
    }
    const lead = leads.find((l) => l.id === arrastando);
    setArrastando(null);
    if (!lead) {
      return;
    }
    if (lead.estagio === codigo) {
      return;
    }
    if (codigo === "PROPOSAL") {
      if (lead.estagio === "EVALUATION") {
        setMensagem(null);
        onConverter(lead.id);
      } else {
        setMensagem("Só um lead em Avaliação vira proposta.");
      }
      return;
    }
    setMensagem(null);
    onMover(lead.id, codigo);
  }

  function soltarEmGanho() {
    setSobre(null);
    setArrastando(null);
    setMensagem("Ganho só via proposta aceita.");
  }

  function soltarEmPerdido() {
    setSobre(null);
    if (!arrastando) {
      return;
    }
    const id = arrastando;
    setArrastando(null);
    onPerder(id);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {mensagem ? <Erro>{mensagem}</Erro> : null}
      {estagios.length === 0 ? (
        <Erro>Estágios não configurados — rode o seed.</Erro>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(210px, 1fr))",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        {colunas.map((coluna) => (
          <ColunaDoEstagio
            arrastando={arrastando}
            coluna={coluna}
            estagios={estagios}
            hoje={hoje}
            key={coluna.codigo}
            onAbrirEstagio={onAbrirEstagio}
            onAbrirLead={onAbrirLead}
            onDragEndCard={finalizarArraste}
            onDragLeaveColuna={() => setSobre(null)}
            onDragOverColuna={() => setSobre(coluna.codigo)}
            onDragStartCard={iniciarArraste}
            onDropColuna={() => soltarEmColuna(coluna.codigo)}
            podeEscrever={podeEscrever}
            sobreColuna={sobre === coluna.codigo}
          />
        ))}
      </div>

      {podeEscrever ? (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: alvo nativo de drag-and-drop, mesmo motivo da coluna acima */}
          <fieldset
            aria-label="Soltar para marcar ganho"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              soltarEmGanho();
            }}
            style={{
              margin: 0,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px dashed rgba(var(--green-rgb),.35)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--green-text)",
            }}
          >
            <Icon name="check" size={13} />
            <span>Ganho</span>
            <span style={{ fontWeight: 500, color: "var(--ink-faint)" }}>
              · só via proposta ganha
            </span>
          </fieldset>
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: alvo nativo de drag-and-drop, mesmo motivo da coluna acima */}
          <fieldset
            aria-label="Soltar para marcar perdido"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              soltarEmPerdido();
            }}
            style={{
              margin: 0,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px dashed rgba(var(--red-rgb),.35)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--red-text)",
            }}
          >
            <Icon name="ban" size={13} />
            <span>Perdido</span>
            <span style={{ fontWeight: 500, color: "var(--ink-faint)" }}>
              · solte para registrar o motivo
            </span>
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}
