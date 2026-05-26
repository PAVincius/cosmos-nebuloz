"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import {
  ChevronDown,
  ChevronRight,
  Settings2Icon,
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { ExternalSourceBadge } from "@/app/(authenticated)/components/external-source-badge";
import { updateFeatureWSJF } from "@/app/actions/features/update-wsjf";
import type {
  EpicWithFeatures,
  FeatureWSJF,
  WSJFConfig,
} from "@/app/actions/wsjf";
import { saveWSJFConfig } from "@/app/actions/wsjf";
import type { AIAccessStatus } from "@/app/actions/wsjf/rebalance";
import {
  ExplainabilityPanel,
  type ExplainabilitySuggestion,
} from "./explainability-panel";
import {
  type FeatureForScenario,
  ScenarioSimulator,
} from "./scenario-simulator";

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

function ScorePicker({
  label,
  value,
  scale,
  onSelect,
  disabled,
}: ScorePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        aria-label={`${label}: ${value}`}
        className="rounded border border-border px-2 py-0.5 font-mono text-xs transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span className="mr-1 text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </button>

      {open ? (
        <>
          {/* backdrop */}
          <div
            aria-hidden
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-1 grid min-w-[120px] grid-cols-4 gap-1 rounded-lg border border-border bg-background p-2 shadow-lg">
            {scale.map((v) => (
              <button
                className={[
                  "rounded px-2 py-1 font-mono text-xs transition-colors",
                  v === value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                ].join(" ")}
                key={v}
                onClick={() => {
                  onSelect(v);
                  setOpen(false);
                }}
                type="button"
              >
                {v}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─── Sub-component: WSJF Badge ───────────────────────────────────────────────

function WSJFBadge({ score }: { score: number }) {
  if (score >= 10) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 font-mono font-semibold text-green-600 text-xs dark:text-green-400">
        {score.toFixed(2)}
      </span>
    );
  }
  if (score >= 5) {
    return (
      <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 font-mono font-semibold text-xs text-yellow-600 dark:text-yellow-500">
        {score.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-mono font-semibold text-muted-foreground text-xs">
      {score.toFixed(2)}
    </span>
  );
}

// ─── Sub-component: Feature Row ──────────────────────────────────────────────

type FeatureRowProps = {
  feature: FeatureWSJF;
  scale: number[];
  labels: WSJFConfig["labels"];
  onUpdate: (
    featureId: string,
    field: "bv" | "tc" | "rr" | "js",
    value: number
  ) => void;
  isPending: boolean;
};

function FeatureRow({
  feature,
  scale,
  labels,
  onUpdate,
  isPending,
}: FeatureRowProps) {
  return (
    <tr className="border-border/50 border-b last:border-0">
      <td className="py-2 pr-4 pl-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">{feature.title}</span>
          <ExternalSourceBadge
            source={feature.externalSource}
            url={feature.externalUrl}
          />
          <span className="font-mono text-muted-foreground/60 text-xs uppercase">
            {feature.statusId}
          </span>
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ScorePicker
            disabled={isPending}
            label={labels.bv}
            onSelect={(v) => onUpdate(feature.id, "bv", v)}
            scale={scale}
            value={feature.bv}
          />
          <ScorePicker
            disabled={isPending}
            label={labels.tc}
            onSelect={(v) => onUpdate(feature.id, "tc", v)}
            scale={scale}
            value={feature.tc}
          />
          <ScorePicker
            disabled={isPending}
            label={labels.rr}
            onSelect={(v) => onUpdate(feature.id, "rr", v)}
            scale={scale}
            value={feature.rr}
          />
          <ScorePicker
            disabled={isPending}
            label={labels.js}
            onSelect={(v) => onUpdate(feature.id, "js", v)}
            scale={scale}
            value={feature.js}
          />
        </div>
      </td>
      <td className="py-2 pr-4 pl-2 text-right">
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
  onUpdateFeature: (
    epicId: string,
    featureId: string,
    field: "bv" | "tc" | "rr" | "js",
    value: number
  ) => void;
  isPending: boolean;
};

type ExpandedContentOpts = {
  expanded: boolean;
  epic: EpicWithFeatures;
  scale: number[];
  labels: WSJFConfig["labels"];
  onUpdateFeature: EpicRowProps["onUpdateFeature"];
  isPending: boolean;
};

function renderExpandedContent(opts: ExpandedContentOpts) {
  const { expanded, epic, scale, labels, onUpdateFeature, isPending } = opts;
  if (!expanded) {
    return null;
  }
  if (epic.features.length === 0) {
    return (
      <tr className="border-border/50 border-b">
        <td
          className="py-3 pl-10 text-muted-foreground text-sm italic"
          colSpan={3}
        >
          Nenhuma feature neste épico ainda.
        </td>
      </tr>
    );
  }
  return epic.features.map((f) => (
    <FeatureRow
      feature={f}
      isPending={isPending}
      key={f.id}
      labels={labels}
      onUpdate={(featureId, field, value) =>
        onUpdateFeature(epic.id, featureId, field, value)
      }
      scale={scale}
    />
  ));
}

function EpicRow({
  epic,
  scale,
  labels,
  onUpdateFeature,
  isPending,
}: EpicRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer border-border border-b transition-colors hover:bg-muted/30"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <td className="py-3 pr-2 pl-4">
          <div className="flex flex-wrap items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">{epic.title}</span>
            <Badge
              className="text-xs uppercase tracking-wide"
              variant="outline"
            >
              {epic.statusId}
            </Badge>
            {epic.themeTitle ? (
              <span
                className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px]"
                style={
                  epic.themeColor
                    ? {
                        background: `${epic.themeColor}18`,
                        borderColor: `${epic.themeColor}55`,
                        color: epic.themeColor,
                      }
                    : {}
                }
              >
                {epic.themeTitle}
              </span>
            ) : null}
            {epic.dependencyCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 font-medium text-[10px] text-amber-600">
                <svg
                  aria-hidden="true"
                  className="h-2.5 w-2.5"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M7 1a1 1 0 0 0 0 2h1.586L5.293 6.293a1 1 0 1 0 1.414 1.414L10 4.414V6a1 1 0 0 0 2 0V2a1 1 0 0 0-1-1H7zm-4 7a1 1 0 0 1 1 1v1.586l3.293-3.293a1 1 0 1 1 1.414 1.414L5.414 11H7a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                </svg>
                {epic.dependencyCount} dep
              </span>
            ) : null}
            <span className="text-muted-foreground text-xs">
              {epic.features.length} feature
              {epic.features.length !== 1 ? "s" : ""}
            </span>
          </div>
        </td>
        <td className="px-2 py-3 text-muted-foreground text-xs">
          {expanded ? "—" : "Clique para expandir"}
        </td>
        <td className="py-3 pr-4 pl-2 text-right">
          <WSJFBadge score={epic.totalWSJF} />
        </td>
      </tr>

      {renderExpandedContent({
        expanded,
        epic,
        scale,
        labels,
        onUpdateFeature,
        isPending,
      })}
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

function ScaleConfigContent({
  config,
  onSave,
  isSaving,
}: ScaleConfigContentProps) {
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
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Presets
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_SCALES.map((preset) => (
            <button
              className={[
                "rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                activePreset?.label === preset.label
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted",
              ].join(" ")}
              key={preset.label}
              onClick={() => setLocalScale(preset.scale)}
              type="button"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Valores ativos
        </p>
        <div className="flex flex-wrap gap-1.5">
          {localScale.map((v) => (
            <span
              className="inline-flex items-center justify-center rounded border border-border bg-muted px-2.5 py-0.5 font-mono text-xs"
              key={v}
            >
              {v}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-border/60 border-t pt-4">
        <Button
          disabled={isSaving}
          onClick={() => {
            onSave({ ...config, scale: localScale });
          }}
          size="sm"
        >
          {isSaving ? "Salvando..." : "Salvar escala"}
        </Button>
        <p className="text-muted-foreground text-xs">
          Afeta apenas os pickers de pontuação. Scores já gravados mantêm-se até
          serem editados.
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

export function WSJFDashboard({
  epics: initialEpics,
  config: initialConfig,
  access,
}: WSJFDashboardProps) {
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSavingTransition] = useTransition();
  const [configOpen, setConfigOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ExplainabilitySuggestion[]>(
    []
  );

  const [optimisticEpics, dispatchEpicUpdate] = useOptimistic<
    OptimisticEpic[],
    {
      epicId: string;
      featureId: string;
      field: "bv" | "tc" | "rr" | "js";
      value: number;
    }
  >(initialEpics, (state, { epicId, featureId, field, value }) =>
    state.map((epic) => {
      if (epic.id !== epicId) {
        return epic;
      }

      const features = epic.features.map((f) => {
        if (f.id !== featureId) {
          return f;
        }
        const updated = { ...f, [field]: value };
        const js = updated.js > 0 ? updated.js : 1;
        const score =
          Math.round(((updated.bv + updated.tc + updated.rr) / js) * 100) / 100;
        return { ...updated, wsjfScore: score };
      });

      const totalWSJF =
        features.length > 0
          ? Math.round(
              (features.reduce((sum, f) => sum + f.wsjfScore, 0) /
                features.length) *
                100
            ) / 100
          : 0;

      return { ...epic, features, totalWSJF };
    })
  );

  // Derive epic-level entries for the scenario simulator (epics act as team proxies)
  const epicTitles = useMemo(
    () =>
      optimisticEpics
        .filter((e) => e.features.length > 0)
        .map((e) => ({ id: e.id, title: e.title })),
    [optimisticEpics]
  );

  const featuresForSimulator = useMemo<FeatureForScenario[]>(
    () =>
      optimisticEpics.flatMap((e) =>
        e.features.map((f) => ({
          id: f.id,
          title: f.title,
          epicTitle: e.title,
          bv: f.bv,
          tc: f.tc,
          rr: f.rr,
          js: f.js,
          wsjfScore: f.wsjfScore,
        }))
      ),
    [optimisticEpics]
  );

  const handleUpdateFeature = useCallback(
    (
      epicId: string,
      featureId: string,
      field: "bv" | "tc" | "rr" | "js",
      value: number
    ) => {
      startTransition(async () => {
        dispatchEpicUpdate({ epicId, featureId, field, value });

        // Build current scores after optimistic update for the server
        const epic = optimisticEpics.find((e) => e.id === epicId);
        const feature = epic?.features.find((f) => f.id === featureId);
        if (!feature) {
          return;
        }

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

  const handleSaveConfig = useCallback(async (config: WSJFConfig) => {
    await new Promise<void>((resolve) => {
      startSavingTransition(async () => {
        await saveWSJFConfig(config);
        resolve();
      });
    });
  }, []);

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Config Sheet */}
      <Sheet onOpenChange={setConfigOpen} open={configOpen}>
        <SheetContent
          className="w-full overflow-y-auto sm:max-w-sm"
          side="right"
        >
          <SheetHeader className="pb-2">
            <SheetTitle>Configurações WSJF</SheetTitle>
            <SheetDescription>
              Escala numérica para BV, TC, RR e JS. Alterada pelo Portfolio
              Manager / RTE.
            </SheetDescription>
          </SheetHeader>
          <ScaleConfigContent
            config={initialConfig}
            isSaving={isSaving}
            onSave={handleSaveConfig}
          />
        </SheetContent>
      </Sheet>

      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <ScenarioSimulator
          epicTitles={epicTitles}
          features={featuresForSimulator}
        />
        <Button
          className="gap-1.5 text-xs"
          onClick={() => setConfigOpen(true)}
          size="sm"
          variant="outline"
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
              Nenhum épico encontrado. Crie épicos no Portfolio Kanban para
              começar a priorizar.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-border border-b bg-muted/40">
                  <th className="py-3 pr-2 pl-4 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Épico / Feature
                  </th>
                  <th className="px-2 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Parâmetros WSJF
                  </th>
                  <th className="w-28 py-3 pr-4 pl-2 text-right font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {optimisticEpics.map((epic) => (
                  <EpicRow
                    epic={epic}
                    isPending={isPending}
                    key={epic.id}
                    labels={initialConfig.labels}
                    onUpdateFeature={handleUpdateFeature}
                    scale={initialConfig.scale}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: AI Rebalancing */}
      <div className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-primary/30 border-dashed bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold text-sm">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            Rebalanceamento por IA
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            Analise todos os épicos e features com base nas metas do portfólio e
            receba sugestões de repriorização automática.
          </p>
        </div>
        <div className="shrink-0 sm:pl-4">
          <RebalanceDialog
            access={access}
            epics={optimisticEpics}
            onSuggestions={setSuggestions}
          />
        </div>
      </div>

      {/* Section 4: Explainability Panel */}
      <div className="w-full min-w-0">
        <ExplainabilityPanel suggestions={suggestions} />
      </div>
    </div>
  );
}
