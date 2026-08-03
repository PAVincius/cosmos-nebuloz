// webhooks.test.tsx — Webhooks (/cosmos/webhooks). Cobre o que a tela precisa
// mostrar e permitir sobre a confiabilidade da entrega: saúde derivada do
// histórico (FR-020 AC-006), pausa/retomada do endpoint e disparo de evento
// sintético (story-037 AC-004). Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listWebhooksMock = vi.fn();
const setWebhookActiveMock = vi.fn();
const sendTestWebhookMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/webhooks", () => ({
  listWebhooks: (...args: unknown[]) => listWebhooksMock(...args),
  createWebhook: vi.fn(),
  setWebhookActive: (...args: unknown[]) => setWebhookActiveMock(...args),
  sendTestWebhook: (...args: unknown[]) => sendTestWebhookMock(...args),
}));

import WebhooksScreen from "../../components/cosmos/screens/webhooks";

const hook = (over: Record<string, unknown>) => ({
  id: "w1",
  url: "https://hooks.example.com/cosmos",
  eventTypes: ["epic.created"],
  active: true,
  lastDeliveryStatus: "DELIVERED",
  lastDeliveryCode: 200,
  lastDeliveryAt: "2026-07-20T12:00:00.000Z",
  consecutiveFailures: 0,
  degraded: false,
  ...over,
});

describe("WebhooksScreen", () => {
  beforeEach(() => {
    listWebhooksMock.mockReset();
    setWebhookActiveMock.mockReset();
    sendTestWebhookMock.mockReset();
  });

  it("marca o endpoint degradado com a contagem de falhas seguidas (AC-006)", async () => {
    listWebhooksMock.mockResolvedValueOnce({
      ok: true,
      data: [
        hook({
          id: "w1",
          lastDeliveryStatus: "FAILED",
          lastDeliveryCode: 503,
          consecutiveFailures: 3,
          degraded: true,
        }),
        hook({
          id: "w2",
          url: "https://hooks.example.com/ok",
          consecutiveFailures: 0,
        }),
      ],
    });

    render(<WebhooksScreen />);

    expect(await screen.findByText("Degradado")).toBeTruthy();
    expect(screen.getByText("3 falhas seguidas")).toBeTruthy();
    expect(screen.getByText("1 degradado")).toBeTruthy();
    // o endpoint saudável não é rotulado como degradado
    expect(screen.getAllByText("Degradado")).toHaveLength(1);
  });

  it("mostra o código HTTP da última entrega em vez de só o horário", async () => {
    listWebhooksMock.mockResolvedValueOnce({
      ok: true,
      data: [hook({ lastDeliveryStatus: "FAILED", lastDeliveryCode: 502 })],
    });

    render(<WebhooksScreen />);

    expect(await screen.findByText(/HTTP 502/)).toBeTruthy();
  });

  it("pausa o endpoint pela tela e recarrega a lista", async () => {
    listWebhooksMock
      .mockResolvedValueOnce({ ok: true, data: [hook({ active: true })] })
      .mockResolvedValueOnce({ ok: true, data: [hook({ active: false })] });
    setWebhookActiveMock.mockResolvedValue({
      ok: true,
      data: { id: "w1", active: false },
    });

    render(<WebhooksScreen />);
    await screen.findByText("https://hooks.example.com/cosmos");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Pausar https://hooks.example.com/cosmos",
      })
    );

    await waitFor(() =>
      expect(setWebhookActiveMock).toHaveBeenCalledWith({
        id: "w1",
        active: false,
      })
    );
    await waitFor(() => expect(listWebhooksMock).toHaveBeenCalledTimes(2));
  });

  it("dispara o evento de teste pela tela (AC-004)", async () => {
    listWebhooksMock.mockResolvedValue({ ok: true, data: [hook({})] });
    sendTestWebhookMock.mockResolvedValue({
      ok: true,
      data: { deliveryLogId: "log-1" },
    });

    render(<WebhooksScreen />);
    await screen.findByText("https://hooks.example.com/cosmos");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Disparar evento de teste em https://hooks.example.com/cosmos",
      })
    );

    await waitFor(() =>
      expect(sendTestWebhookMock).toHaveBeenCalledWith({ id: "w1" })
    );
  });

  it("não oferece disparo de teste em endpoint pausado", async () => {
    listWebhooksMock.mockResolvedValueOnce({
      ok: true,
      data: [hook({ active: false })],
    });

    render(<WebhooksScreen />);
    await screen.findByText("https://hooks.example.com/cosmos");

    expect(
      screen.queryByRole("button", {
        name: "Disparar evento de teste em https://hooks.example.com/cosmos",
      })
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Retomar https://hooks.example.com/cosmos",
      })
    ).toBeTruthy();
  });

  it("mostra o estado vazio quando o tenant não tem endpoint", async () => {
    listWebhooksMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<WebhooksScreen />);

    expect(await screen.findByText("Nenhum webhook configurado.")).toBeTruthy();
  });

  it("mostra o estado de erro e nenhum endpoint quando listWebhooks falha", async () => {
    listWebhooksMock.mockResolvedValueOnce({ ok: false, error: "boom" });

    render(<WebhooksScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar os dados.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("Nenhum webhook configurado.")).toBeNull();
    expect(document.body.innerHTML).not.toContain("hooks.example.com");
  });
});
