"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LayersIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";
import { OKRNode } from "./okr-node";
import type {
  EpicNode,
  StrategyMapData,
  ThemeNode,
} from "@/app/actions/strategy-map";

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_STATUS_LABELS: Record<string, string> = {
  DRAFT:    "Rascunho",
  ANALYSIS: "Análise",
  APPROVED: "Aprovado",
  ACTIVE:   "Ativo",
  CLOSING:  "Encerrando",
  ARCHIVED: "Arquivado",
};

// ─── EpicRow ──────────────────────────────────────────────────────────────────

function EpicRow({ epic }: { epic: EpicNode }) {
  const [open, setOpen] = useState(false);
  const hasOKRs = epic.okrs.length > 0;

  return (
    <div className="ml-6 border-l border-border/50 pl-4">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded py-1.5 text-left text-sm transition-colors hover:bg-muted/40"
        onClick={() => {
          if (hasOKRs) setOpen((prev) => !prev);
        }}
        aria-expanded={open}
      >
        {hasOKRs ? (
          open ? (
            <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <ZapIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">
          {epic.title}
        </span>
        {epic.okrs.length > 0 && (
          <Badge variant="outline" className="shrink-0 text-xs">
            {epic.okrs.length} OKR{epic.okrs.length > 1 ? "s" : ""}
          </Badge>
        )}
      </button>

      {open && (
        <div className="ml-5 mt-1 flex flex-col gap-1.5 pb-2">
          {epic.okrs.map((okr) => (
            <OKRNode key={okr.id} okr={okr} compact />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ThemeCard ────────────────────────────────────────────────────────────────

function ThemeCard({ theme }: { theme: ThemeNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: theme.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {theme.code && (
              <span className="font-mono text-xs text-muted-foreground">
                {theme.code}
              </span>
            )}
            <span className="text-sm font-semibold">{theme.title}</span>
            <Badge variant="secondary" className="text-xs">
              {THEME_STATUS_LABELS[theme.status] ?? theme.status}
            </Badge>
            {theme.horizon && (
              <span className="text-xs text-muted-foreground">
                {theme.horizon}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#5e6ad2] transition-all duration-500"
                style={{ width: `${theme.progress}%` }}
              />
            </div>
            <span className="tabular-nums font-medium">{theme.progress}%</span>
          </div>
          {open ? (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-3">
          {/* Theme OKRs */}
          {theme.okrs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <TargetIcon className="h-3 w-3" />
                OKRs do Tema
              </div>
              {theme.okrs.map((okr) => (
                <OKRNode key={okr.id} okr={okr} />
              ))}
            </div>
          )}

          {/* Epics */}
          {theme.epics.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <LayersIcon className="h-3 w-3" />
                Épicos ({theme.epics.length})
              </div>
              {theme.epics.map((epic) => (
                <EpicRow key={epic.id} epic={epic} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {theme.okrs.length === 0 && theme.epics.length === 0 && (
            <p className="py-2 text-center text-xs italic text-muted-foreground">
              Nenhum OKR ou épico ligado a este tema ainda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── StrategyTree (public export) ─────────────────────────────────────────────

type StrategyTreeProps = {
  data: StrategyMapData;
};

export function StrategyTree({ data }: StrategyTreeProps) {
  if (data.themes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        <LayersIcon className="mb-2 h-6 w-6" />
        <span>Nenhum Tema Estratégico configurado.</span>
        <Link
          href="/portfolio/themes"
          className="mt-1 text-[#5e6ad2] hover:underline"
        >
          Criar temas
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {data.themes.map((theme) => (
        <ThemeCard key={theme.id} theme={theme} />
      ))}

      {data.unlinkedOKRs.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <TargetIcon className="h-4 w-4" />
            OKRs de PI/ART e Times ({data.unlinkedOKRs.length})
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.unlinkedOKRs.map((okr) => (
              <OKRNode key={okr.id} okr={okr} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
