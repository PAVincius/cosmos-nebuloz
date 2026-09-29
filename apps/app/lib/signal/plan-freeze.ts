// Valor de baseline que uma métrica do plano leva para FROZEN (SG-PO-03,
// SG-PO-05). Puro e sem banco: o consumidor de `signal/baseline.frozen` e a
// aprovação de métrica proposta usam a mesma regra.
//
// valor assinado ?? valor anterior. O congelamento nunca APAGA um baseline que a
// métrica já tinha: se a dimensão do baseline assinado não traz valor numérico, o
// que estava antes continua. Só fica nulo se nunca houve valor.

export function resolveBaselineValue(
  dimensions: readonly { key: string; numericValue: unknown }[],
  dimensionKey: string | null,
  previous: unknown
): string | null {
  const signed =
    dimensionKey === null
      ? null
      : (dimensions.find((d) => d.key === dimensionKey)?.numericValue ?? null);
  if (signed !== null && signed !== undefined) {
    return String(signed);
  }
  return previous === null || previous === undefined ? null : String(previous);
}
