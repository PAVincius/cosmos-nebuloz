// Ported from design/components/screen-dashboard.jsx's HBars —
// used for the "Alocação por Tema Estratégico" chart. Unlike the mockup
// (fixed tone palette), each row uses the StrategicTheme's real `color`
// hex value so the chart stays truthful to portfolio configuration.

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export type HBarDatum = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export function HBars({ data }: { data: HBarDatum[] }) {
  if (data.length === 0) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          height: 120,
          fontSize: 12,
          color: "var(--ink-faint)",
        }}
      >
        Sem custo de nuvem registrado neste mês.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value)) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12.5 }}>
      {data.map((d) => (
        <div key={d.id}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              marginBottom: 6,
            }}
          >
            <span style={{ color: "var(--ink-muted)" }}>{d.label}</span>
            <span
              className="font-mono"
              style={{ color: d.color, fontWeight: 700 }}
            >
              {currencyFormatter.format(d.value)}
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 99,
              background: "var(--surface-3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(d.value / max) * 100}%`,
                height: "100%",
                borderRadius: 99,
                background: d.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
