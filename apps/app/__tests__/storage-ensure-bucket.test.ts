// @vitest-environment node

import {
  type BucketAdmin,
  ensureBucketWith,
  SCAFFOLD_ARTEFACT_BUCKET,
} from "@repo/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

// G2 do QA: ensureBucket ignorava o retorno de createBucket. Sem o bucket, o
// upload falhava lá na frente com "Bucket not found" e ninguém sabia por quê. O
// erro tem de aparecer NA criação, alto.
const h = vi.hoisted(() => ({
  listBuckets: vi.fn(),
  createBucket: vi.fn(),
  updateBucket: vi.fn(),
}));

const client = {
  storage: {
    listBuckets: h.listBuckets,
    createBucket: h.createBucket,
    updateBucket: h.updateBucket,
  },
} as unknown as BucketAdmin;

beforeEach(() => {
  vi.clearAllMocks();
  h.listBuckets.mockResolvedValue({ data: [], error: null });
  h.createBucket.mockResolvedValue({ data: { name: "b" }, error: null });
  h.updateBucket.mockResolvedValue({ data: { message: "ok" }, error: null });
});

describe("ensureBucketWith", () => {
  it("cria o bucket privado quando não existe", async () => {
    await ensureBucketWith(client, "meu-bucket");

    expect(h.createBucket).toHaveBeenCalledWith(
      "meu-bucket",
      expect.objectContaining({ public: false })
    );
  });

  it("FALHA ALTO quando o createBucket devolve erro, dizendo qual bucket", async () => {
    h.createBucket.mockResolvedValue({
      data: null,
      error: { message: "permission denied", statusCode: "403" },
    });

    await expect(ensureBucketWith(client, "meu-bucket")).rejects.toThrow(
      /meu-bucket.*permission denied/
    );
  });

  it.each([
    ["status 409", { message: "conflito", statusCode: "409" }],
    ["mensagem 'already exists'", { message: "The resource already exists" }],
  ])("corrida de duas requisições criando o mesmo bucket (%s) não é falha", async (_n, error) => {
    h.createBucket.mockResolvedValue({ data: null, error });

    await expect(
      ensureBucketWith(client, "meu-bucket")
    ).resolves.toBeUndefined();
  });

  it("FALHA ALTO quando não consegue nem listar os buckets, sem tentar criar", async () => {
    h.listBuckets.mockResolvedValue({
      data: null,
      error: { message: "invalid api key" },
    });

    await expect(ensureBucketWith(client, "meu-bucket")).rejects.toThrow(
      /invalid api key/
    );
    expect(h.createBucket).not.toHaveBeenCalled();
  });

  it("bucket existente do Scaffold reaplica as opções e FALHA ALTO se o update falhar", async () => {
    h.listBuckets.mockResolvedValue({
      data: [{ name: SCAFFOLD_ARTEFACT_BUCKET }],
      error: null,
    });
    h.updateBucket.mockResolvedValue({
      data: null,
      error: { message: "update negado" },
    });

    await expect(
      ensureBucketWith(client, SCAFFOLD_ARTEFACT_BUCKET)
    ).rejects.toThrow(/update negado/);
  });

  it("bucket existente que não é do Scaffold não é tocado", async () => {
    h.listBuckets.mockResolvedValue({
      data: [{ name: "meu-bucket" }],
      error: null,
    });

    await ensureBucketWith(client, "meu-bucket");

    expect(h.createBucket).not.toHaveBeenCalled();
    expect(h.updateBucket).not.toHaveBeenCalled();
  });
});
