"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { CheckIcon, TargetIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import {
  createStrategicTheme,
  linkEpicToTheme,
} from "@/app/actions/strategic-themes";
import type { EpicForTheme } from "@/app/actions/strategic-themes/schema";

// ─── Constants ──────────────────────────────────────────────────────────────
// Same 6 tones as the prototype's `nt-tone-opt` radio row
// (screens-analytics.js:269), mapped to the Cosmos token hex values.

const TONE_OPTIONS = [
  { name: "blue", hex: "#2563eb" },
  { name: "purple", hex: "#7c3aed" },
  { name: "green", hex: "#16a34a" },
  { name: "amber", hex: "#d97706" },
  { name: "red", hex: "#e11d48" },
  { name: "accent", hex: "var(--accent-c)" },
] as const;

// ─── Component ──────────────────────────────────────────────────────────────
// Re-skin of prototype's `openNewThemeModal` (screens-analytics.js:260): M8.

type NewThemeButtonProps = {
  allEpics: EpicForTheme[];
  nextOrder: number;
};

export function NewThemeButton({ allEpics, nextOrder }: NewThemeButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [budgetTotal, setBudgetTotal] = useState("");
  const [color, setColor] = useState<string>(TONE_OPTIONS[0].hex);
  const [selectedEpics, setSelectedEpics] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setTitle("");
    setBudgetTotal("");
    setColor(TONE_OPTIONS[0].hex);
    setSelectedEpics([]);
  }

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Nome obrigatório");
      return;
    }
    startTransition(async () => {
      const result = await createStrategicTheme({
        title: trimmed,
        color,
        order: nextOrder,
        budgetTotal: budgetTotal ? Number.parseFloat(budgetTotal) : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (selectedEpics.length > 0) {
        await Promise.all(
          selectedEpics.map((epicId) => linkEpicToTheme(epicId, result.data.id))
        );
      }
      toast.success("Tema criado", { description: trimmed });
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button
        className="gap-1.5"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
      >
        <TargetIcon className="h-3.5 w-3.5" />
        Novo Tema
      </Button>

      <ModalShell
        eyebrow="Organiza o investimento do portfolio e conecta a estratégia aos épicos"
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
              Criar Tema
            </Button>
          </>
        }
        onClose={() => setOpen(false)}
        open={open}
        title="Novo Strategic Theme"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nt-name">
              Nome do tema <span className="text-rose-500">*</span>
            </Label>
            <Input
              autoFocus
              id="nt-name"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="ex: Resiliência de Plataforma"
              value={title}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nt-alloc">Orçamento alocado (M USD)</Label>
            <Input
              id="nt-alloc"
              min="0"
              onChange={(event) => setBudgetTotal(event.target.value)}
              placeholder="ex: 2.0"
              step="0.1"
              type="number"
              value={budgetTotal}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Cor / Tone</Label>
            <div className="flex flex-wrap gap-3.5">
              {TONE_OPTIONS.map((tone) => (
                <label
                  className="flex cursor-pointer items-center gap-1.5 text-xs capitalize"
                  key={tone.name}
                >
                  <input
                    checked={color === tone.hex}
                    className="sr-only"
                    name="nt-tone"
                    onChange={() => setColor(tone.hex)}
                    type="radio"
                    value={tone.hex}
                  />
                  <span
                    className="h-4 w-4 rounded-[6px] border-2 transition-transform hover:scale-110"
                    style={{
                      background: tone.hex,
                      borderColor:
                        color === tone.hex
                          ? "var(--foreground)"
                          : "transparent",
                    }}
                  />
                  {tone.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Épicos vinculados (opcional)</Label>
            <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto rounded-md border border-border/60 bg-muted/20 p-2">
              {allEpics.length === 0 && (
                <p className="p-2 text-center text-muted-foreground text-xs">
                  Nenhum épico disponível.
                </p>
              )}
              {allEpics.map((epic) => {
                const checked = selectedEpics.includes(epic.id);
                return (
                  <label
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                    key={epic.id}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => {
                        setSelectedEpics((prev) =>
                          value
                            ? [...prev, epic.id]
                            : prev.filter((id) => id !== epic.id)
                        );
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {epic.title}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
