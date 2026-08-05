import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  setCreate: vi.fn(),
  setFindFirst: vi.fn(),
  reqCreateMany: vi.fn(),
  reqFindMany: vi.fn(),
  covUpsert: vi.fn(),
  covFindMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterRequirementSet: { create: h.setCreate, findFirst: h.setFindFirst },
      charterRequirement: {
        createMany: h.reqCreateMany,
        findMany: h.reqFindMany,
      },
      charterCoverage: { upsert: h.covUpsert, findMany: h.covFindMany },
      auditLog: { create: h.auditCreate },
    }),
}));
vi.mock("@/lib/charter/capabilities", () => ({
  // vi.fn(...), não uma arrow plain: o teste de degradação de evidência
  // reatribui esta função com `vi.mocked(getCapability).mockReturnValueOnce`
  // — sem o wrapper, `vi.mocked()` é só um cast de tipo (não empacota nada em
  // runtime) e essa chamada quebra com "mockReturnValueOnce is not a
  // function". O comportamento padrão abaixo continua idêntico para todo o
  // resto dos testes.
  getCapability: vi.fn((id: string) =>
    id === "POLICY_ATTESTATION"
      ? {
          id,
          label: "Aceite individual de política",
          evidencia: async () => ({ total: 37, amostra: ["Bia · 12/07"] }),
        }
      : undefined
  ),
}));

import {
  getComplianceMap,
  importRequirementSet,
  setCoverage,
} from "../../app/(charter)/actions/compliance";

const ctx = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "COMPLIANCE_LEAD",
  user: { name: "Bia", email: "bia@x.com" },
};

describe("importRequirementSet", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.setCreate.mockResolvedValue({ id: "s-1" });
    h.reqCreateMany.mockResolvedValue({ count: 2 });
  });

  it("importa exigências e devolve a contagem", async () => {
    const res = await importRequirementSet({
      nome: "RFP Aurora Mesh",
      origem: "RFP",
      requisitos: [
        { codigo: "4.1.2", citacao: "§4.1.2", resumo: "Matriz de risco" },
        { codigo: "4.1.3", citacao: "§4.1.3", resumo: "Workflow de aprovação" },
      ],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.total).toBe(2);
  });

  it("recusa código duplicado nomeando a linha ofensora", async () => {
    const res = await importRequirementSet({
      nome: "RFP com erro de colagem",
      origem: "RFP",
      requisitos: [
        { codigo: "4.1.2", citacao: "§4.1.2", resumo: "Primeira" },
        { codigo: "4.1.2", citacao: "§4.1.2", resumo: "Colada duas vezes" },
      ],
    });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    // Adivinhar qual das duas vale é escolher em nome do usuário.
    expect(res.error).toContain("4.1.2");
    expect(h.setCreate).not.toHaveBeenCalled();
  });

  it("recusa texto verbatim em conjunto REFERENCIA — guarda de copyright", async () => {
    const res = await importRequirementSet({
      nome: "ISO/IEC 42001",
      origem: "REGULACAO",
      licenca: "REFERENCIA",
      requisitos: [
        {
          codigo: "6.1.2",
          citacao: "cláusula 6.1.2",
          resumo: "Formulação nossa do objetivo",
          texto: "texto literal da norma proprietária",
        },
      ],
    });

    expect(res.ok).toBe(false);
    expect(h.setCreate).not.toHaveBeenCalled();
  });
});

