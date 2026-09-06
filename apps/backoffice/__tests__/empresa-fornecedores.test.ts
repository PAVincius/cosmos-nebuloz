// empresa-fornecedores.test.ts — spec §3.1: só as transições que a tela
// oferece existem, e ASSINADO sem evidência é afirmação, não prova.
import { describe, expect, it } from "vitest";
import {
  acoesDisponiveis,
  aplicarAcao,
  contadores,
} from "../lib/empresa/fornecedores";

const AGORA = new Date("2026-09-06T12:00:00Z");

describe("aplicarAcao", () => {
  it("A_ASSINAR + MARCAR_ACEITO com evidência vira ASSINADO e carimba assinadoEm", () => {
    const r = aplicarAcao(
      { estado: "A_ASSINAR", evidenciaUrl: null },
      "MARCAR_ACEITO",
      AGORA,
      "https://exemplo/dpa-assinado.pdf"
    );
    expect(r).toEqual({
      ok: true,
      patch: {
        estado: "ASSINADO",
        evidenciaUrl: "https://exemplo/dpa-assinado.pdf",
        assinadoEm: AGORA,
      },
    });
  });

  it("MARCAR_ACEITO sem evidência é recusado", () => {
    const r = aplicarAcao(
      { estado: "A_ASSINAR", evidenciaUrl: null },
      "MARCAR_ACEITO",
      AGORA
    );
    expect(r.ok).toBe(false);
  });

  it("SEM_DOCUMENTO + REGISTRAR_PEDIDO mantém o estado e carimba pedidoEm", () => {
    const r = aplicarAcao(
      { estado: "SEM_DOCUMENTO", evidenciaUrl: null },
      "REGISTRAR_PEDIDO",
      AGORA
    );
    expect(r).toEqual({
      ok: true,
      patch: { estado: "SEM_DOCUMENTO", pedidoEm: AGORA },
    });
  });

  it("SEM_DOCUMENTO + MARCAR_ACEITO com evidência vira ASSINADO (o DPA chegou)", () => {
    const r = aplicarAcao(
      { estado: "SEM_DOCUMENTO", evidenciaUrl: null },
      "MARCAR_ACEITO",
      AGORA,
      "https://exemplo/dpa.pdf"
    );
    expect(r.ok && r.patch.estado).toBe("ASSINADO");
  });

  it("EMBUTIDO não transita — nada a assinar", () => {
    expect(acoesDisponiveis("EMBUTIDO")).toEqual([]);
    const r = aplicarAcao(
      { estado: "EMBUTIDO", evidenciaUrl: null },
      "MARCAR_ACEITO",
      AGORA,
      "https://x"
    );
    expect(r.ok).toBe(false);
  });

  it("ASSINADO é terminal", () => {
    expect(acoesDisponiveis("ASSINADO")).toEqual([]);
  });

  it("A_ASSINAR não registra pedido — o documento já existe", () => {
    expect(acoesDisponiveis("A_ASSINAR")).toEqual(["MARCAR_ACEITO"]);
    const r = aplicarAcao(
      { estado: "A_ASSINAR", evidenciaUrl: null },
      "REGISTRAR_PEDIDO",
      AGORA
    );
    expect(r.ok).toBe(false);
  });
});

describe("contadores", () => {
  it("conta por estado e só conta bloqueio enquanto não assinado", () => {
    const c = contadores([
      { estado: "EMBUTIDO", bloqueiaVenda: false },
      { estado: "A_ASSINAR", bloqueiaVenda: true },
      { estado: "SEM_DOCUMENTO", bloqueiaVenda: true },
      { estado: "ASSINADO", bloqueiaVenda: true },
    ]);
    expect(c).toEqual({
      embutidos: 1,
      aAssinar: 1,
      semDocumento: 1,
      bloqueiamVenda: 2,
    });
  });
});
