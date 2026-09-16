import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  sectionFindMany: vi.fn(),
  versionCount: vi.fn(),
  membershipCount: vi.fn(),
  useCaseCount: vi.fn(),
  decisionCount: vi.fn(),
  vendorCount: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterContext: h.requireCtx,
}));
vi.mock("@repo/database", () => ({
  // setup.ts importa POLICY_SECTIONS de @repo/provisioning (TOTAL_SECOES); o
  // barrel desse pacote reexporta platformDb = database de platform-db.ts, e
  // um export ausente do factory de vi.mock lança ao ser acessado — mesmo
  // sem uso aqui, precisa existir.
  database: {},
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterPolicySection: { findMany: h.sectionFindMany },
      charterPolicyVersion: { count: h.versionCount },
      charterMembership: { count: h.membershipCount },
      charterUseCase: { count: h.useCaseCount },
      charterDecision: { count: h.decisionCount },
      charterVendor: { count: h.vendorCount },
    }),
}));

import { getSetupProgress } from "../../app/(charter)/actions/setup";

/** Tenant recém-provisionado: 9 seções vazias, 1 pessoa, nada mais. */
function tenantNovo() {
  h.sectionFindMany.mockResolvedValue(
    Array.from({ length: 9 }, () => ({ body: "" }))
  );
  h.versionCount.mockResolvedValue(0);
  h.membershipCount.mockResolvedValue(1);
  h.useCaseCount.mockResolvedValue(0);
  h.decisionCount.mockResolvedValue(0);
  h.vendorCount.mockResolvedValue(0);
}

function passo(res: Awaited<ReturnType<typeof getSetupProgress>>, id: string) {
  if (!res.ok) {
    throw new Error("esperava ok");
  }
  const p = res.data.passos.find((s) => s.id === id);
  if (!p) {
    throw new Error(`passo ${id} ausente`);
  }
  return p;
}

const compliance = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "COMPLIANCE",
  user: { name: "Bia", email: "bia@x.com" },
};

