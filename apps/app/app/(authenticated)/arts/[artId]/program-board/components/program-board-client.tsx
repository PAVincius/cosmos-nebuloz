"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@repo/design-system/lib/utils";
import { AlertTriangleIcon, LinkIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ExternalSourceBadge } from "@/app/(authenticated)/components/external-source-badge";
import type {
  ProgramBoardData,
  ProgramBoardFeature,
} from "@/app/actions/program-board/schema";
import { saveProgramBoardLayout } from "@/app/actions/program-board";

// ─── Status/tone mapping (cosmos legend: done / wip / planned / risk) ────────

type Tone = "green" | "blue" | "neutral" | "red";

const STATUS_META: Record<string, { tone: Tone; label: string }> = {
  BACKLOG: { tone: "neutral", label: "Planejada" },
  ANALYSIS: { tone: "blue", label: "Em análise" },
  REVIEW: { tone: "blue", label: "Em revisão" },
  IMPLEMENTING: { tone: "blue", label: "Em progresso" },
  DONE: { tone: "green", label: "Concluída" },
};

const LEGEND = [
  { tone: "green" as Tone, label: "Concluída" },
  { tone: "blue" as Tone, label: "Em progresso" },
  { tone: "neutral" as Tone, label: "Planejada" },
  { tone: "red" as Tone, label: "Em risco" },
];

const toneVar: Record<Tone, string> = {
  green: "var(--green)",
  blue: "var(--blue)",
  neutral: "var(--ink-faint)",
  red: "var(--red)",
};

/** Cycles through team-distinguishing accent colors, mirroring cosmos.html's per-team dot tone. */
const TEAM_TONES = [
  { solid: "var(--accent-c)", rgb: "var(--accent-rgb)" },
  { solid: "var(--blue)", rgb: "var(--blue-rgb)" },
  { solid: "var(--purple)", rgb: "var(--purple-rgb)" },
  { solid: "var(--green)", rgb: "var(--green-rgb)" },
  { solid: "var(--amber)", rgb: "var(--amber-rgb)" },
];

type PlacedFeature = ProgramBoardFeature & {
  teamId: string;
  sprintIndex: number;
};

// ─── FeatureCard ──────────────────────────────────────────────────────────────

type FeatureCardProps = {
  feature: PlacedFeature;
  isConflict: boolean;
  isDependencyInvolved: boolean;
};

