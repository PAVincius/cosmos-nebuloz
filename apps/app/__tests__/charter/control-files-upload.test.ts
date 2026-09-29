import { beforeEach, describe, expect, it, vi } from "vitest";

// Upload da evidência do controle — servidor. A chave é montada AQUI; o navegador
// só diz nome, tipo e tamanho.
const h = vi.hoisted(() => ({
  requirePerm: vi.fn(),
  requireCtx: vi.fn(),
  ucFindUnique: vi.fn(),
  ccFindUnique: vi.fn(),
  evCount: vi.fn(),
  auditCreate: vi.fn(),
  ensureBucket: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  order: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requirePerm,
  requireCharterContext: h.requireCtx,
}));
vi.mock("@/lib/charter/evidence-bucket", () => ({
  ensureEvidenceBucket: h.ensureBucket,
}));
vi.mock("@repo/storage", () => ({
  CHARTER_EVIDENCE_BUCKET: "charter-evidence",
  storageClient: {
    storage: {
      from: () => ({ createSignedUploadUrl: h.createSignedUploadUrl }),
    },
  },
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) => {
    h.order.push("tx-inicio");
    return Promise.resolve(
      fn({
        charterUseCase: { findUnique: h.ucFindUnique },
        charterCaseControl: { findUnique: h.ccFindUnique },
        charterCaseControlEvent: { count: h.evCount },
        auditLog: { create: h.auditCreate },
      })
    ).finally(() => h.order.push("tx-fim"));
  },
}));

import { requestControlEvidenceUpload } from "@/app/(charter)/actions/control-files";
import { isEvidenceKeyOf } from "@/lib/charter/evidence-file";

const CTX = {
  tenantId: "t1",
  userId: "u1",
  charterRole: "COMPLIANCE",
  user: { name: "Ana", email: "ana@x.test" },
};
const REF = { code: "UC-118", controlCode: "TR-2" };
const INPUT = {
  ...REF,
  filename: "laudo rollback.pdf",
  contentType: "application/pdf",
  sizeBytes: 2048,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.order.length = 0;
  h.requirePerm.mockResolvedValue(CTX);
  h.ucFindUnique.mockResolvedValue({
    id: "uc1",
    code: "UC-118",
    title: "t",
    status: "REVIEW",
  });
  h.ccFindUnique.mockResolvedValue({
    id: "cc1",
    code: "TR-2",
    name: "Rollback",
    state: "NO_EVIDENCE",
  });
  h.evCount.mockResolvedValue(0);
  h.auditCreate.mockResolvedValue({});
  h.ensureBucket.mockImplementation(async () => {
    h.order.push("bucket");
  });
  h.createSignedUploadUrl.mockResolvedValue({
    data: { signedUrl: "https://s/up?t=1" },
    error: null,
  });
});

describe("requestControlEvidenceUpload", () => {
  it("monta a chave no servidor: v<N>-<uuid>/<nome>, e ela é do caso e controle", async () => {
    const r = await requestControlEvidenceUpload(INPUT);

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("x");
    expect(r.data.fileKey).toMatch(
      /^t1\/charter\/UC-118\/TR-2\/v1-[0-9a-f-]{36}\/laudo_rollback\.pdf$/
    );
    expect(
      isEvidenceKeyOf(r.data.fileKey, {
        tenantId: "t1",
        caseCode: "UC-118",
        controlCode: "TR-2",
      })
    ).toBe(true);
    expect(r.data.fileName).toBe("laudo_rollback.pdf");
  });

  it("a versão vem da contagem de ATTACH, mas cada envio tem chave própria (reenvio não trava)", async () => {
    h.evCount.mockResolvedValue(2);

    const a = await requestControlEvidenceUpload(INPUT);
    const b = await requestControlEvidenceUpload(INPUT);

    if (!(a.ok && b.ok)) throw new Error("x");
    expect(a.data.fileKey).toContain("/v3-");
    expect(b.data.fileKey).toContain("/v3-");
    expect(a.data.fileKey).not.toBe(b.data.fileKey);
  });

  it("o tipo declarado precisa ser IGUAL ao da extensão (PDF declarando image/png é recusado)", async () => {
    const r = await requestControlEvidenceUpload({
      ...INPUT,
      contentType: "image/png",
    });

    expect(r.ok).toBe(false);
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("extensão fora da lista é recusada mesmo com tipo aceito", async () => {
    const r = await requestControlEvidenceUpload({
      ...INPUT,
      filename: "a.exe",
      contentType: "application/pdf",
    });

    expect(r.ok).toBe(false);
  });

  it("o bucket é preparado FORA da transação (chamada de rede em transação prende conexão)", async () => {
    await requestControlEvidenceUpload(INPUT);

    const bucket = h.order.indexOf("bucket");
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThan(h.order.indexOf("tx-inicio"));
  });

  it("exige case.submit", async () => {
    await requestControlEvidenceUpload(INPUT);

    expect(h.requirePerm).toHaveBeenCalledWith("case.submit");
  });

  it("recusa arquivo grande e controle fora do estado de anexar", async () => {
    const grande = await requestControlEvidenceUpload({
      ...INPUT,
      sizeBytes: 11 * 1024 * 1024,
    });
    expect(grande.ok).toBe(false);

    h.ccFindUnique.mockResolvedValue({
      id: "cc1",
      code: "TR-2",
      name: "n",
      state: "ACCEPTED",
    });
    const aceito = await requestControlEvidenceUpload(INPUT);
    expect(aceito.ok).toBe(false);
  });
});
