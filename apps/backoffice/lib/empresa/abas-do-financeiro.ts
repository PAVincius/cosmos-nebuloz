/**
 * As abas do Financeiro (`/empresa/financeiro?aba=…`), numa lista só.
 *
 * Moravam dentro de `financeiro/page.tsx`, e a paleta (Ctrl+K) precisa das
 * mesmas para oferecer "Títulos" como destino — uma segunda cópia divergiria
 * no primeiro rótulo renomeado. Página de App Router não exporta nada além do
 * que o Next conhece, então a lista mora aqui e a página importa.
 */

export type AbaDoFinanceiro =
  | "dre"
  | "caixa"
  | "plano"
  | "lancamentos"
  | "titulos"
  | "orcado"
  | "recorrente";

export const ABAS_DO_FINANCEIRO: readonly {
  id: AbaDoFinanceiro;
  rotulo: string;
}[] = [
  { id: "dre", rotulo: "DRE mensal" },
  { id: "lancamentos", rotulo: "Lançamentos" },
  { id: "titulos", rotulo: "Títulos" },
  { id: "orcado", rotulo: "Orçado × realizado" },
  { id: "recorrente", rotulo: "Receita recorrente" },
  { id: "caixa", rotulo: "Caixa" },
  { id: "plano", rotulo: "Plano de contas" },
];