function FeatureCard({
  feature,
  isConflict,
  isDependencyInvolved,
}: FeatureCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: feature.id,
      data: { teamId: feature.teamId, sprintIndex: feature.sprintIndex },
    });

  const meta = STATUS_META[feature.statusId] ?? STATUS_META.BACKLOG;
  const tone: Tone = isConflict ? "red" : meta.tone;
  const shortId = feature.id.slice(-6).toUpperCase();

  return (
    <div
      className="cursor-grab rounded-cosmos-sm border border-hairline bg-surface p-[9px_10px] shadow-cosmos-card transition-opacity active:cursor-grabbing"
      data-dep-id={feature.id}
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.35 : 1,
        borderLeft: `3px solid ${toneVar[tone]}`,
        transform: transform ? CSS.Translate.toString(transform) : undefined,
      }}
      {...listeners}
      {...attributes}
      aria-describedby={`drag-desc-${feature.id}`}
    >
      <span className="sr-only" id={`drag-desc-${feature.id}`}>
        Feature arrastável: {feature.title}. Pressione Espaço para pegar, setas
        para mover, Enter para soltar.
      </span>
      <div className="mb-[5px] flex items-center gap-1.5">
        <span className="font-mono font-semibold text-[10.5px] text-ink-subtle">
          #{shortId}
        </span>
        {isConflict && (
          <AlertTriangleIcon
            aria-label="Em risco"
            className="text-red"
            size={11}
            strokeWidth={2.2}
          />
        )}
        <span className="ml-auto font-bold font-mono text-[10.5px] text-ink-muted">
          {feature.storyPoints}
        </span>
      </div>
      <div
        className="font-semibold text-[12.5px] text-ink leading-[1.3]"
        style={{ textWrap: "pretty" }}
      >
        {feature.title}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: toneVar[tone] }}
        />
        <span className="font-semibold text-[10.5px] text-ink-subtle">
          {isConflict ? "Em risco" : meta.label}
        </span>
        {isDependencyInvolved && (
          <span className="ml-auto inline-flex items-center gap-[3px] rounded-[4px] bg-amber-soft px-[5px] py-px font-mono text-[10px] text-amber-text">
            <LinkIcon size={10} strokeWidth={2.2} />
            dep
          </span>
        )}
      </div>
      {(feature.epicTitle || feature.externalSource) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-ink-muted">
          {feature.epicTitle && (
            <span className="max-w-[110px] truncate">{feature.epicTitle}</span>
          )}
          {feature.externalSource && (
            <ExternalSourceBadge
              source={feature.externalSource}
              url={feature.externalUrl}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dependency lines overlay ─────────────────────────────────────────────────

type DepLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isConflict: boolean;
};

function DependencyLines({
  placements,
  dependencies,
  conflictFeatureIds,
}: {
  placements: PlacedFeature[];
  dependencies: ProgramBoardDep[];
  conflictFeatureIds: Set<string>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [lines, setLines] = useState<DepLine[]>([]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }
    const container = svg.parentElement;
    if (!container) {
      return;
    }
    const cRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    const computed: DepLine[] = [];
    for (const dep of dependencies) {
      const fromEl = container.querySelector<HTMLElement>(
        `[data-dep-id="${dep.blockingFeatureId}"]`
      );
      const toEl = container.querySelector<HTMLElement>(
        `[data-dep-id="${dep.blockedFeatureId}"]`
      );
      if (!(fromEl && toEl)) {
        continue;
      }
      const fR = fromEl.getBoundingClientRect();
      const tR = toEl.getBoundingClientRect();
      computed.push({
        id: dep.id,
        x1: fR.right - cRect.left + scrollLeft,
        y1: (fR.top + fR.bottom) / 2 - cRect.top + scrollTop,
        x2: tR.left - cRect.left + scrollLeft,
        y2: (tR.top + tR.bottom) / 2 - cRect.top + scrollTop,
        isConflict:
          conflictFeatureIds.has(dep.blockingFeatureId) ||
          conflictFeatureIds.has(dep.blockedFeatureId),
      });
    }
    setLines(computed);
    svg.setAttribute("width", String(container.scrollWidth));
    svg.setAttribute("height", String(container.scrollHeight));
  }, [dependencies, conflictFeatureIds]);

  if (dependencies.length === 0) {
    return null;
  }

  return (
    <svg
      aria-hidden
      ref={svgRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 5,
        overflow: "visible",
      }}
    >
      {lines.map((l) => {
        const color = l.isConflict ? "var(--red)" : "var(--amber)";
        const mx = (l.x1 + l.x2) / 2;
        return (
          <path
            d={`M ${l.x1} ${l.y1} C ${mx} ${l.y1}, ${mx} ${l.y2}, ${l.x2} ${l.y2}`}
            fill="none"
            key={l.id}
            stroke={color}
            strokeDasharray={l.isConflict ? undefined : "3 3"}
            strokeWidth={l.isConflict ? 1.5 : 1.25}
          />
        );
      })}
    </svg>
  );
}

// ─── Board cell (droppable) ────────────────────────────────────────────────────

type BoardCellProps = {
  teamId: string;
  sprintIndex: number;
  sprint: string;
  features: PlacedFeature[];
  conflictFeatureIds: Set<string>;
  dependencyFeatureIds: Set<string>;
};

