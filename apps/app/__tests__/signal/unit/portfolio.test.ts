import { describe, expect, it } from "vitest";
import {
  computePortfolio,
  type PortfolioInput,
  rankForDecision,
  toMatrix,
} from "@/lib/signal/portfolio";
import { DEFAULT_BARS } from "@/lib/signal/verdict";
import { INITIATIVES } from "../fixtures";

const src = (over: Partial<PortfolioInput> = {}): PortfolioInput => ({
  code: "IN-001",
  name: "Teste",
  businessUnit: "Operações",
  category: "PRODUCTIVITY",
  status: "ACTIVE",
  entries: [
    { kind: "RETURN", label: "r", total: 200_000, sourceLabel: "s" },
    { kind: "COST", label: "c", total: 100_000, sourceLabel: "s" },
  ],
  adoption: { activeUsers: 8, licensedUsers: 10 },
  ...over,
});

/** As oito do handoff, convertidas para entrada de portfólio. */
const fromFixtures = (): PortfolioInput[] =>
  INITIATIVES.filter((i) => i.status === "ACTIVE").map((i) => ({
    code: i.code,
    name: i.name,
    businessUnit: i.businessUnit,
    category: i.category,
    status: i.status,
    entries: i.roiEntries,
    adoption: i.adoption,
  }));

describe("agregado", () => {
  it("soma os dois lados antes de dividir", () => {
    const p = computePortfolio(
      [
        src({
          code: "A",
          entries: [
            { kind: "RETURN", label: "r", total: 40_000, sourceLabel: "s" },
            { kind: "COST", label: "c", total: 10_000, sourceLabel: "s" },
          ],
        }),
        src({
          code: "B",
          entries: [
            { kind: "RETURN", label: "r", total: 500_000, sourceLabel: "s" },
            { kind: "COST", label: "c", total: 1_000_000, sourceLabel: "s" },
          ],
        }),
      ],
      DEFAULT_BARS
    );
    // Média de múltiplos daria 2,25 e faria a iniciativa de R$ 10 mil pesar
    // igual à de R$ 1 mi. O caixa não confirma essa história.
    expect(p.invested).toBe(1_010_000);
    expect(p.multiple).toBeCloseTo(540_000 / 1_010_000, 6);
    expect(p.multiple).toBeLessThan(1);
  });

  it("portfólio vazio não divide por zero", () => {
    const p = computePortfolio([], DEFAULT_BARS);
    expect(p).toMatchObject({
      invested: 0,
      returned: 0,
      multiple: 0,
      atRisk: 0,
    });
    expect(p.items).toEqual([]);
  });

  it("conta as iniciativas por quadrante", () => {
    const p = computePortfolio(fromFixtures(), DEFAULT_BARS);
    const total = Object.values(p.byVerdict).reduce((a, n) => a + n, 0);
    expect(total).toBe(p.items.length);
    // Das ativas do handoff: IN-021 é VANITY, IN-009 é PROMISE, IN-027 é STOP.
    expect(p.byVerdict.VANITY).toBeGreaterThanOrEqual(1);
    expect(p.byVerdict.PROMISE).toBeGreaterThanOrEqual(1);
  });
});

describe("valor em risco", () => {
  it("soma o INVESTIDO de VANITY e STOP, não o retorno", () => {
    // O que está em risco é o dinheiro que entrou, não o que saiu.
    const p = computePortfolio(
      [
        // 84% adoção, 0,9× → VANITY
        src({
          code: "V",
          adoption: { activeUsers: 84, licensedUsers: 100 },
          entries: [
            { kind: "RETURN", label: "r", total: 90_000, sourceLabel: "s" },
            { kind: "COST", label: "c", total: 100_000, sourceLabel: "s" },
          ],
        }),
        // 80% adoção, 2,0× → PROVEN
        src({
          code: "P",
          adoption: { activeUsers: 80, licensedUsers: 100 },
          entries: [
            { kind: "RETURN", label: "r", total: 400_000, sourceLabel: "s" },
            { kind: "COST", label: "c", total: 200_000, sourceLabel: "s" },
          ],
        }),
      ],
      DEFAULT_BARS
    );
    expect(p.atRisk).toBe(100_000);
  });

  it("NÃO conta promessa parada como risco — o retorno existe, falta escala", () => {
    const p = computePortfolio(
      [
        src({
          adoption: { activeUsers: 3, licensedUsers: 10 },
          entries: [
            { kind: "RETURN", label: "r", total: 300_000, sourceLabel: "s" },
            { kind: "COST", label: "c", total: 100_000, sourceLabel: "s" },
          ],
        }),
      ],
      DEFAULT_BARS
    );
    expect(p.byVerdict.PROMISE).toBe(1);
    expect(p.atRisk).toBe(0);
  });
});

