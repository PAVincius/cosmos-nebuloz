// @vitest-environment node
// US4 (spec 009, FR-010): aceitar um convite troca activeTenantId só da
// sessão que executou a ação — não de todas as sessões da pessoa
// (`session.updateMany({ where: { userId } })` vazava para outras sessões
// abertas da mesma pessoa).

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  tenantInvitationFindUnique: vi.fn(),
  tenantMemberFindFirst: vi.fn(),
  tenantMemberCreate: vi.fn(),
  tenantInvitationUpdate: vi.fn(),
  sessionUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@repo/auth/server", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@repo/database", () => ({
  database: {
    tenantInvitation: {
      findUnique: mocks.tenantInvitationFindUnique,
      update: mocks.tenantInvitationUpdate,
    },
    tenantMember: {
      findFirst: mocks.tenantMemberFindFirst,
      create: mocks.tenantMemberCreate,
    },
    session: { update: mocks.sessionUpdate },
    $transaction: mocks.transaction,
  },
}));

import InviteCompletePage from "../../../app/(unauthenticated)/invite/[token]/complete/page";

const SESSION = {
  user: { id: "user-1", email: "user@exemplo.com" },
  session: { id: "session-B" },
};

const INVITATION = {
  id: "token-1",
  email: "user@exemplo.com",
  role: "PO",
  status: "PENDING",
  tenantId: "tenant-nova",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  tenant: { id: "tenant-nova", name: "Conta Nova" },
};

function params() {
  return Promise.resolve({ token: "token-1" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
  mocks.headers.mockResolvedValue(new Headers());
  mocks.getSession.mockResolvedValue(SESSION);
  mocks.tenantInvitationFindUnique.mockResolvedValue(INVITATION);
  mocks.tenantMemberFindFirst.mockResolvedValue(null); // ainda não é membro
  mocks.transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe("InviteCompletePage — aceitar convite escopado à sessão (FR-010)", () => {
  it("atualiza activeTenantId só da sessão que aceitou o convite, não de todas via userId", async () => {
    await InviteCompletePage({ params: params() }).catch(() => null);

    expect(mocks.sessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-B" },
      data: { activeTenantId: "tenant-nova" },
    });
  });

  it("não chama session.updateMany (vazaria para outras sessões da pessoa)", async () => {
    await InviteCompletePage({ params: params() }).catch(() => null);

    // @repo/database mockado acima não expõe updateMany — se o código ainda
    // chamasse, este teste falharia com "is not a function" antes de chegar
    // aqui, e não com a asserção abaixo.
    expect(mocks.sessionUpdate).toHaveBeenCalledTimes(1);
  });

  it("redireciona ao onboarding com o nome da conta nova depois de aceitar", async () => {
    await expect(InviteCompletePage({ params: params() })).rejects.toThrow(
      "REDIRECT:/onboarding?from=invite&workspace=Conta%20Nova"
    );
  });
});
