import { describe, expect, it, vi } from "vitest";

// `onboarding.ts` importa `@repo/auth/server`, que constrói o client real do
// better-auth no escopo do módulo — e este, por sua vez, importa
// `@repo/database`, que lê `DATABASE_URL` via `@t3-oss/env-nextjs` no escopo
// do módulo. Sem mock, o import deste arquivo quebra antes mesmo de a
// suíte rodar (ambiente jsdom trata o acesso como client-side). Mesmo padrão
// usado em create-onboarding-workspace.test.ts.
vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@repo/database", () => ({ database: {} }));

import { SELF_SERVICE_MODULES } from "@/app/actions/onboarding";

describe("provisionamento do cadastro self-service", () => {
  it("dá COSMOS em TRIAL — cadastro sozinho não é venda fechada", () => {
    expect(SELF_SERVICE_MODULES).toEqual([
      { module: "COSMOS", status: "TRIAL", trialDays: 14 },
    ]);
  });

  it("não dá CHARTER — módulo pago entra por contratação", () => {
    const modules = SELF_SERVICE_MODULES.map((m) => m.module);
    expect(modules).not.toContain("CHARTER");
  });
});
