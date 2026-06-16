"use client";

// Story-028 AC-003: co-editing presence cursors for BPMN canvas
// Presence x/y are relative to the canvas container element.

import { useMyPresence, useOthers } from "@repo/collaboration/hooks";
import { useCallback, useEffect } from "react";

const ROLE_COLORS: Record<string, string> = {
  SCRUM_MASTER: "#6366f1",
  PRODUCT_OWNER: "#f59e0b",
  DEVELOPER: "#10b981",
  RTE: "#ef4444",
  LPM: "#8b5cf6",
};

function CursorOverlay({
  name,
  role,
  x,
  y,
}: {
  name: string | undefined;
  role: string | undefined;
  x: number;
  y: number;
}) {
  const color = ROLE_COLORS[role ?? ""] ?? "#64748b";
  return (
    <div
      className="pointer-events-none absolute z-[999] select-none"
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <svg fill="none" height="20" viewBox="0 0 16 20" width="16">
        <path
          d="M0 0L0 16L4.5 11.5L7 18L9 17L6.5 10.5H12L0 0Z"
          fill={color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      {name && (
        <span
          className="mt-1 ml-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] text-white shadow"
          style={{ backgroundColor: color }}
        >
          {name}
        </span>
      )}
    </div>
  );
}

type Props = {
  containerRef: React.RefObject<HTMLDivElement | null>;
};

export function BpmnCursors({ containerRef }: Props) {
  const [, updateMyPresence] = useMyPresence();
  const others = useOthers();

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      updateMyPresence({
        cursor: {
          x: Math.round(e.clientX - rect.left),
          y: Math.round(e.clientY - rect.top),
        },
      });
    },
    [containerRef, updateMyPresence]
  );

  const onPointerLeave = useCallback(() => {
    updateMyPresence({ cursor: null });
  }, [updateMyPresence]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerleave", onPointerLeave);
    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [containerRef, onPointerMove, onPointerLeave]);

  return (
    <>
      {others.map(({ connectionId, presence, info }) => {
        if (!presence.cursor) {
          return null;
        }
        return (
          <CursorOverlay
            key={connectionId}
            name={info?.name}
            role={(info as Record<string, string> | undefined)?.role}
            x={(presence.cursor as { x: number; y: number }).x}
            y={(presence.cursor as { x: number; y: number }).y}
          />
        );
      })}
    </>
  );
}