function BoardCell({
  teamId,
  sprintIndex,
  sprint,
  features,
  conflictFeatureIds,
  dependencyFeatureIds,
}: BoardCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${teamId}::${sprintIndex}`,
    data: { teamId, sprintIndex },
  });

  const isIP = sprint === "IP Sprint";

  return (
    <div
      className={cn(
        "flex min-h-[96px] flex-col gap-2 border-hairline border-r border-b p-2.5 transition-colors",
        isOver && "bg-accent-soft",
        isIP && !isOver && "bg-surface-2/40"
      )}
      ref={setNodeRef}
    >
      {features.map((f) => (
        <FeatureCard
          feature={f}
          isConflict={conflictFeatureIds.has(f.id)}
          isDependencyInvolved={dependencyFeatureIds.has(f.id)}
          key={f.id}
        />
      ))}
    </div>
  );
}

// ─── Conflict / dependency metrics (unchanged business logic) ────────────────

type ProgramBoardDep = ProgramBoardData["dependencies"][number];

function computeConflictData(
  placements: PlacedFeature[],
  deps: ProgramBoardDep[]
) {
  const placementMap = new Map(placements.map((p) => [p.id, p]));
  const conflictIds = new Set<string>();
  const depIds = new Set<string>();
  const conflictList: ProgramBoardDep[] = [];
  for (const dep of deps) {
    depIds.add(dep.blockingFeatureId);
    depIds.add(dep.blockedFeatureId);
    const blocking = placementMap.get(dep.blockingFeatureId);
    const blocked = placementMap.get(dep.blockedFeatureId);
    if (
      !!blocking &&
      !!blocked &&
      blocking.sprintIndex >= blocked.sprintIndex
    ) {
      conflictIds.add(dep.blockingFeatureId);
      conflictIds.add(dep.blockedFeatureId);
      conflictList.push({ ...dep, isConflict: true });
    }
  }
  return {
    conflictFeatureIds: conflictIds,
    dependencyFeatureIds: depIds,
    conflicts: conflictList,
  };
}

// ─── Team row (sticky first column) ──────────────────────────────────────────

type TeamRowProps = {
  team: { id: string; name: string; velocity: number | null };
  ti: number;
  sprints: string[];
  placements: PlacedFeature[];
  conflictFeatureIds: Set<string>;
  dependencyFeatureIds: Set<string>;
};

function TeamRow({
  team,
  ti,
  sprints,
  placements,
  conflictFeatureIds,
  dependencyFeatureIds,
}: TeamRowProps) {
  const teamTone = TEAM_TONES[ti % TEAM_TONES.length];
  const load = placements
    .filter((p) => p.teamId === team.id)
    .reduce((sum, p) => sum + p.storyPoints, 0);
  const cap = team.velocity ?? 0;
  const over = cap > 0 && load > cap;
  const pct = cap > 0 ? Math.min(100, (load / cap) * 100) : 0;

  return (
    <>
      <div className="sticky left-0 z-[3] border-hairline border-b bg-surface-2 p-3.5">
        <div className="mb-2.5 flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              background: teamTone.solid,
              boxShadow: `0 0 8px rgba(${teamTone.rgb},.6)`,
            }}
          />
          <span className="font-bold text-[13px] text-ink tracking-[-.01em]">
            {team.name}
          </span>
        </div>
        {cap > 0 && (
          <>
            <div className="mb-[5px] flex justify-between text-[10.5px]">
              <span className="font-semibold text-ink-subtle tracking-[.03em]">
                CARGA
              </span>
              <span
                className={cn(
                  "font-bold font-mono",
                  over ? "text-red-text" : "text-ink-muted"
                )}
              >
                {load}/{cap} pts
              </span>
            </div>
            <div className="h-[5px] w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${pct}%`,
                  background: over ? "var(--red)" : teamTone.solid,
                }}
              />
            </div>
          </>
        )}
      </div>
      {sprints.map((sprint, si) => (
        <BoardCell
          conflictFeatureIds={conflictFeatureIds}
          dependencyFeatureIds={dependencyFeatureIds}
          features={placements.filter(
            (p) => p.teamId === team.id && p.sprintIndex === si
          )}
          key={`${team.id}-${sprint}`}
          sprint={sprint}
          sprintIndex={si}
          teamId={team.id}
        />
      ))}
    </>
  );
}

// ─── Root client component ───────────────────────────────────────────────────

type ProgramBoardClientProps = {
  data: ProgramBoardData;
};

