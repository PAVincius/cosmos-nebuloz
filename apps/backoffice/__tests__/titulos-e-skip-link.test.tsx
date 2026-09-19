/** @vitest-environment jsdom */
// titulos-e-skip-link.test.tsx — [P1] hierarquia de títulos e saída rápida
// do teclado.
//
// O `SectionCard` do kit renderizava o título num `<div>`: cada tela do
// painel tinha um `<h1>` (do `PageHeader`) e nenhum `<h2>` — o leitor de tela
// não tinha como pular de seção em seção. O kit ganha `as` opcional; o padrão
// continua `<div>` para Cosmos e Charter não mudarem. E quem navega por
// teclado atravessava os 16 itens da sidebar a cada troca de tela: o shell
// ganha "Pular para o conteúdo" como primeiro foco.
import { SectionCard } from "@repo/design-system/cosmos/kit";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShellChrome } from "@/components/chrome";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark", setTheme: vi.fn() }),
}));
vi.mock("@repo/auth/client", () => ({
  authClient: { signOut: vi.fn() },
}));

const STAFF = { canWrite: true, email: "ana@nebuloz.ai", name: "Ana" };

describe("SectionCard — `as` opcional", () => {
  it("sem `as`, o título não é heading (comportamento atual do Cosmos/Charter)", () => {
    render(<SectionCard title="Dados do cliente">x</SectionCard>);

    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Dados do cliente")).toBeTruthy();
  });

  it('com as="h2", o título é um heading de nível 2', () => {
    render(
      <SectionCard as="h2" title="Dados do cliente">
        x
      </SectionCard>
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Dados do cliente" })
    ).toBeTruthy();
  });

  it('com as="h3", o título é um heading de nível 3', () => {
    render(
      <SectionCard as="h3" title="Módulos">
        x
      </SectionCard>
    );

    expect(
      screen.getByRole("heading", { level: 3, name: "Módulos" })
    ).toBeTruthy();
  });

  it("o heading não ganha margem do navegador: mesma classe e estilo do div", () => {
    render(
      <SectionCard as="h2" title="Dados do cliente">
        x
      </SectionCard>
    );

    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.className).toContain("display");
    expect(h2.style.margin).toBe("0px");
  });
});

describe("Shell — skip link", () => {
  it("'Pular para o conteúdo' é o primeiro foco e aponta para #conteudo", () => {
    mocks.pathname = "/";
    render(<ShellChrome staff={STAFF}>x</ShellChrome>);

    const link = screen.getByRole("link", { name: /Pular para o conteúdo/ });
    expect(link.getAttribute("href")).toBe("#conteudo");
    // Primeiro elemento focável do documento.
    const focaveis = document.querySelectorAll("a[href], button");
    expect(focaveis[0]).toBe(link);

    const main = screen.getByRole("main");
    expect(main.id).toBe("conteudo");
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("fica escondido até receber foco", () => {
    mocks.pathname = "/";
    render(<ShellChrome staff={STAFF}>x</ShellChrome>);

    const link = screen.getByRole("link", { name: /Pular para o conteúdo/ });
    expect(link.className).toContain("sr-only");
    fireEvent.focus(link);
    expect(link.className).not.toContain("sr-only");
    fireEvent.blur(link);
    expect(link.className).toContain("sr-only");
  });
});

describe("Sidebar — um só item aceso", () => {
  it("em /clientes/novo só 'Provisionar cliente' tem aria-current", () => {
    mocks.pathname = "/clientes/novo";
    render(<ShellChrome staff={STAFF}>x</ShellChrome>);

    const acesos = document.querySelectorAll('[aria-current="page"]');
    expect(acesos).toHaveLength(1);
    expect(acesos[0].textContent).toContain("Provisionar cliente");
  });

  it("em /clientes/atlas 'Clientes' segue aceso", () => {
    mocks.pathname = "/clientes/atlas";
    render(<ShellChrome staff={STAFF}>x</ShellChrome>);

    const acesos = document.querySelectorAll('[aria-current="page"]');
    expect(acesos).toHaveLength(1);
    expect(acesos[0].textContent).toContain("Clientes");
  });
});
