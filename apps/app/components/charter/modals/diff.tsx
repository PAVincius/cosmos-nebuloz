"use client";

// modals/diff.tsx — DiffModal (FR-2.6). Movido de modals.tsx no split em um
// arquivo por modal; anatomia preservada 1:1.
//
// O corpo deixou de ser duas colunas com um excerto de 180 caracteres cada e
// virou diff unificado sobre os segmentos de `lib/charter/diff`: linha mudada
// aparece nos dois estados, linha intocada fica em tom neutro e o trecho longe
// da mudança entra colapsado com a contagem. Linha longa reescrita mostra as
// marcas por palavra — é o que impede "tudo mudou" em seção de parágrafo só.

import { Icon } from "@repo/design-system/cosmos/icons";
import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import type {
  VersionDiff,
  VersionDiffRow,
} from "@/app/(charter)/actions/policy";
import {
  agruparSegmentos,
  type BlocoDiff,
  type ParteSegmento,
  type Segmento,
  type TipoSegmento,
} from "@/lib/charter/diff";
import { TableHead } from "../base";
import { Callout, FooterHint, Kbd } from "../form-kit";
import { ModalShell } from "../modal";
import { FS } from "../type-scale";

// ── 6. DiffModal (FR-2.6) ─────────────────────────────────────────────────────

const MARCA: Record<
  TipoSegmento,
  { sinal: string; cor: string; fundo: string }
> = {
  removida: { sinal: "−", cor: "var(--red-text)", fundo: "var(--red-soft)" },
  adicionada: {
    sinal: "+",
    cor: "var(--green-text)",
    fundo: "var(--green-soft)",
  },
  igual: { sinal: "", cor: "var(--ink-muted)", fundo: "transparent" },
};

const chaveDoSegmento = (s: Segmento) =>
  `${s.tipo}-${s.linhaAntes ?? "-"}-${s.linhaDepois ?? "-"}`;

/** Chave pela posição em caracteres: as partes são contíguas e não repetem. */
function comChaves(partes: ParteSegmento[]) {
  let pos = 0;
  return partes.map((p) => {
    const chave = `${p.tipo}-${pos}`;
    pos += p.texto.length;
    return { ...p, chave };
  });
}

function ParteInline({ parte }: { parte: ParteSegmento }) {
  if (parte.tipo === "igual") {
    return <span style={{ color: "var(--ink-muted)" }}>{parte.texto}</span>;
  }
  const marca = MARCA[parte.tipo];
  return (
    <span
      style={{
        color: marca.cor,
        background: marca.fundo,
        fontWeight: 700,
        borderRadius: 4,
        padding: "0 2px",
      }}
    >
      {parte.texto}
    </span>
  );
}

function LinhaDoDiff({ segmento }: { segmento: Segmento }) {
  const marca = MARCA[segmento.tipo];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "12px 1fr",
        gap: 8,
        padding: "3px 12px",
        background: marca.fundo,
        color: marca.cor,
        fontSize: FS.nota,
        lineHeight: 1.55,
      }}
    >
      <span
        aria-hidden="true"
        className="mono"
        style={{ color: "var(--ink-faint)", fontSize: FS.nota }}
      >
        {marca.sinal}
      </span>
      <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {segmento.partes
          ? comChaves(segmento.partes).map((p) => (
              <ParteInline key={p.chave} parte={p} />
            ))
          : segmento.texto}
      </span>
    </div>
  );
}

function BlocoColapsavel({ bloco }: { bloco: BlocoDiff }) {
  const [aberto, setAberto] = useState(false);
  const rotulo =
    bloco.linhas === 1
      ? "1 linha sem alteração"
      : `${bloco.linhas} linhas sem alteração`;

  return (
    <>
      <button
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          border: "none",
          borderTop: "1px solid var(--hairline)",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--surface-2)",
          padding: "5px 12px",
          fontSize: FS.micro,
          color: "var(--ink-faint)",
          cursor: "pointer",
          textAlign: "left",
        }}
        type="button"
      >
        <Icon name={aberto ? "chevronDown" : "chevronRight"} size={13} />
        {rotulo}
      </button>
      {aberto &&
        bloco.segmentos.map((s) => (
          <LinhaDoDiff key={chaveDoSegmento(s)} segmento={s} />
        ))}
    </>
  );
}

function Selo({ texto }: { texto: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: FS.micro,
        fontWeight: 700,
        letterSpacing: ".05em",
        textTransform: "uppercase",
        color: "var(--ink-faint)",
        border: "1px solid var(--hairline)",
        borderRadius: 5,
        padding: "1px 6px",
      }}
    >
      {texto}
    </span>
  );
}

function CampoDoDiff({ row }: { row: VersionDiffRow }) {
  return (
    <div style={{ borderTop: "1px solid var(--hairline)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px 6px",
          fontSize: FS.nota,
          fontWeight: 700,
          color: "var(--ink)",
        }}
      >
        {row.field}
        {row.nova && <Selo texto="seção nova" />}
      </div>
      {row.truncado && (
        <div
          style={{
            padding: "0 12px 6px",
            fontSize: FS.micro,
            color: "var(--ink-faint)",
          }}
        >
          Texto grande: {row.linhasOmitidas} linhas não comparadas.
        </div>
      )}
      {agruparSegmentos(row.segmentos).map((bloco) =>
        bloco.tipo === "colapsado" ? (
          <BlocoColapsavel
            bloco={bloco}
            key={`colapsado-${chaveDoSegmento(bloco.segmentos[0])}`}
          />
        ) : (
          bloco.segmentos.map((s) => (
            <LinhaDoDiff key={chaveDoSegmento(s)} segmento={s} />
          ))
        )
      )}
    </div>
  );
}

export function DiffModal({
  diff,
  publishedBy,
  publishedAt,
  summary,
  onClose,
}: {
  diff: VersionDiff;
  publishedBy: string | null;
  publishedAt: string;
  summary: string;
  onClose: () => void;
}) {
  return (
    <ModalShell
      footer={
        <>
          <FooterHint>
            <Kbd>esc</Kbd> fechar · Referência imutável ao registro de origem
          </FooterHint>
          <Button onClick={onClose} size="md" variant="secondary">
            Fechar
          </Button>
        </>
      }
      icon="eye"
      onClose={onClose}
      subtitle={`${publishedBy ?? "—"} · ${new Date(publishedAt).toLocaleDateString("pt-BR")}`}
      title={`Diff · ${diff.version}`}
      tone="accent"
      width={720}
    >
      <div
        style={{
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <Callout icon="fileText" tone="accent">
          {summary}
        </Callout>
        {diff.rows.length === 0 ? (
          <div
            style={{
              fontSize: FS.base,
              color: "var(--ink-muted)",
              padding: "20px 0",
              textAlign: "center",
            }}
          >
            Nenhuma diferença de conteúdo entre esta versão e a anterior.
          </div>
        ) : (
          <div
            style={{
              borderRadius: 9,
              border: "1px solid var(--hairline)",
              overflow: "hidden",
            }}
          >
            <TableHead
              cols="1fr auto"
              labels={[
                "Antes → Depois",
                { t: "− removido · + adicionado", align: "right" },
              ]}
            />
            {/* Foco no contêiner que rola: sem isso o teclado não alcança o
                conteúdo de diff longo. */}
            <section
              aria-label="Diferenças entre as versões"
              style={{ maxHeight: 420, overflowY: "auto" }}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: axe scrollable-region-focusable exige container focável
              tabIndex={0}
            >
              {diff.rows.map((r) => (
                <CampoDoDiff key={r.field} row={r} />
              ))}
            </section>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
