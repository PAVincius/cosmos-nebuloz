"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { CheckIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { EpicForTheme } from "@/app/actions/strategic-themes/schema";
import { linkEpicToTheme } from "@/app/actions/strategic-themes";
import type { ThemeNode } from "@/app/actions/strategy-map";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";

// ─── Constants ──────────────────────────────────────────────────────────────

const EPIC_STATUS_COLORS: Record<string, string> = {
  BACKLOG: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ACTIVE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  DONE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

// ─── Component ──────────────────────────────────────────────────────────────
// Re-skin of prototype's `openAddEpicModal` (screens-analytics.js:222): lists
// épicos NOT already in this theme. If none are available, shows a toast and
// never opens the modal (`if(!available.length){ toast(...); return; }`).

type AddEpicButtonProps = {
  theme: ThemeNode;
  allEpics: EpicForTheme[];
};

export function AddEpicButton({ theme, allEpics }: AddEpicButtonProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const linkedIds = new Set(theme.epics.map((e) => e.id));
  const available = allEpics.filter((e) => !linkedIds.has(e.id));

  function handleOpen() {
    if (available.length === 0) {
      toast.warning("Todos os épicos já estão neste tema");
      return;
    }
    setSelected([]);
    setOpen(true);
  }

  function handleSubmit() {
    if (selected.length === 0) {
      toast.warning("Nenhum épico selecionado");
      return;
    }
    startTransition(async () => {
      const results = await Promise.all(
        selected.map((epicId) => linkEpicToTheme(epicId, theme.id))
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        toast.error(`Falha ao adicionar ${failed.length} épico(s)`);
      } else {
        toast.success(
          `${selected.length} épico${selected.length > 1 ? "s" : ""} adicionado${selected.length > 1 ? "s" : ""}`,
          { description: theme.title }
        );
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-2 py-1 font-medium text-xs transition-colors hover:border-[rgba(var(--accent-rgb),.5)] hover:bg-[rgba(var(--accent-rgb),.1)] hover:text-accent-text"
        onClick={handleOpen}
        title="Adicionar épico ao tema"
        type="button"
      >
        <PlusIcon className="h-3 w-3" />
        Épico
      </button>

      <ModalShell
        eyebrow={`Tema: ${theme.title}`}
        footer={
          <>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={isPending} onClick={handleSubmit} type="button">
              <CheckIcon className="h-3.5 w-3.5" />
              Adicionar selecionados
            </Button>
          </>
        }
        onClose={() => setOpen(false)}
        open={open}
        size="md"
        title="Adicionar Épicos"
      >
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
          {available.map((epic) => {
            const checked = selected.includes(epic.id);
            const statusClass =
              EPIC_STATUS_COLORS[epic.statusId] ?? EPIC_STATUS_COLORS.BACKLOG;
            return (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted/40"
                key={epic.id}
              >
                <Checkbox
                  checked={checked}
                  className="mt-0.5"
                  onCheckedChange={(value) => {
                    setSelected((prev) =>
                      value
                        ? [...prev, epic.id]
                        : prev.filter((id) => id !== epic.id)
                    );
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">{epic.title}</div>
                  <span
                    className={`mt-1 inline-block rounded px-1.5 py-0.5 font-semibold text-[10px] ${statusClass}`}
                  >
                    {epic.statusId}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </ModalShell>
    </>
  );
}
