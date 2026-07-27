"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Slider } from "@repo/design-system/components/ui/slider";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";

// ─── M9 — Rebalance WSJF (openRebalanceDialog, screens-portfolio.js:51) ────
// Client-only weighting of BV/TC/RR that re-ranks the priority table live.
// Not persisted — purely a "what-if" view over the real WSJF scores.

export type WSJFWeights = { bv: number; tc: number; rr: number };

export const DEFAULT_WSJF_WEIGHTS: WSJFWeights = { bv: 1, tc: 1, rr: 1 };

export function isDefaultWeights(weights: WSJFWeights): boolean {
  return weights.bv === 1 && weights.tc === 1 && weights.rr === 1;
}

const WEIGHT_PRESETS: { key: string; label: string; weights: WSJFWeights }[] = [
  { key: "balanced", label: "Equilibrado", weights: { bv: 1, tc: 1, rr: 1 } },
  {
    key: "ttm",
    label: "Time-to-market",
    weights: { bv: 1, tc: 1.75, rr: 0.75 },
  },
  {
    key: "risk",
    label: "Aversão a risco",
    weights: { bv: 0.75, tc: 1, rr: 1.75 },
  },
];

const WEIGHT_LABELS: Record<keyof WSJFWeights, string> = {
  bv: "Business Value",
  tc: "Time Criticality",
  rr: "Risk Reduction / Opp. Enablement",
};

function activePresetKey(weights: WSJFWeights): string | null {
  const found = WEIGHT_PRESETS.find(
    (p) =>
      p.weights.bv === weights.bv &&
      p.weights.tc === weights.tc &&
      p.weights.rr === weights.rr
  );
  return found?.key ?? null;
}

type RebalanceWeightsDialogProps = {
  open: boolean;
  onClose: () => void;
  weights: WSJFWeights;
  onWeightsChange: (weights: WSJFWeights) => void;
};

export function RebalanceWeightsDialog({
  open,
  onClose,
  weights,
  onWeightsChange,
}: RebalanceWeightsDialogProps) {
  const preset = activePresetKey(weights);

  return (
    <ModalShell
      eyebrow="Ajuste o peso de cada componente do Cost of Delay"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            Aplica-se ao ranking imediatamente
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onWeightsChange(DEFAULT_WSJF_WEIGHTS)}
              size="sm"
              variant="ghost"
            >
              Resetar
            </Button>
            <Button onClick={onClose} size="sm">
              Aplicar
            </Button>
          </div>
        </div>
      }
      onClose={onClose}
      open={open}
      size="md"
      title="Rebalancear WSJF"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Presets
          </span>
          <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-muted/30 p-1">
            {WEIGHT_PRESETS.map((p) => (
              <button
                className={[
                  "rounded-md px-3 py-1.5 font-medium text-xs transition-colors",
                  preset === p.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                ].join(" ")}
                key={p.key}
                onClick={() => onWeightsChange(p.weights)}
                type="button"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {(Object.keys(WEIGHT_LABELS) as (keyof WSJFWeights)[]).map((key) => (
          <div className="flex flex-col gap-2" key={key}>
            <label className="flex items-center justify-between text-sm">
              <span>{WEIGHT_LABELS[key]}</span>
              <span className="font-mono text-muted-foreground text-xs">
                peso {weights[key].toFixed(2)}×
              </span>
            </label>
            <div className="flex items-center gap-3">
              <Slider
                max={2}
                min={0.5}
                onValueChange={(value) =>
                  onWeightsChange({
                    ...weights,
                    [key]: value[0] ?? weights[key],
                  })
                }
                step={0.25}
                value={[weights[key]]}
              />
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
