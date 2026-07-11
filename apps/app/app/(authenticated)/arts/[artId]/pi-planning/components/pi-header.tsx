import {
  PiRelationChip,
  RelationChip,
} from "@/app/(authenticated)/components/relation-chip";
import Link from "next/link";
import { PiBadge, type Tone } from "./pi-tone";

export type PiTab = "objectives" | "burnup" | "roam" | "confidence";

const TABS: { key: PiTab; label: string }[] = [
  { key: "objectives", label: "Objectives" },
  { key: "burnup", label: "Burnup" },
  { key: "roam", label: "ROAM Risks" },
  { key: "confidence", label: "Confidence" },
];

const STATUS_TONE: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Rascunho", tone: "neutral" },
  PLANNING: { label: "Planejamento", tone: "amber" },
  COMMITTED: { label: "Comprometido", tone: "blue" },
  EXECUTING: { label: "Executando", tone: "green" },
  CLOSED: { label: "Encerrado", tone: "neutral" },
};

type PiHeaderProps = {
  artId: string;
  artName: string;
  piId: string;
  piName: string;
  piStatus: string;
  currentWeek: number;
  totalWeeks: number;
  activeTab: PiTab;
  objectivesCount: number;
  risksCount: number;
  sessionId?: string;
  otherPis: { id: string; name: string }[];
};

function toPiChipItems(
  artId: string,
  pis: { id: string; name: string }[]
): { id: string; label: string; href: string }[] {
  return pis.map((p) => ({
    id: p.id,
    label: p.name,
    href: `/arts/${artId}/pi-planning?piId=${p.id}`,
  }));
}

function tabHref(
  artId: string,
  piId: string,
  tab: PiTab,
  sessionId?: string
) {
  const params = new URLSearchParams({ piId, tab });
  if (sessionId) {
    params.set("sessionId", sessionId);
  }
  return `/arts/${artId}/pi-planning?${params.toString()}`;
}

/** Page header with relation chips + in-header tabs — DESIGN.md §3 "Page Header Tabs (PI Plan only)". */
export function PiHeader({
  artId,
  artName,
  piId,
  piName,
  piStatus,
  currentWeek,
  totalWeeks,
  activeTab,
  objectivesCount,
  risksCount,
  sessionId,
  otherPis,
}: PiHeaderProps) {
  const status = STATUS_TONE[piStatus] ?? STATUS_TONE.PLANNING;
  const tabCounts: Record<PiTab, number | null> = {
    objectives: objectivesCount,
    burnup: null,
    roam: risksCount,
    confidence: null,
  };

  return (
    <div
      className="flex flex-col gap-3"
      style={{
        padding: "22px 32px 20px",
        background:
          "linear-gradient(180deg, var(--surface-2) 45%, rgba(255,255,255,.03) 100%)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="flex items-center gap-1.5 font-medium text-[11px] uppercase tracking-wide"
            style={{ color: "var(--ink-faint)" }}
          >
            Program Increment · ART {artName}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="font-bold text-[21px]"
              style={{ color: "var(--ink)" }}
            >
              {piName}
            </span>
            <PiBadge dot tone={status.tone}>
              {status.label.toUpperCase()}
            </PiBadge>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <RelationChip
              eyebrow="ART"
              href={`/arts/${artId}`}
              label={artName}
              tone="blue"
            />
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-1 font-medium text-[11px]"
              style={{
                color: "var(--accent-text)",
                borderColor: "rgba(var(--accent-rgb),.4)",
                background: "var(--accent-soft)",
              }}
            >
              Semana {currentWeek} de {totalWeeks}
            </span>
            {otherPis.length > 0 && (
              <PiRelationChip
                activeId={piId}
                entityName={artName}
                pis={toPiChipItems(artId, [
                  { id: piId, name: piName },
                  ...otherPis,
                ])}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-medium text-[13px] transition-colors hover:border-[var(--ink-faint)]"
            href={`/arts/${artId}/program-board?piPlanId=${piId}`}
            style={{
              borderColor: "var(--hairline)",
              color: "var(--ink-muted)",
              background: "var(--surface-3)",
            }}
          >
            Program Board
          </Link>
          <Link
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-[13px] transition-opacity hover:opacity-90"
            href={tabHref(artId, piId, "confidence", sessionId)}
            style={{ background: "var(--accent-c)", color: "var(--on-accent)" }}
          >
            Confidence Vote
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1 border-t pt-1" style={{ borderColor: "var(--hairline)" }}>
        {TABS.map((t) => {
          const isActive = t.key === activeTab;
          const count = tabCounts[t.key];
          return (
            <Link
              className="flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium text-[13px] transition-colors"
              href={tabHref(artId, piId, t.key, sessionId)}
              key={t.key}
              style={{
                borderColor: isActive ? "var(--accent)" : "transparent",
                color: isActive ? "var(--accent-text)" : "var(--ink-muted)",
              }}
            >
              {t.label}
              {count !== null && (
                <span
                  className="rounded-full px-1.5 py-0.5 font-semibold text-[10px]"
                  style={{ background: "var(--surface-3)", color: "var(--ink-faint)" }}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
