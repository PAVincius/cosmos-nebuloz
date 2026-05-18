"use client";

import { useState, useTransition } from "react";
import { Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { Input } from "@repo/design-system/components/ui/input";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { updateColumnColor, updateColumnLabel } from "@/app/actions/portfolio-kanban";

const PALETTE = [
  "#71717a", // zinc
  "#d97706", // amber
  "#8b5cf6", // violet
  "#5e6ad2", // brand
  "#0ea5e9", // sky
  "#27a644", // success
  "#ec4899", // pink
  "#ef4444", // red
];

type Props = {
  columnId: string;
  label: string;
  color: string;
};

export function ColumnSettings({ columnId, label, color }: Props) {
  const [open, setOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const [draftColor, setDraftColor] = useState(color);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirtyLabel = draftLabel.trim() !== label && draftLabel.trim().length > 0;
  const dirtyColor = draftColor !== color;

  function save() {
    setError(null);
    start(async () => {
      try {
        if (dirtyColor) {
          const res = await updateColumnColor({ columnId, color: draftColor });
          if (!res.ok) throw new Error(res.error);
        }
        if (dirtyLabel) {
          const res = await updateColumnLabel({ columnId, label: draftLabel.trim() });
          if (!res.ok) throw new Error(res.error);
        }
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
          aria-label={`Configurar coluna ${label}`}
        >
          <Settings2 className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3" sideOffset={6}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Nome
            </label>
            <Input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              maxLength={64}
              className="h-8 text-[13px]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Cor do indicador
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraftColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-sm border transition-all",
                    draftColor === c
                      ? "border-foreground ring-1 ring-foreground/40"
                      : "border-border/50 hover:border-foreground/40"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draftColor}
                onChange={(e) => setDraftColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent"
                aria-label="Cor customizada"
              />
              <Input
                value={draftColor}
                onChange={(e) => setDraftColor(e.target.value)}
                maxLength={7}
                className="h-7 font-mono text-[11px] uppercase"
                placeholder="#RRGGBB"
              />
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-border/60 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={pending || (!dirtyLabel && !dirtyColor)}
            >
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
