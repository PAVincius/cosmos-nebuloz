// integrations.test.tsx — screen-level coverage for the richer connector
// cards: real per-connector data (status/lastSync) renders honestly, the
// header meta splits "conectadas" from "disponíveis" (catalog entries with
// no configured row), and neither the Gerenciar nor the Conectar modal
// fabricates a connection state or leaks config/mapping.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IntegrationView } from "../../app/(cosmos)/actions/integrations";

const listIntegrationsMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/integrations", () => ({
  listIntegrations: (...args: unknown[]) => listIntegrationsMock(...args),
}));

import IntegrationsScreen from "../../components/cosmos/screens/integrations";

const ITEMS: IntegrationView[] = [
  {
    id: "i1",
    source: "github",
    name: "GitHub Corp",
    status: "ACTIVE",
    lastSyncAt: "2026-02-01T00:00:00.000Z",
  },
];

describe("IntegrationsScreen", () => {
  it("renders a connected card with real status/sync and an available card for an unconfigured connector", async () => {
    listIntegrationsMock.mockResolvedValueOnce({ ok: true, data: ITEMS });
    render(<IntegrationsScreen />);

    // Real, configured connector.
    expect(await screen.findByText("GitHub Corp")).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
    expect(screen.getByText(/Sincronizado em/)).toBeTruthy();
    expect(screen.getByText("Gerenciar")).toBeTruthy();

    // Catalog entry with zero configured rows for this tenant — honestly
    // "available", not faked as connected.
    expect(screen.getByText("Linear")).toBeTruthy();
    expect(screen.getAllByText("Conectar").length).toBeGreaterThan(0);
    expect(screen.queryByText("GitHub")).toBeNull(); // no duplicate "available" card for the already-connected source

    // Header meta splits real counts: the catalog has 9 entries; with
    // "github" configured, 8 remain "disponíveis".
    expect(screen.getByText("1 conectadas")).toBeTruthy();
    expect(screen.getByText("8 disponíveis")).toBeTruthy();
  });

  it("shows the non-secret manage view for a connected integration without leaking config/mapping", async () => {
    listIntegrationsMock.mockResolvedValueOnce({ ok: true, data: ITEMS });
    render(<IntegrationsScreen />);

    fireEvent.click(await screen.findByText("Gerenciar"));

    expect(await screen.findByText("Fonte")).toBeTruthy();
    expect(screen.getByText("github")).toBeTruthy();
    expect(screen.getByText(/Credenciais e mapeamento de campos/)).toBeTruthy();
    // No credential-shaped content anywhere in the modal.
    expect(screen.queryByText(/apiKey|token|mapping/i)).toBeNull();
  });

  it("shows an honest deferred message for Conectar — no fake connected state, no fabricated sync data", async () => {
    // No configured integrations at all here, so every catalog card is
    // "available" and any "Sincronizado em" text would only be able to come
    // from a fabrication, not real data.
    listIntegrationsMock.mockResolvedValueOnce({ ok: true, data: [] });
    render(<IntegrationsScreen />);

    expect(await screen.findByText("0 conectadas")).toBeTruthy();
    expect(screen.getByText("9 disponíveis")).toBeTruthy();

    const connectButtons = screen.getAllByText("Conectar");
    fireEvent.click(connectButtons[0]);

    expect(
      await screen.findByText(/ainda não está implementado nesta versão/)
    ).toBeTruthy();
    expect(screen.queryByText("Conectado")).toBeNull();
    expect(screen.queryByText("Ativo")).toBeNull();
    expect(screen.queryByText(/Sincronizado em/)).toBeNull();
  });

  it("shows the error state when the action fails", async () => {
    listIntegrationsMock.mockResolvedValueOnce({ ok: false, error: "boom" });
    render(<IntegrationsScreen />);

    expect(
      await screen.findByText("Não foi possível carregar os dados.")
    ).toBeTruthy();
  });
});
