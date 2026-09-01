// meetings.test.tsx — Consentimento de Gravação (/cosmos/meetings). Cobre a
// lógica da tela sem virar teste de pixel: RBAC visível (item 3b do spec),
// wiring das três mutações, e os estados vazio/erro.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const grantConsentMock = vi.fn();
const denyConsentMock = vi.fn();
const revokeConsentMock = vi.fn();
const listConsentQueueMock = vi.fn();

vi.mock("@/app/actions/meeting/consent", () => ({
  grantConsent: (...args: unknown[]) => grantConsentMock(...args),
  denyConsent: (...args: unknown[]) => denyConsentMock(...args),
  revokeConsent: (...args: unknown[]) => revokeConsentMock(...args),
  listConsentQueue: (...args: unknown[]) => listConsentQueueMock(...args),
}));

import MeetingsClient from "../../components/cosmos/screens/meetings-client";

const row = (over: Record<string, unknown>) => ({
  id: "tx_1",
  title: "Sprint Review",
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
  consentState: "PENDING",
  consentMode: "PER_MEETING",
  standingConsentRef: null,
  grantedByName: null,
  grantedByRef: null,
  grantedAt: null,
  insightCount: 2,
  ...over,
});

beforeEach(() => {
  grantConsentMock.mockReset();
  denyConsentMock.mockReset();
  revokeConsentMock.mockReset();
  listConsentQueueMock.mockReset();
});

describe("MeetingsClient", () => {
  it("mostra o estado vazio quando não há transcrições", () => {
    render(
      <MeetingsClient
        error={null}
        initial={{ rows: [], podeAgir: true, quemPode: "ADMIN, STE ou RTE" }}
      />
    );

    expect(screen.getByText("Nenhuma transcrição ainda")).toBeTruthy();
  });

  it("mostra o erro quando a leitura inicial falha", () => {
    render(<MeetingsClient error="boom" initial={null} />);

    expect(
      screen.getByText("Não foi possível carregar a fila de consentimento.")
    ).toBeTruthy();
  });

  it("quem pode agir vê Liberar/Negar na fila PENDING e não vê o aviso de RBAC", () => {
    render(
      <MeetingsClient
        error={null}
        initial={{
          rows: [row({})],
          podeAgir: true,
          quemPode: "ADMIN, STE ou RTE",
        }}
      />
    );

    expect(screen.getByRole("button", { name: /Liberar/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Negar/ })).toBeTruthy();
    expect(screen.queryByText(/só ADMIN, STE ou RTE podem/)).toBeNull();
  });

  it("quem não pode agir vê o estado e o aviso de quem pode, sem botões (item 3b)", () => {
    render(
      <MeetingsClient
        error={null}
        initial={{
          rows: [row({})],
          podeAgir: false,
          quemPode: "ADMIN, STE ou RTE",
        }}
      />
    );

    expect(screen.queryByRole("button", { name: /Liberar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Negar/ })).toBeNull();
    expect(screen.getByText(/só ADMIN, STE ou RTE podem/)).toBeTruthy();
  });

  it("a fila PENDING traz a afirmação de que liberar é uma checagem feita fora do sistema (item 3a)", () => {
    render(
      <MeetingsClient
        error={null}
        initial={{
          rows: [row({})],
          podeAgir: true,
          quemPode: "ADMIN, STE ou RTE",
        }}
      />
    );

    expect(
      screen.getByText(/você verificou o consentimento fora do sistema/i)
    ).toBeTruthy();
  });

  it("clicar em Liberar chama grantConsent com o transcriptId e recarrega a fila", async () => {
    grantConsentMock.mockResolvedValue({
      ok: true,
      data: { id: "tx_1", consentState: "GRANTED" },
    });
    listConsentQueueMock.mockResolvedValue({
      ok: true,
      data: { rows: [], podeAgir: true, quemPode: "ADMIN, STE ou RTE" },
    });

    render(
      <MeetingsClient
        error={null}
        initial={{
          rows: [row({})],
          podeAgir: true,
          quemPode: "ADMIN, STE ou RTE",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Liberar/ }));

    await waitFor(() =>
      expect(grantConsentMock).toHaveBeenCalledWith({ transcriptId: "tx_1" })
    );
    await waitFor(() => expect(listConsentQueueMock).toHaveBeenCalledTimes(1));
  });

  it("clicar em Negar chama denyConsent com o transcriptId", async () => {
    denyConsentMock.mockResolvedValue({
      ok: true,
      data: { id: "tx_1", consentState: "DENIED" },
    });
    listConsentQueueMock.mockResolvedValue({
      ok: true,
      data: { rows: [], podeAgir: true, quemPode: "ADMIN, STE ou RTE" },
    });

    render(
      <MeetingsClient
        error={null}
        initial={{
          rows: [row({})],
          podeAgir: true,
          quemPode: "ADMIN, STE ou RTE",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Negar/ }));

    await waitFor(() =>
      expect(denyConsentMock).toHaveBeenCalledWith({ transcriptId: "tx_1" })
    );
  });

  it("linhas GRANTED mostram Revogar para quem pode agir e chamam revokeConsent", async () => {
    revokeConsentMock.mockResolvedValue({
      ok: true,
      data: { id: "tx_2", consentState: "REVOKED" },
    });
    listConsentQueueMock.mockResolvedValue({
      ok: true,
      data: { rows: [], podeAgir: true, quemPode: "ADMIN, STE ou RTE" },
    });

    render(
      <MeetingsClient
        error={null}
        initial={{
          rows: [
            row({
              id: "tx_2",
              consentState: "GRANTED",
              grantedByName: "Helena Souza",
              grantedAt: new Date("2026-08-01T12:00:00.000Z"),
            }),
          ],
          podeAgir: true,
          quemPode: "ADMIN, STE ou RTE",
        }}
      />
    );

    expect(screen.getByText(/Liberado por Helena Souza/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Revogar/ }));

    await waitFor(() =>
      expect(revokeConsentMock).toHaveBeenCalledWith({ transcriptId: "tx_2" })
    );
  });

  it("linhas DENIED/REVOKED aparecem como histórico, sem botão de ação", () => {
    render(
      <MeetingsClient
        error={null}
        initial={{
          rows: [
            row({ id: "tx_3", consentState: "DENIED" }),
            row({ id: "tx_4", consentState: "REVOKED" }),
          ],
          podeAgir: true,
          quemPode: "ADMIN, STE ou RTE",
        }}
      />
    );

    expect(screen.getByText("Histórico")).toBeTruthy();
    expect(screen.getByText("DENIED")).toBeTruthy();
    expect(screen.getByText("REVOKED")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Revogar/ })).toBeNull();
  });
});
