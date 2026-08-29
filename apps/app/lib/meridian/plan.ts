import { type GraphEdge, type GraphGap, topologicalOrder } from "./graph";

// Plano de 12 meses.
//
// O plano é a ordenação topológica do DAG de gaps, fatiada em quatro
// trimestres. Não é um calendário: é uma sequência com marcos. Por isso a
// bucketização é por posição na ordem, e não por data — e por isso a invariante
// que interessa é "nenhum item antes de um pré-requisito", verificada antes de
// gravar.

export type PlanEntry = {
  gapCode: string;
  quarter: number;
  seq: number;
};

const QUARTERS = 4;

/**
 * Sequencia os gaps e os distribui em quatro trimestres, em fatias iguais.
 *
 * A fatia é `ceil(total / 4)`: com 8 gaps, dois por trimestre; com 6, dois nos
 * dois primeiros e um nos dois últimos. Distribuir por nível topológico em vez
 * de por posição criaria trimestres vazios sempre que o grafo fosse raso — e um
 * plano com Q2 e Q3 vazios não é um plano, é um gráfico.
 */
export function buildPlan(gaps: GraphGap[], edges: GraphEdge[]): PlanEntry[] {
  if (gaps.length === 0) {
    return [];
  }
  const order = topologicalOrder(gaps, edges);
  const perQuarter = Math.ceil(order.length / QUARTERS);
  return order.map((gapCode, i) => ({
    gapCode,
    quarter: Math.min(QUARTERS, Math.floor(i / perQuarter) + 1),
    seq: i + 1,
  }));
}
