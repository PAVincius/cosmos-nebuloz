// apps/app/app/(authenticated)/portfolio/value-streams/[id]/components/value-stream-detail.tsx
//
// Content component for the Value Stream detail screen — port of prototype
// `screenValueStream` (screens-budget.js:4). Covers the 3 non-loading
// states from DESIGN.md §6: error (inline banner), empty (GAP: no
// ValueStream backend yet — see ../data.ts), and populated.

import {
  ActivityIcon,
  ClockIcon,
  DollarSignIcon,
  FlagIcon,
  LayersIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { KpiCard, KpiGrid, type KpiTone } from "@/app/(authenticated)/components/kpi-card";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import type {
  ValueStreamArtSummary,
  ValueStreamDetail,
  ValueStreamEpicSummary,
} from "../types";

// SVG path data (lucide glyphs), mirrored from other Portfolio screens so the
// KpiCard watermark matches (KpiCard takes a raw `d` string, not a component).
const ICON_DOLLAR =
  "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6";
const ICON_TRENDING = "M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6";
const ICON_ACTIVITY = "M22 12h-4l-3 9L9 3l-3 9H2";
const ICON_CLOCK = "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2";

type ValueStreamDetailViewProps = {
  id: string;
  valueStream: ValueStreamDetail | null;
  error: string | null;
};

export function ValueStreamDetailView({
  id,
  valueStream,
  error,
}: ValueStreamDetailViewProps) {
  if (error) return <ErrorState id={id} message={error} />;
  if (!valueStream) return <EmptyState id={id} />;
  return <PopulatedValueStream vs={valueStream} />;
}

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
        Falha ao carregar o Value Stream {id}. {message}
      </div>
      <Link
        href={`/portfolio/value-streams/${id}`}
        style={{
          fontWeight: 700,
          textDecoration: "underline",
          color: "var(--red-text)",
        }}
      >
        Tentar novamente
      </Link>
    </div>
  );
}

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
        <LayersIcon aria-hidden size={24} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        Value Stream {id} ainda não está disponível
      </div>
      <p
        style={{
          maxWidth: 380,
          fontSize: 12.5,
          color: "var(--ink-muted)",
          lineHeight: 1.6,
        }}
      >
        O modelo de Value Stream ainda não existe no backend de Lean Budget.
        Use "Editar VS" para preparar os dados assim que a integração
        estiver pronta.
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

