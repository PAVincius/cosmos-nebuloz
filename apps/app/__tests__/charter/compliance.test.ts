import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  requireContext: vi.fn(),
  setCreate: vi.fn(),
  setFindFirst: vi.fn(),
  setFindMany: vi.fn(),
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
      charterRequirementSet: {
        create: h.setCreate,
        findFirst: h.setFindFirst,
        findMany: h.setFindMany,
      },
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
  adoptSetVersion,
  getComplianceCan,
  getComplianceMap,
  importRequirementSet,
  listCapabilities,
  listRequirementSets,
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

  it("recusa NAO_APLICAVEL sem justificativa", async () => {
    // "Não se aplica" sem motivo é indistinguível de "não quis responder", e é
    // o veredito mais fácil de abusar num documento que sai da empresa.
    const res = await setCoverage({
      requirementId: "r-1",
      status: "NAO_APLICAVEL",
    });

    expect(res.ok).toBe(false);
    expect(h.covUpsert).not.toHaveBeenCalled();
  });

  it("aceita NAO_APLICAVEL com justificativa, sem exigir capacidade", async () => {
    // Simétrico invertido de ATENDE: lá a capacidade é obrigatória porque
    // alegação precisa de prova; aqui não há o que provar, só o que explicar.
    const res = await setCoverage({
      requirementId: "r-1",
      status: "NAO_APLICAVEL",
      comentario: "Não fazemos canary release de modelo.",
    });

    expect(res.ok).toBe(true);
  });
});

