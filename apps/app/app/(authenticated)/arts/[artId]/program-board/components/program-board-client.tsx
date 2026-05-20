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
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { AlertTriangleIcon, GripVerticalIcon, LinkIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { ExternalSourceBadge } from "@/app/(authenticated)/components/external-source-badge";
import type {
  ProgramBoardData,
  ProgramBoardFeature,
} from "@/app/actions/program-board";

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  ANALYSIS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  REVIEW:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  IMPLEMENTING:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

type PlacedFeature = ProgramBoardFeature & {
  teamId: string;
  sprintIndex: number;
};

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

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      aria-describedby={`drag-desc-${feature.id}`}
      className={[
        "group flex cursor-grab items-start gap-1 rounded-md px-2 py-1.5 text-xs transition-opacity active:cursor-grabbing",
        isDragging ? "opacity-30" : "",
        STATUS_COLORS[feature.statusId] ?? STATUS_COLORS.BACKLOG,
        isConflict ? "ring-2 ring-red-500 ring-offset-1" : "",
        !isConflict && isDependencyInvolved ? "ring-1 ring-amber-400/60" : "",
      ].join(" ")}
      ref={setNodeRef}
      style={style}
    >
      <GripVerticalIcon
        className="mt-0.5 h-2.5 w-2.5 shrink-0 touch-none opacity-0 group-hover:opacity-60"
        {...listeners}
        {...attributes}
      />
      <span className="sr-only" id={`drag-desc-${feature.id}`}>
        Feature arrastável: {feature.title}. Pressione Espaço para pegar, setas
        para mover, Enter para soltar.
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-1">
          <p className="truncate font-medium leading-snug">{feature.title}</p>
          {isConflict ? (
            <AlertTriangleIcon
              aria-label="Conflito de dependência"
              className="h-3 w-3 shrink-0 text-red-600"
            />
          ) : null}
          {!isConflict && isDependencyInvolved ? (
            <LinkIcon
              aria-label="Feature com dependência"
              className="h-3 w-3 shrink-0 text-amber-500 opacity-70"
            />
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 opacity-75">
          <span>{feature.storyPoints} SP</span>
          {feature.epicTitle ? (
            <>
              <span>·</span>
              <span className="max-w-[80px] truncate">{feature.epicTitle}</span>
            </>
          ) : null}
          <ExternalSourceBadge
            source={feature.externalSource}
            url={feature.externalUrl}
          />
        </div>
      </div>
    </div>
  );
}

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
    <td
      className={`border-l px-2 py-2 align-top transition-colors ${
        isOver ? "bg-primary/5 ring-1 ring-primary/30 ring-inset" : ""
      } ${isIP ? "bg-amber-50/30" : ""}`}
      ref={setNodeRef}
    >
      <div className="flex flex-col gap-1.5">
        {features.length === 0 && !isOver && (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
        {features.map((f) => (
          <FeatureCard
            feature={f}
            isConflict={conflictFeatureIds.has(f.id)}
            isDependencyInvolved={dependencyFeatureIds.has(f.id)}
            key={f.id}
          />
        ))}
      </div>
    </td>
  );
}

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

function computeDepMetrics(
  placements: PlacedFeature[],
  deps: ProgramBoardDep[],
  conflictIds: Set<string>,
  teams: { id: string }[]
) {
  const countMap = new Map<string, { deps: number; conflicts: number }>();
  for (const t of teams) {
    countMap.set(t.id, { deps: 0, conflicts: 0 });
  }
  const placementMap = new Map(placements.map((p) => [p.id, p]));
  for (const dep of deps) {
    const blocking = placementMap.get(dep.blockingFeatureId);
    if (!blocking) {
      continue;
    }
    const m = countMap.get(blocking.teamId);
    if (!m) {
      continue;
    }
    m.deps += 1;
    if (conflictIds.has(dep.blockingFeatureId)) {
      m.conflicts += 1;
    }
  }
  return countMap;
}

type TeamRowProps = {
  team: { id: string; name: string; velocity: number | null };
  ti: number;
  metrics: { deps: number; conflicts: number } | undefined;
  sprints: string[];
  placements: PlacedFeature[];
  conflictFeatureIds: Set<string>;
  dependencyFeatureIds: Set<string>;
};

function TeamRow({
  team,
  ti,
  metrics,
  sprints,
  placements,
  conflictFeatureIds,
  dependencyFeatureIds,
}: TeamRowProps) {
  return (
    <tr
      className={ti % 2 === 0 ? "bg-background" : "bg-muted/20"}
      key={team.id}
    >
      <td className="sticky left-0 z-10 border-r bg-inherit px-3 py-2 align-top backdrop-blur-sm">
        <div className="font-medium">{team.name}</div>
        {team.velocity ? (
          <div className="text-muted-foreground text-xs">
            {team.velocity} SP/sprint
          </div>
        ) : null}
        {!!metrics && metrics.deps > 0 ? (
          <div className="mt-1 flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] ${
                    metrics.conflicts > 0
                      ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                  }`}
                >
                  <LinkIcon className="h-2.5 w-2.5" />
                  {metrics.deps}
                  {metrics.conflicts > 0 ? ` / ${metrics.conflicts}⚠` : ""}
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs" side="right">
                {metrics.deps} dependênci{metrics.deps !== 1 ? "as" : "a"}{" "}
                fornecidas
                {metrics.conflicts > 0
                  ? `, ${metrics.conflicts} com conflito`
                  : ""}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </td>
      {sprints.map((sprint, si) => {
        const cellFeatures = placements.filter(
          (p) => p.teamId === team.id && p.sprintIndex === si
        );
        return (
          <BoardCell
            conflictFeatureIds={conflictFeatureIds}
            dependencyFeatureIds={dependencyFeatureIds}
            features={cellFeatures}
            key={sprint}
            sprint={sprint}
            sprintIndex={si}
            teamId={team.id}
          />
        );
      })}
    </tr>
  );
}

function applyDragEnd(
  event: DragEndEvent,
  setActiveId: (id: string | null) => void,
  setPlacements: React.Dispatch<React.SetStateAction<PlacedFeature[]>>
): void {
  setActiveId(null);
  const { active, over } = event;
  if (!over) {
    return;
  }
  const featureId = active.id as string;
  const [targetTeamId, targetSprintStr] = (over.id as string).split("::");
  const targetSprintIndex = Number.parseInt(targetSprintStr, 10);
  if (!targetTeamId) {
    return;
  }
  if (Number.isNaN(targetSprintIndex)) {
    return;
  }
  setPlacements((prev) =>
    prev.map((p) =>
      p.id === featureId
        ? { ...p, teamId: targetTeamId, sprintIndex: targetSprintIndex }
        : p
    )
  );
}

type ProgramBoardClientProps = {
  data: ProgramBoardData;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrates DnD + conflict state across teams×sprints
export function ProgramBoardClient({ data }: ProgramBoardClientProps) {
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    applyDragEnd(event, setActiveId, setPlacements);
  }

  const { conflictFeatureIds, dependencyFeatureIds, conflicts } = useMemo(
    () => computeConflictData(placements, data.dependencies),
    [placements, data.dependencies]
  );

  const depMetrics = useMemo(
    () =>
      computeDepMetrics(
        placements,
        data.dependencies,
        conflictFeatureIds,
        teamList
      ),
    [placements, data.dependencies, conflictFeatureIds, teamList]
  );

  const activeFeature = activeId
    ? placements.find((p) => p.id === activeId)
    : null;
  const totalConflicts = conflicts.length;
  const totalDeps = data.dependencies.length;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Arraste features entre células para reposicionar. Posicionamento é
            temporário (sessão atual).
          </p>

          {/* Dependency summary chips */}
          {totalDeps > 0 && (
            <div className="flex items-center gap-2">
              <Badge className="gap-1 text-xs" variant="outline">
                <LinkIcon className="h-3 w-3" />
                {totalDeps} dependênci{totalDeps !== 1 ? "as" : "a"}
              </Badge>
              {totalConflicts > 0 && (
                <Badge
                  className="gap-1 border-red-300 bg-red-50 text-red-700 text-xs dark:bg-red-950/30 dark:text-red-400"
                  variant="outline"
                >
                  <AlertTriangleIcon className="h-3 w-3" />
                  {totalConflicts} conflito{totalConflicts !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          )}
        </div>

        <DndContext
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
          onDragStart={({ active }) => setActiveId(active.id as string)}
          sensors={sensors}
        >
          {data.piPlan ? (
            <div className="flex flex-wrap gap-2 text-muted-foreground text-sm">
              <span className="font-medium text-foreground">
                {data.piPlan.name}
              </span>
              {data.piPlan.startDate ? (
                <span>
                  {new Date(data.piPlan.startDate).toLocaleDateString("pt-BR")}
                  {data.piPlan.endDate
                    ? ` → ${new Date(data.piPlan.endDate).toLocaleDateString("pt-BR")}`
                    : ""}
                </span>
              ) : null}
              <span>·</span>
              <span>{data.teams.length} times</span>
              <span>·</span>
              <span>{data.sprints.length} sprints</span>
              <span>·</span>
              <span>{placements.length} features</span>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <table
              aria-label="Program Board — times × sprints"
              className="w-full border-collapse text-sm"
            >
              <thead>
                <tr className="bg-muted/50">
                  <th
                    className="sticky left-0 z-10 min-w-[140px] bg-muted/80 px-3 py-2.5 text-left font-medium backdrop-blur-sm"
                    scope="col"
                  >
                    Time
                  </th>
                  {data.sprints.map((sprint, si) => (
                    <th
                      className={`min-w-[180px] px-3 py-2.5 text-center font-medium ${
                        si === data.sprints.length - 1
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                          : ""
                      }`}
                      key={sprint}
                      scope="col"
                    >
                      {sprint}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamList.map((team, ti) => (
                  <TeamRow
                    conflictFeatureIds={conflictFeatureIds}
                    dependencyFeatureIds={dependencyFeatureIds}
                    key={team.id}
                    metrics={depMetrics.get(team.id)}
                    placements={placements}
                    sprints={data.sprints}
                    team={team}
                    ti={ti}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <DragOverlay>
            {activeFeature ? (
              <div
                className={`rounded-md px-2 py-1.5 text-xs opacity-90 shadow-xl ${
                  STATUS_COLORS[activeFeature.statusId] ?? STATUS_COLORS.BACKLOG
                }`}
              >
                <p className="font-medium">{activeFeature.title}</p>
                <span className="opacity-75">
                  {activeFeature.storyPoints} SP
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Conflict list */}
        {conflicts.length > 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-950/20">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-red-800 text-sm dark:text-red-300">
              <AlertTriangleIcon className="h-4 w-4" />
              {conflicts.length} conflito{conflicts.length !== 1 ? "s" : ""} de
              dependência
            </p>
            <div className="flex flex-col gap-1.5">
              {conflicts.map((dep) => (
                <div
                  className="flex flex-wrap items-start gap-1 text-red-700 text-xs dark:text-red-400"
                  key={dep.id}
                >
                  <span className="font-medium">
                    {dep.blockingFeatureTitle}
                  </span>
                  <span className="text-red-400">→ fornece para →</span>
                  <span className="font-medium">{dep.blockedFeatureTitle}</span>
                  <span className="text-red-400">mas entrega tarde demais</span>
                  <Badge
                    className="border-red-300 text-[10px] text-red-600"
                    variant="outline"
                  >
                    {dep.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-muted-foreground text-xs">
          <span className="font-medium">Status:</span>
          {Object.entries(STATUS_COLORS).map(([status, cls]) => (
            <span className={`rounded px-2 py-0.5 ${cls}`} key={status}>
              {status}
            </span>
          ))}
          {totalDeps > 0 ? (
            <>
              <span className="ml-2 flex items-center gap-1 rounded px-2 py-0.5 ring-2 ring-red-500">
                <AlertTriangleIcon className="h-3 w-3 text-red-500" /> Conflito
                de dependência
              </span>
              <span className="flex items-center gap-1 rounded px-2 py-0.5 ring-1 ring-amber-400/60">
                <LinkIcon className="h-3 w-3 text-amber-500" /> Tem dependência
              </span>
            </>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}
