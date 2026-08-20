// linear-state-map.test.ts — tradução de estado do Linear para a coluna do
// board do Cosmos.
//
// O Linear não tem tipo de estado próprio para revisão: "In Review",
// "Testando" e "QA" são todos `started`, exatamente como "In Progress". Como o
// mapa só olhava o tipo, tudo isso caía em IN_PROGRESS e a coluna REVIEW do
// board (`(cosmos)/actions/board.constants.ts`) nunca recebia nada vindo de
// integração — só de quem movia card na mão.
import { describe, expect, it } from "vitest";
import { linearStateToStatus } from "../../../app/actions/integrations/connectors/linear";

describe("linearStateToStatus", () => {
  it("traduz os tipos que o Linear define", () => {
    expect(linearStateToStatus("backlog")).toBe("BACKLOG");
    expect(linearStateToStatus("unstarted")).toBe("TODO");
    expect(linearStateToStatus("started")).toBe("IN_PROGRESS");
    expect(linearStateToStatus("completed")).toBe("DONE");
    expect(linearStateToStatus("cancelled")).toBe("CANCELLED");
  });

  it("cai em BACKLOG quando o tipo é desconhecido", () => {
    // `triage` existe no Linear e não tem coluna correspondente aqui. Backlog é
    // o destino honesto: não foi começado.
    expect(linearStateToStatus("triage")).toBe("BACKLOG");
    expect(linearStateToStatus("")).toBe("BACKLOG");
  });

  it("reconhece revisão pelo nome do estado, já que o tipo não distingue", () => {
    for (const nome of [
      "In Review",
      "Testando",
      "Em revisão",
      "QA",
      "Code Review",
      "Homologação",
    ]) {
      expect(linearStateToStatus("started", nome)).toBe("REVIEW");
    }
  });

  it("mantém IN_PROGRESS para estado começado que não é revisão", () => {
    expect(linearStateToStatus("started", "In Progress")).toBe("IN_PROGRESS");
    expect(linearStateToStatus("started", "Em andamento")).toBe("IN_PROGRESS");
    expect(linearStateToStatus("started")).toBe("IN_PROGRESS");
  });

  it("não deixa o nome sobrepor um tipo que já é terminal", () => {
    // Um time pode ter um estado `completed` chamado "Reviewed". Ele terminou —
    // devolver REVIEW o traria de volta para uma coluna em aberto.
    expect(linearStateToStatus("completed", "Reviewed")).toBe("DONE");
    expect(linearStateToStatus("backlog", "To review")).toBe("BACKLOG");
  });

  it("ignora caixa alta e baixa no tipo", () => {
    expect(linearStateToStatus("STARTED", "in review")).toBe("REVIEW");
    expect(linearStateToStatus("Completed")).toBe("DONE");
  });
});