describe("getComplianceMap — NAO_APLICAVEL é veredito", () => {
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
      { id: "r-1", codigo: "1", citacao: "§1", resumo: "a", peso: null },
      { id: "r-2", codigo: "2", citacao: "§2", resumo: "b", peso: null },
    ]);
    h.covFindMany.mockResolvedValue([
      {
        requirementId: "r-1",
        status: "NAO_APLICAVEL",
        comentario: "Não fazemos canary release de modelo (§10.2).",
        capabilityId: null,
      },
    ]);
  });

  it("não conta NAO_APLICAVEL como sem veredito", async () => {
    // r-1 foi respondido (não se aplica); só r-2 segue sem resposta.
    const res = await getComplianceMap("s-1");

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.semVeredito).toBe(1);
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

  it("recusa publicar versão de um conjunto global — só a Nebuloz publica, adoção é o caminho certo", async () => {
    // "Substitui um conjunto existente" oferecendo qualquer conjunto (Bloqueio
    // da review final) deixava a tela chamar isto com o id de uma regulação
    // global. Sem este guard, o tenant cria fork privado tudo-REVISAR (a
    // colagem não tem `texto`) e disputa sucessor com a v2 oficial futura.
    h.setFindFirst.mockResolvedValueOnce({
      id: "s-1",
      nome: "EU AI Act",
      licenca: "LIVRE",
      tenantId: null,
    });

    const res = await publishSetVersion({
      supersedesId: "s-1",
      nome: "EU AI Act (fork)",
      versao: "2",
      requisitos: [{ codigo: "4.1", citacao: "Art. 4.1", resumo: "x" }],
    });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toMatch(/publicado pela Nebuloz/);
    expect(h.setCreate).not.toHaveBeenCalled();
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

describe("adoptSetVersion", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
  });

  it("recusa conjunto que não substitui nenhum outro", async () => {
    h.setFindFirst.mockResolvedValueOnce({
      id: "set-v2",
      supersedesId: null,
      tenantId: null,
    });

    const res = await adoptSetVersion({ setId: "set-v2" });

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/não substitui nenhum outro/);
  });

  it("recusa conjunto de outro tenant sem distinguir de inexistente", async () => {
    h.setFindFirst.mockResolvedValueOnce(null);

    const res = await adoptSetVersion({ setId: "set-de-outro" });

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/não encontrado/i);
  });

  it("transporta cobertura e marca REVISAR só no que mudou de texto", async () => {
    h.setFindFirst
      .mockResolvedValueOnce({
        id: "set-v2",
        supersedesId: "set-v1",
        tenantId: null,
      })
      .mockResolvedValueOnce({ id: "set-v1", tenantId: null });
    h.reqFindMany
      // exigências do antecessor
      .mockResolvedValueOnce([
        { id: "r1-v1", codigo: "A-1", resumo: "igual", texto: null },
        { id: "r2-v1", codigo: "B-1", resumo: "antigo", texto: null },
      ])
      // exigências do sucessor
      .mockResolvedValueOnce([
        { id: "r1-v2", codigo: "A-1", resumo: "igual", texto: null },
        { id: "r2-v2", codigo: "B-1", resumo: "NOVO", texto: null },
        { id: "r3-v2", codigo: "C-1", resumo: "inédita", texto: null },
      ]);
    h.covFindMany
      // cobertura do antecessor
      .mockResolvedValueOnce([
        {
          requirementId: "r1-v1",
          status: "ATENDE",
          comentario: null,
          capabilityId: "POLICY_LINK",
        },
        {
          requirementId: "r2-v1",
          status: "ATENDE",
          comentario: null,
          capabilityId: "POLICY_LINK",
        },
      ])
      // nada ainda no sucessor — a implementação lê as duas, nesta ordem
      .mockResolvedValueOnce([]);

    const res = await adoptSetVersion({ setId: "set-v2" });

    expect(res.ok).toBe(true);
    expect(res.ok && res.data).toEqual({
      transportadas: 2,
      emRevisao: 1,
      novas: 1,
    });
    expect(h.covCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ requirementId: "r1-v2", status: "ATENDE" }),
        expect.objectContaining({ requirementId: "r2-v2", status: "REVISAR" }),
      ]),
    });
  });

  it("não sobrescreve veredito já dado no sucessor — adotar duas vezes é idempotente", async () => {
    h.setFindFirst
      .mockResolvedValueOnce({
        id: "set-v2",
        supersedesId: "set-v1",
        tenantId: null,
      })
      .mockResolvedValueOnce({ id: "set-v1", tenantId: null });
    h.reqFindMany
      .mockResolvedValueOnce([
        { id: "r1-v1", codigo: "A-1", resumo: "x", texto: null },
      ])
      .mockResolvedValueOnce([
        { id: "r1-v2", codigo: "A-1", resumo: "x", texto: null },
      ]);
    h.covFindMany
      // cobertura do antecessor
      .mockResolvedValueOnce([
        {
          requirementId: "r1-v1",
          status: "ATENDE",
          comentario: null,
          capabilityId: null,
        },
      ])
      // cobertura que já existe no sucessor (segunda adoção)
      .mockResolvedValueOnce([{ requirementId: "r1-v2" }]);

    const res = await adoptSetVersion({ setId: "set-v2" });

    expect(res.ok).toBe(true);
    expect(res.ok && res.data.transportadas).toBe(0);
    expect(h.covCreateMany).not.toHaveBeenCalled();
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

describe("listRequirementSets — sucessão", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
  });

  it("aponta o sucessor e resume o que muda ao adotá-lo", async () => {
    h.setFindMany.mockResolvedValueOnce([
      {
        id: "set-v1",
        nome: "Reg",
        origem: "REGULACAO",
        versao: "1",
        supersedesId: null,
        _count: { requirements: 2 },
      },
      {
        id: "set-v2",
        nome: "Reg",
        origem: "REGULACAO",
        versao: "2",
        supersedesId: "set-v1",
        _count: { requirements: 3 },
      },
    ]);
    h.reqFindMany.mockResolvedValueOnce([
      { setId: "set-v1", codigo: "A-1", resumo: "igual", texto: null },
      { setId: "set-v1", codigo: "B-1", resumo: "antigo", texto: null },
      { setId: "set-v2", codigo: "A-1", resumo: "igual", texto: null },
      { setId: "set-v2", codigo: "B-1", resumo: "NOVO", texto: null },
      { setId: "set-v2", codigo: "C-1", resumo: "inédita", texto: null },
    ]);
    // Ruído para listRequirementSets ler cobertura sem quebrar — este teste é
    // sobre sucessão/diff, não sobre temCobertura.
    h.covFindMany.mockResolvedValueOnce([]);

    const res = await listRequirementSets();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const v1 = res.data.find((s) => s.id === "set-v1");
    expect(v1?.supersededById).toBe("set-v2");
    expect(v1?.diff).toEqual({ alteradas: 1, novas: 1, removidas: 0 });

    const v2 = res.data.find((s) => s.id === "set-v2");
    expect(v2?.supersededById).toBe(null);
    expect(v2?.diff).toBe(null);
  });

  it("conjunto sem sucessor não carrega diff", async () => {
    h.setFindMany.mockResolvedValueOnce([
      {
        id: "solo",
        nome: "RFP",
        origem: "RFP",
        versao: "1",
        supersedesId: null,
        _count: { requirements: 1 },
      },
    ]);
    h.reqFindMany.mockResolvedValueOnce([]);
    h.covFindMany.mockResolvedValueOnce([]);

    const res = await listRequirementSets();

    expect(res.ok && res.data[0].supersededById).toBe(null);
    expect(res.ok && res.data[0].diff).toBe(null);
  });

  it("com dois sucessores do mesmo antecessor, oferece o mais recente", async () => {
    // importadoEm desc: set-v3 é o mais recente dos dois que substituem set-v1
    h.setFindMany.mockResolvedValueOnce([
      {
        id: "set-v3",
        nome: "Reg",
        origem: "REGULACAO",
        versao: "3",
        supersedesId: "set-v1",
        _count: { requirements: 1 },
      },
      {
        id: "set-v2",
        nome: "Reg",
        origem: "REGULACAO",
        versao: "2",
        supersedesId: "set-v1",
        _count: { requirements: 1 },
      },
      {
        id: "set-v1",
        nome: "Reg",
        origem: "REGULACAO",
        versao: "1",
        supersedesId: null,
        _count: { requirements: 1 },
      },
    ]);
    h.reqFindMany.mockResolvedValueOnce([
      { setId: "set-v1", codigo: "A-1", resumo: "antigo", texto: null },
      { setId: "set-v2", codigo: "A-1", resumo: "v2", texto: null },
      { setId: "set-v3", codigo: "A-1", resumo: "v3", texto: null },
    ]);
    h.covFindMany.mockResolvedValueOnce([]);

    const res = await listRequirementSets();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const v1 = res.data.find((s) => s.id === "set-v1");
    expect(v1?.supersededById).toBe("set-v3");
  });

  it("marca temCobertura no set com veredito do tenant, não no outro", async () => {
    h.setFindMany.mockResolvedValueOnce([
      {
        id: "set-v2",
        nome: "Reg",
        origem: "REGULACAO",
        versao: "2",
        supersedesId: "set-v1",
        _count: { requirements: 1 },
      },
      {
        id: "set-v1",
        nome: "Reg",
        origem: "REGULACAO",
        versao: "1",
        supersedesId: null,
        _count: { requirements: 1 },
      },
    ]);
    h.reqFindMany.mockResolvedValueOnce([
      {
        id: "req-v1-a1",
        setId: "set-v1",
        codigo: "A-1",
        resumo: "antigo",
        texto: null,
      },
      {
        id: "req-v2-a1",
        setId: "set-v2",
        codigo: "A-1",
        resumo: "novo",
        texto: null,
      },
    ]);
    // Só o requisito do set-v1 tem veredito do tenant — set-v2 (o sucessor)
    // ainda não recebeu nenhum.
    h.covFindMany.mockResolvedValueOnce([{ requirementId: "req-v1-a1" }]);

    const res = await listRequirementSets();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.find((s) => s.id === "set-v1")?.temCobertura).toBe(true);
    expect(res.data.find((s) => s.id === "set-v2")?.temCobertura).toBe(false);
  });
});
