"use client";

import { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverlay,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@repo/design-system/components/ui/badge";
import { GripVerticalIcon } from "lucide-react";
import type { ProgramBoardData, ProgramBoardFeature } from "@/app/actions/program-board";

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  ANALYSIS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  IMPLEMENTING: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

type PlacedFeature = ProgramBoardFeature & { teamId: string; sprintIndex: number };

interface FeatureCardProps {
  feature: PlacedFeature;
}

function FeatureCard({ feature }: FeatureCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feature.id,
    data: { teamId: feature.teamId, sprintIndex: feature.sprintIndex },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      aria-describedby={`drag-desc-${feature.id}`}
      className={`group flex items-start gap-1 rounded-md px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? "opacity-30" : ""
      } ${STATUS_COLORS[feature.statusId] ?? STATUS_COLORS.BACKLOG}`}
    >
      <GripVerticalIcon
        className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-60 touch-none"
        {...listeners}
        {...attributes}
      />
      <span id={`drag-desc-${feature.id}`} className="sr-only">
        Feature arrastável: {feature.title}. Pressione Espaço para pegar, setas para mover, Enter para soltar.
      </span>
      <div className="min-w-0">
        <p className="font-medium leading-snug truncate">{feature.title}</p>
        <div className="flex items-center gap-1 opacity-75 mt-0.5">
          <span>{feature.storyPoints} SP</span>
          {feature.epicTitle && (
            <>
              <span>·</span>
              <span className="truncate max-w-[80px]">{feature.epicTitle}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface BoardCellProps {
  teamId: string;
  sprintIndex: number;
  sprint: string;
  features: PlacedFeature[];
}

function BoardCell({ teamId, sprintIndex, sprint, features }: BoardCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `${teamId}::${sprintIndex}`,
    data: { teamId, sprintIndex },
  });

  const isIP = sprint === "IP Sprint";

  return (
    <td
      ref={setNodeRef}
      className={`border-l px-2 py-2 align-top transition-colors ${
        isOver ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
      } ${isIP ? "bg-amber-50/30" : ""}`}
    >
      <div className="flex flex-col gap-1.5">
        {features.length === 0 && !isOver && (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
        {features.map((f) => (
          <FeatureCard key={f.id} feature={f} />
        ))}
      </div>
    </td>
  );
}

interface ProgramBoardClientProps {
  data: ProgramBoardData;
}

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
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const featureId = active.id as string;
    const [targetTeamId, targetSprintStr] = (over.id as string).split("::");
    const targetSprintIndex = parseInt(targetSprintStr);
    if (!targetTeamId || isNaN(targetSprintIndex)) return;

    setPlacements((prev) =>
      prev.map((p) =>
        p.id === featureId ? { ...p, teamId: targetTeamId, sprintIndex: targetSprintIndex } : p
      )
    );
  }

  const activeFeature = activeId ? placements.find((p) => p.id === activeId) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Arraste features entre células para reposicionar. Posicionamento é temporário (sessão atual).
      </p>

      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setActiveId(active.id as string)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {data.piPlan && (
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.piPlan.name}</span>
            {data.piPlan.startDate && (
              <span>
                {new Date(data.piPlan.startDate).toLocaleDateString("pt-BR")}
                {data.piPlan.endDate &&
                  ` → ${new Date(data.piPlan.endDate).toLocaleDateString("pt-BR")}`}
              </span>
            )}
            <span>·</span>
            <span>{data.teams.length} times</span>
            <span>·</span>
            <span>{data.sprints.length} sprints</span>
            <span>·</span>
            <span>{placements.length} features</span>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <table
            role="grid"
            aria-label="Program Board — times × sprints"
            className="w-full border-collapse text-sm"
          >
            <thead>
              <tr className="bg-muted/50">
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-[140px] bg-muted/80 px-3 py-2.5 text-left font-medium backdrop-blur-sm"
                >
                  Time
                </th>
                {data.sprints.map((sprint, si) => (
                  <th
                    key={si}
                    scope="col"
                    className={`min-w-[180px] px-3 py-2.5 text-center font-medium ${
                      si === data.sprints.length - 1
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                        : ""
                    }`}
                  >
                    {sprint}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamList.map((team, ti) => (
                <tr key={team.id} className={ti % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="sticky left-0 z-10 border-r bg-inherit px-3 py-2 align-top backdrop-blur-sm">
                    <div className="font-medium">{team.name}</div>
                    {team.velocity && (
                      <div className="text-xs text-muted-foreground">{team.velocity} SP/sprint</div>
                    )}
                  </td>
                  {data.sprints.map((sprint, si) => {
                    const cellFeatures = placements.filter(
                      (p) => p.teamId === team.id && p.sprintIndex === si
                    );
                    return (
                      <BoardCell
                        key={si}
                        teamId={team.id}
                        sprintIndex={si}
                        sprint={sprint}
                        features={cellFeatures}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DragOverlay>
          {activeFeature && (
            <div
              className={`rounded-md px-2 py-1.5 text-xs shadow-xl opacity-90 ${
                STATUS_COLORS[activeFeature.statusId] ?? STATUS_COLORS.BACKLOG
              }`}
            >
              <p className="font-medium">{activeFeature.title}</p>
              <span className="opacity-75">{activeFeature.storyPoints} SP</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="font-medium">Status:</span>
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <span key={status} className={`rounded px-2 py-0.5 ${cls}`}>{status}</span>
        ))}
      </div>
    </div>
  );
}
