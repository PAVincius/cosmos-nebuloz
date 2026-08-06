import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  requireContext: vi.fn(),
  setCreate: vi.fn(),
  setFindFirst: vi.fn(),
  reqCreateMany: vi.fn(),
  reqFindMany: vi.fn(),
  reqFindFirst: vi.fn(),
  covUpsert: vi.fn(),
  covFindMany: vi.fn(),
  covFindUnique: vi.fn(),
  covCreateMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
  requireCharterContext: h.requireContext,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterRequirementSet: { create: h.setCreate, findFirst: h.setFindFirst },
      charterRequirement: {
        createMany: h.reqCreateMany,
        findMany: h.reqFindMany,
        findFirst: h.reqFindFirst,
      },
      charterCoverage: {
        upsert: h.covUpsert,
        findMany: h.covFindMany,
        findUnique: h.covFindUnique,
        createMany: h.covCreateMany,
      },
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
  // Catálogo mínimo para listCapabilities — evidencia real fica de fora de
  // propósito (server-only, nunca deveria atravessar para o cliente).
  CAPABILITIES: [
    {
      id: "POLICY_ATTESTATION",
      label: "Aceite individual de política, com revalidação por versão",
      evidencia: async () => ({ total: 37, amostra: [] }),
    },
    {
      id: "VENDOR_TIER",
      label: "Fornecedor classificado como aprovado, restrito ou bloqueado",
      evidencia: async () => ({ total: 5, amostra: [] }),
    },
  ],
}));

import {
  getComplianceCan,
  getComplianceMap,
  importRequirementSet,
  listCapabilities,
  publishSetVersion,
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
    // Requisito existe e é visível ao tenant, e não há veredito prévio —
    // testes que precisam do caso contrário sobrescrevem por cima.
    h.reqFindFirst.mockResolvedValue({ id: "r-1" });
    h.covFindUnique.mockResolvedValue(null);
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

  it("requisito de outro tenant é recusado, sem distinguir de inexistente", async () => {
    // Mesmo raciocínio do teste análogo de getComplianceMap: sem este guard,
    // requirementId de outro tenant vira oráculo de existência (sucesso vs
    // erro denuncia se o id existe em algum lugar), mesmo que a linha de
    // CharterCoverage em si tenha RLS e carregue o tenantId de quem chamou.
    h.reqFindFirst.mockResolvedValue(null);

    const res = await setCoverage({
      requirementId: "r-de-outro-tenant",
      status: "NAO_ATENDE",
    });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("não encontrada");
    expect(h.covUpsert).not.toHaveBeenCalled();
  });

  it("audita traço como veredito anterior no primeiro registro", async () => {
    // h.covFindUnique já resolve null pelo beforeEach — nenhuma cobertura
    // prévia para este requisito.
    await setCoverage({ requirementId: "r-1", status: "NAO_ATENDE" });

    expect(h.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diff: [["Status", "—", "NAO_ATENDE"]],
        }),
      })
    );
  });

  it("audita o veredito anterior real quando já existe cobertura — não só um traço", async () => {
    // ATENDE → NAO_ATENDE é o fato mais relevante que esta tabela registra;
    // um "—" aqui esconderia justamente essa mudança.
    h.covFindUnique.mockResolvedValue({ status: "ATENDE" });

    await setCoverage({ requirementId: "r-1", status: "NAO_ATENDE" });

    expect(h.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diff: [["Status", "ATENDE", "NAO_ATENDE"]],
        }),
      })
    );
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