export function ProgramBoardClient({ data }: ProgramBoardClientProps) {
  const prefersReducedMotion = useReducedMotion();
  const teamList =
    data.teams.length > 0
      ? data.teams
      : [{ id: "unassigned", name: "Sem time", velocity: null }];

  const initial: PlacedFeature[] = data.matrix.flatMap((cell) =>
    cell.features.map((f) => ({
      ...f,
      teamId: cell.teamId,
      sprintIndex: cell.sprintIndex,
    }))
  );

  const [placements, setPlacements] = useState<PlacedFeature[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startSave] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!(over && data.piPlan)) {
      return;
    }
    const featureId = active.id as string;
    const parts = (over.id as string).split("::");
    const targetTeamId = parts[0];
    const targetSprintIndex = Number.parseInt(parts[1] ?? "", 10);
    if (!targetTeamId || Number.isNaN(targetSprintIndex)) {
      return;
    }
    const updated = placements.map((p) =>
      p.id === featureId
        ? { ...p, teamId: targetTeamId, sprintIndex: targetSprintIndex }
        : p
    );
    setPlacements(updated);
    startSave(async () => {
      await saveProgramBoardLayout({
        piPlanId: data.piPlan!.id,
        placements: updated.map((p) => ({
          featureId: p.id,
          teamId: p.teamId,
          sprintIndex: p.sprintIndex,
        })),
      });
    });
  }

  const { conflictFeatureIds, dependencyFeatureIds, conflicts } = useMemo(
    () => computeConflictData(placements, data.dependencies),
    [placements, data.dependencies]
  );

  const activeFeature = activeId
    ? placements.find((p) => p.id === activeId)
    : null;
  const totalConflicts = conflicts.length;
  const totalDeps = data.dependencies.length;

  const cols = `212px repeat(${data.sprints.length}, minmax(200px, 1fr))`;

  return (
    <motion.div
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      className="flex h-full flex-col gap-3.5"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ease: [0.0, 0.0, 0.2, 1] }}
    >
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4">
        {LEGEND.map((l) => (
          <span
            className="inline-flex items-center gap-[7px] font-medium text-[12px] text-ink-muted"
            key={l.label}
          >
            <span
              className="h-[9px] w-[9px] rounded-[3px]"
              style={{ background: toneVar[l.tone] }}
            />
            {l.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 font-medium text-[12px] text-ink-muted">
          <LinkIcon className="text-amber" size={13} strokeWidth={2.2} />
          Dependência
        </span>
        {totalDeps > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-cosmos-pill border border-hairline bg-surface-2 px-[9px] py-[3px] font-bold text-[11.5px] text-ink-muted">
            <LinkIcon size={11} strokeWidth={2.2} />
            {totalDeps} dependência{totalDeps !== 1 ? "s" : ""}
          </span>
        )}
        {totalConflicts > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-cosmos-pill border border-red-500/25 bg-red-soft px-[9px] py-[3px] font-bold text-[11.5px] text-red-text">
            <AlertTriangleIcon size={11} strokeWidth={2.2} />
            {totalConflicts} conflito{totalConflicts !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Board grid */}
      <DndContext
        onDragEnd={handleDragEnd}
        onDragStart={({ active }) => setActiveId(active.id as string)}
        sensors={sensors}
      >
        <div className="relative min-h-0 flex-1 overflow-auto rounded-cosmos-lg border border-hairline bg-surface shadow-cosmos-card">
          <div
            className="grid min-w-fit"
            style={{ gridTemplateColumns: cols }}
          >
            {/* Header row */}
            <div className="sticky top-0 left-0 z-[5] flex items-center border-hairline border-r border-b bg-surface-2 p-[12px_14px]">
              <span className="font-bold text-[11px] text-ink-muted uppercase tracking-[.06em]">
                Times
              </span>
            </div>
            {data.sprints.map((sprint) => {
              const isIP = sprint === "IP Sprint";
              return (
                <div
                  className={cn(
                    "sticky top-0 z-[4] border-hairline border-r border-b p-[10px_12px]",
                    isIP ? "bg-surface-3" : "bg-surface-2"
                  )}
                  key={sprint}
                >
                  <div className="flex items-center gap-[7px]">
                    <span className="font-bold text-[12.5px] text-ink tracking-[-.01em]">
                      {sprint}
                    </span>
                    {isIP && (
                      <span className="rounded-cosmos-pill bg-surface-3 px-[7px] py-px font-bold text-[10.5px] text-ink-muted">
                        IP
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Team rows */}
            {teamList.map((team, ti) => (
              <TeamRow
                conflictFeatureIds={conflictFeatureIds}
                dependencyFeatureIds={dependencyFeatureIds}
                key={team.id}
                placements={placements}
                sprints={data.sprints}
                team={team}
                ti={ti}
              />
            ))}
          </div>
          <DependencyLines
            conflictFeatureIds={conflictFeatureIds}
            dependencies={data.dependencies}
            placements={placements}
          />
        </div>
        <DragOverlay>
          {activeFeature ? (
            <div className="w-[200px] rotate-2 opacity-90 shadow-cosmos-card">
              <FeatureCard
                feature={activeFeature}
                isConflict={conflictFeatureIds.has(activeFeature.id)}
                isDependencyInvolved={dependencyFeatureIds.has(
                  activeFeature.id
                )}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </motion.div>
  );
}
