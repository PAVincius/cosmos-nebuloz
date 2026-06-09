"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMyPresence, useOthers } from "@repo/collaboration/hooks";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { calculateWSJF } from "@repo/safe-engine";
import { memo, useCallback, useState } from "react";

type KanbanCardItem = {
  id: string;
  columnId: string; // maps to statusId
  title: string;
  bv: number;
  tc: number;
  rr: number;
  js: number;
  wsjfScore: number;
  featureCount: number;
};

const COLUMNS = [
  {
    id: "BACKLOG",
    title: "Backlog",
    color: "bg-slate-500/10 border-slate-500/20",
  },
  { id: "REVIEW", title: "Review", color: "bg-blue-500/10 border-blue-500/20" },
  {
    id: "ANALYSIS",
    title: "Analysis",
    color: "bg-purple-500/10 border-purple-500/20",
  },
  {
    id: "IMPLEMENTING",
    title: "Implementing",
    color: "bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "DONE",
    title: "Done",
    color: "bg-emerald-500/10 border-emerald-500/20",
  },
];

const SortableCard = memo(function SortableCard({
  card,
}: {
  readonly card: KanbanCardItem;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });
  const wsjf =
    card.wsjfScore > 0
      ? card.wsjfScore
      : calculateWSJF({ bv: card.bv, tc: card.tc, rr: card.rr, js: card.js });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab bg-background/80 shadow-sm transition-colors hover:border-primary/50 active:cursor-grabbing"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1">
        <CardTitle className="font-medium text-xs leading-normal">
          {card.title}
        </CardTitle>
        <Badge
          className="shrink-0 text-[10px]"
          variant={
            wsjf >= 8 ? "destructive" : wsjf >= 5 ? "default" : "secondary"
          }
        >
          WSJF: {wsjf}
        </Badge>
      </CardHeader>
      <CardContent className="flex gap-2 p-3 pt-1 text-[10px] text-muted-foreground">
        <span>
          {card.featureCount} feat{card.featureCount !== 1 ? "s" : ""}
        </span>
        <span>BV:{card.bv}</span>
        <span>TC:{card.tc}</span>
        <span>RR:{card.rr}</span>
        <span>JS:{card.js}</span>
      </CardContent>
    </Card>
  );
});

function KanbanColumn({
  col,
  cards,
}: {
  readonly col: (typeof COLUMNS)[0];
  readonly cards: KanbanCardItem[];
}) {
  const { setNodeRef } = useDroppable({ id: col.id });
  const colCards = cards.filter((c) => c.columnId === col.id);

  return (
    <div
      className={`flex w-[350px] shrink-0 flex-col rounded-xl border shadow-sm backdrop-blur-sm ${col.color}`}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between rounded-t-xl border-inherit border-b bg-background/50 p-4">
        <h3 className="font-semibold text-sm">{col.title}</h3>
        <span className="rounded-full border bg-background/80 px-2 py-1 text-xs">
          {colCards.length}
        </span>
      </div>
      <div className="flex min-h-[500px] flex-1 flex-col gap-3 p-3">
        <SortableContext
          items={colCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {colCards.map((card) => (
            <SortableCard card={card} key={card.id} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function PortfolioBoard({
  epics,
}: {
  readonly epics: KanbanCardItem[];
}) {
  const others = useOthers();
  const [, updateMyPresence] = useMyPresence();

  const [cards, setCards] = useState<KanbanCardItem[]>(epics);
  const [activeCard, setActiveCard] = useState<KanbanCardItem | null>(null);

  const handleDragStart = useCallback(
    (event: { active: { id: string | number } }) => {
      const card = cards.find((c) => c.id === String(event.active.id));
      if (card) {
        setActiveCard(card);
      }
    },
    [cards]
  );

  const handleDragEnd = useCallback(
    (event: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      setActiveCard(null);
      const { active, over } = event;
      if (!over) {
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);

      const column = COLUMNS.find((c) => c.id === overId);
      if (column) {
        setCards((prev) =>
          prev.map((c) =>
            c.id === activeId ? { ...c, columnId: column.id } : c
          )
        );
        return;
      }

      setCards((prev) => {
        const targetCard = prev.find((c) => c.id === overId);
        if (!targetCard) {
          return prev;
        }
        return prev.map((c) =>
          c.id === activeId ? { ...c, columnId: targetCard.columnId } : c
        );
      });
    },
    []
  );

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
    >
      <div className="flex h-full items-start gap-6">
        {COLUMNS.map((col) => (
          <KanbanColumn cards={cards} col={col} key={col.id} />
        ))}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="rounded-lg border bg-background p-4 opacity-80 shadow-2xl backdrop-blur-md">
            <div className="font-medium text-xs">{activeCard.title}</div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Multiplayer Presence Cursors */}
      {others.map(({ connectionId, presence }) => {
        if (!(presence && presence.cursor)) {
          return null;
        }
        return (
          <div
            className="pointer-events-none absolute z-50 transition-transform duration-100 ease-out"
            key={connectionId}
            style={{
              transform: `translateX(${presence.cursor.x}px) translateY(${presence.cursor.y}px)`,
            }}
          >
            <svg
              className="h-5 w-5 text-primary drop-shadow-md"
              fill="currentColor"
              stroke="white"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.42a.5.5 0 0 0 .35-.85L5.5 3.21z" />
            </svg>
            <div className="ml-4 whitespace-nowrap rounded-full bg-primary px-2 py-1 text-primary-foreground text-xs shadow-md">
              User {connectionId}
            </div>
          </div>
        );
      })}
    </DndContext>
  );
}
