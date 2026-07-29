"use client";

import { useState } from "react";

// ─── Sub-component: Score Picker ───────────────────────────────────────────
// Click-to-edit chip for a single WSJF component (BV/TC/RR/JS). Renders the
// current value and opens a small grid popover with the allowed scale.

type ScorePickerProps = {
  label: string;
  value: number;
  scale: number[];
  onSelect: (v: number) => void;
  disabled: boolean;
};

export function ScorePicker({
  label,
  value,
  scale,
  onSelect,
  disabled,
}: ScorePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        aria-label={`${label}: ${value}`}
        className="rounded border border-border px-2 py-0.5 font-mono text-xs transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        type="button"
      >
        <span className="mr-1 text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </button>

      {open ? (
        <>
          {/* backdrop */}
          <div
            aria-hidden
            className="fixed inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute z-20 mt-1 grid min-w-[120px] grid-cols-4 gap-1 rounded-lg border border-border bg-background p-2 shadow-lg">
            {scale.map((v) => (
              <button
                className={[
                  "rounded px-2 py-1 font-mono text-xs transition-colors",
                  v === value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                ].join(" ")}
                key={v}
                onClick={(e) => {
                  // Guard on the button rather than a wrapper div: the table
                  // row behind this popover is clickable, and a div carrying
                  // click handlers is neither focusable nor announced.
                  e.stopPropagation();
                  onSelect(v);
                  setOpen(false);
                }}
                type="button"
              >
                {v}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
