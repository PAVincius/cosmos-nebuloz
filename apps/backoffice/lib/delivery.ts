/**
 * Ciclo de vida de um engajamento.
 *
 * Mora fora de `app/actions/engagements.ts` porque módulo `"use server"` só
 * pode exportar função async — mesma razão de `lib/comercial.ts`. E a tela
 * também precisa do mapa: um botão que oferece uma transição que a action
 * recusa é pior que não ter o botão.
 */

export const STATUS_ENGAJAMENTO = [
  "PROPOSTO",
  "ATIVO",
  "PAUSADO",
  "CONCLUIDO",
  "CANCELADO",
] as const;

export type StatusEngajamento = (typeof STATUS_ENGAJAMENTO)[number];

/**
 * Para onde cada estado pode ir.
 *
 * `CONCLUIDO` e `CANCELADO` são terminais de propósito. Um engajamento que
 * retrocede apaga a leitura de "já entregamos isso", que é como a operação
 * inteira se orienta — e no Benchmark faria a receita de um contrato entregue
 * sumir e reaparecer conforme alguém mexesse no status.
 *
 * Reabrir um contrato encerrado é decisão de negócio, não clique de tela: o
 * caminho é criar um engajamento novo, que preserva o histórico dos dois.
 */
export const TRANSICOES: Record<StatusEngajamento, StatusEngajamento[]> = {
  PROPOSTO: ["ATIVO", "CANCELADO"],
  ATIVO: ["PAUSADO", "CONCLUIDO", "CANCELADO"],
  PAUSADO: ["ATIVO", "CONCLUIDO", "CANCELADO"],
  CONCLUIDO: [],
  CANCELADO: [],
};

export const ROTULO_STATUS: Record<StatusEngajamento, string> = {
  PROPOSTO: "Proposto",
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export function podeIr(
  de: StatusEngajamento,
  para: StatusEngajamento
): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
