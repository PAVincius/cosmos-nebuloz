import { afterEach, describe, expect, it, vi } from "vitest";
import {
  feriadosAbertos,
  feriadosDoAno,
  feriadosNoIntervalo,
} from "@/lib/feriados";

// O que precisa ser verdade sobre uma API pública de terceiro dentro de um
// cálculo de SLA: ela pode falhar de qualquer jeito, e o pior resultado
// aceitável é o comportamento de ontem. Nenhum destes testes toca a rede.

const PAYLOAD_2026 = [
  { date: "2026-01-01", name: "Confraternização mundial", type: "national" },
  { date: "2026-02-16", name: "Carnaval", type: "national" },
  { date: "2026-02-17", name: "Carnaval", type: "national" },
];

function mockFetch(impl: () => unknown) {
  // A assinatura precisa declarar o argumento: sem ela o TypeScript infere a
  // tupla de argumentos como `[]` e `mock.calls[0][0]` não compila — e é
  // justamente a URL chamada que metade destes testes verifica.
  const spy = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    Promise.resolve(impl() as Response)
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

const ok = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("feriadosDoAno", () => {
  it("devolve as datas como conjunto de YYYY-MM-DD", async () => {
    mockFetch(() => ok(PAYLOAD_2026));

    const f = await feriadosDoAno(2026);

    expect(f.has("2026-02-16")).toBe(true);
    expect(f.has("2026-02-17")).toBe(true);
    expect(f.size).toBe(3);
  });

  it("pede o ano certo ao BrasilAPI", async () => {
    const spy = mockFetch(() => ok([]));

    await feriadosDoAno(2027);

    expect(spy.mock.calls[0]?.[0]).toContain("/feriados/v1/2027");
  });

  it("devolve vazio quando a rede cai — nunca propaga o erro", async () => {
    mockFetch(() => {
      throw new Error("ECONNREFUSED");
    });

    await expect(feriadosDoAno(2026)).resolves.toEqual(new Set());
  });

  it("devolve vazio em resposta não-ok", async () => {
    mockFetch(() => ({ ok: false }) as Response);

    await expect(feriadosDoAno(2026)).resolves.toEqual(new Set());
  });

  it("devolve vazio quando o payload muda de forma", async () => {
    // Contrato de terceiro muda sem avisar. Um objeto onde se esperava lista
    // não pode virar exceção dentro do cálculo de SLA.
    mockFetch(() => ok({ erro: "manutenção" }));

    await expect(feriadosDoAno(2026)).resolves.toEqual(new Set());
  });

  it("descarta entrada malformada e mantém o resto", async () => {
    mockFetch(() =>
      ok([
        { date: "2026-01-01" },
        { date: 20_260_216 },
        { date: "16/02/2026" },
        { nome: "sem data" },
        null,
      ])
    );

    const f = await feriadosDoAno(2026);

    expect([...f]).toEqual(["2026-01-01"]);
  });
});

describe("feriadosNoIntervalo", () => {
  it("cobre a virada de ano buscando os dois anos", async () => {
    const spy = mockFetch(() => ok([]));

    await feriadosNoIntervalo(
      new Date("2025-12-20T00:00:00Z"),
      new Date("2026-01-10T00:00:00Z")
    );

    const anos = spy.mock.calls.map((c) => String(c[0]).slice(-4)).sort();
    expect(anos).toEqual(["2025", "2026"]);
  });

  it("junta os feriados dos anos cobertos num conjunto só", async () => {
    mockFetch(() => ok(PAYLOAD_2026));

    const f = await feriadosNoIntervalo(
      new Date("2025-12-20T00:00:00Z"),
      new Date("2026-01-10T00:00:00Z")
    );

    expect(f.has("2026-02-16")).toBe(true);
  });
});

describe("feriadosAbertos", () => {
  it("olha um ano para trás — caso de dezembro lido em janeiro", async () => {
    const spy = mockFetch(() => ok([]));

    await feriadosAbertos(new Date("2026-01-15T00:00:00Z"));

    const anos = spy.mock.calls.map((c) => String(c[0]).slice(-4)).sort();
    expect(anos).toEqual(["2025", "2026"]);
  });
});
