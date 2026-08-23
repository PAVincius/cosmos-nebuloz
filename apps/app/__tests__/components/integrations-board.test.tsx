// integrations-board.test.tsx — regression coverage for the id/type contract
// on the disconnect button (COS-87 groundwork). `deleteIntegration` looks up
// by `Integration.id` (cuid), never by `type` ("GITHUB"). Before the fix,
// `handleDisconnect` was called with `def.type`, so the server-side
// `findFirst` never matched, the action always returned
// `{ ok: false, error: "Integração não encontrada." }`, and the component
// ignored that result entirely — `router.refresh()` ran unconditionally and
// no error ever reached the screen. These tests fail against that code:
// the first because the action is called with the type instead of the id,
// the second and third because the component doesn't branch on `res.ok`.
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Integration } from "@/app/actions/settings/schema";

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn().mockReturnValue("toast-1"),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const actionMocks = vi.hoisted(() => ({
  deleteIntegration: vi.fn(),
  upsertIntegration: vi.fn(),
}));
vi.mock("@/app/actions/settings/integrations", () => ({
  deleteIntegration: actionMocks.deleteIntegration,
  upsertIntegration: actionMocks.upsertIntegration,
}));

// IntegrationsBoard statically renders BillingConnectWizard, which imports
// this "use server" module (Prisma-backed). Without a mock, jsdom blows up
// resolving the generated Prisma client — same reason
// __tests__/screens/integrations.test.tsx mocks its server actions instead
// of letting them load for real.
vi.mock("@/app/actions/billing", () => ({
  createBillingIntegration: vi.fn(),
}));

import { IntegrationsBoard } from "../../app/(authenticated)/settings/integrations/components/integrations-board";

// id ("int-abc123") deliberately differs from type ("GITHUB") — if the
// component ever regresses to sending the type, the assertions below catch
// it.
function integrationFixture(over: Partial<Integration> = {}): Integration {
  return {
    id: "int-abc123",
    tenantId: "tenant-1",
    type: "GITHUB",
    name: "GitHub Corp",
    status: "ACTIVE",
    configured: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...over,
  };
}

function findDisconnectButton(): HTMLElement {
  const button = document.querySelector("button.text-destructive");
  if (!button) {
    throw new Error("botão de desconectar não renderizou");
  }
  return button as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IntegrationsBoard — desconectar", () => {
  it("chama deleteIntegration com o id da integração, não o type", async () => {
    actionMocks.deleteIntegration.mockResolvedValue({
      ok: true,
      data: { id: "int-abc123" },
    });

    render(<IntegrationsBoard initialIntegrations={[integrationFixture()]} />);
    fireEvent.click(findDisconnectButton());

    await waitFor(() =>
      expect(actionMocks.deleteIntegration).toHaveBeenCalledWith("int-abc123")
    );
    expect(actionMocks.deleteIntegration).not.toHaveBeenCalledWith("GITHUB");
  });

  it("erro do servidor mostra o erro e não recarrega a tela", async () => {
    actionMocks.deleteIntegration.mockResolvedValue({
      ok: false,
      error: "Integração não encontrada.",
    });

    render(<IntegrationsBoard initialIntegrations={[integrationFixture()]} />);
    fireEvent.click(findDisconnectButton());

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(
        "Integração não encontrada."
      )
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("sucesso confirma e recarrega a tela", async () => {
    actionMocks.deleteIntegration.mockResolvedValue({
      ok: true,
      data: { id: "int-abc123" },
    });

    render(<IntegrationsBoard initialIntegrations={[integrationFixture()]} />);
    fireEvent.click(findDisconnectButton());

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(toastMocks.success).toHaveBeenCalled();
  });
});
