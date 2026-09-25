import { vi } from "vitest";

/**
 * `actions/agregados.ts` de mentira para os testes de tela que não são sobre
 * os KPIs. A action real importa `@repo/database`, e sob jsdom o guard de env
 * do @t3-oss derruba a suíte antes de a página renderizar. Aqui cada contagem
 * responde zero — quem testa o número mocka o próprio (`kpis-do-universo`).
 *
 * Uso: `vi.mock("@/app/actions/agregados", () => import("../vitest-mocks/agregados"))`.
 */
const zerado = <T>(data: T) => vi.fn(async () => ({ data, ok: true as const }));

export const agregadoDaCarteira = zerado({
  clientes: 0,
  modulosAtivos: 0,
  suspensos: 0,
  trials: 0,
});
export const agregadoDasContas = zerado({
  atencao: 0,
  renovando: 0,
  risco: 0,
  semSinal: 0,
});
export const agregadoDasPropostas = zerado({
  abertas: 0,
  decididas: 0,
  ganhas: 0,
  naFila: 0,
  pipelineAbertoCentavos: 0,
  ticketMedioCentavos: 0,
  total: 0,
});
export const agregadoDoFunil = zerado({
  ativos: 0,
  estagnados: 0,
  pelaEscada: null,
});
export const agregadoDoBenchmark = zerado({
  clientes: 0,
  receitaCentavos: 0,
  semContrato: 0,
});
