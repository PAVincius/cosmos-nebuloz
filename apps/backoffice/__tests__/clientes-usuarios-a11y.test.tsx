/** @vitest-environment jsdom */
// clientes-usuarios-a11y.test.tsx — a aba Usuários sem informação escondida.
//
// 1. O motivo de "somente leitura" (papel MEMBER no tenant system) estava só
//    em `title` do `<select>` desabilitado — que nem recebe foco. Passa a ser
//    texto visível, uma vez, e cada select aponta para ele por
//    `aria-describedby`.
// 2. A coluna "Acesso" dizia "Ativo" para todo mundo, hardcoded: nem
//    `TenantMember` nem `TenantMemberRow` têm esse dado. Coluna removida.
// 3. STE/RTE/SM/PO/DEV sem glossário — legenda visível, uma linha por papel.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AbaUsuarios } from "@/app/(staff)/clientes/[slug]/abas/usuarios";
import type { TenantMemberRow } from "@/app/actions/tenant-members";

vi.mock("@/app/actions/tenant-members", () => ({
  updateTenantMemberRoleAction: vi.fn(),
}));

const MEMBROS: TenantMemberRow[] = [
  {
    desde: "2026-01-01T00:00:00.000Z",
    email: "ana@acme.com",
    id: "m1",
    nome: "Ana",
    role: "ADMIN",
  },
  {
    desde: "2026-02-01T00:00:00.000Z",
    email: "bia@acme.com",
    id: "m2",
    nome: "Bia",
    role: "STE",
  },
];

describe("AbaUsuarios — nada só em title, nada inventado", () => {
  it("sem permissão, o motivo aparece em texto e descreve cada select", () => {
    render(<AbaUsuarios canWrite={false} membros={MEMBROS} slug="acme" />);

    const motivo = screen.getByText(/seu papel no tenant system é MEMBER/);
    expect(motivo.className).not.toContain("sr-only");

    const select = screen.getByLabelText("Papel de ana@acme.com");
    expect(select.getAttribute("title")).toBeNull();
    expect(
      screen.getByRole("combobox", {
        description: /seu papel no tenant system é MEMBER/,
        name: "Papel de ana@acme.com",
      })
    ).toBe(select);
  });

  it("com permissão, não há aviso de somente leitura", () => {
    render(<AbaUsuarios canWrite membros={MEMBROS} slug="acme" />);

    expect(screen.queryByText(/somente leitura/i)).toBeNull();
  });

  it("não existe coluna 'Acesso' nem um 'Ativo' inventado", () => {
    render(<AbaUsuarios canWrite membros={MEMBROS} slug="acme" />);

    expect(screen.queryByRole("columnheader", { name: "Acesso" })).toBeNull();
    expect(screen.queryByText("Ativo")).toBeNull();
  });

  it("os papéis têm legenda visível, uma linha por sigla", () => {
    const { container } = render(
      <AbaUsuarios canWrite membros={MEMBROS} slug="acme" />
    );

    const legenda = container.querySelector("dl") as HTMLElement;
    expect(legenda).toBeTruthy();
    for (const sigla of ["ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"]) {
      const termo = Array.from(legenda.querySelectorAll("dt")).find(
        (dt) => dt.textContent === sigla
      );
      expect(termo, sigla).toBeTruthy();
      expect(
        termo?.nextElementSibling?.textContent?.trim().length
      ).toBeGreaterThan(3);
    }
  });
});
