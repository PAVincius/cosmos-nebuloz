import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/design-system/components/mode-toggle", () => ({
  ModeToggle: () => null,
}));

import AuthLayout from "../../app/(unauthenticated)/layout";

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
