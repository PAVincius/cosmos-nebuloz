/** @vitest-environment jsdom */
// a-casa-e-home.test.tsx — crítica rodada 4 (30/40): o painel tinha duas casas.
// O menu abria em Home (`/home`), mas o login, o erro, o 404 e a tela pendente
// mandavam para `/` (Clientes), e o wordmark da topbar não levava a lugar
// nenhum. Decisão do dono: a casa é `/home`.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  irPara: vi.fn(),
  registrarAcesso: vi.fn(),
  signInEmail: vi.fn(),
  verifyTotp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));
vi.mock("@repo/auth/client", () => ({
  authClient: {
    signIn: { email: h.signInEmail },
    signOut: vi.fn(),
    twoFactor: { verifyTotp: h.verifyTotp },
  },
}));
vi.mock("@/app/actions/access", () => ({
  registrarAcesso: h.registrarAcesso,
}));

beforeEach(() => {
  vi.clearAllMocks();
  h.registrarAcesso.mockResolvedValue(undefined);
  // `window.location.assign` real lança "not implemented" no jsdom.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign: h.irPara },
  });
});

describe("login — depois do TOTP a casa é /home", () => {
  it("redireciona para /home, não para /", async () => {
    h.signInEmail.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    });
    h.verifyTotp.mockResolvedValue({ error: null });
    const { SignInForm } = await import("@/app/sign-in/form");
    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "ana@nebuloz.ai" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "segredo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const totp = await screen.findByLabelText("Código do autenticador");
    fireEvent.change(totp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verificar" }));

    await waitFor(() => expect(h.irPara).toHaveBeenCalledWith("/home"));
    expect(h.irPara).not.toHaveBeenCalledWith("/");
  });
});

describe("saídas de erro voltam para a Home", () => {
  it("error.tsx", async () => {
    const { default: Erro } = await import("@/app/(staff)/error");
    render(<Erro error={new Error("x")} reset={vi.fn()} />);

    expect(
      screen
        .getByRole("link", { name: "Voltar para a Home" })
        .getAttribute("href")
    ).toBe("/home");
  });

  it("not-found.tsx", async () => {
    const { default: NaoEncontrado } = await import("@/app/(staff)/not-found");
    render(<NaoEncontrado />);

    expect(
      screen
        .getByRole("link", { name: "Voltar para a Home" })
        .getAttribute("href")
    ).toBe("/home");
  });

  it("tela pendente do shell", async () => {
    const { Pendente } = await import("@/components/shell");
    render(<Pendente rota="/rota-que-nao-existe" />);

    expect(
      screen
        .getByRole("link", { name: "Voltar para a Home" })
        .getAttribute("href")
    ).toBe("/home");
  });
});

describe("wordmark da topbar", () => {
  it("é um link para /home com nome acessível", async () => {
    const { ShellChrome } = await import("@/components/chrome");
    render(
      <ShellChrome
        staff={{ canWrite: true, email: "ana@nebuloz.ai", name: "Ana" }}
      >
        x
      </ShellChrome>
    );

    const wordmark = screen.getByRole("link", {
      name: "Nebuloz — ir para a Home",
    });
    expect(wordmark.getAttribute("href")).toBe("/home");
  });
});
