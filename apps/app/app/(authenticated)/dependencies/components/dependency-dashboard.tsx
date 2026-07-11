"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Calendar, Link2, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import type { DependencyWithFeatures } from "@/app/actions/dependencies/schema";
import { CreateDependencyModal } from "./create-dependency-modal";

// Lucide path `d` strings merged into single paths so KpiCard's watermark
// (a single <path>) can render multi-part icons — same trick used elsewhere.
const ICON_GIT_BRANCH =
  "M6 3V15M21 6A3 3 0 1 1 15 6A3 3 0 1 1 21 6M9 18A3 3 0 1 1 3 18A3 3 0 1 1 9 18M18 9a9 9 0 0 1-9 9";
const ICON_ALERT =
  "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01";
const ICON_CHECK = "M20 6 9 17l-5-5";
const ICON_LAYERS =
  "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83zM2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17";

type StatusTone = "green" | "red" | "amber" | "blue" | "purple" | "accent" | "neutral";

const STATUS_META: Record<string, { tone: StatusTone; label: string }> = {
  "not-started": { tone: "neutral", label: "Não iniciada" },
  "on-track": { tone: "blue", label: "No prazo" },
  "at-risk": { tone: "amber", label: "Em risco" },
  blocked: { tone: "red", label: "Bloqueada" },
  completed: { tone: "green", label: "Concluída" },
};

const EPIC_TONES: StatusTone[] = ["blue", "purple", "green", "amber", "accent", "red"];

function toneForEpic(epicId: string | null): StatusTone {
  if (!epicId) {
    return "neutral";
  }
  let hash = 0;
  for (let i = 0; i < epicId.length; i++) {
    hash = (hash * 31 + epicId.charCodeAt(i)) >>> 0;
  }
  return EPIC_TONES[hash % EPIC_TONES.length];
}

function toneBorder(tone: StatusTone): string {
  if (tone === "neutral") {
    return "var(--hairline-strong)";
  }
  if (tone === "accent") {
    return "var(--accent-c)";
  }
  return `var(--${tone})`;
}

function formatDueDate(dueDate: Date | null): string {
  if (!dueDate) {
    return "Sem prazo definido";
  }
  return new Date(dueDate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export type DependenciesEpic = {
  id: string;
  title: string;
  features: { id: string; title: string; statusId: string }[];
};

export type DependencyDashboardProps = {
  dependencies: DependencyWithFeatures[];
  epics: DependenciesEpic[];
  loadError?: boolean;
};

function DepCard({ dep }: { dep: DependencyWithFeatures }) {
  const reduceMotion = useReducedMotion();
  const meta = STATUS_META[dep.status] ?? { tone: "neutral" as StatusTone, label: dep.status };
  const blockingTone = toneForEpic(dep.blockingFeature.epicId);
  const blockedTone = toneForEpic(dep.blockedFeature.epicId);

  return (
    <motion.div
      animate="rest"
      initial="rest"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderLeft: `3px solid ${toneBorder(meta.tone)}`,
        borderRadius: "var(--r-md)",
        boxShadow: "var(--card-shadow)",
        padding: "15px 18px",
      }}
      transition={{ duration: 0.2, ease: [0.2, 0.7, 0.3, 1] }}
      variants={{
        rest: { y: 0 },
        hover: { y: reduceMotion ? 0 : -2 },
      }}
      whileHover="hover"
    >
      <div style={{ alignItems: "center", display: "flex", gap: 8, marginBottom: 10 }}>
        <span
          className="font-mono"
          style={{ color: "var(--ink-subtle)", fontSize: 11, fontWeight: 600 }}
        >
          {dep.id.slice(0, 8).toUpperCase()}
        </span>
        <Badge dot tone={meta.tone}>
          {meta.label}
        </Badge>
        <span
          style={{
            alignItems: "center",
            color: "var(--ink-muted)",
            display: "inline-flex",
            fontSize: 11.5,
            fontWeight: 600,
            gap: 5,
            marginLeft: "auto",
          }}
        >
          <Calendar aria-hidden size={13} style={{ color: "var(--ink-subtle)" }} />
          {formatDueDate(dep.dueDate)}
        </span>
      </div>

      <div
        style={{
          color: "var(--ink)",
          fontSize: 13.5,
          fontWeight: 600,
          letterSpacing: "-.01em",
          lineHeight: 1.35,
          marginBottom: 6,
        }}
      >
        {dep.blockingFeature.title} bloqueia {dep.blockedFeature.title}
      </div>

      {dep.description ? (
        <div
          style={{
            color: "var(--ink-muted)",
            fontSize: 12,
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          {dep.description}
        </div>
      ) : null}

      <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 12 }}>
        <RelationChip
          eyebrow={dep.blockingFeature.epic?.title ?? "Sem épico"}
          href={`/features/${dep.blockingFeature.id}`}
          label={dep.blockingFeature.title}
          tone={blockingTone}
        />
        <ArrowRight
          aria-hidden
          size={15}
          strokeWidth={2.4}
          style={{
            color: meta.tone === "red" ? "var(--red)" : "var(--ink-faint)",
            flexShrink: 0,
          }}
        />
        <RelationChip
          eyebrow={dep.blockedFeature.epic?.title ?? "Sem épico"}
          href={`/features/${dep.blockedFeature.id}`}
          label={dep.blockedFeature.title}
          tone={blockedTone}
        />
      </div>

      <div
        style={{
          alignItems: "center",
          borderTop: "1px solid var(--hairline)",
          color: "var(--ink-subtle)",
          display: "flex",
          fontSize: 11.5,
          gap: 8,
          paddingTop: 11,
        }}
      >
        <Badge tone="neutral">{dep.type}</Badge>
        <Badge tone={meta.tone}>{dep.severity}</Badge>
      </div>
    </motion.div>
  );
}

