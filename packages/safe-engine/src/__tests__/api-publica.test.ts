// api-publica.test.ts — o barril de `@repo/safe-engine`.
//
// `src/index.ts` é a superfície pública do pacote e não era importado por teste
// nenhum — aparecia com 0% de cobertura. Não é detalhe de métrica: um
// `export *` que some quebra quem consome em tempo de import, e o pacote que
// exporta é o último a descobrir.
//
// Este teste afirma o contrato, não a implementação: cada símbolo aqui é usado
// de fora do pacote.
import { describe, expect, it } from "vitest";
import * as safeEngine from "../index";

describe("superfície pública", () => {
  it("exporta as duas máquinas de estado", () => {
    expect(safeEngine.confidenceVoteMachine).toBeDefined();
    expect(safeEngine.epicLifecycleMachine).toBeDefined();
  });

  it("exporta o mapa de evento para status e o conjunto de transições elevadas", () => {
    expect(safeEngine.EVENT_TO_STATUS.MOVE_TO_BACKLOG).toBe(
      "PORTFOLIO_BACKLOG"
    );
    expect(safeEngine.ELEVATED_EVENTS.has("START_IMPLEMENTING")).toBe(true);
  });

  it("toda transição elevada existe no mapa de status", () => {
    // Se alguém acrescentar um evento elevado sem registrar o status de
    // destino, a validação que usa os dois cai em `undefined` em silêncio.
    for (const evento of safeEngine.ELEVATED_EVENTS) {
      expect(safeEngine.EVENT_TO_STATUS[evento]).toBeDefined();
    }
  });
});
