"use client";

// Painel de detalhe do canvas: o que o nó selecionado diz, sem sair do desenho.
// Só leitura. O motivo de um bloqueio fica escrito aqui (não em `title`), e o
// gate decidido mostra o snapshot congelado, nunca os critérios de hoje (SG-07).

import { Button } from "@repo/design-system/cosmos/kit";
import type { ReactNode } from "react";
import type { TrackDetail } from "@/app/(scaffold)/actions/tracks";
import type { CanvasLayout } from "@/lib/scaffold/canvas-layout";
import {
  KIND_LABEL,
  PRODUCER_LABEL,
  STATUS,
} from "@/lib/scaffold/deliverable-labels";
import { phaseGateState } from "@/lib/scaffold/deliverable-machine";
import { PHASE, PHASE_STATE } from "@/lib/scaffold/phases";
import { StatusDot } from "./base";
import type { DeliverableItem } from "./deliverable-list";
import {
  type CanvasSel,
  gateSummary,
  stepStatement,
} from "./track-canvas-model";

/** Rótulo e valor do painel. Tamanhos literais nos degraus de DESIGN.md: o
 *  `MetaCell` lê `--fs-*`, que não resolvem sob `.scaffold-root` (dívida
 *  registrada) e o rótulo sairia no tamanho do pai. */
function MetaCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        className="mono"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        {label}
      </span>
      <span
        className={mono ? "mono" : undefined}
        style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

const dateBr = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3
        className="mono"
        style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

const Note = ({
  tone,
  children,
}: {
  tone: "red" | "amber" | "neutral";
  children: ReactNode;
}) => (
  <div
    role="note"
    style={{
      padding: "9px 12px",
      borderRadius: "var(--r-sm)",
      background: `var(--${tone}-soft)`,
      color: `var(--${tone}-text)`,
      fontSize: 11.5,
      lineHeight: 1.5,
    }}
  >
    {children}
  </div>
);

