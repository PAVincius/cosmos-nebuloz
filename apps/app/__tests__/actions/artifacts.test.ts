import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "t1" }),
  headersResult: vi.fn().mockResolvedValue({}),
  storageUpload: vi
    .fn()
    .mockResolvedValue({ data: { path: "t1/a1.md.gz" }, error: null }),
  storageList: vi.fn().mockResolvedValue({ data: [], error: null }),
  storageRemove: vi.fn().mockResolvedValue({ error: null }),
  storageFrom: vi.fn(),
  ensureBucket: vi.fn().mockResolvedValue(undefined),
  tenantFindFirst: vi.fn().mockResolvedValue({ metadata: {} }),
  tenantUpdate: vi.fn().mockResolvedValue({}),
}));

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: mocks.requireTenantSession,
}));
vi.mock("next/headers", () => ({ headers: mocks.headersResult }));
vi.mock("@repo/storage", () => ({
  storageClient: {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mocks.storageUpload,
        list: mocks.storageList,
        remove: mocks.storageRemove,
      }),
    },
  },
  AI_PLAYGROUND_BUCKET: "cosmos-ai-playground",
  ensureBucket: mocks.ensureBucket,
}));
vi.mock("@repo/database", () => ({
  database: {
    tenant: {
      findFirst: mocks.tenantFindFirst,
      update: mocks.tenantUpdate,
    },
  },
}));
vi.mock("@paralleldrive/cuid2", () => ({ createId: () => "test-id-123" }));

import { listArtifacts, saveArtifact } from "@/app/actions/artifacts/index";

describe("saveArtifact", () => {
  it("saves artifact and returns metadata", async () => {
    const result = await saveArtifact({
      title: "My PRD",
      type: "prd",
      content: "# PRD\nContent here",
      epicId: "e1",
    });
    expect(result.ok).toBe(true);
    expect(result.data?.title).toBe("My PRD");
    expect(result.data?.type).toBe("prd");
  });

  it("fails with empty title", async () => {
    const result = await saveArtifact({
      title: "",
      type: "prd",
      content: "content",
    });
    expect(result.ok).toBe(false);
  });
});

describe("listArtifacts", () => {
  it("returns empty array when no artifacts", async () => {
    const result = await listArtifacts();
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([]);
  });
});
