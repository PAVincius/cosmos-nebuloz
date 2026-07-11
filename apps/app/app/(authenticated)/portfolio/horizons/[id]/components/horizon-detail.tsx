// Content component for the Investment Horizon detail screen — port of
// prototype `screenHorizon` (screens-budget.js:180). Covers the 3 non-loading
// states from DESIGN.md §6: error (inline banner), empty (GAP: no
// InvestmentHorizon backend yet — see ../data.ts), and populated.

import { FlagIcon, LayersIcon, TargetIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { KpiCard, KpiGrid, type KpiTone } from "@/app/(authenticated)/components/kpi-card";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import type {
  InvestmentHorizonDetail,
  InvestmentHorizonEpicSummary,
  InvestmentHorizonValueStream,
} from "../types";

// SVG path data (lucide glyphs), mirrored from other Portfolio screens so the
// KpiCard watermark matches (KpiCard takes a raw `d` string, not a component).
const ICON_WALLET =
  "M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4Z";
const ICON_TRENDING = "M22 7L13.5 15.5 8.5 10.5 2 17M16 7h6v6";
const ICON_LAYERS =
  "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83ZM2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.6-3.9A1 1 0 0 0 22 12M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.6-3.9A1 1 0 0 0 22 17";
const ICON_FLAG = "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7";

type HorizonDetailProps = {
  id: string;
  horizon: InvestmentHorizonDetail | null;
  error: string | null;
};

export function HorizonDetail({ id, horizon, error }: HorizonDetailProps) {
  if (error) return <ErrorState id={id} message={error} />;
  if (!horizon) return <EmptyState id={id} />;
  return <PopulatedHorizon horizon={horizon} />;
}

// ─── Error state (DESIGN.md §6 — inline banner + retry) ────────────────────

function ErrorState({ id, message }: { id: string; message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        borderRadius: 12,
        border: "1px solid rgba(var(--red-rgb),.3)",
        background: "var(--red-soft)",
        color: "var(--red-text)",
        fontSize: 13,
      }}
    >
      <TrendingUpIcon aria-hidden size={16} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        Falha ao carregar o Investment Horizon {id}. {message}
      </div>
      <Link
        href={`/portfolio/horizons/${id}`}
        style={{ fontWeight: 700, textDecoration: "underline", color: "var(--red-text)" }}
      >
        Tentar novamente
      </Link>
    </div>
  );
}

// ─── Empty state (DESIGN.md §6 — centered icon + explanation + CTA) ───────
// GAP: there is no InvestmentHorizon/ValueStream Prisma model yet, so
// getInvestmentHorizonDetail (../data.ts) always resolves to null for now.

function EmptyState({ id }: { id: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "72px 24px",
        borderRadius: 14,
        border: "1px dashed var(--hairline-strong)",
        background: "var(--surface)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "grid",
          placeItems: "center",
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "var(--surface-3)",
          border: "1px solid var(--hairline)",
          color: "var(--ink-faint)",
        }}
      >
        <TrendingUpIcon aria-hidden size={24} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        Horizonte {id} ainda não está disponível
      </div>
      <p style={{ maxWidth: 380, fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6 }}>
        O modelo de Investment Horizon ainda não existe no backend de Lean
        Budget. Use "Editar Horizon" para preparar os dados assim que a
        integração estiver pronta.
      </p>
      <Link
        href="/portfolio/budgets"
        style={{
          marginTop: 4,
          padding: "8px 16px",
          borderRadius: "var(--cosmos-r-md)",
          background: "var(--accent-c)",
          color: "var(--on-accent)",
          fontSize: 12.5,
          fontWeight: 700,
        }}
      >
        Ver Budget Flow
      </Link>
    </div>
  );
}

// ─── Populated state ────────────────────────────────────────────────────

