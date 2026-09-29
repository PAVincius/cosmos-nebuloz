import { beforeEach, describe, expect, it, vi } from "vitest";

// Arquivo de evidência do controle (CH-DEV-05): upload por URL assinada e
// download com auditoria ANTES de emitir a URL. A chave é montada no servidor;
// o cliente só diz nome, tipo e tamanho.

const h = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireContext: vi.fn(),
  audit: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  createSignedUrl: vi.fn(),
  ensureBucket: vi.fn(),
  calls: [] as string[],
  db: {} as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));
vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requirePermission,
  requireCharterContext: h.requireContext,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) => fn(h.db),
}));
vi.mock("@repo/storage", () => ({
  CHARTER_EVIDENCE_BUCKET: "charter-evidence",
  storageClient: {
    storage: {
      from: () => ({
        createSignedUploadUrl: h.createSignedUploadUrl,
        createSignedUrl: h.createSignedUrl,
      }),
    },
  },
}));
vi.mock("@/lib/charter/evidence-bucket", () => ({
  ensureEvidenceBucket: h.ensureBucket,
}));
vi.mock("../../app/(charter)/actions/_shared", async () => {
  const actual = await vi.importActual<
    typeof import("../../app/(charter)/actions/_shared")
  >("../../app/(charter)/actions/_shared");
  return { ...actual, logCharterAudit: h.audit };
});

import {
  readControlEvidenceFile,
  requestControlEvidenceUpload,
} from "../../app/(charter)/actions/control-files";

const CTX = { tenantId: "t1", userId: "u1", charterRole: "LEGAL" };
const UP = {
  code: "UC-118",
  controlCode: "TR-2",
  filename: "Laudo de rollback.pdf",
  contentType: "application/pdf",
  sizeBytes: 2048,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.requirePermission.mockResolvedValue(CTX);
  h.requireContext.mockResolvedValue(CTX);
  h.audit.mockImplementation(async () => {
    h.calls.push("audit");
  });
  h.ensureBucket.mockResolvedValue(undefined);
  h.createSignedUploadUrl.mockImplementation(async () => {
    h.calls.push("sign");
    return { data: { signedUrl: "https://s/up?token=1" }, error: null };
  });
  h.createSignedUrl.mockImplementation(async () => {
    h.calls.push("sign");
    return { data: { signedUrl: "https://s/dl?token=2" }, error: null };
  });
  h.db = {
    charterUseCase: {
      findUnique: vi.fn().mockResolvedValue({
        id: "uc-1",
        code: "UC-118",
        title: "Triagem",
        status: "REVIEW",
      }),
    },
    charterCaseControl: {
      findUnique: vi.fn().mockResolvedValue({
        id: "cc-1",
        code: "TR-2",
        name: "Rollback testado",
        state: "NO_EVIDENCE",
        fileKey: "t1/charter/UC-118/TR-2/v1/laudo.pdf",
        fileName: "laudo.pdf",
      }),
    },
    charterCaseControlEvent: { count: vi.fn().mockResolvedValue(0) },
  };
});

