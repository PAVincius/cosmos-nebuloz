// exportEvidence — o pacote de evidência precisa levar o diff de verdade.
//
// O que este teste barra: o pacote saía com contagem. `publishPolicyVersion`
// gravava `["Seções alteradas", "—", "9"]` no evento, e `toCsv` serializava
// isso como "Seções alteradas: — → 9". A tela (DiffModal, PR #236) mostrava o
// texto alterado; o artefato que sai do produto, não. Agora o diff é derivado
// dos snapshots imutáveis da versão e da anterior, com a mesma montagem da
// tela — o CSV do auditor não pode discordar do que a compliance lead viu.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireContext: vi.fn(),
  requirePermissionContext: vi.fn(),
  auditFindMany: vi.fn(),
  auditCreate: vi.fn(),
  versionFindMany: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireContext,
  requireCharterPermissionContext: h.requirePermissionContext,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      auditLog: { findMany: h.auditFindMany, create: h.auditCreate },
      charterPolicyVersion: { findMany: h.versionFindMany },
    }),
}));

import { exportEvidence } from "../../app/(charter)/actions/audit";

const ctx = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "COMPLIANCE_LEAD",
  user: { name: "Bia Nunes", email: "bia@x.com" },
};

const RETENCAO_ANTES =
  "O fornecedor deve manter registro das inferências do modelo por prazo não inferior a vinte e quatro meses.";
const RETENCAO_DEPOIS =
  "O fornecedor deve manter registro das inferências do modelo por prazo não inferior a trinta e seis meses.";
const REVISAO =
  "Decisão automatizada com efeito jurídico exige revisão humana documentada.";

const secao = (ordinal: number, name: string, body: string) => ({
  ordinal,
  name,
  body,
  status: "APPROVED",
});

const PUBLICACAO = {
  id: "ev-2",
  entityType: "charter.policy",
  entityId: "pol-1",
  action: "Publicou versão",
  actorId: "u-1",
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  diff: [
    ["Versão", "v1.0", "v1.1"],
    ["Trilhas para reatribuir", "—", "3"],
  ],
  metadata: {
    target: "Política de IA · v1.1",
    note: "Ajuste do prazo de retenção",
    charterRole: "COMPLIANCE_LEAD",
    actorName: "Bia Nunes",
  },
};

const DECISAO = {
  id: "ev-1",
  entityType: "charter.usecase",
  entityId: "uc-9",
  action: "Aprovou caso de uso",
  actorId: "u-2",
  createdAt: new Date("2026-08-20T09:00:00.000Z"),
  diff: [["Status", "EM_REVISAO", "APROVADO"]],
  metadata: {
    target: "UC-118 · Triagem de sinistros",
    note: null,
    charterRole: "RISK_OWNER",
    actorName: "Caio Melo",
  },
};

const VERSOES = [
  {
    policyId: "pol-1",
    version: "v1.0",
    snapshot: [
      secao(1, "Escopo", RETENCAO_ANTES),
      secao(2, "Revisão", REVISAO),
    ],
  },
  {
    policyId: "pol-1",
    version: "v1.1",
    snapshot: [
      secao(1, "Escopo", RETENCAO_DEPOIS),
      secao(2, "Revisão", REVISAO),
    ],
  },
];

const FILTRO = {
  from: "2026-08-01T00:00:00.000Z",
  to: "2026-09-30T00:00:00.000Z",
  categories: ["policy", "decision"],
};

/** Parser RFC 4180 — prova que a célula multilinha sobrevive ao escape. */
function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        aspas = false;
        i += 1;
        continue;
      }
      campo += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      aspas = true;
    } else if (c === ",") {
      linha.push(campo);
      campo = "";
    } else if (c === "\n") {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else {
      campo += c;
    }
    i += 1;
  }
  linha.push(campo);
  linhas.push(linha);
  return linhas;
}

async function exportar(format: "csv" | "json") {
  const res = await exportEvidence({ ...FILTRO, format });
  if (!res.ok) {
    throw new Error(`exportação falhou: ${res.error}`);
  }
  return res.data;
}

type LinhaJson = {
  id: string;
  actor: string;
  diff: [string, string, string][] | null;
  sections?: {
    field: string;
    nova: boolean;
    segmentos: { tipo: string; texto: string }[];
  }[];
};