function PopulatedHorizon({ horizon: h }: { horizon: InvestmentHorizonDetail }) {
  const totalAlloc = h.valueStreams.reduce((sum, vs) => sum + vs.budgetAlloc, 0);
  const totalSpent = h.valueStreams.reduce((sum, vs) => sum + vs.budgetSpent, 0);
  const utilPct = totalAlloc > 0 ? Math.round((totalSpent / totalAlloc) * 100) : 0;
  const utilTone: KpiTone =
    utilPct >= h.guardrails.max
      ? "red"
      : utilPct >= h.guardrails.max - 10
        ? "amber"
        : "green";

  const epicMap = new Map<string, InvestmentHorizonEpicSummary>();
  for (const vs of h.valueStreams) {
    for (const epic of vs.epics) epicMap.set(epic.id, epic);
  }
  const allEpics = Array.from(epicMap.values());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Relation chips — one per Value Stream in this horizon, mirrors the
          prototype's `ph-chips` row (rendered here instead of PageHeader
          since VS data is only known after the async fetch resolves). */}
      {h.valueStreams.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {h.valueStreams.map((vs) => (
            <RelationChip
              key={vs.id}
              eyebrow={vs.type === "development" ? "Dev VS" : "Ops VS"}
              href={`/portfolio/value-streams/${vs.id}`}
              icon={<LayersIcon />}
              label={vs.name}
              tone={vs.tone}
            />
          ))}
        </div>
      )}

      <KpiGrid>
        <KpiCard
          badge={`${h.pct}% do portfolio`}
          iconPath={ICON_WALLET}
          label="Budget do horizonte"
          tone="blue"
          value={`US$ ${totalAlloc.toFixed(1)}M`}
        />
        <KpiCard
          badge={`guardrail ${h.guardrails.min}–${h.guardrails.max}%`}
          iconPath={ICON_TRENDING}
          label="Utilização"
          tone={utilTone}
          value={`${utilPct}%`}
        />
        <KpiCard
          badge={h.valueStreams.length > 0 ? h.valueStreams.map((vs) => vs.name).join(", ") : "Nenhum VS"}
          iconPath={ICON_LAYERS}
          label="Value Streams"
          tone={h.tone}
          value={h.valueStreams.length}
        />
        <KpiCard
          badge="neste horizonte"
          iconPath={ICON_FLAG}
          label="Épicos ativos"
          tone="accent"
          value={allEpics.length}
        />
      </KpiGrid>

      <SectionCard icon={TargetIcon} subtitle={h.returnProfile} title="Overview">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          {h.kpis.map((kpi) => (
            <div
              key={kpi.label}
              style={{ border: "1px solid var(--hairline)", borderRadius: 10, padding: 14 }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "var(--ink-faint)",
                  letterSpacing: ".08em",
                  marginBottom: 6,
                  textTransform: "uppercase",
                }}
              >
                {kpi.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: `var(--${h.tone}-text)`, lineHeight: 1 }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
            Guardrail de budget{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
              {h.guardrails.min}% – {h.guardrails.max}%
            </span>
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 700,
              color: `var(--${utilTone}-text)`,
            }}
          >
            {utilPct}% consumido
          </span>
        </div>
        <div style={{ position: "relative", height: 10, borderRadius: 999, background: "var(--surface-4)" }}>
          <div
            style={{
              position: "absolute",
              left: `${h.guardrails.min}%`,
              width: `${h.guardrails.max - h.guardrails.min}%`,
              height: "100%",
              background: `rgba(var(--${h.tone}-rgb),.15)`,
              borderRadius: 999,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              width: `${Math.min(utilPct, 100)}%`,
              height: "100%",
              background: `var(--${utilTone})`,
              borderRadius: 999,
              transition: "width .4s",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${h.guardrails.min}%`,
              top: -3,
              width: 2,
              height: 16,
              background: `rgba(var(--${h.tone}-rgb),.5)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${h.guardrails.max}%`,
              top: -3,
              width: 2,
              height: 16,
              background: `rgba(var(--${h.tone}-rgb),.5)`,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 9, color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>
            MIN {h.guardrails.min}%
          </span>
          <span style={{ fontSize: 9, color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>
            MAX {h.guardrails.max}%
          </span>
        </div>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard
          actions={
            <Link href="/portfolio/budgets" style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-text)" }}>
              + Novo VS
            </Link>
          }
          icon={LayersIcon}
          subtitle={`${h.valueStreams.length} value stream${h.valueStreams.length !== 1 ? "s" : ""}`}
          title="Value Streams neste Horizonte"
        >
          {h.valueStreams.length === 0 ? (
            <EmptyList label="Nenhum value stream vinculado a este horizonte ainda." />
          ) : (
            h.valueStreams.map((vs) => <ValueStreamRow key={vs.id} vs={vs} />)
          )}
        </SectionCard>

        <SectionCard
          icon={FlagIcon}
          subtitle={`${allEpics.length} épico${allEpics.length !== 1 ? "s" : ""} vinculados`}
          title="Épicos neste Horizonte"
        >
          {allEpics.length === 0 ? (
            <EmptyList label="Nenhum épico vinculado a este horizonte ainda." />
          ) : (
            allEpics.map((epic) => <EpicRow epic={epic} key={epic.id} />)
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ValueStreamRow({ vs }: { vs: InvestmentHorizonValueStream }) {
  const u = vs.budgetAlloc > 0 ? Math.round((vs.budgetSpent / vs.budgetAlloc) * 100) : 0;
  const ut: KpiTone = u >= 90 ? "red" : u >= 75 ? "amber" : "green";
  return (
    <Link
      href={`/portfolio/value-streams/${vs.id}`}
      style={{
        display: "block",
        padding: 14,
        background: "var(--surface-3)",
        border: `1px solid rgba(var(--${vs.tone}-rgb),.2)`,
        borderRadius: 10,
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `rgba(var(--${vs.tone}-rgb),.14)`,
              border: `1px solid rgba(var(--${vs.tone}-rgb),.3)`,
              display: "grid",
              placeItems: "center",
              color: `var(--${vs.tone}-text)`,
            }}
          >
            <LayersIcon aria-hidden size={15} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{vs.name}</div>
            <div style={{ fontSize: 11, color: "var(--ink-muted)" }}>{vs.owner}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: `var(--${ut}-text)` }}>
            {u}%
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>
            US$ {vs.budgetSpent.toFixed(2)}M / {vs.budgetAlloc.toFixed(2)}M
          </div>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "var(--surface-4)", overflow: "hidden", marginBottom: 10 }}>
        <div style={{ height: "100%", width: `${Math.min(u, 100)}%`, background: `var(--${ut})`, borderRadius: 999 }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "var(--ink-muted)" }}>
        <span>{vs.type === "development" ? "Dev VS" : "Ops VS"}</span>
        <span>
          Cycle time: {vs.cycleTimeDays}d · Flow eff: {Math.round(vs.flowEfficiency * 100)}%
        </span>
      </div>
    </Link>
  );
}

function EpicRow({ epic }: { epic: InvestmentHorizonEpicSummary }) {
  const pct = Math.round((epic.featuresDone / (epic.featuresTotal || 1)) * 100);
  return (
    <Link
      href={`/epics/${epic.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <FlagIcon aria-hidden size={14} style={{ color: `var(--${epic.tone}-text)`, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {epic.title}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 3, fontSize: 10, color: "var(--ink-muted)" }}>
          <span>{epic.lifecycle}</span>
          <span>WSJF {epic.wsjf}</span>
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: `var(--${epic.tone}-text)`, flexShrink: 0 }}>
        {pct}%
      </div>
    </Link>
  );
}

function EmptyList({ label }: { label: string }) {
  return (
    <div style={{ padding: "24px 12px", textAlign: "center", fontSize: 12.5, color: "var(--ink-faint)" }}>
      {label}
    </div>
  );
}
