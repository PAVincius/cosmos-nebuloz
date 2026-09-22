// diffDeSnapshots — a montagem "dois snapshots → linhas de diff por seção".
//
// Morava dentro de `getVersionDiff`, onde só a tela alcançava. O pacote de
// evidência precisa exatamente do mesmo resultado: se cada um montasse o seu,
// o CSV que o auditor recebe poderia discordar da tela que a compliance lead
// abriu. Estes testes travam a montagem no lugar compartilhado.

import { describe, expect, it } from "vitest";
import {
  diffDeSnapshots,
  type SnapshotSection,
  snapshotSections,
} from "../../lib/charter/version-diff";

const secao = (
  ordinal: number,
  name: string,
  body: string
): SnapshotSection => ({ ordinal, name, body, status: "APPROVED" });

const ANTES =
  "O fornecedor deve manter registro das inferências por vinte e quatro meses.";
const DEPOIS =
  "O fornecedor deve manter registro das inferências por trinta e seis meses.";

const textos = (
  rows: ReturnType<typeof diffDeSnapshots>,
  i: number,
  tipo: string
) => rows[i].segmentos.filter((s) => s.tipo === tipo).map((s) => s.texto);

describe("diffDeSnapshots", () => {
  it("seção alterada vira uma linha com o texto dos dois lados", () => {
    const rows = diffDeSnapshots(
      [secao(1, "Escopo", ANTES)],
      [secao(1, "Escopo", DEPOIS)]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].field).toBe("S01 · Escopo");
    expect(rows[0].nova).toBe(false);
    expect(textos(rows, 0, "removida")).toEqual([ANTES]);
    expect(textos(rows, 0, "adicionada")).toEqual([DEPOIS]);
  });

  it("seção inalterada não vira linha", () => {
    const rows = diffDeSnapshots(
      [secao(1, "Escopo", ANTES)],
      [secao(1, "Escopo", ANTES)]
    );

    expect(rows).toEqual([]);
  });

  it("seção que não existia na versão anterior chega inteira e marcada", () => {
    const rows = diffDeSnapshots([], [secao(3, "Fornecedores", DEPOIS)]);

    expect(rows).toHaveLength(1);
    expect(rows[0].field).toBe("S03 · Fornecedores");
    expect(rows[0].nova).toBe(true);
    expect(rows[0].segmentos.every((s) => s.tipo === "adicionada")).toBe(true);
    expect(rows[0].segmentos.map((s) => s.texto).join("\n")).toBe(DEPOIS);
  });

  it("nome de seção alterado vira linha própria com os dois nomes", () => {
    const rows = diffDeSnapshots(
      [secao(4, "Uso aceitável", ANTES)],
      [secao(4, "Uso vedado", ANTES)]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].field).toBe("Nome de S04");
    expect(rows[0].segmentos.map((s) => [s.tipo, s.texto])).toEqual([
      ["removida", "Uso aceitável"],
      ["adicionada", "Uso vedado"],
    ]);
  });

  it("corpo e nome alterados na mesma seção viram duas linhas", () => {
    const rows = diffDeSnapshots(
      [secao(2, "Revisão", ANTES)],
      [secao(2, "Revisão humana", DEPOIS)]
    );

    expect(rows.map((r) => r.field)).toEqual([
      "S02 · Revisão humana",
      "Nome de S02",
    ]);
  });

  it("primeira publicação (sem anterior) traz todas as seções como novas", () => {
    const rows = diffDeSnapshots(
      [],
      [secao(1, "Escopo", ANTES), secao(2, "Revisão", DEPOIS)]
    );

    expect(rows.map((r) => [r.field, r.nova])).toEqual([
      ["S01 · Escopo", true],
      ["S02 · Revisão", true],
    ]);
  });

  // Seção só é criada no onboarding/seed: nenhuma action do app faz create ou
  // delete de `charterPolicySection`. Então snapshot com seção a menos não é
  // estado alcançável, e a montagem não inventa linha para ele. O teste existe
  // para que, se o produto passar a permitir remoção, a lacuna apareça aqui em
  // vez de sumir em silêncio do pacote de evidência.
  it("seção presente só no anterior não vira linha (produto não remove seção)", () => {
    const rows = diffDeSnapshots(
      [secao(1, "Escopo", ANTES), secao(9, "Revogada", DEPOIS)],
      [secao(1, "Escopo", ANTES)]
    );

    expect(rows).toEqual([]);
  });
});

describe("snapshotSections", () => {
  it("lê o Json do banco quando é lista", () => {
    const bruto: unknown = [secao(1, "Escopo", ANTES)];
    expect(snapshotSections(bruto)).toEqual([secao(1, "Escopo", ANTES)]);
  });

  it("devolve lista vazia para null, undefined e formato inesperado", () => {
    expect(snapshotSections(null)).toEqual([]);
    expect(snapshotSections(undefined)).toEqual([]);
    expect(snapshotSections({ secoes: [] })).toEqual([]);
  });
});
