"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = { totalExpected: number; totalMin: number; totalMax: number };

export function CapacityForecastChart({
  totalExpected,
  totalMin,
  totalMax,
}: Props) {
  const errorLow = totalExpected - totalMin;
  const errorHigh = totalMax - totalExpected;

  const data = [
    { sprint: "Próximo", expected: totalExpected, err: [errorLow, errorHigh] },
    { sprint: "+2", expected: totalExpected, err: [errorLow, errorHigh] },
    { sprint: "+3", expected: totalExpected, err: [errorLow, errorHigh] },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-widest">
        Previsão — 3 Sprints
      </p>
      <ResponsiveContainer height={180} width="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit=" SP" />
          <Tooltip formatter={(v: number) => [`${v} SP`, "Estimado"]} />
          <Bar dataKey="expected" fill="#5e6ad2" radius={[4, 4, 0, 0]}>
            <ErrorBar
              dataKey="err"
              stroke="#5e6ad260"
              strokeWidth={2}
              width={4}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Barras de erro = intervalo p10–p90 da composição atual.
      </p>
    </div>
  );
}
