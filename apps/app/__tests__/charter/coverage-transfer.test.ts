import { describe, expect, it } from "vitest";
import { planejarTransporte } from "@/lib/charter/coverage-transfer";

const base = {
  tenantId: "t1",
  idAnteriorParaCodigo: new Map([
    ["req-antigo-a", "A-1"],
    ["req-antigo-b", "B-1"],
  ]),
  novoPorCodigo: new Map([
    ["A-1", { id: "req-novo-a" }],
    ["B-1", { id: "req-novo-b" }],
  ]),
};

describe("planejarTransporte", () => {
  it("preserva o veredito quando o código não mudou de texto", () => {
    const linhas = planejarTransporte({
      ...base,
      codigosMudados: new Set(),
      coberturas: [
        {
          requirementId: "req-antigo-a",
          status: "ATENDE",
          comentario: "ok",
          capabilityId: "POLICY_LINK",
        },
      ],
    });

    expect(linhas).toEqual([
      {
        tenantId: "t1",
        requirementId: "req-novo-a",
        status: "ATENDE",
        comentario: "ok",
        capabilityId: "POLICY_LINK",
      },
    ]);
  });

  it("marca REVISAR só no código cujo texto mudou", () => {
    const linhas = planejarTransporte({
      ...base,
      codigosMudados: new Set(["A-1"]),
      coberturas: [
        {
          requirementId: "req-antigo-a",
          status: "ATENDE",
          comentario: null,
          capabilityId: null,
        },
        {
          requirementId: "req-antigo-b",
          status: "ATENDE",
          comentario: null,
          capabilityId: null,
        },
      ],
    });

    expect(linhas.find((l) => l.requirementId === "req-novo-a")?.status).toBe(
      "REVISAR"
    );
    expect(linhas.find((l) => l.requirementId === "req-novo-b")?.status).toBe(
      "ATENDE"
    );
  });

  it("descarta cobertura de código que sumiu da versão nova", () => {
    const linhas = planejarTransporte({
      ...base,
      novoPorCodigo: new Map([["A-1", { id: "req-novo-a" }]]),
      codigosMudados: new Set(),
      coberturas: [
        {
          requirementId: "req-antigo-b",
          status: "ATENDE",
          comentario: null,
          capabilityId: null,
        },
      ],
    });

    expect(linhas).toEqual([]);
  });

  it("ignora cobertura cujo requisito não pertence ao conjunto anterior", () => {
    const linhas = planejarTransporte({
      ...base,
      codigosMudados: new Set(),
      coberturas: [
        {
          requirementId: "req-de-outro-conjunto",
          status: "ATENDE",
          comentario: null,
          capabilityId: null,
        },
      ],
    });

    expect(linhas).toEqual([]);
  });
});