function PopulatedValueStream({ vs }: { vs: ValueStreamDetail }) {
  const utilPct = Math.round((vs.budgetSpent / vs.budgetAlloc) * 100);
  const utilTone: KpiTone = utilPct >= 90 ? "red" : utilPct >= 75 ? "amber" : "green";
  const flowTone: KpiTone = vs.metrics.flowEfficiency >= 70 ? "green" : "amber";
  const cycleTone: KpiTone =
    vs.metrics.cycleTimeDays <= 14
      ? "green"
      : vs.metrics.cycleTimeDays <= 20
        ? "amber"
        : "red";
  const remaining = vs.budgetAlloc - vs.budgetSpent;
  const maxThroughput = Math.max(...vs.metrics.weeklyThroughput, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiGrid>
        <KpiCard
          badge={`— ${vs.horizonLabel}`}
          iconPath={ICON_DOLLAR}
          label="Budget alocado"
          tone="blue"
          unit="M"
          value={`US$ ${vs.budgetAlloc.toFixed(2)}`}
        />
        <KpiCard
          badge={
            utilPct >= 90
              ? "↑ Acima do guardrail"
              : utilPct >= 75
                ? "— Atenção"
                : "↓ Dentro do guardrail"
          }
          iconPath={ICON_TRENDING}
          label="Utilização"
          tone={utilTone}
          unit="%"
          value={utilPct}
        />
        <KpiCard
          badge={`— WIP: ${vs.metrics.wip} itens`}
          iconPath={ICON_ACTIVITY}
          label="Flow Efficiency"
          tone={flowTone}
          unit="%"
          value={Math.round(vs.metrics.flowEfficiency)}
        />
        <KpiCard
          badge="— Feature a produção"
          iconPath={ICON_CLOCK}
          label="Cycle Time médio"
          tone={cycleTone}
          unit="d"
          value={vs.metrics.cycleTimeDays}
        />
      </KpiGrid>

      <SectionCard
        icon={LayersIcon}
        subtitle="Missão · escopo · owner"
        title="Sobre este Value Stream"
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-muted)",
            lineHeight: 1.7,
            margin: "0 0 16px",
          }}
        >
          {vs.description}
        </p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <DescField label="MISSÃO" value={vs.mission} />
          <DescField label="OWNER" value={vs.owner} />
          <DescField
            label="TIPO"
            value={vs.type === "development" ? "Development VS" : "Operational VS"}
          />
          <DescField
            color={`var(--${vs.horizonTone}-text)`}
            label="INVESTMENT HORIZON"
            value={vs.horizonLabel}
          />
        </div>
      </SectionCard>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <SectionCard
          icon={ActivityIcon}
          subtitle="Eficiência de entrega deste VS"
          title="Flow Metrics"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {vs.kpis.map((k) => (
              <div
                key={k.label}
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--ink-faint)",
                    letterSpacing: ".08em",
                    marginBottom: 6,
                  }}
                >
                  {k.label.toUpperCase()}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--ink)",
                    lineHeight: 1,
                  }}
                >
                  {k.value}
                </div>
                {k.note && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ink-muted)",
                      marginTop: 6,
                    }}
                  >
                    {k.note}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--hairline)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--ink-faint)",
                letterSpacing: ".1em",
                marginBottom: 10,
              }}
            >
              THROUGHPUT SEMANAL (últimas 6 semanas)
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 48 }}>
              {vs.metrics.weeklyThroughput.map((v, i) => {
                const h = Math.round((v / maxThroughput) * 100);
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed 6-week series, no stable id
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      background: `rgba(var(--${vs.tone}-rgb),.5)`,
                      borderRadius: "3px 3px 0 0",
                      minHeight: 4,
                    }}
                    title={`S${i + 1}: ${v}/sem`}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {vs.metrics.weeklyThroughput.map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed 6-week series, no stable id
                  key={i}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 9,
                    color: "var(--ink-faint)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  S{i + 1}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={UsersIcon}
          subtitle={`${vs.arts.length} Agile Release Train${vs.arts.length > 1 ? "s" : ""}`}
          title="ARTs contribuindo"
        >
          {vs.arts.length === 0 ? (
            <EmptyList label="Nenhum ART vinculado a este value stream ainda." />
          ) : (
            vs.arts.map((art) => <ArtRow art={art} key={art.id} />)
          )}
        </SectionCard>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <SectionCard
          icon={FlagIcon}
          subtitle={`${vs.epics.length} épico${vs.epics.length !== 1 ? "s" : ""} neste value stream`}
          title="Épicos ativos"
        >
          {vs.epics.length === 0 ? (
            <EmptyList label="Nenhum épico neste value stream ainda." />
          ) : (
            vs.epics.map((epic) => <EpicRow epic={epic} key={epic.id} />)
          )}
        </SectionCard>

        <SectionCard
          icon={DollarSignIcon}
          subtitle="Alocação do VS · PI atual"
          title="Budget Guardrail"
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Consumo do orçamento
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                color: `var(--${utilTone}-text)`,
              }}
            >
              {utilPct}%
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "var(--surface-4)",
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${utilPct}%`,
                borderRadius: 999,
                background: `var(--${utilTone})`,
                transition: "width .4s",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <GuardrailStat label="Alocado" value={`US$ ${vs.budgetAlloc.toFixed(2)}M`} />
            <GuardrailStat
              color="var(--amber-text)"
              label="Consumido"
              value={`US$ ${vs.budgetSpent.toFixed(2)}M`}
            />
            <GuardrailStat
              color="var(--green-text)"
              label="Disponível"
              value={`US$ ${remaining.toFixed(2)}M`}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function DescField({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--ink-faint)",
          letterSpacing: ".1em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function GuardrailStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 20,
          fontWeight: 700,
          color: color ?? "var(--ink)",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>{label}</div>
    </div>
  );
}

function ArtRow({ art }: { art: ValueStreamArtSummary }) {
  const util = Math.round((art.budgetSpent / art.budgetAlloc) * 100);
  const tone: KpiTone = art.confidence >= 3.5 ? "green" : art.confidence >= 3 ? "amber" : "red";
  return (
    <Link
      href={`/arts/${art.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: 12,
        background: "var(--surface-3)",
        border: "1px solid var(--hairline)",
        borderRadius: 10,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `rgba(var(--${art.tone}-rgb),.15)`,
          border: `1px solid rgba(var(--${art.tone}-rgb),.3)`,
          display: "grid",
          placeItems: "center",
          color: `var(--${art.tone}-text)`,
          flexShrink: 0,
        }}
      >
        <LayersIcon aria-hidden size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{art.name}</span>
          <span
            style={{
              padding: "1px 7px",
              borderRadius: 999,
              fontSize: 9.5,
              fontWeight: 700,
              background: `rgba(var(--${art.tone}-rgb),.14)`,
              color: `var(--${art.tone}-text)`,
            }}
          >
            {art.status}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
          {art.teams} times · {art.members} membros · Confidence {art.confidence.toFixed(1)}/5
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: `var(--${tone}-text)` }}>
          {util}%
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>budget consumido</div>
      </div>
    </Link>
  );
}

function EpicRow({ epic }: { epic: ValueStreamEpicSummary }) {
  const pct = Math.round((epic.featuresDone / (epic.featuresTotal || 1)) * 100);
  return (
    <Link
      href={`/epics/${epic.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 12,
        background: "var(--surface-3)",
        border: `1px solid rgba(var(--${epic.tone}-rgb),.2)`,
        borderRadius: 10,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: `rgba(var(--${epic.tone}-rgb),.12)`,
          border: `1px solid rgba(var(--${epic.tone}-rgb),.25)`,
          display: "grid",
          placeItems: "center",
          color: `var(--${epic.tone}-text)`,
          flexShrink: 0,
        }}
      >
        <FlagIcon aria-hidden size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{epic.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-faint)" }}>
            {epic.id}
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>{epic.lifecycle}</span>
          <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>WSJF {epic.wsjf}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: `var(--${epic.tone}-text)` }}>
          {pct}%
        </div>
        <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>
          {epic.featuresDone}/{epic.featuresTotal} features
        </div>
      </div>
    </Link>
  );
}

function EmptyList({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "24px 12px",
        textAlign: "center",
        fontSize: 12.5,
        color: "var(--ink-faint)",
      }}
    >
      {label}
    </div>
  );
}
