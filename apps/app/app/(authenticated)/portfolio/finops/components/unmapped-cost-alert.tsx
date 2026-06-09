type Props = { unmappedPct: number; unmappedCost: number };

function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function UnmappedCostAlert({ unmappedPct, unmappedCost }: Props) {
  if (unmappedPct < 10) {
    return null;
  }
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 text-sm">
      <p className="font-semibold">⚠ Custo não mapeado: {unmappedPct}%</p>
      <p className="mt-1 text-xs">
        {formatUSD(unmappedCost)} sem Tema Estratégico associado. Configure
        regras de mapeamento.
      </p>
    </div>
  );
}