describe("requestControlEvidenceUpload", () => {
  it("exige case.submit", async () => {
    await requestControlEvidenceUpload(UP);
    expect(h.requirePermission).toHaveBeenCalledWith("case.submit");
  });

  it("monta a chave no servidor: <tenant>/charter/<caso>/<controle>/v1/<nome saneado>", async () => {
    const res = await requestControlEvidenceUpload(UP);
    if (!res.ok) throw new Error(res.error);
    expect(res.data.fileKey).toBe(
      "t1/charter/UC-118/TR-2/v1/Laudo_de_rollback.pdf"
    );
    expect(res.data.uploadUrl).toBe("https://s/up?token=1");
    expect(res.data.fileName).toBe("Laudo_de_rollback.pdf");
    expect(res.data.contentType).toBe("application/pdf");
    expect(h.createSignedUploadUrl).toHaveBeenCalledWith(res.data.fileKey);
  });

  it("a versão sobe a cada anexo anterior do controle", async () => {
    h.db.charterCaseControlEvent.count.mockResolvedValue(2);
    const res = await requestControlEvidenceUpload(UP);
    if (!res.ok) throw new Error(res.error);
    expect(res.data.fileKey).toContain("/v3/");
    expect(
      h.db.charterCaseControlEvent.count.mock.calls[0][0].where
    ).toMatchObject({
      tenantId: "t1",
      caseControlId: "cc-1",
      action: "ATTACH",
    });
  });

  it("recusa tipo fora da lista, mesmo que o navegador declare pdf", async () => {
    const res = await requestControlEvidenceUpload({
      ...UP,
      filename: "laudo.pdf.exe",
    });
    expect(res.ok).toBe(false);
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("recusa .pdf que se declara text/html", async () => {
    const res = await requestControlEvidenceUpload({
      ...UP,
      contentType: "text/html",
    });
    expect(res.ok).toBe(false);
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("recusa arquivo acima de 10 MB", async () => {
    const res = await requestControlEvidenceUpload({
      ...UP,
      sizeBytes: 10 * 1024 * 1024 + 1,
    });
    expect(res.ok).toBe(false);
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("controle já aceito não recebe arquivo novo sem reabrir", async () => {
    h.db.charterCaseControl.findUnique.mockResolvedValue({
      id: "cc-1",
      code: "TR-2",
      name: "Rollback",
      state: "ACCEPTED",
    });
    const res = await requestControlEvidenceUpload(UP);
    expect(res.ok).toBe(false);
    expect(h.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("caso e controle são lidos pelo tenant do contexto", async () => {
    await requestControlEvidenceUpload(UP);
    expect(h.db.charterUseCase.findUnique.mock.calls[0][0].where).toEqual({
      tenantId_code: { tenantId: "t1", code: "UC-118" },
    });
  });

  it("audita o pedido de envio", async () => {
    await requestControlEvidenceUpload(UP);
    expect(h.audit).toHaveBeenCalledTimes(1);
    expect(h.audit.mock.calls[0][2]).toMatchObject({
      entityType: "charter.casecontrol",
    });
  });

  it("garante o bucket (limite de tipo e tamanho) antes de assinar", async () => {
    await requestControlEvidenceUpload(UP);
    expect(h.ensureBucket).toHaveBeenCalled();
    expect(h.ensureBucket.mock.invocationCallOrder[0]).toBeLessThan(
      h.createSignedUploadUrl.mock.invocationCallOrder[0]
    );
  });
});

describe("readControlEvidenceFile", () => {
  const REF = { code: "UC-118", controlCode: "TR-2" };

  it("audita ANTES de emitir a URL assinada", async () => {
    const res = await readControlEvidenceFile(REF);
    expect(res.ok).toBe(true);
    expect(h.calls).toEqual(["audit", "sign"]);
  });

  it("URL de download força o nome do arquivo", async () => {
    await readControlEvidenceFile(REF);
    expect(h.createSignedUrl).toHaveBeenCalledWith(
      "t1/charter/UC-118/TR-2/v1/laudo.pdf",
      300,
      { download: "laudo.pdf" }
    );
  });

  it("controle sem arquivo não emite URL", async () => {
    h.db.charterCaseControl.findUnique.mockResolvedValue({
      id: "cc-1",
      code: "TR-2",
      name: "Rollback",
      state: "NO_EVIDENCE",
      fileKey: null,
      fileName: null,
    });
    const res = await readControlEvidenceFile(REF);
    expect(res.ok).toBe(false);
    expect(h.createSignedUrl).not.toHaveBeenCalled();
  });

  it("chave que não é do tenant nunca é assinada", async () => {
    h.db.charterCaseControl.findUnique.mockResolvedValue({
      id: "cc-1",
      code: "TR-2",
      name: "Rollback",
      state: "ACCEPTED",
      fileKey: "t2/charter/UC-9/TR-2/v1/x.pdf",
      fileName: "x.pdf",
    });
    const res = await readControlEvidenceFile(REF);
    expect(res.ok).toBe(false);
    expect(h.createSignedUrl).not.toHaveBeenCalled();
  });

  it("qualquer papel do Charter lê (Auditor inclusive)", async () => {
    h.requireContext.mockResolvedValue({ ...CTX, charterRole: "AUDITOR" });
    const res = await readControlEvidenceFile(REF);
    expect(res.ok).toBe(true);
  });
});
