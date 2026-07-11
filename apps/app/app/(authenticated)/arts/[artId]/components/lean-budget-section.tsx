type LeanBudgetSectionProps = {
  spentM: number;
  allocatedM: number;
};

export function LeanBudgetSection({
  spentM = 1.62,
  allocatedM = 2.4,
}: LeanBudgetSectionProps) {
  const pct = allocatedM > 0 ? Math.round((spentM / allocatedM) * 100) : 0;
  const remainingM = Math.max(0, allocatedM - spentM);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Budget bar */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 14, color: "var(--ink-muted)", fontWeight: 500 }}>
            Consumo do orçamento
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--amber)",
            }}
          >
            US$ {spentM.toFixed(2)}M / US$ {allocatedM.toFixed(2)}M
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: "var(--surface-3)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, pct)}%`,
              borderRadius: 999,
              background: "linear-gradient(90deg, var(--amber), #f59e0b)",
              transition: "width .6s ease",
            }}
          />
        </div>

        <div style={{ marginTop: 6, fontSize: 11, color: "var(--ink-faint)" }}>
          {pct}% consumido · US$ {remainingM.toFixed(2)}M restante
        </div>
      </div>
    </div>
  );
}
