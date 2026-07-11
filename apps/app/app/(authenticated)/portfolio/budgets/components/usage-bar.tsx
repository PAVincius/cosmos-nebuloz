// Horizontal spend-vs-budget bar with a guardrail threshold marker,
// matching the Value Stream row treatment in the Cosmos design reference.

const GUARDRAIL_PCT = 80;

export type UsageBarTone = "green" | "amber" | "red";

type UsageBarProps = {
  amount: number;
  percentUsed: number;
  spent: number;
  tone: UsageBarTone;
};

const TONE_COLOR: Record<UsageBarTone, string> = {
  amber: "var(--amber-text)",
  green: "var(--green-text)",
  red: "var(--red-text)",
};

function formatCurrencyShort(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    currency: "USD",
    maximumFractionDigits: 1,
    notation: "compact",
    style: "currency",
  }).format(value);
}

/** Spend-vs-budget bar with a fixed guardrail reference line at 80% usage. */
export function UsageBar({ amount, percentUsed, spent, tone }: UsageBarProps) {
  const color = TONE_COLOR[tone];
  const fillPct = Math.min(100, Math.max(0, percentUsed));

  return (
    <div style={{ minWidth: 132 }}>
      <div className="flex items-center justify-between gap-2 font-mono text-[11.5px]">
        <span className="font-semibold" style={{ color }}>
          {formatCurrencyShort(spent)}
          <span className="font-medium text-ink-muted"> / {formatCurrencyShort(amount)}</span>
        </span>
        <span className="font-bold" style={{ color }}>
          {percentUsed}%
        </span>
      </div>
      <div style={{ marginTop: 6, position: "relative" }}>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
          <div
            className="h-full rounded-full"
            style={{ background: color, width: `${fillPct}%` }}
          />
        </div>
        <span
          style={{
            background: "var(--ink-faint)",
            borderRadius: 2,
            bottom: -3,
            left: `${GUARDRAIL_PCT}%`,
            position: "absolute",
            top: -3,
            width: 2,
          }}
          title={`Referência de guardrail · ${GUARDRAIL_PCT}% do orçamento`}
        />
      </div>
    </div>
  );
}
