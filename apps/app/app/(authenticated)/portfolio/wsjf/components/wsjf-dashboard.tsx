"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { motion, useReducedMotion } from "framer-motion";
import { Settings2Icon, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { updateFeatureWSJF } from "@/app/actions/features/update-wsjf";
import { saveWSJFConfig } from "@/app/actions/wsjf";
import type { AIAccessStatus } from "@/app/actions/wsjf/rebalance-schema";
import type { EpicWithFeatures, WSJFConfig } from "@/app/actions/wsjf/schema";
import {
  ExplainabilityPanel,
  type ExplainabilitySuggestion,
} from "./explainability-panel";
import {
  DEFAULT_WSJF_WEIGHTS,
  isDefaultWeights,
  RebalanceWeightsDialog,
  type WSJFWeights,
} from "./rebalance-weights-dialog";
import {
  type FeatureForScenario,
  ScenarioSimulator,
} from "./scenario-simulator";
import { WsjfPriorityTable } from "./wsjf-priority-table";

const RebalanceDialog = dynamic(
  () => import("./rebalance-dialog").then((m) => m.RebalanceDialog),
  { loading: () => null }
);

// KPI icon paths (lucide-react v0.542.0, multi-subpath icons flattened into a
// single `d` string — first command of each subpath forced to absolute `M`
// so their original coordinates hold once merged).
const ICON_TRENDING_UP = "M16 7h6v6M22 7-8.5 8.5-5-5L2 17";
const ICON_FLAG =
  "M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528";
const ICON_ACTIVITY =
  "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2";
const ICON_LIST_CHECKS = "M3 17 2 2 4-4M3 7 2 2 4-4M13 6h8M13 12h8M13 18h8";

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
  const prefersReducedMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSavingTransition] = useTransition();
  const [configOpen, setConfigOpen] = useState(false);
  const [themeFilter, setThemeFilter] = useState<string>("ALL");
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

  const themeOptions = useMemo(() => {
    const seen = new Map<string, { title: string; color: string }>();
    for (const e of optimisticEpics) {
      if (e.themeTitle && !seen.has(e.themeTitle)) {
        seen.set(e.themeTitle, {
          title: e.themeTitle,
          color: e.themeColor ?? "#888",
        });
      }
    }
    return Array.from(seen.values());
  }, [optimisticEpics]);

  const filteredEpics = useMemo(
    () =>
      themeFilter === "ALL"
        ? optimisticEpics
        : optimisticEpics.filter((e) => e.themeTitle === themeFilter),
    [optimisticEpics, themeFilter]
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

  // ── M9 Rebalance — client-side BV/TC/RR weighting, re-ranks the table
  // live and never persists (mirrors openRebalanceDialog in the prototype).
  const [weights, setWeights] = useState<WSJFWeights>(DEFAULT_WSJF_WEIGHTS);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);

  const allFeatures = useMemo(
    () => optimisticEpics.flatMap((epic) => epic.features),
    [optimisticEpics]
  );

  const weightedScores = useMemo(
    () =>
      allFeatures.map((f) => {
        const js = f.js > 0 ? f.js : 1;
        return (
          Math.round(
            ((f.bv * weights.bv + f.tc * weights.tc + f.rr * weights.rr) / js) *
              100
          ) / 100
        );
      }),
    [allFeatures, weights]
  );

  const maxScore = weightedScores.length > 0 ? Math.max(...weightedScores) : 0;
  const avgScore =
    weightedScores.length > 0
      ? weightedScores.reduce((a, b) => a + b, 0) / weightedScores.length
      : 0;
  const epicsAwaitingScore = optimisticEpics.filter(
    (epic) => epic.features.length === 0
  ).length;

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        {themeOptions.length > 0 && (
          <Select onValueChange={setThemeFilter} value={themeFilter}>
            <SelectTrigger
              aria-label="Filtrar por tema estratégico"
              className="h-8 w-48 text-xs"
            >
              <SelectValue placeholder="Todos os temas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os temas</SelectItem>
              {themeOptions.map((t) => (
                <SelectItem key={t.title} value={t.title}>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-2">
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
      </div>

      {/* Section 2: KPIs */}
      <KpiGrid>
        <KpiCard
          badge="— Fila WSJF"
          iconPath={ICON_TRENDING_UP}
          label="Features priorizadas"
          tone="accent"
          value={allFeatures.length}
        />
        <KpiCard
          badge="↗ Próxima a puxar"
          iconPath={ICON_FLAG}
          label="Maior WSJF"
          tone="green"
          value={maxScore.toFixed(1)}
        />
        <KpiCard
          badge="— Média do portfólio"
          iconPath={ICON_ACTIVITY}
          label="WSJF médio"
          tone="blue"
          value={avgScore.toFixed(1)}
        />
        <KpiCard
          badge="— Sem features ainda"
          iconPath={ICON_LIST_CHECKS}
          label="Aguardando score"
          tone="amber"
          value={epicsAwaitingScore}
        />
      </KpiGrid>

      {/* Section 3: AI Rebalancing banner (screen-wsjf.jsx order: KPIs → AI banner → ranking table) */}
      <div
        className="relative flex w-full min-w-0 flex-col gap-4 overflow-hidden p-6 sm:flex-row sm:items-center sm:justify-between"
        style={{
          borderRadius: 16,
          border: "1px solid rgba(var(--accent-rgb),.28)",
          background: "var(--accent-soft)",
        }}
      >
        {!prefersReducedMotion && (
          <motion.div
            animate={{ x: ["-120%", "220%"] }}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent)",
            }}
            transition={{
              duration: 2.8,
              ease: "linear",
              repeat: Number.POSITIVE_INFINITY,
            }}
          />
        )}
        <div className="relative flex min-w-0 flex-1 items-center gap-4">
          <div
            className="flex shrink-0 items-center justify-center"
            style={{
              background: "var(--accent-c)",
              borderRadius: 12,
              boxShadow: "0 8px 20px -6px rgba(var(--accent-rgb),.55)",
              color: "#04121a",
              height: 44,
              width: 44,
            }}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p
              className="font-semibold text-sm"
              style={{ color: "var(--ink)" }}
            >
              Rebalanceamento por IA
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              Analise todos os épicos e features com base nas metas do portfólio
              e receba sugestões de repriorização automática.
            </p>
          </div>
        </div>
        <div className="relative shrink-0 sm:pl-4">
          <RebalanceDialog
            access={access}
            epics={optimisticEpics}
            onSuggestions={setSuggestions}
          />
        </div>
      </div>

      {/* Section 4: Priority table (screenWsjf, screens-portfolio.js:9) */}
      <WsjfPriorityTable
        epics={filteredEpics}
        hasAnyFeatures={allFeatures.length > 0}
        isPending={isPending}
        labels={initialConfig.labels}
        onOpenRebalance={() => setRebalanceOpen(true)}
        onUpdateFeature={handleUpdateFeature}
        scale={initialConfig.scale}
        weights={weights}
        weightsActive={!isDefaultWeights(weights)}
      />

      <RebalanceWeightsDialog
        onClose={() => setRebalanceOpen(false)}
        onWeightsChange={setWeights}
        open={rebalanceOpen}
        weights={weights}
      />

      {/* Section 5: Explainability Panel */}
      <div className="w-full min-w-0">
        <ExplainabilityPanel suggestions={suggestions} />
      </div>
    </div>
  );
}
