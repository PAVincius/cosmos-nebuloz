// getVersionDiff — o diff de versão de política que o auditor abre.
//
// O que este teste barra é o P0: a montagem antiga recortava
// `body.slice(0, 180)` dos dois lados, então mudança no 3º parágrafo devolvia
// dois excertos *idênticos* sob "Antes" e "Depois", e o `…` era concatenado
// incondicionalmente — seção de 40 caracteres se apresentava como truncada.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireContext: vi.fn(),
  requirePermissionContext: vi.fn(),
  versionFindFirst: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireContext,
  requireCharterPermissionContext: h.requirePermissionContext,
  StateConflictError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({ charterPolicyVersion: { findFirst: h.versionFindFirst } }),
}));

import { getVersionDiff } from "../../app/(charter)/actions/policy";

const ctx = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "COMPLIANCE_LEAD",
  user: { name: "Bia", email: "bia@x.com" },
};

const P1 =
  "Esta política estabelece os limites de uso de sistemas de inteligência artificial pela organização, em qualquer área e por qualquer pessoa colaboradora.";
const P2 =
  "Todo caso de uso precisa de registro no inventário antes de entrar em produção, com pessoa responsável nomeada e classificação de risco declarada.";
const P3_ANTES =
  "O fornecedor deve manter registro de todas as inferências do modelo por prazo não inferior a vinte e quatro meses contados da data da decisão automatizada.";
const P3_DEPOIS =
  "O fornecedor deve manter registro de todas as inferências do modelo por prazo não inferior a trinta e seis meses contados da data da decisão automatizada.";
const P4 =
  "Decisão automatizada com efeito jurídico sobre pessoa natural exige revisão humana documentada antes de produzir qualquer efeito externo.";

const corpo = (p3: string) => [P1, P2, p3, P4].join("\n\n");
const CURTA_ANTES = "Revisão humana obrigatória em decisão.";
const CURTA_DEPOIS = "Revisão humana obrigatória em tudo.";

type Secao = {
  ordinal: number;
  name: string;
  body: string;
  status: string;
};

const secao = (ordinal: number, name: string, body: string): Secao => ({
  ordinal,
  name,
  body,
  status: "APPROVED",
});

function montar(anteriores: Secao[] | null, atuais: Secao[]) {
  h.versionFindFirst.mockImplementation((args: { where: { id?: string } }) => {
    if (args.where.id) {
      return Promise.resolve({
        id: "v-2",
        policyId: "pol-1",
        version: "v1.1",
        publishedAt: new Date("2026-09-01T00:00:00.000Z"),
        snapshot: atuais,
      });
    }
    return Promise.resolve(
      anteriores === null
        ? null
        : {
            id: "v-1",
            policyId: "pol-1",
            version: "v1.0",
            publishedAt: new Date("2026-08-01T00:00:00.000Z"),
            snapshot: anteriores,
          }
    );
  });
}

async function linhas(anteriores: Secao[] | null, atuais: Secao[]) {
  montar(anteriores, atuais);
  const res = await getVersionDiff("v-2");
  if (!(res.ok && res.data)) {
    throw new Error("diff não veio");
  }
  return res.data.rows;
}

describe("getVersionDiff", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireContext.mockResolvedValue(ctx);
  });

  it("mudança no 3º parágrafo não devolve dois blocos idênticos", async () => {
    const rows = await linhas(
      [secao(1, "Escopo", corpo(P3_ANTES))],
      [secao(1, "Escopo", corpo(P3_DEPOIS))]
    );

    expect(rows).toHaveLength(1);
    const removidas = rows[0].segmentos.filter((s) => s.tipo === "removida");
    const adicionadas = rows[0].segmentos.filter(
      (s) => s.tipo === "adicionada"
    );
    expect(removidas).toHaveLength(1);
    expect(adicionadas).toHaveLength(1);
    expect(removidas[0].texto).toBe(P3_ANTES);
    expect(adicionadas[0].texto).toBe(P3_DEPOIS);
    expect(removidas[0].texto).not.toBe(adicionadas[0].texto);
  });

  it("os parágrafos intocados continuam marcados como iguais", async () => {
    const rows = await linhas(
      [secao(1, "Escopo", corpo(P3_ANTES))],
      [secao(1, "Escopo", corpo(P3_DEPOIS))]
    );

    const iguais = rows[0].segmentos
      .filter((s) => s.tipo === "igual")
      .map((s) => s.texto);
    expect(iguais).toContain(P1);
    expect(iguais).toContain(P2);
    expect(iguais).toContain(P4);
  });

  it("seção curta inalterada não aparece no diff", async () => {
    const rows = await linhas(
      [secao(2, "Revisão", CURTA_ANTES)],
      [secao(2, "Revisão", CURTA_ANTES)]
    );

    expect(rows).toEqual([]);
  });

  it("seção curta alterada não ganha reticência de truncagem", async () => {
    const rows = await linhas(
      [secao(2, "Revisão", CURTA_ANTES)],
      [secao(2, "Revisão", CURTA_DEPOIS)]
    );

    expect(rows).toHaveLength(1);
    const textos = rows[0].segmentos.map((s) => s.texto);
    expect(textos).toEqual([CURTA_ANTES, CURTA_DEPOIS]);
    expect(textos.some((t) => t.endsWith("…"))).toBe(false);
    expect(rows[0].truncado).toBe(false);
  });

  it("seção nova chega inteira, marcada como nova", async () => {
    const rows = await linhas([], [secao(3, "Fornecedores", corpo(P3_DEPOIS))]);

    expect(rows).toHaveLength(1);
    expect(rows[0].field).toBe("S03 · Fornecedores");
    expect(rows[0].nova).toBe(true);
    expect(rows[0].segmentos.every((s) => s.tipo === "adicionada")).toBe(true);
    expect(rows[0].segmentos.map((s) => s.texto).join("\n")).toBe(
      corpo(P3_DEPOIS)
    );
  });

  it("nome alterado continua virando linha própria com os dois nomes", async () => {
    const rows = await linhas(
      [secao(4, "Uso aceitável", CURTA_ANTES)],
      [secao(4, "Uso vedado", CURTA_ANTES)]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].field).toBe("Nome de S04");
    expect(rows[0].nova).toBe(false);
    expect(rows[0].segmentos.map((s) => [s.tipo, s.texto])).toEqual([
      ["removida", "Uso aceitável"],
      ["adicionada", "Uso vedado"],
    ]);
  });

  it("primeira versão sem anterior traz todas as seções como novas", async () => {
    const rows = await linhas(null, [
      secao(1, "Escopo", CURTA_ANTES),
      secao(2, "Revisão", CURTA_DEPOIS),
    ]);

    expect(rows.map((r) => r.nova)).toEqual([true, true]);
  });
});
