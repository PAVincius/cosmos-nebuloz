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
