"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { cn } from "@repo/design-system/lib/utils";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/** Shared tone palette for board columns/cards — mirrors Badge's tone system. */
export type BoardTone =
  | "accent"
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "purple"
  | "neutral";

const toneVars: Record<
  BoardTone,
  { solid: string; soft: string; text: string; rgb?: string }
> = {
  accent: {
    solid: "var(--accent-c)",
    soft: "var(--accent-soft)",
    text: "var(--accent-text)",
    rgb: "var(--accent-rgb)",
  },
  green: {
    solid: "var(--cosmos-green)",
    soft: "var(--cosmos-green-soft)",
    text: "var(--cosmos-green-text)",
    rgb: "var(--cosmos-green-rgb)",
  },
  red: {
    solid: "var(--cosmos-red)",
    soft: "var(--cosmos-red-soft)",
    text: "var(--cosmos-red-text)",
    rgb: "var(--cosmos-red-rgb)",
  },
  amber: {
    solid: "var(--cosmos-amber)",
    soft: "var(--cosmos-amber-soft)",
    text: "var(--cosmos-amber-text)",
    rgb: "var(--cosmos-amber-rgb)",
  },
  blue: {
    solid: "var(--cosmos-blue)",
    soft: "var(--cosmos-blue-soft)",
    text: "var(--cosmos-blue-text)",
    rgb: "var(--cosmos-blue-rgb)",
  },
  purple: {
    solid: "var(--cosmos-purple)",
    soft: "var(--cosmos-purple-soft)",
    text: "var(--cosmos-purple-text)",
    rgb: "var(--cosmos-purple-rgb)",
  },
  neutral: {
    solid: "var(--ink-faint)",
    soft: "var(--surface-3)",
    text: "var(--ink-muted)",
  },
};

const cardReveal = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.0, 0.0, 0.2, 1] as const },
  },
};

interface BoardColumnProps {
  /** Droppable id — defaults to `title` when omitted. */
  id?: string;
  title: string;
  count?: number;
  tone?: BoardTone;
  children: ReactNode;
  className?: string;
}

/** Kanban-style column: colored dot header, count pill, droppable body. */
export function BoardColumn({
  id,
  title,
  count,
  tone = "neutral",
  children,
  className,
}: BoardColumnProps) {
  const droppableId = id ?? title;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const t = toneVars[tone];

  return (
    <div
      className={cn(
        "flex min-h-[120px] w-[276px] shrink-0 flex-col rounded-cosmos-lg border border-hairline bg-gradient-to-b from-surface-2 to-surface shadow-cosmos-card transition-[flex-basis]",
        className
      )}
      style={{ borderTopWidth: 2, borderTopColor: t.solid }}
    >
      <div className="flex items-center gap-2 px-[13px] pt-[13px] pb-2.5">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{
            background: t.solid,
            boxShadow: t.rgb ? `0 0 7px rgba(${t.rgb},.7)` : undefined,
          }}
        />
        <span className="font-semibold text-[13px] text-ink">{title}</span>
        {typeof count === "number" && (
          <span className="ml-auto rounded-cosmos-pill bg-surface-3 px-[7px] py-px font-bold font-mono text-[10.5px] text-ink-muted">
            {count}
          </span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-10 flex-1 flex-col gap-2 rounded-cosmos-md px-2.5 pb-2 transition-colors",
          isOver && "bg-accent-soft"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export interface BoardBadge {
  label: string;
  tone?: BoardTone;
  mono?: boolean;
}

interface BoardCardProps {
  title: string;
  meta?: ReactNode;
  tone?: BoardTone;
  badges?: BoardBadge[];
  draggableId?: string;
  className?: string;
}

/** Draggable board card: title, tone badges, footer meta with hover affordance. */
export function BoardCard({
  title,
  meta,
  tone = "neutral",
  badges,
  draggableId,
  className,
}: BoardCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const id = draggableId ?? title;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });
  const t = toneVars[tone];

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      variants={prefersReducedMotion ? undefined : cardReveal}
      initial={prefersReducedMotion ? undefined : "hidden"}
      whileInView={prefersReducedMotion ? undefined : "visible"}
      viewport={{ once: true, margin: "-10%" }}
      whileHover={
        prefersReducedMotion || isDragging ? undefined : { y: -2 }
      }
      style={
        {
          transform: CSS.Translate.toString(transform),
          opacity: isDragging ? 0.4 : 1,
          "--tone-solid": t.solid,
        } as CSSProperties
      }
      className={cn(
        "cursor-pointer rounded-cosmos-md border border-hairline-strong bg-surface p-[13px] shadow-cosmos-card transition-colors hover:border-[color:var(--tone-solid)]",
        className
      )}
    >
      <div
        className="mb-2.5 font-semibold text-[13px] text-ink leading-[1.35]"
        style={{ textWrap: "pretty" }}
      >
        {title}
      </div>
      {!!badges?.length && (
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          {badges.map((badge) => (
            <Badge
              key={badge.label}
              tone={badge.tone ?? tone}
              className={badge.mono ? "font-mono" : undefined}
            >
              {badge.label}
            </Badge>
          ))}
        </div>
      )}
      {!!meta && (
        <div className="group flex items-center justify-between text-[11px] text-ink-muted">
          <span>{meta}</span>
          <ArrowRightIcon
            aria-hidden
            size={12}
            className="text-ink-muted transition-colors group-hover:text-accent-text"
          />
        </div>
      )}
    </motion.div>
  );
}
