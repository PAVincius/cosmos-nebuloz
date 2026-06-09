"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LayersIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type {
  EpicNode,
  StrategyMapData,
  ThemeNode,
} from "@/app/actions/strategy-map";
import { OKRNode } from "./okr-node";

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  ANALYSIS: "Análise",
  APPROVED: "Aprovado",
  ACTIVE: "Ativo",
  CLOSING: "Encerrando",
  ARCHIVED: "Arquivado",
};

// ─── EpicRow ──────────────────────────────────────────────────────────────────

function EpicRow({ epic }: { epic: EpicNode }) {
  const [open, setOpen] = useState(false);
  const hasOKRs = epic.okrs.length > 0;

  return (
    <div className="ml-6 border-border/50 border-l pl-4">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded py-1.5 text-left text-sm transition-colors hover:bg-muted/40"
        onClick={() => {
          if (hasOKRs) {
            setOpen((prev) => !prev);
          }
        }}
        type="button"
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
          <Badge className="shrink-0 text-xs" variant="outline">
            {epic.okrs.length} OKR{epic.okrs.length > 1 ? "s" : ""}
          </Badge>
        )}
      </button>

      {open && (
        <div className="mt-1 ml-5 flex flex-col gap-1.5 pb-2">
          {epic.okrs.map((okr) => (
            <OKRNode compact key={okr.id} okr={okr} />
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
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[var(--card-shadow)]">
      {/* Header */}
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: theme.color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {theme.code && (
              <span className="font-mono text-muted-foreground text-xs">
                {theme.code}
              </span>
            )}
            <span className="font-semibold text-sm">{theme.title}</span>
            <Badge className="text-xs" variant="secondary">
              {THEME_STATUS_LABELS[theme.status] ?? theme.status}
            </Badge>
            {theme.horizon && (
              <span className="text-muted-foreground text-xs">
                {theme.horizon}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#5e6ad2] transition-all duration-500"
                style={{ width: `${theme.progress}%` }}
              />
            </div>
            <span className="font-medium tabular-nums">{theme.progress}%</span>
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
        <div className="flex flex-col gap-3 border-border/50 border-t px-4 py-3">
          {/* Theme OKRs */}
          {theme.okrs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
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
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                <LayersIcon className="h-3 w-3" />
                Épicos ({theme.epics.length})
              </div>
              {theme.epics.map((epic) => (
                <EpicRow epic={epic} key={epic.id} />
              ))}
            </div>
          )}

          {/* Empty state */}
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

// ─── StrategyTree (public export) ─────────────────────────────────────────────

type StrategyTreeProps = {
  data: StrategyMapData;
};

export function StrategyTree({ data }: StrategyTreeProps) {
  if (data.themes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center text-muted-foreground text-sm">
        <LayersIcon className="mb-2 h-6 w-6" />
        <span>Nenhum Tema Estratégico configurado.</span>
        <Link
          className="mt-1 text-[#5e6ad2] hover:underline"
          href="/portfolio/themes"
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
          <div className="mb-2 flex items-center gap-2 font-semibold text-muted-foreground text-sm">
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
