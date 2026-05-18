"use client";

import { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
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
import Link from "next/link";

type Feature = {
  id: string;
  title: string;
  storyPoints: number;
  wsjfScore: number;
  statusId: string;
  epicId?: string | null;
  epicTitle?: string | null;
  assigneeUserId?: string | null;
};

type Team = { id: string; name: string; velocity?: number | null };

type PlacedFeature = Feature & { teamId: string; sprintIndex: number };

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  ANALYSIS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  IMPLEMENTING: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

interface FeatureCardProps {
  feature: Feature;
  teamId: string;
  sprintIndex: number;
}

function FeatureCard({ feature, teamId, sprintIndex }: FeatureCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feature.id,
    data: { teamId, sprintIndex },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-1 rounded-md px-2 py-1.5 text-xs transition-opacity cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      } ${STATUS_COLORS[feature.statusId] ?? STATUS_COLORS.BACKLOG}`}
    >
      <GripVerticalIcon
        className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-50 touch-none"
        {...listeners}
        {...attributes}
      />
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
      className={`border-l px-2 py-2 align-top transition-colors min-w-[160px] ${
        isOver ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
      } ${isIP ? "bg-amber-50/30" : ""}`}
    >
      <div className="flex flex-col gap-1.5">
        {features.length === 0 && !isOver && (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
        {features.map((f) => (
          <FeatureCard key={f.id} feature={f} teamId={teamId} sprintIndex={sprintIndex} />
        ))}
      </div>
    </td>
  );
}

interface ProgramBoardEmbeddedProps {
  artId: string;
  piPlanId: string;
  teams: Team[];
  features: Feature[];
  cadence?: number | null;
}

export function ProgramBoardEmbedded({
  teams,
  features,
  cadence,
}: ProgramBoardEmbeddedProps) {
  const iterationCount = Math.min(Math.max(Math.floor((cadence ?? 10) / 2), 4), 5);
  const sprints: string[] = Array.from({ length: iterationCount }, (_, i) => `Sprint ${i + 1}`);
  sprints.push("IP Sprint");

  const teamList =
    teams.length > 0 ? teams : [{ id: "unassigned", name: "Sem time", velocity: null }];

  // Derive initial placement (same round-robin as server-side)
  const userToTeamIndex = new Map<string, number>();
  let userCounter = 0;
  for (const f of features) {
    if (f.assigneeUserId && !userToTeamIndex.has(f.assigneeUserId)) {
      userToTeamIndex.set(f.assigneeUserId, userCounter % teamList.length);
      userCounter++;
    }
  }

  const teamSprintCounter = new Map<string, number>();
  for (const team of teamList) teamSprintCounter.set(team.id, 0);

  const initialPlacements: PlacedFeature[] = features.map((f) => {
    let teamIdx = 0;
    if (f.assigneeUserId) teamIdx = userToTeamIndex.get(f.assigneeUserId) ?? 0;
    const team = teamList[teamIdx] ?? teamList[0];
    const si = (teamSprintCounter.get(team.id) ?? 0) % (sprints.length - 1);
    teamSprintCounter.set(team.id, si + 1);
    return { ...f, teamId: team.id, sprintIndex: si };
  });

  const [placements, setPlacements] = useState<PlacedFeature[]>(initialPlacements);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

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

  if (teamList.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum time associado a este ART.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Posicionamento via DnD é temporário — persistência de sprint por feature será adicionada em versão futura.
      </p>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 min-w-[140px] bg-muted/80 px-3 py-2.5 text-left font-medium backdrop-blur-sm">
                  Time
                </th>
                {sprints.map((sprint, si) => (
                  <th
                    key={si}
                    className={`min-w-[180px] px-3 py-2.5 text-center font-medium ${
                      si === sprints.length - 1
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
                  {sprints.map((sprint, si) => {
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
            <div className={`rounded-md px-2 py-1.5 text-xs shadow-lg opacity-90 ${
              STATUS_COLORS[activeFeature.statusId] ?? STATUS_COLORS.BACKLOG
            }`}>
              <p className="font-medium">{activeFeature.title}</p>
              <span className="opacity-75">{activeFeature.storyPoints} SP</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="font-medium">Status:</span>
        {Object.entries(STATUS_COLORS).map(([status, cls]) => (
          <span key={status} className={`rounded px-2 py-0.5 ${cls}`}>{status}</span>
        ))}
      </div>
    </div>
  );
}
