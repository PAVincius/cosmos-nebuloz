/** @vitest-environment jsdom */
// propostas-linha-a11y.test.tsx — a linha da proposta sem controle aninhado.
//
// Era `<li role="button">` com um `<button>` (Enviar) dentro: botão dentro de
// botão não é HTML válido, e o leitor de tela (persona Sam) anunciava a linha
// inteira como um único controle sem dizer o que o clique faz. Agora:
//
// 1. O alvo clicável da linha é um `<Link>` próprio, com "Abrir" em `sr-only`
//    no início — o nome acessível é a intenção mais o conteúdo da linha.
// 2. "Enviar" fica fora do link, como irmão dentro do `<li>`.
// 3. Nenhum `button` ou `link` tem ancestral com papel interativo.
// 4. "1 proposta" / "2 propostas", não "(s)".
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Propostas } from "@/app/(staff)/propostas/propostas";
import type { ProposalRow } from "@/app/actions/proposals";

const { paramsMock } = vi.hoisted(() => ({
  paramsMock: vi.fn<() => URLSearchParams>(() => new URLSearchParams()),
}));

vi.mock("@/app/actions/proposals", () => ({
  submitProposalAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => paramsMock(),
}));

function linha(over: Partial<ProposalRow>): ProposalRow {
  return {
    acvCentavos: 100_000,
    cliente: "Atlas Energia",
    criadoEm: "2026-09-01T00:00:00.000Z",
    descontoPercent: 0,
    id: "prop-1",
    numero: "P-0001",
    status: "RASCUNHO",
    titulo: "Atlas — plataforma",
    totalCentavos: 100_000,
    ...over,
  };
}

const PAPEIS_INTERATIVOS = new Set(["button", "link"]);

function temAncestralInterativo(el: HTMLElement): boolean {
  let pai = el.parentElement;
  while (pai) {
    const papel = pai.getAttribute("role") ?? pai.tagName.toLowerCase();
    if (PAPEIS_INTERATIVOS.has(papel) || pai.tagName === "A") {
      return true;
    }
    pai = pai.parentElement;
  }
  return false;
}

describe("Propostas — linha sem controle aninhado", () => {
  beforeEach(() => {
    paramsMock.mockImplementation(() => new URLSearchParams());
  });

  it("o alvo da linha é um link cujo nome começa com 'Abrir' e traz o título", () => {
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    const link = screen.getByRole("link", {
      name: /^Abrir.*Atlas — plataforma/,
    });
    expect(link.getAttribute("href")).toBe("/propostas/prop-1");
    expect(screen.queryByRole("button", { name: /Abrir proposta/ })).toBeNull();
  });

  it("nenhum botão ou link tem ancestral com papel interativo", () => {
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    const controles = [
      ...screen.getAllByRole("button"),
      ...screen.getAllByRole("link"),
    ];
    expect(controles.length).toBeGreaterThan(1);
    for (const c of controles) {
      expect(temAncestralInterativo(c)).toBe(false);
    }
  });

  it("Enviar é irmão do link, não filho", () => {
    render(<Propostas iniciais={[linha({})]} podeEscrever />);

    const enviar = screen.getByRole("button", { name: "Enviar" });
    const link = screen.getByRole("link", { name: /^Abrir/ });
    expect(link.contains(enviar)).toBe(false);
    expect(enviar.closest("li")).toBe(link.closest("li"));
  });

  it("o subtítulo pluraliza de verdade", () => {
    const { unmount } = render(
      <Propostas iniciais={[linha({})]} podeEscrever total={1} />
    );
    expect(screen.getByText("1 proposta")).toBeTruthy();
    unmount();

    render(
      <Propostas
        iniciais={[linha({}), linha({ id: "prop-2", numero: "P-0002" })]}
        podeEscrever
        total={2}
      />
    );
    expect(screen.getByText("2 propostas")).toBeTruthy();
  });
});
