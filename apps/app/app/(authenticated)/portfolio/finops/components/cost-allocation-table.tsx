import type { ThemeCostRow } from "@/app/actions/billing/cost-summary";

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

type Props = { rows: ThemeCostRow[]; totalCost: number };

export function CostAllocationTable({ rows, totalCost }: Props) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left font-medium text-muted-foreground">
              Tema Estratégico
            </th>
            <th className="p-2 text-right font-medium text-muted-foreground">
              Custo
            </th>
            <th className="p-2 text-right font-medium text-muted-foreground">
              % do Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.themeId} className="border-b">
              <td className="p-2 font-medium">{r.themeName}</td>
              <td className="p-2 text-right">{formatUSD(r.cost)}</td>
              <td className="p-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-muted-foreground">
                    {r.pct}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="p-2">Total</td>
            <td className="p-2 text-right">{formatUSD(totalCost)}</td>
            <td className="p-2 text-right">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
