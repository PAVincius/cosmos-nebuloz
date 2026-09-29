import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  listBuckets: vi.fn(),
  createBucket: vi.fn(),
  updateBucket: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/observability/log", () => ({ log: { error: vi.fn() } }));
vi.mock("@repo/storage", () => ({
  CHARTER_EVIDENCE_BUCKET: "charter-evidence",
  storageClient: {
    storage: {
      listBuckets: h.listBuckets,
      createBucket: h.createBucket,
      updateBucket: h.updateBucket,
    },
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  h.createBucket.mockResolvedValue({});
  h.updateBucket.mockResolvedValue({});
});

describe("bucket de evidência do Charter", () => {
  it("nasce privado, com teto de 10 MB e lista de tipos", async () => {
    const { evidenceBucketOptions } = await import(
      "@/lib/charter/evidence-bucket"
    );
    const o = evidenceBucketOptions();
    expect(o.public).toBe(false);
    expect(o.fileSizeLimit).toBe(10 * 1024 * 1024);
    expect(o.allowedMimeTypes).toContain("application/pdf");
    expect(o.allowedMimeTypes).not.toContain("text/html");
  });

  it("cria quando não existe", async () => {
    h.listBuckets.mockResolvedValue({ data: [] });
    const { ensureEvidenceBucket } = await import(
      "@/lib/charter/evidence-bucket"
    );
    await ensureEvidenceBucket();
    expect(h.createBucket).toHaveBeenCalledWith(
      "charter-evidence",
      expect.objectContaining({ public: false })
    );
    expect(h.updateBucket).not.toHaveBeenCalled();
  });

  it("reaplica as opções quando já existe (pode ter nascido sem limite de tipo)", async () => {
    h.listBuckets.mockResolvedValue({ data: [{ name: "charter-evidence" }] });
    const { ensureEvidenceBucket } = await import(
      "@/lib/charter/evidence-bucket"
    );
    await ensureEvidenceBucket();
    expect(h.updateBucket).toHaveBeenCalledWith(
      "charter-evidence",
      expect.objectContaining({ fileSizeLimit: 10 * 1024 * 1024 })
    );
    expect(h.createBucket).not.toHaveBeenCalled();
  });

  it("uma vez por processo", async () => {
    h.listBuckets.mockResolvedValue({ data: [] });
    const { ensureEvidenceBucket } = await import(
      "@/lib/charter/evidence-bucket"
    );
    await ensureEvidenceBucket();
    await ensureEvidenceBucket();
    expect(h.listBuckets).toHaveBeenCalledTimes(1);
  });

  it("falha na configuração não estoura e a próxima tentativa refaz", async () => {
    h.listBuckets
      .mockRejectedValueOnce(new Error("fora"))
      .mockResolvedValue({ data: [] });
    const { ensureEvidenceBucket } = await import(
      "@/lib/charter/evidence-bucket"
    );
    await expect(ensureEvidenceBucket()).resolves.toBeUndefined();
    await ensureEvidenceBucket();
    expect(h.listBuckets).toHaveBeenCalledTimes(2);
  });
});
