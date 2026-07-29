"use client";

import { useOthers } from "@repo/collaboration/hooks";
import { Badge } from "@repo/design-system/components/cosmos/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { Download, LayoutGrid, Zap } from "lucide-react";

export type KanbanThemeOption = {
  id: string;
  title: string;
  color: string;
};

type KanbanToolbarProps = {
  themes: KanbanThemeOption[];
  activeTheme: string | null;
  onThemeChange: (themeId: string | null) => void;
  onAnalyzeAll: () => void;
  onExportCsv: () => void;
  analyzing: boolean;
};

/** Toolbar do board de épicos: densidade, IA, export CSV, presença e filtro por tema (screen-kanban.jsx). */
export function KanbanToolbar({
  themes,
  activeTheme,
  onThemeChange,
  onAnalyzeAll,
  onExportCsv,
  analyzing,
}: KanbanToolbarProps) {
  const others = useOthers();
  const onlineCount = others.length + 1;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-cosmos-md border border-hairline bg-surface-2 px-3 py-2">
      <span className="font-semibold text-[13px] text-ink">
        Board de Épicos
      </span>
      <Badge dot tone="green">
        {onlineCount} colaborador{onlineCount === 1 ? "" : "es"} online
      </Badge>
      <span aria-hidden className="h-4 w-px bg-hairline" />
      <Button
        aria-label="Alternar densidade"
        className="h-7 w-7"
        size="icon"
        title="Densidade do board"
        type="button"
        variant="ghost"
      >
        <LayoutGrid aria-hidden size={13} />
      </Button>
      <Button
        aria-label="Analisar todos os épicos com IA"
        className="h-7 gap-1.5 px-2 text-[11px]"
        disabled={analyzing}
        onClick={onAnalyzeAll}
        size="sm"
        title="Recalcular INVEST de todos os épicos"
        type="button"
        variant="ghost"
      >
        <Zap aria-hidden size={13} />
        {analyzing ? "Analisando…" : "Analisar tudo"}
      </Button>
      <Button
        aria-label="Exportar épicos em CSV"
        className="h-7 gap-1.5 px-2 text-[11px]"
        onClick={onExportCsv}
        size="sm"
        title="Exportar CSV"
        type="button"
        variant="ghost"
      >
        <Download aria-hidden size={13} />
        CSV
      </Button>

      <span aria-hidden className="h-4 w-px bg-hairline" />
      <span className="text-[11px] text-ink-muted">Filtrar por tema:</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          className={cn(
            "rounded-cosmos-pill border px-2.5 py-1 font-medium text-[11px] transition-colors",
            activeTheme === null
              ? "border-accent-c bg-accent-soft text-accent-text"
              : "border-hairline bg-surface text-ink-muted hover:text-ink"
          )}
          onClick={() => onThemeChange(null)}
          type="button"
        >
          Todos
        </button>
        {themes.map((theme) => (
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-cosmos-pill border px-2.5 py-1 font-medium text-[11px] transition-colors",
              activeTheme === theme.id
                ? "border-accent-c bg-accent-soft text-accent-text"
                : "border-hairline bg-surface text-ink-muted hover:text-ink"
            )}
            key={theme.id}
            onClick={() => onThemeChange(theme.id)}
            type="button"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: theme.color }}
            />
            {theme.title}
          </button>
        ))}
      </div>
    </div>
  );
}