describe("exportEvidence — diff derivado do snapshot", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requirePermissionContext.mockResolvedValue(ctx);
    h.auditFindMany.mockResolvedValue([DECISAO, PUBLICACAO]);
    h.auditCreate.mockResolvedValue({});
    h.versionFindMany.mockResolvedValue(VERSOES);
  });

  it("JSON traz os segmentos da seção alterada, não a contagem", async () => {
    const pacote = await exportar("json");
    const rows = JSON.parse(pacote.content) as LinhaJson[];
    const publicacao = rows.find((r) => r.id === "ev-2");

    const escopo = publicacao?.sections?.find(
      (s) => s.field === "S01 · Escopo"
    );
    expect(escopo).toBeDefined();
    expect(escopo?.nova).toBe(false);
    expect(
      escopo?.segmentos.filter((s) => s.tipo === "removida").map((s) => s.texto)
    ).toEqual([RETENCAO_ANTES]);
    expect(
      escopo?.segmentos
        .filter((s) => s.tipo === "adicionada")
        .map((s) => s.texto)
    ).toEqual([RETENCAO_DEPOIS]);
  });

  it("JSON não inventa linha para seção intocada", async () => {
    const pacote = await exportar("json");
    const rows = JSON.parse(pacote.content) as LinhaJson[];
    const publicacao = rows.find((r) => r.id === "ev-2");

    expect(publicacao?.sections?.map((s) => s.field)).toEqual(["S01 · Escopo"]);
  });

  it("CSV traz o nome da seção e o texto com - e +", async () => {
    const pacote = await exportar("csv");
    const tabela = parseCsv(pacote.content);
    const celula = tabela.find((l) => l[0] === "ev-2")?.at(-1) ?? "";

    expect(celula).toContain("S01 · Escopo");
    expect(celula).toContain(`- ${RETENCAO_ANTES}`);
    expect(celula).toContain(`+ ${RETENCAO_DEPOIS}`);
    expect(celula).not.toContain("Seções alteradas");
  });

  it("CSV mantém os campos do evento acima do diff de seções", async () => {
    const pacote = await exportar("csv");
    const tabela = parseCsv(pacote.content);
    const celula = tabela.find((l) => l[0] === "ev-2")?.at(-1) ?? "";

    expect(celula).toContain("Versão: v1.0 → v1.1");
    expect(celula).toContain("Trilhas para reatribuir: — → 3");
    expect(celula.indexOf("Versão: v1.0")).toBeLessThan(
      celula.indexOf("S01 · Escopo")
    );
  });

  it("a célula multilinha é CSV válido: escapa quebra de linha e aspas", async () => {
    h.auditFindMany.mockResolvedValue([
      {
        ...PUBLICACAO,
        metadata: { ...PUBLICACAO.metadata, note: 'Nota com "aspas"' },
      },
    ]);
    const pacote = await exportar("csv");
    const tabela = parseCsv(pacote.content);

    // Cabeçalho + uma linha só, embora a célula tenha várias quebras.
    expect(tabela).toHaveLength(2);
    expect(tabela[1]).toHaveLength(tabela[0].length);
    expect(tabela[1][7]).toBe('Nota com "aspas"');
    expect((tabela[1].at(-1) ?? "").split("\n").length).toBeGreaterThan(2);
  });

  it("evento que não é publicação segue com o diff que já tinha", async () => {
    const csv = await exportar("csv");
    const celula =
      parseCsv(csv.content)
        .find((l) => l[0] === "ev-1")
        ?.at(-1) ?? "";
    expect(celula).toBe("Status: EM_REVISAO → APROVADO");

    const rows = JSON.parse((await exportar("json")).content) as LinhaJson[];
    const decisao = rows.find((r) => r.id === "ev-1");
    expect(decisao?.diff).toEqual([["Status", "EM_REVISAO", "APROVADO"]]);
    expect(decisao?.sections).toBeUndefined();
  });

  it("primeira publicação, sem anterior, traz as seções como novas", async () => {
    h.auditFindMany.mockResolvedValue([
      { ...PUBLICACAO, diff: [["Versão", "—", "v1.0"]] },
    ]);
    const rows = JSON.parse((await exportar("json")).content) as LinhaJson[];

    expect(rows[0].sections?.map((s) => [s.field, s.nova])).toEqual([
      ["S01 · Escopo", true],
      ["S02 · Revisão", true],
    ]);
  });

  it("mesmo período e escopo devolvem conteúdo idêntico (NFR-5.3)", async () => {
    const a = await exportar("csv");
    const b = await exportar("csv");
    expect(a.content).toBe(b.content);
    expect(a.filename).toBe(b.filename);

    const j1 = await exportar("json");
    const j2 = await exportar("json");
    expect(j1.content).toBe(j2.content);
  });

  it("toda query nova filtra por tenantId", async () => {
    await exportar("json");

    expect(h.auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "t-1" }),
      })
    );
    expect(h.versionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t-1",
          policyId: { in: ["pol-1"] },
        }),
      })
    );
  });

  it("sem publicação no período, nenhuma versão é buscada", async () => {
    h.auditFindMany.mockResolvedValue([DECISAO]);
    await exportar("json");

    expect(h.versionFindMany).not.toHaveBeenCalled();
  });

  it("a exportação continua gravando a si mesma na trilha (FR-11.6)", async () => {
    await exportar("csv");

    expect(h.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t-1",
          entityType: "charter.export",
          action: "Exportou pacote",
        }),
      })
    );
  });
});
