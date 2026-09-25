/** @vitest-environment jsdom */
// residuos-harden-onda9b.test.tsx — crítica R6, os resíduos de harden: Aprovar
// e Rejeitar abertos juntos; a pergunta de descarte com um token de borda que
// não existe; o 404 da raiz apontando para `/home` (a Home é `/`); a Home
// chamando a trilha de "Audit Explorer"; e o glifo "→" no nome acessível da
// transição terminal do engajamento.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Decisao } from "@/app/(staff)/aprovacoes/decisao";
import { Engajamentos } from "@/app/(staff)/delivery/engajamentos";
import type { EngagementRow } from "@/app/actions/engagements";
import NaoEncontradoRaiz from "@/app/not-found";
import { PerguntaDescartar } from "@/components/pergunta-descartar";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/approvals", () => ({
  decidePlatformApprovalAction: vi.fn(),
}));
vi.mock("@/app/actions/engagements", () => ({
  createEngagementAction: vi.fn(),
  listEngagements: vi.fn(),
  setEngagementStatusAction: vi.fn(),
}));

beforeEach(() => {
  zerarRoteador("/");
});

describe("Decisão — uma barreira por vez", () => {
  it("abrir Rejeitar fecha Aprovar, e vice-versa", () => {
    render(<Decisao alvo="Desconto 30% · Atlas" canWrite id="ap-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    expect(screen.getByRole("group", { name: "Aprovar" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByRole("group", { name: "Rejeitar" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByRole("group", { name: "Aprovar" })).toBeTruthy();
  });

  it("Voltar fecha e os dois gatilhos voltam", () => {
    render(<Decisao canWrite id="ap-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rejeitar" })).toBeTruthy();
  });
});

describe("PerguntaDescartar — borda com token que existe", () => {
  it("não usa --red-border (não existe no tema)", () => {
    render(<PerguntaDescartar onDescartar={vi.fn()} onVoltar={vi.fn()} />);
    const grupo = screen.getByRole("group");
    expect(grupo.getAttribute("style")).not.toContain("--red-border");
    expect(grupo.getAttribute("style")).toContain("--red-rgb");
  });
});

describe("404 da raiz leva à Home, que mora em /", () => {
  it("o link aponta para /", () => {
    render(<NaoEncontradoRaiz />);
    expect(
      screen.getByRole("link", { name: "Ir para a Home" }).getAttribute("href")
    ).toBe("/");
  });
});

describe("Home chama a trilha pelo nome do menu", () => {
  it("sem 'Audit Explorer' na Home", () => {
    const fonte = readFileSync(
      path.join(__dirname, "..", "app", "(staff)", "page.tsx"),
      "utf8"
    );
    expect(fonte).not.toContain("Audit Explorer");
    expect(fonte).toContain("Abrir a Trilha de auditoria");
  });
});

describe("Engajamento — transição terminal sem glifo no nome", () => {
  const ENG: EngagementRow = {
    clienteNome: "Atlas",
    clienteSlug: "atlas",
    codigo: "ENG-01",
    fimEm: null,
    id: "e1",
    inicioEm: "2026-09-01",
    nome: "Diagnóstico",
    proximos: ["PAUSADO", "CONCLUIDO", "CANCELADO"],
    status: "ATIVO",
    valorCentavos: 1_200_000,
  };

  it("Concluir e Cancelar são verbos, e nenhuma barreira leva '→' no nome", () => {
    render(
      <Engajamentos clientes={[]} iniciais={[ENG]} podeEscrever servicos={[]} />
    );

    expect(screen.getByRole("button", { name: "Concluir" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    const grupo = screen.getByRole("group", { name: "Concluir" });
    expect(grupo.textContent).toContain("ENG-01 · Diagnóstico");
    expect(screen.queryByRole("group", { name: /→/ })).toBeNull();
  });
});
