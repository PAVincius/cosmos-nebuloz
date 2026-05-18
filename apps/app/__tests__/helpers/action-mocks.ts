import { vi } from "vitest";

export class MockAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

export const tenantCtx = {
  tenantId: "tenant-test",
  userId: "user-test",
  role: "PO" as const,
};

export function createActionMocks() {
  return {
    headers: vi.fn().mockResolvedValue(new Headers()),
    requireTenantSession: vi.fn().mockResolvedValue(tenantCtx),
    requireRole: vi.fn(),
    revalidateTag: vi.fn(),
    revalidatePath: vi.fn(),
    dispatchEvent: vi.fn().mockResolvedValue(undefined),
    featureFindFirst: vi.fn(),
    featureUpdateMany: vi.fn(),
    epicUpdateMany: vi.fn(),
  };
}

export type ActionMocks = ReturnType<typeof createActionMocks>;