describe("agrupamento", () => {
  it("agrupa por área e ordena por investimento", () => {
    const p = computePortfolio(
      [
        src({
          code: "A",
          businessUnit: "Ops",
          entries: [
            { kind: "COST", label: "c", total: 50_000, sourceLabel: "s" },
          ],
        }),
        src({
          code: "B",
          businessUnit: "Jurídico",
          entries: [
            { kind: "COST", label: "c", total: 300_000, sourceLabel: "s" },
          ],
        }),
        src({
          code: "C",
          businessUnit: "Ops",
          entries: [
            { kind: "COST", label: "c", total: 20_000, sourceLabel: "s" },
          ],
        }),
      ],
      DEFAULT_BARS
    );
    expect(p.byBusinessUnit.map((g) => g.key)).toEqual(["Jurídico", "Ops"]);
    expect(p.byBusinessUnit[0]?.invested).toBe(300_000);
    expect(p.byBusinessUnit[1]?.count).toBe(2);
  });

  it("agrupa por categoria também", () => {
    const p = computePortfolio(fromFixtures(), DEFAULT_BARS);
    const keys = p.byCategory.map((g) => g.key);
    expect(keys).toContain("PRODUCTIVITY");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("ranking de decisão", () => {
  it("põe quem precisa de decisão antes de quem vai bem", () => {
    const p = computePortfolio(fromFixtures(), DEFAULT_BARS);
    const ranked = rankForDecision(p.items);
    expect(ranked[0]?.verdict).toBe("VANITY");
    expect(ranked.at(-1)?.verdict).toBe("PROVEN");
  });

  it("dentro do mesmo veredito, o dinheiro decide", () => {
    const items = computePortfolio(
      [
        src({
          code: "PEQ",
          adoption: { activeUsers: 9, licensedUsers: 10 },
          entries: [
            { kind: "RETURN", label: "r", total: 10_000, sourceLabel: "s" },
            { kind: "COST", label: "c", total: 50_000, sourceLabel: "s" },
          ],
        }),
        src({
          code: "GRA",
          adoption: { activeUsers: 9, licensedUsers: 10 },
          entries: [
            { kind: "RETURN", label: "r", total: 100_000, sourceLabel: "s" },
            { kind: "COST", label: "c", total: 900_000, sourceLabel: "s" },
          ],
        }),
      ],
      DEFAULT_BARS
    ).items;
    const ranked = rankForDecision(items);
    expect(ranked[0]?.code).toBe("GRA");
  });

  it("não muta a lista original", () => {
    const items = computePortfolio(fromFixtures(), DEFAULT_BARS).items;
    const before = items.map((i) => i.code);
    rankForDecision(items);
    expect(items.map((i) => i.code)).toEqual(before);
  });
});

describe("matriz adoção × valor", () => {
  const bars = DEFAULT_BARS;

  it("põe a régua de valor no MEIO do eixo vertical", () => {
    const [onBar] = toMatrix(
      computePortfolio(
        [
          src({
            adoption: { activeUsers: 5, licensedUsers: 10 },
            entries: [
              { kind: "RETURN", label: "r", total: 150_000, sourceLabel: "s" },
              { kind: "COST", label: "c", total: 100_000, sourceLabel: "s" },
            ],
          }),
        ],
        bars
      ).items,
      bars
    );
    // 1,5× é exatamente a régua → 50%.
    expect(onBar?.y).toBeCloseTo(50, 5);
  });

  it("satura o topo para outlier não achatar o resto", () => {
    // Um 12× e um 4× decidem a mesma coisa ("escalar"). Escala linear crua
    // empurraria todo o resto para a base.
    const points = toMatrix(
      computePortfolio(
        [
          src({
            code: "ALTO",
            entries: [
              {
                kind: "RETURN",
                label: "r",
                total: 1_200_000,
                sourceLabel: "s",
              },
              { kind: "COST", label: "c", total: 100_000, sourceLabel: "s" },
            ],
          }),
          src({
            code: "BOM",
            entries: [
              { kind: "RETURN", label: "r", total: 400_000, sourceLabel: "s" },
              { kind: "COST", label: "c", total: 100_000, sourceLabel: "s" },
            ],
          }),
        ],
        bars
      ).items,
      bars
    );
    expect(points.every((p) => p.y <= 100)).toBe(true);
    // Os dois ficam saturados no topo, não um no topo e outro no meio.
    expect(points[0]?.y).toBe(100);
    expect(points[1]?.y).toBe(100);
  });

  it("dimensiona a bolha pelo investido, relativo ao maior", () => {
    const points = toMatrix(
      computePortfolio(
        [
          src({
            code: "G",
            entries: [
              { kind: "COST", label: "c", total: 200_000, sourceLabel: "s" },
            ],
          }),
          src({
            code: "P",
            entries: [
              { kind: "COST", label: "c", total: 50_000, sourceLabel: "s" },
            ],
          }),
        ],
        bars
      ).items,
      bars
    );
    expect(points.find((p) => p.code === "G")?.weight).toBe(1);
    expect(points.find((p) => p.code === "P")?.weight).toBeCloseTo(0.25, 5);
  });

  it("mantém x e y dentro do quadro, sempre", () => {
    const points = toMatrix(computePortfolio(fromFixtures(), bars).items, bars);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });

  it("iniciativa sem custo (múltiplo nulo) vai para a base, não some", () => {
    // Nulo é ausência de dado; a bolha precisa aparecer para alguém corrigir.
    const [p] = toMatrix(
      computePortfolio(
        [
          src({
            entries: [
              { kind: "RETURN", label: "r", total: 90_000, sourceLabel: "s" },
            ],
          }),
        ],
        bars
      ).items,
      bars
    );
    expect(p?.multiple).toBeNull();
    expect(p?.y).toBe(0);
  });

  it("carrega rótulo e tom do veredito para a legenda", () => {
    const [p] = toMatrix(computePortfolio([src()], bars).items, bars);
    expect(p?.label).toBe("Provado");
    expect(p?.tone).toBe("green");
  });
});