describe("getSetupProgress", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(compliance);
    tenantNovo();
  });

  it("num tenant novo: nada concluído, e o passo 1 disponível", async () => {
    const res = await getSetupProgress();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.concluidos).toBe(0);
    expect(res.data.total).toBe(6);
    expect(res.data.completo).toBe(false);
    expect(passo(res, "policy.write").estado).toBe("disponivel");
  });

  it("os passos vêm na ordem da montagem, com fornecedor entre publicar e submeter", async () => {
    const res = await getSetupProgress();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.passos.map((p) => p.id)).toEqual([
      "policy.write",
      "policy.publish",
      "roles.assign",
      "vendor.approve",
      "usecase.first",
      "decision.first",
    ]);
  });

  it("aprovar fornecedor só fecha com fornecedor de classe máxima não nula", async () => {
    // O tenant real: quatro fornecedores em REVIEW, nenhum com cláusula →
    // maxClass nulo em todos → nenhum caso pode ser submetido. Contar
    // fornecedor cadastrado fecharia o passo com a porta ainda trancada.
    const antes = passo(await getSetupProgress(), "vendor.approve");
    expect(antes.estado).toBe("disponivel");
    expect(antes.porque).toMatch(/nenhum caso pode ser submetido/i);
    expect(antes.href).toBe("/charter/vendors");
    expect(h.vendorCount.mock.calls[0][0].where).toMatchObject({
      tenantId: "t-1",
      maxClass: { not: null },
    });

    h.vendorCount.mockResolvedValue(1);
    expect(passo(await getSetupProgress(), "vendor.approve").estado).toBe(
      "feito"
    );
  });

  it("rascunho não conta como primeiro caso submetido", async () => {
    // Dois rascunhos no tenant real e o painel dizia "submetido" — enquanto o
    // caminho de submissão continuava fechado. Só status fora de DRAFT conta:
    // o banco fake responde 2 sem filtro de status e 0 com ele.
    h.useCaseCount.mockImplementation(
      ({ where }: { where: { status?: { not: string } } }) =>
        Promise.resolve(where.status?.not === "DRAFT" ? 0 : 2)
    );

    const res = await getSetupProgress();

    expect(h.useCaseCount.mock.calls[0][0].where).toMatchObject({
      tenantId: "t-1",
    });
    expect(passo(res, "usecase.first").estado).not.toBe("feito");
  });

  it("publicar bloqueado nomeia o bloqueador real: aprovar as seções, não escrevê-las", async () => {
    // policyPublishBlockers exige status PUBLISHED em cada seção; a copy
    // prometia "escrever" — quem escrevesse as nove e tentasse publicar
    // esbarraria num bloqueio que o painel não anunciou.
    const p = passo(await getSetupProgress(), "policy.publish");

    expect(p.bloqueadoPor).toMatch(/aprove as nove seções/i);
    expect(p.bloqueadoPor).not.toMatch(/escreva/i);
  });

  it("mostra 3 de 9, e seção só com espaço não conta como escrita", async () => {
    // Um Enter acidental não pode fechar o passo mais longo da montagem.
    h.sectionFindMany.mockResolvedValue([
      { body: "texto" },
      { body: "texto" },
      { body: "texto" },
      { body: "   " },
      { body: "" },
      { body: "" },
      { body: "" },
      { body: "" },
      { body: "" },
    ]);

    const res = await getSetupProgress();

    expect(passo(res, "policy.write").progresso).toEqual({
      feito: 3,
      total: 9,
    });
  });

  it("publicar fica bloqueado enquanto houver seção vazia", async () => {
    const res = await getSetupProgress();
    const p = passo(res, "policy.publish");

    expect(p.estado).toBe("bloqueado");
    expect(p.bloqueadoPor).toBeTruthy();
  });

  it("publicar libera quando as nove estão escritas", async () => {
    h.sectionFindMany.mockResolvedValue(
      Array.from({ length: 9 }, () => ({ body: "texto" }))
    );

    const res = await getSetupProgress();

    expect(passo(res, "policy.publish").estado).toBe("disponivel");
  });

  it("passo feito ganha de passo bloqueado", async () => {
    // Dado semeado torto, ou provisionamento antigo: existe decisão sem
    // política publicada. Passo bloqueado que já aconteceu é o painel
    // discutindo com o banco.
    h.decisionCount.mockResolvedValue(1);

    const res = await getSetupProgress();

    expect(passo(res, "decision.first").estado).toBe("feito");
  });

  it("atribuir papéis não bloqueia nada, e fecha com mais de uma pessoa", async () => {
    // Montagem não pode travar esperando alguém aceitar convite.
    expect(passo(await getSetupProgress(), "roles.assign").estado).toBe(
      "disponivel"
    );

    h.membershipCount.mockResolvedValue(2);
    expect(passo(await getSetupProgress(), "roles.assign").estado).toBe(
      "feito"
    );
  });

  it("LEGAL vê publicar sem poder agir, e o painel diz quem pode", async () => {
    // policy.publish é só de COMPLIANCE. Seis dos sete papéis não conseguem.
    // Esconder o passo faz a pessoa achar que o produto está quebrado.
    h.requireCtx.mockResolvedValue({ ...compliance, charterRole: "LEGAL" });

    const p = passo(await getSetupProgress(), "policy.publish");

    expect(p.podeAgir).toBe(false);
    expect(p.quemPode).toBeTruthy();
  });

  it("COMPLIANCE pode agir no passo 3; LEGAL não", async () => {
    // setMemberCharterRole não usa a matriz de permissões: compara o papel
    // com "COMPLIANCE" direto, porque permissão que concede permissões não
    // pode ser concedida pela mesma matriz sem circularidade.
    expect(passo(await getSetupProgress(), "roles.assign").podeAgir).toBe(true);

    h.requireCtx.mockResolvedValue({ ...compliance, charterRole: "LEGAL" });
    expect(passo(await getSetupProgress(), "roles.assign").podeAgir).toBe(
      false
    );
  });

  it("com tudo feito, completo é true", async () => {
    h.sectionFindMany.mockResolvedValue(
      Array.from({ length: 9 }, () => ({ body: "texto" }))
    );
    h.versionCount.mockResolvedValue(1);
    h.membershipCount.mockResolvedValue(3);
    h.useCaseCount.mockResolvedValue(2);
    h.decisionCount.mockResolvedValue(1);
    h.vendorCount.mockResolvedValue(1);

    const res = await getSetupProgress();

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.concluidos).toBe(6);
    expect(res.data.completo).toBe(true);
  });
});
