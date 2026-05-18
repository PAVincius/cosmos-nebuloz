"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useOptimistic, useTransition, useState } from "react";
import { ChevronDown, ChevronRight, Settings2Icon, Sparkles } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@repo/design-system/components/ui/sheet";
import type { EpicWithFeatures, FeatureWSJF, WSJFConfig } from "@/app/actions/wsjf";
import { saveWSJFConfig } from "@/app/actions/wsjf";
import { updateFeatureWSJF } from "@/app/actions/features/update-wsjf";
import type { AIAccessStatus } from "@/app/actions/wsjf/rebalance";
import { appDesign } from "@/lib/app-design";

const RebalanceDialog = dynamic(
  () => import("./rebalance-dialog").then((m) => m.RebalanceDialog),
  { loading: () => null }
);

// ─── Sub-component: Score Picker ─────────────────────────────────────────────

type ScorePickerProps = {
  label: string;
  value: number;
  scale: number[];
  onSelect: (v: number) => void;
  disabled: boolean;
};

function ScorePicker({ label, value, scale, onSelect, disabled }: ScorePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="rounded border border-border px-2 py-0.5 text-xs font-mono hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`${label}: ${value}`}
      >
        <span className="text-muted-foreground mr-1">{label}</span>
        <span className="font-semibold">{value}</span>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute z-20 mt-1 bg-background border border-border rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1 min-w-[120px]">
            {scale.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  onSelect(v);
                  setOpen(false);
                }}
                className={[
                  "rounded px-2 py-1 text-xs font-mono transition-colors",
                  v === value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-component: WSJF Badge ───────────────────────────────────────────────

function WSJFBadge({ score }: { score: number }) {
  if (score >= 10) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-semibold bg-green-500/10 text-green-600 dark:text-green-400">
        {score.toFixed(2)}
      </span>
    );
  }
  if (score >= 5) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-semibold bg-yellow-500/10 text-yellow-600 dark:text-yellow-500">
        {score.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-semibold bg-muted text-muted-foreground">
      {score.toFixed(2)}
    </span>
  );
}

// ─── Sub-component: Feature Row ──────────────────────────────────────────────

type FeatureRowProps = {
  feature: FeatureWSJF;
  scale: number[];
  labels: WSJFConfig["labels"];
  onUpdate: (featureId: string, field: "bv" | "tc" | "rr" | "js", value: number) => void;
  isPending: boolean;
};

function FeatureRow({ feature, scale, labels, onUpdate, isPending }: FeatureRowProps) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="py-2 pl-10 pr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{feature.title}</span>
          <span className="text-xs text-muted-foreground/60 font-mono uppercase">
            {feature.statusId}
          </span>
        </div>
      </td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ScorePicker
            label={labels.bv}
            value={feature.bv}
            scale={scale}
            onSelect={(v) => onUpdate(feature.id, "bv", v)}
            disabled={isPending}
          />
          <ScorePicker
            label={labels.tc}
            value={feature.tc}
            scale={scale}
            onSelect={(v) => onUpdate(feature.id, "tc", v)}
            disabled={isPending}
          />
          <ScorePicker
            label={labels.rr}
            value={feature.rr}
            scale={scale}
            onSelect={(v) => onUpdate(feature.id, "rr", v)}
            disabled={isPending}
          />
          <ScorePicker
            label={labels.js}
            value={feature.js}
            scale={scale}
            onSelect={(v) => onUpdate(feature.id, "js", v)}
            disabled={isPending}
          />
        </div>
      </td>
      <td className="py-2 pl-2 pr-4 text-right">
        <WSJFBadge score={feature.wsjfScore} />
      </td>
    </tr>
  );
}

// ─── Sub-component: Epic Row ─────────────────────────────────────────────────

type EpicRowProps = {
  epic: EpicWithFeatures;
  scale: number[];
  labels: WSJFConfig["labels"];
  onUpdateFeature: (epicId: string, featureId: string, field: "bv" | "tc" | "rr" | "js", value: number) => void;
  isPending: boolean;
};

function EpicRow({ epic, scale, labels, onUpdateFeature, isPending }: EpicRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-border cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <td className="py-3 pl-4 pr-2">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="font-medium text-sm">{epic.title}</span>
            <Badge variant="outline" className="text-xs uppercase tracking-wide">
              {epic.statusId}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {epic.features.length} feature{epic.features.length !== 1 && "s"}
            </span>
          </div>
        </td>
        <td className="py-3 px-2 text-xs text-muted-foreground">
          {expanded ? "—" : "Clique para expandir"}
        </td>
        <td className="py-3 pl-2 pr-4 text-right">
          <WSJFBadge score={epic.totalWSJF} />
        </td>
      </tr>

      {expanded &&
        (epic.features.length === 0 ? (
          <tr className="border-b border-border/50">
            <td colSpan={3} className="py-3 pl-10 text-sm text-muted-foreground italic">
              Nenhuma feature neste épico ainda.
            </td>
          </tr>
        ) : (
          epic.features.map((f) => (
            <FeatureRow
              key={f.id}
              feature={f}
              scale={scale}
              labels={labels}
              onUpdate={(featureId, field, value) =>
                onUpdateFeature(epic.id, featureId, field, value)
              }
              isPending={isPending}
            />
          ))
        ))}
    </>
  );
}

// ─── Sub-component: Scale Config Sheet content ───────────────────────────────