function DependencyLegend() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14 }}>
      {Object.values(STATUS_META).map((meta) => (
        <span
          key={meta.label}
          style={{
            alignItems: "center",
            color: "var(--ink-muted)",
            display: "inline-flex",
            fontSize: 12,
            fontWeight: 500,
            gap: 7,
          }}
        >
          <span
            aria-hidden
            style={{
              background: toneBorder(meta.tone),
              borderRadius: 3,
              height: 9,
              width: 9,
            }}
          />
          {meta.label}
        </span>
      ))}
    </div>
  );
}

function DependencyErrorBanner() {
  const router = useRouter();

  return (
    <div
      className="flex items-center gap-3 rounded-lg p-4 text-sm"
      style={{
        background: "rgba(var(--red-rgb),.08)",
        border: "1px solid rgba(var(--red-rgb),.3)",
        color: "var(--red-text)",
      }}
    >
      <TriangleAlert aria-hidden className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Não foi possível carregar o mapa de dependências. Tente novamente em instantes.
      </span>
      <button
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-2.5 py-1 font-semibold text-xs hover:bg-surface-3"
        onClick={() => router.refresh()}
        type="button"
      >
        <RefreshCw aria-hidden className="h-3 w-3" />
        Recarregar
      </button>
    </div>
  );
}

function DependencyEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
      <Link2 aria-hidden className="h-6 w-6" />
      <span>Nenhuma dependência mapeada ainda. Mapeie uma dependência para rastrear bloqueios entre features.</span>
    </div>
  );
}

export function DependencyDashboard({
  dependencies,
  epics,
  loadError = false,
}: DependencyDashboardProps) {
  const [createOpen, setCreateOpen] = useState(false);

  if (loadError) {
    return <DependencyErrorBanner />;
  }

  const totalFeatures = epics.reduce((sum, epic) => sum + epic.features.length, 0);
  const riskCount = dependencies.filter(
    (dep) => dep.status === "blocked" || dep.status === "at-risk"
  ).length;
  const onTrackCount = dependencies.filter(
    (dep) => dep.status === "on-track" || dep.status === "completed"
  ).length;
  const epicsInvolved = new Set(
    dependencies.flatMap((dep) => [dep.blockingFeature.epicId, dep.blockedFeature.epicId])
      .filter((id): id is string => Boolean(id))
  ).size;

  return (
    <div className="flex flex-col gap-6">
      <KpiGrid>
        <KpiCard
          badge={`— ${totalFeatures} features mapeadas`}
          iconPath={ICON_GIT_BRANCH}
          label="Dependências mapeadas"
          tone="accent"
          value={dependencies.length}
        />
        <KpiCard
          badge="— travam entregas downstream"
          iconPath={ICON_ALERT}
          label="Em risco de bloqueio"
          tone="red"
          value={riskCount}
        />
        <KpiCard
          badge="— sem bloqueio ativo"
          iconPath={ICON_CHECK}
          label="Sob controle"
          tone="green"
          value={onTrackCount}
        />
        <KpiCard
          badge={`— entre ${epics.length} épicos`}
          iconPath={ICON_LAYERS}
          label="Épicos envolvidos"
          tone="purple"
          value={epicsInvolved}
        />
      </KpiGrid>

      <SectionCard
        accentRgb="251,113,133"
        actions={
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-3 py-1.5 font-semibold text-xs hover:bg-surface-3"
            onClick={() => setCreateOpen(true)}
            type="button"
          >
            <Link2 aria-hidden size={13} />
            Mapear dependência
          </button>
        }
        icon={Link2}
        subtitle={`Feature → Feature · ${epics.length} épicos`}
        title="Dependências"
      >
        {dependencies.length === 0 ? (
          <DependencyEmptyState />
        ) : (
          <>
            <DependencyLegend />
            <div
              style={{
                display: "grid",
                gap: "var(--gap, 16px)",
                gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              }}
            >
              {dependencies.map((dep) => (
                <DepCard dep={dep} key={dep.id} />
              ))}
            </div>
          </>
        )}
      </SectionCard>

      <CreateDependencyModal
        epics={epics}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
    </div>
  );
}
