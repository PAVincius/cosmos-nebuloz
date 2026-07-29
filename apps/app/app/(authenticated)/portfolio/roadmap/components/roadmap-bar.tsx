"use client";

import { motion } from "framer-motion";
import { FlagIcon, XIcon } from "lucide-react";
import Link from "next/link";
import type { RoadmapItemWithRelations } from "@/app/actions/roadmap/schema";
import { STATUS_LABEL, TONE_RGB, type Tone } from "./roadmap-gantt-utils";

type RoadmapBarProps = {
  item: RoadmapItemWithRelations;
  gridColumn: string;
  row: number;
  tone: Tone;
  progress: number;
  reduceMotion: boolean;
  onDelete: (item: RoadmapItemWithRelations) => void;
};

function BarInner({ item }: { item: RoadmapItemWithRelations }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 pr-4">
      {item.milestone && (
        <FlagIcon
          aria-hidden
          className="h-3 w-3 shrink-0"
          style={{ color: "var(--amber-text)" }}
        />
      )}
      <span
        style={{
          color: "var(--ink)",
          fontSize: 12.5,
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.title}
      </span>
    </div>
  );
}

export function RoadmapBar({
  item,
  gridColumn,
  row,
  tone,
  progress,
  reduceMotion,
  onDelete,
}: RoadmapBarProps) {
  const isPlanned = item.status === "PLANNED";
  const rgb = TONE_RGB[tone];

  return (
    <motion.div
      className="group relative"
      style={{ gridColumn, gridRow: row + 1 }}
      transition={{ duration: 0.16, ease: [0, 0, 0.2, 1] }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
    >
      <div
        style={{
          background: isPlanned ? "var(--surface-2)" : `rgba(${rgb},.12)`,
          border: `1px solid ${isPlanned ? "var(--hairline-strong)" : `rgba(${rgb},.4)`}`,
          borderLeft: `3px solid rgb(${rgb})`,
          borderRadius: "var(--cosmos-r-md)",
          margin: "4px 3px",
          minHeight: 46,
          overflow: "hidden",
          padding: "7px 9px",
          position: "relative",
        }}
      >
        {item.epicId ? (
          <Link
            aria-label={`${item.title} — ${STATUS_LABEL[item.status as keyof typeof STATUS_LABEL]}`}
            href={`/epics/${item.epicId}`}
          >
            <BarInner item={item} />
          </Link>
        ) : (
          <BarInner item={item} />
        )}
        {progress > 0 && (
          <div
            style={{
              background: "var(--surface-3)",
              borderRadius: 999,
              height: 4,
              marginTop: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: `rgb(${rgb})`,
                borderRadius: 999,
                height: "100%",
                width: `${progress}%`,
              }}
            />
          </div>
        )}
        <button
          aria-label={`Excluir ${item.title}`}
          className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete(item);
          }}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: 999,
            cursor: "pointer",
            lineHeight: 0,
            padding: 2,
          }}
          type="button"
        >
          <XIcon
            className="h-2.5 w-2.5"
            style={{ color: "var(--ink-subtle)" }}
          />
        </button>
      </div>
    </motion.div>
  );
}
