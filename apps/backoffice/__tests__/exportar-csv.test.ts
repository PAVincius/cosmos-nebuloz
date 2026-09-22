// exportar-csv.test.ts — crítica rodada 5 (H7): trilha de auditoria e
// títulos só existiam na tela. Quem precisava levar para planilha copiava
// linha a linha. Agora cada uma tem um GET que devolve CSV com os filtros da
// tela: UTF-8 com BOM (o Excel pt-BR abre acentuado), `;` como separador (a
// vírgula é o decimal daqui) e datas no fuso do painel.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));
vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const db = vi.hoisted(() => ({
  auditFindMany: vi.fn(),
  tituloFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
  database: {
    auditLog: { findMany: db.auditFindMany },
    tenantMember: { findFirst: vi.fn() },
    titulo: { findMany: db.tituloFindMany },
  },
}));

vi.mock("@/lib/guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/guard")>();
  return {
    ...actual,
    requirePlatformStaff: vi.fn(async () => ({
      canWrite: false,
      email: "a@b.c",
      name: null,
      userId: "u",
    })),
  };
});

const { paraCsv } = await import("@/lib/csv");
const { requirePlatformStaff, StaffAuthError } = await import("@/lib/guard");
const auditoria = await import("@/app/(staff)/audit/exportar/route");
const titulos = await import(
  "@/app/(staff)/empresa/financeiro/titulos/exportar/route"
);

const BOM = [0xef, 0xbb, 0xbf];
/** Escrito por código, não literal: o caractere é invisível no editor. */
const BOM_TEXTO = String.fromCharCode(0xfe_ff);

function semBom(texto: string): string {
  return texto.startsWith(BOM_TEXTO) ? texto.slice(1) : texto;
}

/** `Response.text()` decodifica UTF-8 e engole o BOM — os bytes, não. */
async function bytes(res: Response): Promise<number[]> {
  return [...new Uint8Array(await res.arrayBuffer())];
}

function linhas(texto: string): string[] {
  return texto.split("\r\n").filter((l) => l !== "");
}

beforeEach(() => {
  vi.clearAllMocks();
  db.auditFindMany.mockResolvedValue([]);
  db.tituloFindMany.mockResolvedValue([]);
});

describe("paraCsv", () => {
  it("começa pelo BOM, separa com ; e quebra linha com CRLF", () => {
    const csv = paraCsv(["A", "B"], [["1", "2"]]);

    expect(csv.startsWith(BOM_TEXTO)).toBe(true);
    expect(csv.slice(1)).toBe("A;B\r\n1;2\r\n");
  });

  it("escapa ;, aspas e quebra de linha entre aspas, dobrando as aspas", () => {
    const csv = paraCsv(
      ["x"],
      [["a;b"], ['diz "oi"'], ["linha 1\nlinha 2"], ["simples"]]
    );

    expect(csv.slice(1).split("\r\n").slice(1, 5)).toEqual([
      '"a;b"',
      '"diz ""oi"""',
      '"linha 1\nlinha 2"',
      "simples",
    ]);
  });

  it("vazio e nulo viram célula vazia; número entra como veio", () => {
    const csv = paraCsv(["a", "b", "c"], [[null, "", 3]]);

    expect(csv.slice(1)).toBe("a;b;c\r\n;;3\r\n");
  });

  it("texto que o Excel leria como fórmula é neutralizado; número negativo não", () => {
    const csv = paraCsv(
      ["x"],
      [["=HYPERLINK(1)"], ["@soma"], ["+1+1"], ["-12,50"]]
    );

    expect(linhas(csv.slice(1)).slice(1)).toEqual([
      "'=HYPERLINK(1)",
      "'@soma",
      "'+1+1",
      "-12,50",
    ]);
  });
});