const PRESET_SCALES: { label: string; scale: number[] }[] = [
  { label: "Fibonacci SAFe", scale: [1, 2, 3, 5, 8, 13, 20] },
  { label: "Simplificado", scale: [1, 2, 3, 5, 8] },
  { label: "Linear", scale: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
];

type ScaleConfigContentProps = {
  config: WSJFConfig;
  onSave: (config: WSJFConfig) => Promise<void>;
  isSaving: boolean;
};

function ScaleConfigContent({ config, onSave, isSaving }: ScaleConfigContentProps) {
  const [localScale, setLocalScale] = useState<number[]>(config.scale);

  useEffect(() => {
    setLocalScale(config.scale);
  }, [config.scale]);

  const activePreset = PRESET_SCALES.find(
    (p) => JSON.stringify(p.scale) === JSON.stringify(localScale)
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-2">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_SCALES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setLocalScale(preset.scale)}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activePreset?.label === preset.label
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted",
              ].join(" ")}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Valores ativos
        </p>
        <div className="flex flex-wrap gap-1.5">
          {localScale.map((v) => (
            <span
              key={v}
              className="inline-flex items-center justify-center rounded border border-border bg-muted px-2.5 py-0.5 font-mono text-xs"
            >
              {v}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-border/60 pt-4">
        <Button size="sm" onClick={() => void onSave({ ...config, scale: localScale })} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar escala"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Afeta apenas os pickers de pontuação. Scores já gravados mantêm-se até serem editados.
        </p>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

type WSJFDashboardProps = {
  epics: EpicWithFeatures[];
  config: WSJFConfig;
  access: AIAccessStatus;
};

type OptimisticEpic = EpicWithFeatures;

export function WSJFDashboard({ epics: initialEpics, config: initialConfig, access }: WSJFDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSavingTransition] = useTransition();
  const [configOpen, setConfigOpen] = useState(false);

  const [optimisticEpics, dispatchEpicUpdate] = useOptimistic<
    OptimisticEpic[],
    { epicId: string; featureId: string; field: "bv" | "tc" | "rr" | "js"; value: number }
  >(initialEpics, (state, { epicId, featureId, field, value }) =>
    state.map((epic) => {
      if (epic.id !== epicId) return epic;

      const features = epic.features.map((f) => {
        if (f.id !== featureId) return f;
        const updated = { ...f, [field]: value };
        const js = updated.js > 0 ? updated.js : 1;
        const score = Math.round(((updated.bv + updated.tc + updated.rr) / js) * 100) / 100;
        return { ...updated, wsjfScore: score };
      });

      const totalWSJF =
        features.length > 0
          ? Math.round(
              (features.reduce((sum, f) => sum + f.wsjfScore, 0) / features.length) * 100
            ) / 100
          : 0;

      return { ...epic, features, totalWSJF };
    })
  );

  const handleUpdateFeature = useCallback(
    (epicId: string, featureId: string, field: "bv" | "tc" | "rr" | "js", value: number) => {
      startTransition(async () => {
        dispatchEpicUpdate({ epicId, featureId, field, value });

        // Build current scores after optimistic update for the server
        const epic = optimisticEpics.find((e) => e.id === epicId);
        const feature = epic?.features.find((f) => f.id === featureId);
        if (!feature) return;

        const updated = { ...feature, [field]: value };

        await updateFeatureWSJF({
          featureId,
          bv: updated.bv,
          tc: updated.tc,
          rr: updated.rr,
          js: updated.js,
        });
      });
    },
    [optimisticEpics, dispatchEpicUpdate]
  );

  const handleSaveConfig = useCallback(
    async (config: WSJFConfig) => {
      startSavingTransition(async () => {
        await saveWSJFConfig(config);
      });
    },
    []
  );

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Config Sheet */}
      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle>Configurações WSJF</SheetTitle>
            <SheetDescription>
              Escala numérica para BV, TC, RR e JS. Alterada pelo Portfolio Manager / RTE.
            </SheetDescription>
          </SheetHeader>
          <ScaleConfigContent
            config={initialConfig}
            onSave={handleSaveConfig}
            isSaving={isSaving}
          />
        </SheetContent>
      </Sheet>

      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setConfigOpen(true)}
        >
          <Settings2Icon className="h-3.5 w-3.5" />
          Configurações
        </Button>
      </div>

      {/* Section 2: Priority table */}
      <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border bg-card">
        {optimisticEpics.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">
              Nenhum épico encontrado. Crie épicos no Portfolio Kanban para começar a priorizar.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-3 pl-4 pr-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Épico / Feature
                </th>
                <th className="py-3 px-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Parâmetros WSJF
                </th>
                <th className="w-28 py-3 pl-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {optimisticEpics.map((epic) => (
                <EpicRow
                  key={epic.id}
                  epic={epic}
                  scale={initialConfig.scale}
                  labels={initialConfig.labels}
                  onUpdateFeature={handleUpdateFeature}
                  isPending={isPending}
                />
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Section 3: AI Rebalancing */}
      <div className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            Rebalanceamento por IA
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Analise todos os épicos e features com base nas metas do portfólio e receba sugestões de
            repriorização automática.
          </p>
        </div>
        <div className="shrink-0 sm:pl-4">
          <RebalanceDialog epics={optimisticEpics} access={access} />
        </div>
      </div>
    </div>
  );
}