describe("setCoverage", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.covUpsert.mockResolvedValue({ id: "c-1" });
  });

  it("é upsert por requisito e tenant — nunca cria veredito duplicado", async () => {
    await setCoverage({
      requirementId: "r-1",
      status: "ATENDE",
      capabilityId: "POLICY_ATTESTATION",
    });

    // A chave é composta porque exigência de regulação é UMA linha global
    // compartilhada: com `where: { requirementId }` só o primeiro tenant do
    // mundo a opinar sobre o AI Act teria cobertura, e o upsert do segundo
    // sobrescreveria a do primeiro — que então some da vista dele por RLS.
    expect(h.covUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_requirementId: { tenantId: "t-1", requirementId: "r-1" },
        },
      })
    );
  });

  it("recusa capacidade que não existe no catálogo", async () => {
    const res = await setCoverage({
      requirementId: "r-1",
      status: "ATENDE",
      capabilityId: "INVENTADA",
    });

    expect(res.ok).toBe(false);
    expect(h.covUpsert).not.toHaveBeenCalled();
  });

  it("ATENDE sem capacidade é recusado — alegação precisa de prova", async () => {
    const res = await setCoverage({ requirementId: "r-1", status: "ATENDE" });

    expect(res.ok).toBe(false);
    expect(h.covUpsert).not.toHaveBeenCalled();
  });

  it("NAO_ATENDE dispensa capacidade", async () => {
    const res = await setCoverage({
      requirementId: "r-1",
      status: "NAO_ATENDE",
    });

    expect(res.ok).toBe(true);
  });
});

describe("getComplianceMap", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.setFindFirst.mockResolvedValue({
      id: "s-1",
      nome: "RFP",
      licenca: "LIVRE",
    });
    h.reqFindMany.mockResolvedValue([
      {
        id: "r-1",
        codigo: "4.1.5",
        citacao: "§4.1.5",
        resumo: "Attestation",
        peso: null,
      },
      {
        id: "r-2",
        codigo: "6.3",
        citacao: "§6.3",
        resumo: "Dado em prompt",
        peso: null,
      },
    ]);
    h.covFindMany.mockResolvedValue([
      {
        requirementId: "r-1",
        status: "ATENDE",
        comentario: null,
        capabilityId: "POLICY_ATTESTATION",
      },
    ]);
  });

  it("anexa evidência viva às linhas que atendem", async () => {
    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const linha = res.data.linhas.find((l) => l.codigo === "4.1.5");
    expect(linha?.evidencia?.total).toBe(37);
  });

  it("conta as linhas sem veredito para o cabeçalho do export", async () => {
    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.semVeredito).toBe(1);
  });

  it("degrada para evidência indisponível quando a consulta falha", async () => {
    // O mapa nunca pode seguir mostrando "atende" limpo sem conseguir provar:
    // mapa que afirma sem provar vai para o comprador com a chancela do
    // produto.
    const { getCapability } = await import("@/lib/charter/capabilities");
    vi.mocked(getCapability).mockReturnValueOnce({
      id: "POLICY_ATTESTATION",
      label: "Aceite",
      evidencia: () => Promise.reject(new Error("coluna removida")),
    });

    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const linha = res.data.linhas.find((l) => l.codigo === "4.1.5");
    expect(linha?.evidencia).toBeNull();
    expect(linha?.evidenciaErro).toBeTruthy();
  });

  it("cobertura apontando capacidade removida do catálogo diz isso", async () => {
    // Cobertura gravada há meses aponta capacidade que uma refatoração tirou
    // do catálogo. Renderizar em branco esconde que a alegação perdeu o
    // lastro; a linha tem de pedir revisão em vez de continuar parecendo
    // provada.
    h.covFindMany.mockResolvedValue([
      {
        requirementId: "r-1",
        status: "ATENDE",
        comentario: null,
        capabilityId: "CAPACIDADE_QUE_SUMIU",
      },
    ]);

    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const linha = res.data.linhas.find((l) => l.codigo === "4.1.5");
    expect(linha?.evidencia).toBeNull();
    expect(linha?.evidenciaErro).toContain("removida");
  });

  it("conjunto de outro tenant é não encontrado, sem distinguir de inexistente", async () => {
    // Mensagem diferente para "não é seu" e "não existe" confirma ao curioso
    // que o id existe em algum lugar — é enumeração de tenant pela porta dos
    // fundos.
    h.setFindFirst.mockResolvedValue(null);

    const res = await getComplianceMap("s-de-outro-tenant");

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("não encontrado");
    expect(h.reqFindMany).not.toHaveBeenCalled();
  });
});