describe("GET /audit/exportar", () => {
  const evento = {
    action: "tenant.create",
    createdAt: new Date("2026-09-18T15:30:00.000Z"),
    diff: null,
    entityId: "e1",
    entityType: "Tenant",
    id: "a1",
    metadata: { actorName: "Ana; Souza", target: 'Acme "Ltda"' },
    tenant: { name: "Acme", slug: "acme" },
  };

  it("devolve CSV anexado, com BOM, cabeçalho e datas no fuso do painel", async () => {
    db.auditFindMany.mockResolvedValue([evento]);

    const res = await auditoria.GET(
      new Request("http://painel/audit/exportar")
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="trilha-de-auditoria-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    const corpo = await bytes(res.clone());
    expect(corpo.slice(0, 3)).toEqual(BOM);

    const [cabecalho, primeira] = linhas(semBom(await res.text()));
    expect(cabecalho).toBe("Quando;Cliente;Ação;Entidade;Alvo;Autor");
    // 15:30 UTC = 12:30 em São Paulo.
    expect(primeira).toBe(
      '18/09/2026 12:30;acme;tenant.create;Tenant;"Acme ""Ltda""";"Ana; Souza"'
    );
  });

  it("aplica os filtros da tela e tem teto finito", async () => {
    await auditoria.GET(
      new Request(
        "http://painel/audit/exportar?tenant=t1&acao=tenant.create&entidade=Tenant&de=2026-09-01&ate=2026-09-10&pagina=3"
      )
    );

    const args = db.auditFindMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      action: "tenant.create",
      entityType: "Tenant",
      tenantId: "t1",
    });
    expect(args.where.createdAt.gte).toEqual(new Date("2026-09-01"));
    expect(args.where.createdAt.lte).toBeInstanceOf(Date);
    // A exportação leva o filtro inteiro, não a página que estava na tela.
    expect(args.skip ?? 0).toBe(0);
    expect(args.take).toBe(5000);
    expect(args.orderBy).toEqual({ createdAt: "desc" });
  });

  it.each([
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
  ] as const)("sem staff (%s) responde %i e não lê", async (codigo, status) => {
    vi.mocked(requirePlatformStaff).mockRejectedValueOnce(
      new StaffAuthError(codigo, "recusado")
    );

    const res = await auditoria.GET(
      new Request("http://painel/audit/exportar")
    );

    expect(res.status).toBe(status);
    expect(db.auditFindMany).not.toHaveBeenCalled();
  });
});

describe("GET /empresa/financeiro/titulos/exportar", () => {
  const base = {
    baixadoEm: null,
    clienteSlug: null,
    competenciaBaixa: null,
    conta: "4.1.01",
    contraparte: "Fornecedor X",
    descricao: "Licença",
    emissao: new Date("2026-08-01T00:00:00.000Z"),
    motivoCancelamento: null,
    status: "ABERTO",
    tipo: "PAGAR",
    valorCentavos: 123_456,
    vencimento: new Date("2020-08-10T00:00:00.000Z"),
  };

  it("CSV com valor em reais (vírgula decimal) e datas dd/mm/aaaa sem pular de dia", async () => {
    db.tituloFindMany.mockResolvedValue([{ ...base, id: "t1" }]);

    const res = await titulos.GET(
      new Request("http://painel/empresa/financeiro/titulos/exportar")
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="titulos-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect((await bytes(res.clone())).slice(0, 3)).toEqual(BOM);
    const [cabecalho, primeira] = linhas(semBom(await res.text()));
    expect(cabecalho).toBe(
      "Tipo;Situação;Descrição;Contraparte;Conta;Valor (R$);Emissão;Vencimento;Baixado em;Motivo do cancelamento;Cliente"
    );
    expect(primeira).toBe(
      "A pagar;Vencido;Licença;Fornecedor X;4.1.01;1234,56;01/08/2026;10/08/2020;;;"
    );
    const args = db.tituloFindMany.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: "system" });
    expect(args.take).toBe(5000);
  });

  it("filtra por tipo no banco e por situação como a tela calcula", async () => {
    db.tituloFindMany.mockResolvedValue([
      { ...base, id: "vencido" },
      {
        ...base,
        descricao: "Em dia",
        id: "aberto",
        vencimento: new Date("2999-01-01T00:00:00.000Z"),
      },
    ]);

    const res = await titulos.GET(
      new Request(
        "http://painel/empresa/financeiro/titulos/exportar?tipo=PAGAR&situacao=VENCIDO"
      )
    );

    expect(db.tituloFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
      tipo: "PAGAR",
    });
    const texto = await res.text();
    expect(texto).toContain("Licença");
    expect(texto).not.toContain("Em dia");
  });

  it("filtro fora do que a tela conhece é ignorado, não vira erro de banco", async () => {
    await titulos.GET(
      new Request(
        "http://painel/empresa/financeiro/titulos/exportar?tipo=QUALQUER&situacao=X"
      )
    );

    expect(db.tituloFindMany.mock.calls[0][0].where).toEqual({
      tenantId: "system",
    });
  });

  it.each([
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
  ] as const)("sem staff (%s) responde %i e não lê", async (codigo, status) => {
    vi.mocked(requirePlatformStaff).mockRejectedValueOnce(
      new StaffAuthError(codigo, "recusado")
    );

    const res = await titulos.GET(
      new Request("http://painel/empresa/financeiro/titulos/exportar")
    );

    expect(res.status).toBe(status);
    expect(db.tituloFindMany).not.toHaveBeenCalled();
  });
});
