"use client";

import { LayersIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import type { EpicForTheme } from "@/app/actions/strategic-themes/schema";
import type { StrategyMapData } from "@/app/actions/strategy-map";
import { OKRNode } from "./okr-node";
import { ThemeCard } from "./theme-card";

// ─── StrategyTree (public export) ───────────────────────────────────────────
// Orchestrator: renders one ThemeCard per Strategic Theme (each with its own
// inline rename / palette / add-épico / delete affordances — see
// theme-card.tsx) plus the unlinked-OKRs shelf below.

type StrategyTreeProps = {
  data: StrategyMapData;
  allEpics: EpicForTheme[];
};

export function StrategyTree({ data, allEpics }: StrategyTreeProps) {
  if (data.themes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center text-muted-foreground text-sm">
        <LayersIcon className="mb-2 h-6 w-6" />
        <span>Nenhum Tema Estratégico configurado.</span>
        <Link
          className="mt-1 text-accent-text hover:underline"
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
        <div className="scroll-mt-4" id={`theme-${theme.id}`} key={theme.id}>
          <ThemeCard allEpics={allEpics} theme={theme} />
        </div>
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
