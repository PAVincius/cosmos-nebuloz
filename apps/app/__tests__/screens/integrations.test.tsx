// integrations.test.tsx — Integrações (/cosmos/integrations). Cobre os
// critérios da story-060 visíveis na tela: AC-001 (pausar/retomar o ciclo de
// vida do conector), AC-002 (testar conexão sem pedir credencial), AC-004
// (saúde de sincronização vinda de SyncLog, "nunca sincronizado" sem log) e
// AC-006 (vazio/erro sem conexão fabricada). Asserção sobre conteúdo — sem
// snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationView } from "../../app/(cosmos)/actions/integrations";

const listIntegrationsMock = vi.fn();
const setIntegrationPausedMock = vi.fn();
const testIntegrationConnectionMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/integrations", () => ({
  listIntegrations: (...args: unknown[]) => listIntegrationsMock(...args),
  setIntegrationPaused: (...args: unknown[]) =>
    setIntegrationPausedMock(...args),
  testIntegrationConnection: (...args: unknown[]) =>
    testIntegrationConnectionMock(...args),
}));

import IntegrationsScreen from "../../components/cosmos/screens/integrations";

const integration = (over: Partial<IntegrationView>): IntegrationView => ({
  id: "i1",
  source: "github",
  name: "GitHub Corp",
  status: "ACTIVE",
  lastSyncAt: "2026-02-01T00:00:00.000Z",
  lastSync: null,
  ...over,
});

const ITEMS: IntegrationView[] = [integration({})];

describe("IntegrationsScreen", () => {
  beforeEach(() => {
    listIntegrationsMock.mockReset();
    setIntegrationPausedMock.mockReset();
    testIntegrationConnectionMock.mockReset();
  });

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

  it("mostra a saúde da última sincronização vinda de SyncLog (AC-004)", async () => {
    listIntegrationsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        integration({
          lastSync: {
            id: "l1",
            type: "snapshot",
            status: "partial",
            itemsCreated: 3,
            itemsUpdated: 2,
            itemsSkipped: 1,
            createdAt: "2026-02-01T00:00:00.000Z",
          },
        }),
      ],
    });

    render(<IntegrationsScreen />);

    // parcial é distinguido de sucesso: FR-020 diz que PARTIAL não faz
    // rollback, então é um estado real que o Admin precisa ver
    expect(
      await screen.findByText("Última sincronização: parcial")
    ).toBeTruthy();
    expect(
      screen.getByText("3 criados · 2 atualizados · 1 pulado")
    ).toBeTruthy();
  });

  it("diz que nunca sincronizou, sem contador zerado (AC-004)", async () => {
    listIntegrationsMock.mockResolvedValueOnce({
      ok: true,
      data: [integration({ lastSyncAt: null, lastSync: null })],
    });

    render(<IntegrationsScreen />);

    expect(await screen.findByText("Nunca sincronizado")).toBeTruthy();
    expect(screen.queryByText(/criados/)).toBeNull();
    expect(screen.queryByText(/Última sincronização:/)).toBeNull();
  });

  it("pausa o conector pela tela e recarrega a lista (AC-001)", async () => {
    listIntegrationsMock
      .mockResolvedValueOnce({ ok: true, data: ITEMS })
      .mockResolvedValueOnce({
        ok: true,
        data: [integration({ status: "PAUSED" })],
      });
    setIntegrationPausedMock.mockResolvedValue({
      ok: true,
      data: { id: "i1", status: "PAUSED" },
    });

    render(<IntegrationsScreen />);
    await screen.findByText("GitHub Corp");

    fireEvent.click(screen.getByRole("button", { name: "Pausar GitHub Corp" }));

    await waitFor(() =>
      expect(setIntegrationPausedMock).toHaveBeenCalledWith({
        id: "i1",
        paused: true,
      })
    );
    await waitFor(() => expect(listIntegrationsMock).toHaveBeenCalledTimes(2));
  });

  it("mostra o conector pausado e oferece retomar (AC-001)", async () => {
    listIntegrationsMock.mockResolvedValueOnce({
      ok: true,
      data: [integration({ status: "PAUSED" })],
    });

    render(<IntegrationsScreen />);

    expect(await screen.findByText("Pausado")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retomar GitHub Corp" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Pausar GitHub Corp" })
    ).toBeNull();
  });

  it("testa a conexão pela tela sem pedir credencial alguma (AC-002)", async () => {
    listIntegrationsMock.mockResolvedValue({ ok: true, data: ITEMS });
    testIntegrationConnectionMock.mockResolvedValue({
      ok: true,
      data: { id: "i1", status: "ACTIVE", account: "octocat" },
    });

    render(<IntegrationsScreen />);
    await screen.findByText("GitHub Corp");

    fireEvent.click(
      screen.getByRole("button", { name: "Testar conexão de GitHub Corp" })
    );

    await waitFor(() =>
      expect(testIntegrationConnectionMock).toHaveBeenCalledWith({ id: "i1" })
    );
    // nenhum campo de entrada existe nesta tela: credencial não é digitada aqui
    expect(document.querySelector("input")).toBeNull();
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
