import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Achado 28a do Lacre, 2ª parte. O link novo leva o token no fragmento. A página
// lê `location.hash` no cliente, troca o token por sessão numa server action
// (POST, corpo e não URL), o servidor grava o cookie httpOnly, e o endereço
// perde o hash com `history.replaceState`. O token nunca está numa URL que o
// servidor veja.

const h = vi.hoisted(() => ({
  startRespondentSession: vi.fn(),
  reloadPage: vi.fn(),
}));

vi.mock("@/app/(meridian)/actions/respondent", () => ({
  startRespondentSession: h.startRespondentSession,
}));
vi.mock("@/lib/meridian/reload-page", () => ({ reloadPage: h.reloadPage }));

import { RespondentSessionGate } from "@/components/meridian/respondent-session-gate";

const TOKEN = "cd".repeat(32);
const FORM = <div>formulário da bateria</div>;

const setHash = (hash: string) => {
  window.history.replaceState(null, "", `/meridian-responder${hash}`);
};

beforeEach(() => {
  vi.clearAllMocks();
  setHash("");
  h.startRespondentSession.mockResolvedValue({ ok: true, data: undefined });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("troca do token do fragmento por sessão", () => {
  it("manda o token à server action e recarrega a página já com a sessão", async () => {
    setHash(`#t=${TOKEN}`);
    render(
      <RespondentSessionGate hasSession={false} initialError={null}>
        {FORM}
      </RespondentSessionGate>
    );
    await waitFor(() =>
      expect(h.startRespondentSession).toHaveBeenCalledWith(TOKEN)
    );
    await waitFor(() => expect(h.reloadPage).toHaveBeenCalledTimes(1));
  });

  it("o endereço perde o hash ANTES da chamada: nenhuma URL do navegador carrega o token", async () => {
    setHash(`#t=${TOKEN}`);
    const seen: { href: string; hash: string }[] = [];
    h.startRespondentSession.mockImplementation(async () => {
      seen.push({ href: window.location.href, hash: window.location.hash });
      return { ok: true, data: undefined };
    });
    const replace = vi.spyOn(window.history, "replaceState");
    render(
      <RespondentSessionGate hasSession={false} initialError={null}>
        {FORM}
      </RespondentSessionGate>
    );
    await waitFor(() => expect(h.startRespondentSession).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith(null, "", "/meridian-responder");
    expect(seen[0]?.href).not.toContain(TOKEN);
    expect(seen[0]?.hash).toBe("");
    expect(window.location.href).not.toContain(TOKEN);
  });

  it("enquanto troca, mostra 'abrindo' e não o formulário nem 'link inválido'", async () => {
    setHash(`#t=${TOKEN}`);
    h.startRespondentSession.mockReturnValue(
      new Promise<never>(() => {
        /* nunca resolve */
      })
    );
    render(
      <RespondentSessionGate hasSession={false} initialError={null}>
        {FORM}
      </RespondentSessionGate>
    );
    expect(await screen.findByRole("status")).toBeDefined();
    expect(screen.queryByText(/inválido/i)).toBeNull();
    expect(screen.queryByText("formulário da bateria")).toBeNull();
  });

  it("token recusado: mostra o texto de link inválido, não recarrega, e o hash já saiu do endereço", async () => {
    setHash(`#t=${TOKEN}`);
    h.startRespondentSession.mockResolvedValue({
      ok: false,
      error: "Link inválido ou expirado.",
    });
    render(
      <RespondentSessionGate hasSession={false} initialError={null}>
        {FORM}
      </RespondentSessionGate>
    );
    expect(await screen.findByText("Link inválido ou expirado")).toBeDefined();
    expect(h.reloadPage).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain(TOKEN);
  });

  it("teto de tentativas tem o texto próprio", async () => {
    setHash(`#t=${TOKEN}`);
    h.startRespondentSession.mockResolvedValue({
      ok: false,
      error: "Muitas tentativas. Aguarde um minuto.",
    });
    render(
      <RespondentSessionGate hasSession={false} initialError={null}>
        {FORM}
      </RespondentSessionGate>
    );
    expect(await screen.findByText("Muitas tentativas")).toBeDefined();
  });

  it("a chamada que lança não deixa a tela em 'abrindo' para sempre", async () => {
    setHash(`#t=${TOKEN}`);
    h.startRespondentSession.mockRejectedValue(new Error("Failed to fetch"));
    render(
      <RespondentSessionGate hasSession={false} initialError={null}>
        {FORM}
      </RespondentSessionGate>
    );
    expect(await screen.findByText("Link inválido ou expirado")).toBeDefined();
  });

  it("com sessão antiga e link novo (outro respondente), troca a sessão em vez de mostrar a velha", async () => {
    setHash(`#t=${TOKEN}`);
    h.startRespondentSession.mockReturnValue(
      new Promise<never>(() => {
        /* nunca resolve */
      })
    );
    render(
      <RespondentSessionGate hasSession initialError={null}>
        {FORM}
      </RespondentSessionGate>
    );
    await waitFor(() =>
      expect(h.startRespondentSession).toHaveBeenCalledWith(TOKEN)
    );
    await waitFor(() =>
      expect(screen.queryByText("formulário da bateria")).toBeNull()
    );
  });
});

describe("sem token no fragmento", () => {
  it("com sessão (cookie): mostra o formulário e não chama a server action", async () => {
    render(
      <RespondentSessionGate hasSession initialError={null}>
        {FORM}
      </RespondentSessionGate>
    );
    expect(screen.getByText("formulário da bateria")).toBeDefined();
    expect(h.startRespondentSession).not.toHaveBeenCalled();
  });

  it("sem sessão: mostra o texto de link inválido que o servidor decidiu", async () => {
    render(
      <RespondentSessionGate
        hasSession={false}
        initialError="Link inválido ou expirado."
      >
        {FORM}
      </RespondentSessionGate>
    );
    expect(await screen.findByText("Link inválido ou expirado")).toBeDefined();
    expect(h.startRespondentSession).not.toHaveBeenCalled();
  });

  it("fragmento que não é token é ignorado", async () => {
    setHash("#qualquer-coisa");
    render(
      <RespondentSessionGate hasSession initialError={null}>
        {FORM}
      </RespondentSessionGate>
    );
    expect(screen.getByText("formulário da bateria")).toBeDefined();
    expect(h.startRespondentSession).not.toHaveBeenCalled();
  });
});
