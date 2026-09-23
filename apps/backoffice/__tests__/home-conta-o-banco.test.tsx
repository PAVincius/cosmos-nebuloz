/** @vitest-environment jsdom */
// home-conta-o-banco.test.tsx — integração da onda 9. A 9a passou a contar
// as integrações com erro no banco (`integracoesComErro`), porque a lista para
// em 50; Observabilidade já usa o total. A Home ainda contava a lista: com 73
// quebradas, a Home dizia 50 e Observabilidade 73 — o mesmo número em duas
// telas, dois valores.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegracaoQuebrada } from "@/app/actions/access";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

const mocks = vi.hoisted(() => ({
  listPlatformApprovals: vi.fn(),
  listPlatformHealth: vi.fn(),
}));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/access", () => ({
  listPlatformHealth: mocks.listPlatformHealth,
}));
vi.mock("@/app/actions/approvals", () => ({
  listPlatformApprovals: mocks.listPlatformApprovals,
}));

vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.clearAllMocks();
  zerarRoteador("/");
  mocks.listPlatformApprovals.mockResolvedValue({ data: [], ok: true });
});

function quebrada(i: number): IntegracaoQuebrada {
  return {
    id: `i-${i}`,
    mensagem: "Token expirado.",
    name: "GitHub",
    source: "github",
    status: "ERROR",
    tenantNome: "Vanta Saúde",
    tenantSlug: "vanta",
    ultimoSync: null,
  };
}

describe("Home — integrações com erro", () => {
  it("conta o total do banco, não a lista que para em 50", async () => {
    mocks.listPlatformHealth.mockResolvedValue({
      data: {
        acessos: [],
        integracoes: Array.from({ length: 50 }, (_, i) => quebrada(i)),
        integracoesComErro: 73,
        recusas: 0,
        tenants: 3,
        ultimosEventos: [],
      },
      ok: true,
    });
    const { default: Home } = await import("@/app/(staff)/page");
    render(await Home());

    expect(screen.getByText(/73 integrações com erro/)).toBeTruthy();
    expect(screen.queryByText(/50 integrações com erro/)).toBeNull();
  });
});
