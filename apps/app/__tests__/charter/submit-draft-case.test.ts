// submit-draft-case.test.ts — rascunho ganha saída. O IntakeModal só submete
// se o fornecedor for elegível; com todo fornecedor em REVIEW sem cláusulas, o
// requester só consegue "Salvar rascunho" — e depois não existia action que
// submetesse um rascunho existente. `submitDraftCase` fecha o loop, com
// exatamente o mesmo gate de `submitCase` (fornecedor obrigatório →
// elegibilidade por classe de dado → caminho de aprovação): a mensagem de
// recusa tem de ser a mesma nos dois caminhos, senão o requester vê um motivo
// no intake e outro no detalhe do caso.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recommendPath, vendorEligibility } from "@/lib/charter/rules";

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  requireContext: vi.fn(),
  revalidatePath: vi.fn(),
  useCaseFindFirst: vi.fn(),
  useCaseUpdate: vi.fn(),
  useCaseCreate: vi.fn(),
  vendorFindFirst: vi.fn(),
  sequenceUpsert: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
  requireCharterContext: h.requireContext,
}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      charterUseCase: {
        findFirst: h.useCaseFindFirst,
        update: h.useCaseUpdate,
        create: h.useCaseCreate,
      },
      charterVendor: { findFirst: h.vendorFindFirst },
      charterSequence: { upsert: h.sequenceUpsert },
      auditLog: { create: h.auditCreate },
    }),
}));

import { submitCase, submitDraftCase } from "../../app/(charter)/actions/cases";

const ctx = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "REQUESTER",
  user: { name: "Bia", email: "bia@x.com" },
};

/** O tenant real: fornecedor em REVIEW, sem cláusulas → maxClass nulo. */
const vendorSemClasse = {
  name: "OpenAI",
  maxClass: null,
  notes: "DPA em negociação.",
};

const vendorElegivel = {
  name: "Azure OpenAI",
  maxClass: "CONFIDENTIAL",
  notes: null,
};

function rascunho(over: Record<string, unknown> = {}) {
  return {
    id: "uc-1",
    tenantId: "t-1",
    code: "UC-003",
    title: "Triagem de sinistros",
    status: "DRAFT",
    dataClass: "INTERNAL",
    exposure: "INTERNAL",
    criticality: "MEDIUM",
    vendorId: "v-1",
    vendor: vendorSemClasse,
    ...over,
  };
}

describe("submitDraftCase", () => {
  beforeEach(() => {
    for (const m of Object.values(h)) {
      m.mockReset();
    }
    h.requireCtx.mockResolvedValue(ctx);
    h.useCaseUpdate.mockResolvedValue({});
    h.auditCreate.mockResolvedValue({});
  });

  it("recusa caso que não está em rascunho, sem tocar no banco", async () => {
    h.useCaseFindFirst.mockResolvedValue(rascunho({ status: "SUBMITTED" }));

    const res = await submitDraftCase({ caseId: "uc-1" });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toMatch(/rascunho/i);
    expect(h.useCaseUpdate).not.toHaveBeenCalled();
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("recusa fornecedor inelegível com a mesma mensagem que submitCase dá", async () => {
    h.useCaseFindFirst.mockResolvedValue(rascunho());

    const draft = await submitDraftCase({ caseId: "uc-1" });

    // O mesmo fornecedor, submetido direto pelo intake, tem de ser recusado
    // com a mesma frase — é o mesmo gate, não uma cópia.
    h.vendorFindFirst.mockResolvedValue(vendorSemClasse);
    const direto = await submitCase({
      title: "Triagem de sinistros",
      objective: "Reduzir tempo de triagem de 6 para 2 dias.",
      vendorId: "cm0000000000000000000001",
      dataClass: "INTERNAL",
      exposure: "INTERNAL",
      criticality: "MEDIUM",
    });

    expect(draft.ok).toBe(false);
    expect(direto.ok).toBe(false);
    if (draft.ok || direto.ok) {
      return;
    }
    const gate = vendorEligibility(vendorSemClasse, "INTERNAL");
    expect(gate.eligible).toBe(false);
    expect(draft.error).toBe(gate.eligible ? "" : gate.reason);
    expect(draft.error).toBe(direto.error);
    expect(h.useCaseUpdate).not.toHaveBeenCalled();
  });

  it("recusa rascunho sem fornecedor — a regra vendor.required fica intacta", async () => {
    h.useCaseFindFirst.mockResolvedValue(
      rascunho({ vendorId: null, vendor: null })
    );

    const draft = await submitDraftCase({ caseId: "uc-1" });
    const direto = await submitCase({
      title: "Triagem de sinistros",
      objective: "Reduzir tempo de triagem de 6 para 2 dias.",
      vendorId: null,
      dataClass: "INTERNAL",
      exposure: "INTERNAL",
      criticality: "MEDIUM",
    });

    expect(draft.ok).toBe(false);
    expect(direto.ok).toBe(false);
    if (draft.ok || direto.ok) {
      return;
    }
    expect(draft.error).toMatch(/fornecedor/i);
    expect(draft.error).toBe(direto.error);
    expect(h.useCaseUpdate).not.toHaveBeenCalled();
  });

  it("transiciona para SUBMITTED gravando o caminho congelado", async () => {
    h.useCaseFindFirst.mockResolvedValue(
      rascunho({ vendor: vendorElegivel, dataClass: "CONFIDENTIAL" })
    );
    const rec = recommendPath("CONFIDENTIAL", "INTERNAL", "MEDIUM");

    const res = await submitDraftCase({ caseId: "uc-1" });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data).toEqual({ code: "UC-003", path: rec.path });

    const update = h.useCaseUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: "uc-1" });
    expect(update.data).toMatchObject({
      status: "SUBMITTED",
      approvalPath: rec.path,
      slaTotal: rec.slaDays,
      hitl: rec.hitl,
    });
    expect(update.data.submittedAt).toBeInstanceOf(Date);
    expect(h.revalidatePath).toHaveBeenCalledWith("/charter", "layout");
  });

  it("grava auditoria com a mesma nota da submissão direta", async () => {
    h.useCaseFindFirst.mockResolvedValue(
      rascunho({ vendor: vendorElegivel, dataClass: "CONFIDENTIAL" })
    );
    const rec = recommendPath("CONFIDENTIAL", "INTERNAL", "MEDIUM");

    await submitDraftCase({ caseId: "uc-1" });

    expect(h.auditCreate).toHaveBeenCalledTimes(1);
    const audit = h.auditCreate.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      tenantId: "t-1",
      action: "Submeteu caso de uso",
      entityType: "charter.usecase",
      entityId: "uc-1",
    });
    expect(audit.metadata.note).toBe(
      `${rec.path} · SLA ${rec.slaDays} dias úteis · ${rec.rule}`
    );
  });

  it("carrega o caso por { id, tenantId } — nunca só por id", async () => {
    h.useCaseFindFirst.mockResolvedValue(null);

    const res = await submitDraftCase({ caseId: "uc-outro-tenant" });

    expect(res.ok).toBe(false);
    expect(h.useCaseFindFirst).toHaveBeenCalledTimes(1);
    expect(h.useCaseFindFirst.mock.calls[0][0].where).toMatchObject({
      id: "uc-outro-tenant",
      tenantId: "t-1",
    });
  });
});
