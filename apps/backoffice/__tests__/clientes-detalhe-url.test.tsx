/** @vitest-environment jsdom */
// clientes-detalhe-url.test.tsx — a aba do detalhe do tenant vive em `?aba=`
// (persona Alex: "nenhum link para 'aba Usuários do cliente X'"). Abrir a URL
// com o param já mostra a aba; trocar de aba faz `router.replace` preservando
// os outros params; aba inexistente cai em Resumo sem erro.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DetalheDoTenant } from "@/app/(staff)/clientes/[slug]/detalhe";
import type { TenantMemberRow } from "@/app/actions/tenant-members";
import { replaceMock, zerarRoteador } from "../vitest-mocks/next-navigation";

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.mock("@/app/actions/tenant-members", () => ({
  updateTenantMemberRoleAction: vi.fn(),
}));

const MEMBROS: TenantMemberRow[] = [
  {
    desde: "2026-01-10T00:00:00.000Z",
    email: "ana@vanta.com",
    id: "m1",
    nome: "Ana Souza",
    role: "ADMIN",
  },
];

function montar() {
  return render(
    <DetalheDoTenant
      acoesDeModulo={<div>ações de módulo</div>}
      auditoria={{ data: [], ok: true }}
      canWrite={false}
      charter={<div>charter</div>}
      contratados={new Set()}
      integracoes={{ data: [], ok: true }}
      membros={{ data: MEMBROS, ok: true }}
      meridian={<div>meridian</div>}
      modulos={[]}
      slug="vanta"
    />
  );
}

beforeEach(() => {
  zerarRoteador("/clientes/vanta");
});

describe("DetalheDoTenant — aba na URL", () => {
  it("sem param, abre em Resumo", () => {
    montar();
    expect(screen.getByText("ações de módulo")).toBeTruthy();
    expect(screen.queryByText("ana@vanta.com")).toBeNull();
  });

  it("?aba=usuarios já entra na aba Usuários", () => {
    zerarRoteador("/clientes/vanta", "aba=usuarios");
    montar();
    expect(screen.getByText("ana@vanta.com")).toBeTruthy();
    expect(screen.queryByText("ações de módulo")).toBeNull();
  });

  it("trocar de aba faz router.replace com ?aba=, preserva os outros params e abre a aba", () => {
    zerarRoteador("/clientes/vanta", "q=vanta");
    montar();

    fireEvent.click(screen.getByRole("button", { name: /Usuários/ }));

    expect(replaceMock).toHaveBeenCalledWith(
      "/clientes/vanta?q=vanta&aba=usuarios",
      { scroll: false }
    );
    expect(screen.getByText("ana@vanta.com")).toBeTruthy();
  });

  it("voltar para Resumo tira o param da URL", () => {
    zerarRoteador("/clientes/vanta", "aba=audit");
    montar();

    fireEvent.click(screen.getByRole("button", { name: "Resumo" }));

    expect(replaceMock).toHaveBeenCalledWith("/clientes/vanta", {
      scroll: false,
    });
    expect(screen.getByText("ações de módulo")).toBeTruthy();
  });

  it("aba inexistente no param cai em Resumo, sem quebrar", () => {
    zerarRoteador("/clientes/vanta", "aba=nao-existe");
    montar();
    expect(screen.getByText("ações de módulo")).toBeTruthy();
  });
});