export function CanvasPanel({
  sel,
  track,
  deliverables,
  layout,
  onSelect,
  onOpenPhase,
}: {
  sel: CanvasSel | null;
  track: TrackDetail;
  deliverables: DeliverableItem[];
  layout: CanvasLayout<DeliverableItem>;
  onSelect: (sel: CanvasSel) => void;
  onOpenPhase: (phase: string) => void;
}) {
  const phaseByInstance = (id: string) => track.phases.find((p) => p.id === id);
  let title = "Visão geral";
  let body: ReactNode = null;
  let openPhase: string | null = null;

  if (!sel) {
    const phasesOpen = track.phases.filter(
      (p) => p.state !== "IDLE" && p.state !== "CLOSED"
    ).length;
    body = (
      <>
        <Note tone="neutral">
          Somente leitura. Selecione uma fase, um passo, um entregável ou um
          gate; arraste para mover e use a roda para aproximar.
        </Note>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <MetaCell
            label="Entregáveis"
            mono
            value={String(deliverables.length)}
          />
          <MetaCell label="Fases em curso" mono value={String(phasesOpen)} />
        </div>
      </>
    );
  } else if (sel.type === "dv") {
    const d = deliverables.find((x) => x.id === sel.id);
    const ph = d ? phaseByInstance(d.phaseInstanceId) : undefined;
    if (d && ph) {
      const dispensed = d.dispensedReason !== null;
      const st = dispensed
        ? { label: "Dispensado", tone: "neutral" as const }
        : STATUS[d.status];
      const overdue =
        d.dueAt !== null && d.status !== "APPROVED" && d.dueAt < new Date();
      title = `${d.code} · ${d.title}`;
      openPhase = ph.phase;
      body = (
        <>
          <StatusDot label={st.label} tone={st.tone} />
          {dispensed ? (
            <Note tone="neutral">Dispensado: {d.dispensedReason}</Note>
          ) : null}
          {d.lastReview ? (
            <Note tone="red">
              {d.lastReview.action === "REOPEN" ? "Reaberto" : "Ajuste pedido"}{" "}
              por {d.lastReview.byName}: “{d.lastReview.comment}”
            </Note>
          ) : null}
          {d.description ? (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
              {d.description}
            </p>
          ) : null}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <MetaCell label="Tipo" value={KIND_LABEL[d.kind]} />
            <MetaCell label="Produtor" value={PRODUCER_LABEL[d.producer]} />
            <MetaCell
              label="Versão"
              mono
              value={d.version > 0 ? `v${d.version}` : "—"}
            />
            <MetaCell
              label="Prazo"
              mono
              value={overdue ? `${dateBr(d.dueAt)} · vencido` : dateBr(d.dueAt)}
            />
          </div>
          {d.summary ? (
            <Section title="Resumo">
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                {d.summary}
              </p>
            </Section>
          ) : null}
          <MetaCell
            label="Arquivo"
            value={d.hasFile ? (d.fileName ?? "anexado") : "nenhum anexado"}
          />
        </>
      );
    }
  } else if (sel.type === "step") {
    const block = layout.columns
      .flatMap((c) => c.steps)
      .find((s) => s.id === sel.id);
    const ph = block ? track.phases.find((p) => p.phase === block.phase) : null;
    if (block && ph) {
      const items = block.deliverableIds
        .map((id) => deliverables.find((d) => d.id === id))
        .filter((d): d is DeliverableItem => Boolean(d));
      title = `${block.stepCode} · ${stepStatement(ph, block.stepCode) ?? "Passo do método"}`;
      openPhase = ph.phase;
      body = (
        <Section title={`Entregáveis do passo (${items.length})`}>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 6,
            }}
          >
            {items.map((d) => (
              <li key={d.id}>
                <button
                  className="btn navitem sc-cv-hit"
                  onClick={() => onSelect({ type: "dv", id: d.id })}
                  style={{
                    width: "100%",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                  type="button"
                >
                  <span
                    className="mono"
                    style={{ fontSize: 10, color: "var(--ink-faint)" }}
                  >
                    {d.code}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{d.title}</span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: `var(--${d.dispensedReason ? "neutral" : STATUS[d.status].tone}-text)`,
                    }}
                  >
                    {d.dispensedReason ? "Dispensado" : STATUS[d.status].label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      );
    }
  } else if (sel.type === "phase") {
    const ph = track.phases.find((p) => p.phase === sel.id);
    if (ph) {
      const own = deliverables.filter((d) => d.phaseInstanceId === ph.id);
      const ap = own.filter((d) => d.status === "APPROVED").length;
      const stepsDone = ph.steps.filter((s) => s.state === "DONE").length;
      const st = PHASE_STATE[ph.state];
      title = `${PHASE[ph.phase].label}`;
      openPhase = ph.phase;
      body = (
        <>
          <StatusDot label={st.label} tone={st.tone} />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {PHASE[ph.phase].desc}
          </p>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <MetaCell
              label="Aprovados"
              mono
              value={own.length ? `${ap}/${own.length}` : "sem entregáveis"}
            />
            <MetaCell
              label="Passos concluídos"
              mono
              value={ph.steps.length ? `${stepsDone}/${ph.steps.length}` : "—"}
            />
            <MetaCell label="Aberta em" mono value={dateBr(ph.openedAt)} />
            <MetaCell label="Fechada em" mono value={dateBr(ph.closedAt)} />
          </div>
        </>
      );
    }
  } else {
    const code = sel.id.split(":")[1];
    const ph = track.phases.find((p) => p.phase === code);
    if (ph) {
      const g = gateSummary(ph);
      const blocked =
        g.visual === "locked"
          ? null
          : phaseGateState(
              deliverables,
              ph.id,
              Boolean(track.businessCase?.signed)
            ).reason;
      title = `Gate ${PHASE[ph.phase].label}`;
      openPhase = ph.phase;
      body = (
        <>
          <StatusDot label={g.word} tone={g.tone} />
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
            {PHASE[ph.phase].gate}
          </p>
          {blocked && !g.decided ? <Note tone="amber">{blocked}</Note> : null}
          <Section
            title={
              g.decided
                ? `Critérios no momento da decisão · ${g.met}/${g.criteria.length}`
                : `Critérios do gate (${g.criteria.length})`
            }
          >
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 6,
              }}
            >
              {g.criteria.map((c) => (
                <li
                  key={c.key}
                  style={{
                    display: "flex",
                    gap: 8,
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color:
                        c.met === null
                          ? "var(--ink-muted)"
                          : `var(--${c.met ? "green" : "red"}-text)`,
                    }}
                  >
                    {c.met === null
                      ? "Em aberto"
                      : c.met
                        ? "Atendido"
                        : "Não atendido"}
                  </span>
                  <span>
                    {c.statement}
                    {c.note ? (
                      <span style={{ color: "var(--ink-muted)" }}>
                        {" "}
                        — {c.note}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
          {ph.result?.override && g.decided ? (
            <Note tone="amber">
              Override registrado em {dateBr(ph.result.override.createdAt)}:{" "}
              {ph.result.override.rationale}
            </Note>
          ) : null}
        </>
      );
    }
  }

  return (
    <aside
      aria-label="Detalhe do que está selecionado"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 16,
        borderRadius: "var(--r-lg)",
        background: "var(--surface)",
        border: "1px solid var(--hairline-strong)",
        boxShadow: "var(--card-shadow)",
        maxHeight: "100%",
        overflow: "auto",
      }}
    >
      <h2
        className="display"
        style={{ margin: 0, fontSize: 15, fontWeight: 700 }}
      >
        {title}
      </h2>
      {body}
      {openPhase ? (
        <Button
          icon="arrowRight"
          onClick={() => onOpenPhase(openPhase)}
          size="sm"
          variant="secondary"
        >
          Abrir {PHASE[openPhase as keyof typeof PHASE].label} na trilha
        </Button>
      ) : null}
    </aside>
  );
}
