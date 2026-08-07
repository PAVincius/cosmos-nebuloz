// confidence-vote-fluxo.test.ts — o que a máquina de confidence vote impede.
//
// O comentário do próprio arquivo diz o ponto: "Ensures that a PI cannot just
// arbitrarily change from 'OPEN' to 'APPROVED'". A máquina existe para que o
// caminho seja obrigatório, não sugerido — e é isso que estes testes afirmam.
//
// O rework também limpa os votos, e isso importa: refazer o planejamento e
// contar de novo sobre a contagem antiga daria um número que não corresponde a
// votação nenhuma.

import { describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { confidenceVoteMachine } from "../confidenceVoteMachine";

function aberto() {
  const a = createActor(confidenceVoteMachine);
  a.start();
  a.send({ type: "START_VOTING" });
  return a;
}

describe("o caminho é obrigatório", () => {
  it("começa em NOT_STARTED", () => {
    const a = createActor(confidenceVoteMachine);
    a.start();

    expect(a.getSnapshot().value).toBe("NOT_STARTED");
  });

  it("não pula de OPEN direto para APPROVED", () => {
    // A razão de existir da máquina.
    const a = aberto();
    a.send({ type: "APPROVE_PI" });

    expect(a.getSnapshot().value).toBe("OPEN");
  });

  it("não vota antes de abrir", () => {
    const a = createActor(confidenceVoteMachine);
    a.start();
    a.send({ type: "SUBMIT_VOTE", vote: 5 });

    const snap = a.getSnapshot();
    expect(snap.value).toBe("NOT_STARTED");
    expect(snap.context.totalVotes).toBe(0);
  });

  it("evento fora de hora não corrompe o contexto", () => {
    // `recordVote` devolve o contexto intacto quando o evento não é
    // SUBMIT_VOTE. Sem isso, um evento inesperado zeraria os votos já dados.
    const a = aberto();
    a.send({ type: "SUBMIT_VOTE", vote: 4 });
    a.send({ type: "REQUIRE_REWORK" });

    expect(a.getSnapshot().context.votes).toEqual([4]);
  });
});

describe("contagem", () => {
  it("acumula voto e total", () => {
    const a = aberto();
    a.send({ type: "SUBMIT_VOTE", vote: 3 });
    a.send({ type: "SUBMIT_VOTE", vote: 5 });

    const ctx = a.getSnapshot().context;
    expect(ctx.votes).toEqual([3, 5]);
    expect(ctx.totalVotes).toBe(2);
  });

  it("fecha para apuração levando os votos", () => {
    const a = aberto();
    a.send({ type: "SUBMIT_VOTE", vote: 2 });
    a.send({ type: "CLOSE_VOTING" });

    const snap = a.getSnapshot();
    expect(snap.value).toBe("TALLYING");
    expect(snap.context.totalVotes).toBe(1);
  });

  it("apura sem voto nenhum — silêncio é resultado, não erro", () => {
    const a = aberto();
    a.send({ type: "CLOSE_VOTING" });

    const snap = a.getSnapshot();
    expect(snap.value).toBe("TALLYING");
    expect(snap.context.totalVotes).toBe(0);
  });
});

describe("rework e aprovação", () => {
  it("rework volta a votar do zero", () => {
    // Contar a votação nova sobre a contagem velha daria um número que não
    // corresponde a votação nenhuma.
    const a = aberto();
    a.send({ type: "SUBMIT_VOTE", vote: 1 });
    a.send({ type: "SUBMIT_VOTE", vote: 2 });
    a.send({ type: "CLOSE_VOTING" });
    a.send({ type: "REQUIRE_REWORK" });
    a.send({ type: "RESET_VOTING" });

    const snap = a.getSnapshot();
    expect(snap.value).toBe("OPEN");
    expect(snap.context.votes).toEqual([]);
    expect(snap.context.totalVotes).toBe(0);
  });

  it("aprovar é final — não volta de APPROVED", () => {
    const a = aberto();
    a.send({ type: "SUBMIT_VOTE", vote: 5 });
    a.send({ type: "CLOSE_VOTING" });
    a.send({ type: "APPROVE_PI" });

    const snap = a.getSnapshot();
    expect(snap.value).toBe("APPROVED");
    expect(snap.status).toBe("done");
  });

  it("de REWORK não se aprova direto", () => {
    const a = aberto();
    a.send({ type: "CLOSE_VOTING" });
    a.send({ type: "REQUIRE_REWORK" });
    a.send({ type: "APPROVE_PI" });

    expect(a.getSnapshot().value).toBe("REWORK");
  });
});
