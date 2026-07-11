"use client";

import { ChevronDownIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type PiRelationChipPlan = {
  id: string;
  name: string;
  status: string;
};

type Props = {
  artId: string;
  piPlans: PiRelationChipPlan[];
};

const STATUS_TONE: Record<string, { dot: string; label: string; ghost?: boolean }> = {
  EXECUTING: { dot: "var(--green)", label: "EXECUTING" },
  COMMITTED: { dot: "var(--green)", label: "COMMITTED" },
  CLOSED: { dot: "var(--ink-faint)", label: "CLOSED" },
  DRAFT: { dot: "var(--ink-faint)", label: "DRAFT", ghost: true },
  PLANNING: { dot: "var(--ink-faint)", label: "PLANNING", ghost: true },
};

function statusTone(status: string) {
  return STATUS_TONE[status] ?? { dot: "var(--ink-faint)", label: status };
}

export function PiRelationChip({ artId, piPlans }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const labelStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--ink-faint)",
  };

  if (piPlans.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7, opacity: 0.5 }}>
        <span style={labelStyle}>PI ATIVO</span>
        <span style={{ width: 1, height: 12, background: "var(--hairline-strong)" }} />
        <span style={{ fontSize: 12, color: "var(--ink-subtle)", fontWeight: 500, cursor: "default" }}>
          —
        </span>
      </div>
    );
  }

  if (piPlans.length === 1) {
    const pi = piPlans[0];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={labelStyle}>PI ATIVO</span>
        <span style={{ width: 1, height: 12, background: "var(--hairline-strong)" }} />
        <Link
          href={`/arts/${artId}/pi-planning?piId=${pi.id}`}
          style={{ fontSize: 12, color: "var(--ink-subtle)", textDecoration: "none", fontWeight: 500 }}
        >
          {pi.name}
        </Link>
      </div>
    );
  }

  const active = piPlans[0];

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 7 }}>
      <span style={labelStyle}>PI ATIVO</span>
      <span style={{ width: 1, height: 12, background: "var(--hairline-strong)" }} />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: "var(--ink-subtle)",
          fontWeight: 500,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        {active.name}
        <ChevronDownIcon size={12} style={{ color: "var(--ink-faint)" }} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            width: 260,
            background: "var(--surface-2)",
            border: "1px solid var(--hairline)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {piPlans.map((pi) => {
            const tone = statusTone(pi.status);
            const isActive = pi.id === active.id;
            return (
              <Link
                key={pi.id}
                href={`/arts/${artId}/pi-planning?piId=${pi.id}`}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 12px",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--hairline)",
                  background: isActive ? "rgba(var(--accent-c-rgb,94,106,210),.08)" : "transparent",
                }}
              >
                {pi.status === "CLOSED" ? (
                  <CheckIcon size={12} style={{ color: tone.dot, flexShrink: 0 }} />
                ) : (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: tone.ghost ? "transparent" : tone.dot,
                      border: tone.ghost ? `1.5px solid ${tone.dot}` : "none",
                    }}
                  />
                )}
                <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, flex: 1 }}>
                  {pi.name}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "var(--ink-faint)",
                  }}
                >
                  {tone.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
