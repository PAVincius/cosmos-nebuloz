"use client";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  PaletteIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteStrategicTheme,
  linkEpicToTheme,
  updateStrategicTheme,
} from "@/app/actions/strategic-themes";
import type { EpicForTheme } from "@/app/actions/strategic-themes/schema";
import type { ThemeNode } from "@/app/actions/strategy-map";
import { AddEpicButton } from "./add-epic-modal";
import { EpicChip } from "./epic-chip";
import { OKRNode } from "./okr-node";

// ─── Constants ──────────────────────────────────────────────────────────────

const THEME_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  ANALYSIS: "Análise",
  APPROVED: "Aprovado",
  ACTIVE: "Ativo",
  CLOSING: "Encerrando",
  ARCHIVED: "Arquivado",
};

const TONE_SWATCHES = [
  "#2563eb",
  "#7c3aed",
  "#16a34a",
  "#d97706",
  "#e11d48",
  "var(--accent-c)",
];

// ─── PaletteButton ──────────────────────────────────────────────────────────
// Re-skin of `.smap-palette-wrap`/`.smap-tones-pop` (batch2.css) — a popover
// of 6 color dots that recolors the theme (`smapSetTone`).

function PaletteButton({
  themeId,
  color,
  onChange,
}: {
  themeId: string;
  color: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        aria-label="Mudar cor do tema"
        className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-[rgba(var(--accent-rgb),.4)] hover:bg-[rgba(var(--accent-rgb),.1)] hover:text-accent-text"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        title="Mudar cor do tema"
        type="button"
      >
        <PaletteIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-20 flex gap-1.5 rounded-lg border border-border/60 bg-popover p-2 shadow-md">
          {TONE_SWATCHES.map((hex) => (
            <button
              aria-label={`Tone ${hex}`}
              className="h-4 w-4 rounded-[5px] border-2 transition-transform hover:scale-115"
              key={hex}
              onClick={(event) => {
                // The guard belongs on the button, not on a wrapper div: the
                // card behind this popover is itself clickable, and a div with
                // a click handler is neither focusable nor announced.
                event.stopPropagation();
                onChange(hex);
                setOpen(false);
              }}
              style={{
                background: hex,
                borderColor:
                  color === hex ? "var(--foreground)" : "transparent",
              }}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ThemeCard ──────────────────────────────────────────────────────────────

type ThemeCardProps = {
  theme: ThemeNode;
  allEpics: EpicForTheme[];
};

export function ThemeCard({ theme, allEpics }: ThemeCardProps) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(theme.title);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function commitRename(value: string) {
    setEditing(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === theme.title) {
      return;
    }
    startTransition(async () => {
      const result = await updateStrategicTheme(theme.id, { title: trimmed });
      if (result.ok) {
        toast.success("Tema renomeado", { description: trimmed });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function recolor(hex: string) {
    startTransition(async () => {
      const result = await updateStrategicTheme(theme.id, { color: hex });
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!confirm("Excluir este Strategic Theme?")) {
      return;
    }
    startTransition(async () => {
      const result = await deleteStrategicTheme(theme.id);
      if (result.ok) {
        toast.error("Tema excluído", { description: theme.title });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeEpic(epicId: string) {
    startTransition(async () => {
      const result = await linkEpicToTheme(epicId, null);
      if (result.ok) {
        toast.warning("Épico removido do tema", { description: epicId });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[var(--card-shadow)]">
      {/* Header. Not a click-anywhere row: it contains the rename control, the
          palette, add-epic and delete buttons, so making the row itself a
          control would nest interactive elements — invalid HTML, and a div
          with onClick is neither focusable nor announced. The chevron is the
          disclosure, which also gives keyboard users a way to expand at all. */}
      <div className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
        <button
          aria-expanded={open}
          aria-label={`${open ? "Recolher" : "Expandir"} tema ${theme.title}`}
          className="shrink-0 cursor-pointer text-muted-foreground"
          onClick={() => setOpen((prev) => !prev)}
          type="button"
        >
          {open ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </button>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
          style={{ backgroundColor: theme.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {theme.code && (
              <span className="font-mono text-muted-foreground text-xs">
                {theme.code}
              </span>
            )}
            {editing ? (
              <input
                autoFocus
                className="rounded border border-[var(--accent-c)] bg-background px-1.5 py-0.5 font-semibold text-sm outline-none"
                defaultValue={theme.title}
                onBlur={(event) => commitRename(event.target.value)}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    setEditing(false);
                  }
                }}
                value={nameDraft}
              />
            ) : (
              <button
                className="cursor-text text-left font-semibold text-sm"
                onClick={() => {
                  setNameDraft(theme.title);
                  setEditing(true);
                }}
                style={{ color: theme.color }}
                title="Clique para renomear"
                type="button"
              >
                {theme.title}
              </button>
            )}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground text-xs">
              {THEME_STATUS_LABELS[theme.status] ?? theme.status}
            </span>
            {theme.horizon && (
              <span className="text-muted-foreground text-xs">
                {theme.horizon}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="whitespace-nowrap text-muted-foreground text-xs">
            {theme.epics.length} épico{theme.epics.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--accent-c)] transition-all duration-500"
                style={{ width: `${theme.progress}%` }}
              />
            </div>
            <span className="font-medium tabular-nums">{theme.progress}%</span>
          </div>

          {/* No propagation guard needed any more: the header row above is no
              longer a control, so nothing swallows these clicks. */}
          <div className="flex items-center gap-2">
            <PaletteButton
              color={theme.color}
              onChange={recolor}
              themeId={theme.id}
            />
            <AddEpicButton allEpics={allEpics} theme={theme} />
            <button
              aria-label="Excluir tema"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500"
              onClick={handleDelete}
              title="Excluir tema"
              type="button"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="flex flex-col gap-3 border-border/50 border-t px-4 py-3">
          {theme.okrs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                OKRs do Tema
              </div>
              {theme.okrs.map((okr) => (
                <OKRNode key={okr.id} okr={okr} />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
              Épicos ({theme.epics.length})
            </div>
            {theme.epics.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {theme.epics.map((epic) => (
                  <EpicChip
                    epic={epic}
                    key={epic.id}
                    onRemove={() => removeEpic(epic.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="py-2 text-center text-muted-foreground text-xs italic">
                Nenhum épico neste tema.
              </p>
            )}
          </div>

          {theme.okrs.length === 0 && theme.epics.length === 0 && (
            <p className="py-2 text-center text-muted-foreground text-xs italic">
              Nenhum OKR ou épico ligado a este tema ainda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
