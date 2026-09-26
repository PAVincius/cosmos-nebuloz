import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/design-system/components/mode-toggle", () => ({
  ModeToggle: () => null,
}));

import { ForgotPassword } from "@repo/auth/components/forgot-password";
import { SignUp } from "@repo/auth/components/sign-up";
import AuthLayout from "../../app/(unauthenticated)/layout";

/** Regressão do achado do Crivo (E2E, 274b4f75): a busca por "Cosmos" tem que
 *  ser por substring, não por texto exato — a violação real
 *  (`sign-up.tsx:90`, "Comece sua jornada no Cosmos gratuitamente.") está
 *  embutida num parágrafo maior, não é um nó de texto isolado. */
function textoTemCosmos(container: HTMLElement): boolean {
  return /Cosmos/i.test(container.textContent ?? "");
}

describe("AuthLayout — sem marca de produto específico (FR-001)", () => {
  it("não exibe o wordmark 'Cosmos'", () => {
    render(
      <AuthLayout>
        <div>conteúdo</div>
      </AuthLayout>
    );
    expect(screen.queryByText("Cosmos")).toBeNull();
  });

  it("não exibe a headline específica do Cosmos", () => {
    render(
      <AuthLayout>
        <div>conteúdo</div>
      </AuthLayout>
    );
    expect(screen.queryByText(/Cinco iterações/i)).toBeNull();
    expect(screen.queryByText(/Nenhuma decisão perdida/i)).toBeNull();
  });

  it("não renderiza o CadenceRail (rótulos de iteração I1–I5/IP)", () => {
    render(
      <AuthLayout>
        <div>conteúdo</div>
      </AuthLayout>
    );
    expect(screen.queryByText("I1")).toBeNull();
    expect(screen.queryByText("IP")).toBeNull();
    expect(screen.queryByText("Execução")).toBeNull();
  });

  it("segue renderizando o conteúdo filho", () => {
    render(
      <AuthLayout>
        <div>conteúdo</div>
      </AuthLayout>
    );
    expect(screen.getByText("conteúdo")).not.toBeNull();
  });
});

describe("Telas de autenticação — nenhuma menciona 'Cosmos' (FR-001/SC-002)", () => {
  // SignIn não entra aqui: importa auth-events.ts → server.ts, que quebra em
  // jsdom sem o mock pesado de packages/auth/__tests__/server.test.ts — e não
  // tem texto "Cosmos" nenhum hoje (só os redirects fixos, cobertos abaixo).
  it("SignUp", () => {
    const { container } = render(<SignUp />);
    expect(textoTemCosmos(container)).toBe(false);
  });

  it("ForgotPassword", () => {
    const { container } = render(<ForgotPassword />);
    expect(textoTemCosmos(container)).toBe(false);
  });
});
