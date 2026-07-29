"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  FlaskConicalIcon,
  MinusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

export type FeatureForScenario = {
  id: string;
  title: string;
  epicTitle: string;
  bv: number;
  tc: number;
  rr: number;
  js: number;
  wsjfScore: number;
};

type ScenarioSimulatorProps = {
  features: FeatureForScenario[];
  epicTitles: { id: string; title: string }[];
};

/** Recomputes WSJF with a capacity multiplier applied to job size.
 *  Lower capacity → effective JS grows → WSJF drops (harder to fit the work). */
function simulateWSJF(
  bv: number,
  tc: number,
  rr: number,
  js: number,
  capacityMultiplier: number
): number {
  const effectiveJs = js / Math.max(0.1, capacityMultiplier);
  if (effectiveJs <= 0) {
    return 0;
  }
  return Math.round(((bv + tc + rr) / effectiveJs) * 10) / 10;
}

export function ScenarioSimulator({
  features,
  epicTitles,
}: ScenarioSimulatorProps) {
  const [open, setOpen] = useState(false);

  // Capacity sliders are keyed by epic id (best proxy for "team" given the data model)
  const [capacities, setCapacities] = useState<Record<string, number>>(() =>
    Object.fromEntries(epicTitles.map((e) => [e.id, 100]))
  );

  const simulatedRanking = useMemo(() => {
    const epicByTitle = new Map(epicTitles.map((e) => [e.title, e.id]));
    return features
      .map((f) => {
        const epicId = epicByTitle.get(f.epicTitle);
        const pct = epicId ? (capacities[epicId] ?? 100) : 100;
        const mult = pct / 100;
        const simWSJF = simulateWSJF(f.bv, f.tc, f.rr, f.js, mult);
        return { ...f, simWSJF, delta: simWSJF - f.wsjfScore };
      })
      .sort((a, b) => b.simWSJF - a.simWSJF);
  }, [features, capacities, epicTitles]);

  const changed = Object.values(capacities).some((v) => v !== 100);

  function resetCapacities() {
    setCapacities(Object.fromEntries(epicTitles.map((e) => [e.id, 100])));
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm" variant="outline">
          <FlaskConicalIcon className="h-4 w-4" />
          Simulador de Cenários
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Simulador de Cenários WSJF</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-[240px_1fr] gap-6">
          {/* Capacity sliders — one per epic */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Capacidade por Épico</h3>
              {changed && (
                <Button
                  className="h-6 text-xs"
                  onClick={resetCapacities}
                  size="sm"
                  variant="ghost"
                >
                  Resetar
                </Button>
              )}
            </div>
            {epicTitles.length === 0 && (
              <p className="text-muted-foreground text-xs">
                Nenhum épico com features e dados WSJF.
              </p>
            )}
            {epicTitles.map((epic) => {
              const pct = capacities[epic.id] ?? 100;
              return (
                <div className="flex flex-col gap-1.5" key={epic.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium" title={epic.title}>
                      {epic.title}
                    </span>
                    <Badge
                      className="ml-2 shrink-0 text-xs tabular-nums"
                      variant={
                        pct < 100
                          ? "destructive"
                          : pct > 100
                            ? "default"
                            : "secondary"
                      }
                    >
                      {pct}%
                    </Badge>
                  </div>
                  <Slider
                    className="w-full"
                    max={150}
                    min={30}
                    onValueChange={([v]: [number]) =>
                      setCapacities((prev) => ({ ...prev, [epic.id]: v }))
                    }
                    step={10}
                    value={[pct]}
                  />
                </div>
              );
            })}
          </div>

          {/* Simulated ranking */}
          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            <h3 className="font-semibold text-sm">
              Ranking Simulado
              {changed && (
                <span className="ml-2 font-normal text-muted-foreground text-xs">
                  (vs. ranking atual)
                </span>
              )}
            </h3>
            {simulatedRanking.map((f, i) => (
              <div
                className="flex items-center gap-2 rounded border border-border/80 bg-card px-3 py-2 text-xs"
                key={f.id}
              >
                <span className="w-5 shrink-0 text-right font-medium text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.title}</div>
                  <div className="truncate text-muted-foreground">
                    {f.epicTitle}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-semibold tabular-nums">
                    {f.simWSJF.toFixed(1)}
                  </span>
                  {f.delta > 0.05 ? (
                    <TrendingUpIcon className="h-3 w-3 text-emerald-500" />
                  ) : f.delta < -0.05 ? (
                    <TrendingDownIcon className="h-3 w-3 text-rose-500" />
                  ) : (
                    <MinusIcon className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