describe("publishSetVersion", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.setFindFirst.mockResolvedValue({
      id: "s-1",
      nome: "EU AI Act",
      licenca: "LIVRE",
    });
    h.setCreate.mockResolvedValue({ id: "s-2" });
    h.reqCreateMany.mockResolvedValue({ count: 2 });
    // Versão anterior: 4.1 e 4.2. A nova muda 4.2 e mantém 4.1. `reqFindMany`
    // representa dois métodos reais diferentes aqui — requisitos do conjunto
    // antigo, depois a releitura dos novos após o createMany (regra 3) — e o
    // mock não distingue chamada por `where`. Sem os dois
    // `mockResolvedValueOnce`, a segunda leitura devolveria os mesmos ids
    // "r-1"/"r-2" da primeira, e nenhum teste conseguiria distinguir
    // cobertura transportada para o requisito novo de cobertura ainda presa
    // no antigo.
    h.reqFindMany
      .mockResolvedValueOnce([
        { id: "r-1", codigo: "4.1", resumo: "Inalterada" },
        { id: "r-2", codigo: "4.2", resumo: "Texto antigo" },
      ])
      .mockResolvedValueOnce([
        { id: "novo-r-1", codigo: "4.1" },
        { id: "novo-r-2", codigo: "4.2" },
      ]);
  });

  it("marca como REVISAR só as coberturas cujo requisito mudou", async () => {
    // Tenant já opinou nas duas: ATENDE em 4.1, ATENDE em 4.2.
    h.covFindMany.mockResolvedValue([
      {
        requirementId: "r-1",
        status: "ATENDE",
        comentario: null,
        capabilityId: "POLICY_VERSIONING",
      },
      {
        requirementId: "r-2",
        status: "ATENDE",
        comentario: null,
        capabilityId: "POLICY_VERSIONING",
      },
    ]);

    const res = await publishSetVersion({
      supersedesId: "s-1",
      nome: "EU AI Act",
      versao: "2",
      requisitos: [
        { codigo: "4.1", citacao: "Art. 4.1", resumo: "Inalterada" },
        { codigo: "4.2", citacao: "Art. 4.2", resumo: "Texto NOVO" },
      ],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    // Só 4.2 mudou. Marcar tudo faria o cliente revisar o que não moveu, e é
    // assim que aviso de mudança regulatória vira ruído que se ignora.
    expect(res.data.afetadas).toBe(1);
  });

  it("transporta o veredito inalterado para a versão nova, sem rebaixá-lo", async () => {
    // Sem transporte, publicar versão apaga todo veredito da vista: os
    // requisitos novos têm ids novos e getComplianceMap busca cobertura por
    // id de requisito, sem percorrer supersedesId.
    h.covFindMany.mockResolvedValue([
      {
        requirementId: "r-1",
        status: "ATENDE",
        comentario: "Prova em v3",
        capabilityId: "POLICY_VERSIONING",
      },
    ]);

    await publishSetVersion({
      supersedesId: "s-1",
      nome: "EU AI Act",
      versao: "2",
      requisitos: [
        { codigo: "4.1", citacao: "Art. 4.1", resumo: "Inalterada" },
        { codigo: "4.2", citacao: "Art. 4.2", resumo: "Texto NOVO" },
      ],
    });

    const transportada = h.covCreateMany.mock.calls[0][0].data.find(
      (c: { requirementId: string }) => c.requirementId === "novo-r-1"
    );
    expect(transportada.status).toBe("ATENDE");
    expect(transportada.comentario).toBe("Prova em v3");
    expect(transportada.capabilityId).toBe("POLICY_VERSIONING");
  });

  it("não cria cobertura onde o tenant nunca opinou", async () => {
    // Ausência de linha já é SEM_VEREDITO. Criar REVISAR ali transforma
    // "nunca avaliado" em "avaliado e agora duvidoso" — afirmação falsa.
    h.covFindMany.mockResolvedValue([]);

    const res = await publishSetVersion({
      supersedesId: "s-1",
      nome: "EU AI Act",
      versao: "2",
      requisitos: [
        { codigo: "4.1", citacao: "Art. 4.1", resumo: "Inalterada" },
        { codigo: "4.2", citacao: "Art. 4.2", resumo: "Texto NOVO" },
      ],
    });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.afetadas).toBe(0);
    const criadas = h.covCreateMany.mock.calls[0]?.[0]?.data ?? [];
    expect(criadas).toHaveLength(0);
  });

  it("audita com entityType e nota do conjunto", async () => {
    h.covFindMany.mockResolvedValue([]);

    await publishSetVersion({
      supersedesId: "s-1",
      nome: "EU AI Act",
      versao: "2",
      requisitos: [
        { codigo: "4.1", citacao: "Art. 4.1", resumo: "Inalterada" },
      ],
    });

    const entrada = h.auditCreate.mock.calls[0][0].data;
    expect(entrada.entityType).toBe("charter.requirementset");
    // note vive em metadata.note, não em data.note — é assim que
    // logCharterAudit (_shared.ts) grava para toda action do Charter, não
    // uma escolha desta função.
    expect(entrada.metadata.note).toContain("v2");
  });
});

describe("listCapabilities", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
  });

  it("devolve só id e label — evidencia nunca atravessa para o cliente", async () => {
    const res = await listCapabilities();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data).toEqual([
      {
        id: "POLICY_ATTESTATION",
        label: "Aceite individual de política, com revalidação por versão",
      },
      {
        id: "VENDOR_TIER",
        label: "Fornecedor classificado como aprovado, restrito ou bloqueado",
      },
    ]);
    // Nenhum item carrega evidencia (ou qualquer chave além de id/label) —
    // é o contrato que mantém a busca de prova, que chama withTenantDb, no
    // servidor.
    for (const cap of res.data) {
      expect(Object.keys(cap).sort()).toEqual(["id", "label"]);
    }
  });

  it("exige compliance.map", async () => {
    await listCapabilities();
    expect(h.requireCtx).toHaveBeenCalledWith("compliance.map");
  });
});

describe("getComplianceCan", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
  });

  // Bloqueio "CoverageEditor sem gate" da review final: 4 dos 7 papéis do
  // Charter têm compliance.map sem compliance.edit. Esta action é a fonte da
  // verdade que a tela usa para desabilitar "Definir veredito" com o motivo
  // visível — errar aqui reabre o mesmo furo por outro caminho.
  it("papel COMPLIANCE (único com compliance.edit) recebe edit: true", async () => {
    h.requireContext.mockResolvedValue({ ...ctx, charterRole: "COMPLIANCE" });

    const res = await getComplianceCan();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data).toEqual({ edit: true });
  });

  it("papel com compliance.map mas sem compliance.edit (LEGAL) recebe edit: false", async () => {
    h.requireContext.mockResolvedValue({ ...ctx, charterRole: "LEGAL" });

    const res = await getComplianceCan();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data).toEqual({ edit: false });
  });
});
