/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  cadastro: vi.fn(),
  encerrarTodasAsSessoes: vi.fn(),
}));

vi.mock("@repo/auth/two-factor-enrollment", () => ({
  useTwoFactorEnrollment: () => h.cadastro(),
}));
// A saída da tela varre as sessões no servidor, e o módulo dela puxa
// `@repo/database` → env de servidor. Sem o mock, o teste morre no import
// antes de renderizar qualquer coisa.
vi.mock("../app/seguranca/actions", () => ({
  encerrarTodasAsSessoes: h.encerrarTodasAsSessoes,
}));

import { CadastroDe2FA } from "../app/seguranca/form";

const URI = "otpauth://totp/Cosmos:ana@nebuloz.ai?secret=JBSWY3DPEHPK3PXP";

function estado(over: Record<string, unknown> = {}) {
  return {
    passo: "senha",
    totpURI: null,
    chaveManual: null,
    backupCodes: null,
    erro: null,
    pendente: false,
    iniciar: vi.fn(),
    cancelar: vi.fn(),
    gerarSegredo: vi.fn(),
    confirmar: vi.fn(),
    ...over,
  };
}

describe("CadastroDe2FA — uma tela só", () => {
  it("mostra os três pedaços antes de qualquer ação", () => {
    h.cadastro.mockReturnValue(estado());
    render(<CadastroDe2FA />);

    // A forma inteira do trabalho visível de cara: em duas telas a senha
    // parecia pedágio surpresa.
    expect(screen.getByText(/QR aparece aqui/i)).toBeDefined();
    expect(screen.getByLabelText(/sua senha/i)).toBeDefined();
    expect(screen.getByLabelText(/código do autenticador/i)).toBeDefined();
  });

  it("o campo do código nasce desabilitado — não há contra o que verificar", () => {
    h.cadastro.mockReturnValue(estado());
    render(<CadastroDe2FA />);

    expect(
      screen.getByLabelText(/código do autenticador/i).hasAttribute("disabled")
    ).toBe(true);
  });

  it("com segredo: QR no lugar do aviso, senha vira linha confirmada", () => {
    h.cadastro.mockReturnValue(
      estado({ totpURI: URI, chaveManual: "JBSWY3DPEHPK3PXP" })
    );
    render(<CadastroDe2FA />);

    expect(screen.queryByText(/QR aparece aqui/i)).toBeNull();
    expect(screen.getByText(/senha confirmada/i)).toBeDefined();
    // O campo de senha some: mantê-lo editável convida a redigitar algo que já
    // valeu, e ele não faz mais nada.
    expect(screen.queryByLabelText(/sua senha/i)).toBeNull();
    expect(
      screen.getByLabelText(/código do autenticador/i).hasAttribute("disabled")
    ).toBe(false);
  });

  it("o botão muda de trabalho conforme a etapa", () => {
    h.cadastro.mockReturnValue(estado());
    const { rerender } = render(<CadastroDe2FA />);
    expect(screen.getByRole("button", { name: /gerar qr/i })).toBeDefined();

    h.cadastro.mockReturnValue(estado({ totpURI: URI }));
    rerender(<CadastroDe2FA />);
    expect(screen.getByRole("button", { name: /confirmar e ativar/i })).toBeDefined();
  });

  it("erro do servidor aparece na tela, sem tradução minha por cima", () => {
    h.cadastro.mockReturnValue(
      estado({ erro: "Falha ao ativar: Invalid origin · 500" })
    );
    render(<CadastroDe2FA />);

    expect(screen.getByText(/Invalid origin/)).toBeDefined();
  });

  it("códigos de recuperação são a tela terminal, e só eles", () => {
    h.cadastro.mockReturnValue(
      estado({ passo: "codigos", backupCodes: ["aaaa-1111", "bbbb-2222"] })
    );
    render(<CadastroDe2FA />);

    expect(screen.getByText("aaaa-1111")).toBeDefined();
    expect(screen.queryByLabelText(/sua senha/i)).toBeNull();
    expect(screen.queryByLabelText(/código do autenticador/i)).toBeNull();
  });
});
