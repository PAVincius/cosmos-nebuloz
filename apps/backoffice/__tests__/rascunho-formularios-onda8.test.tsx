/** @vitest-environment jsdom */
// rascunho-formularios-onda8.test.tsx — onda 8a, bloco 4. Três formulários de
// criação jogavam fora o que foi digitado sem perguntar: registrar ativo de IP
// e nova pessoa da capacidade ("Fechar" desmontava o formulário), e o novo
// engajamento (fechar a aba). Agora, com rascunho, fechar a aba passa pelo
// `beforeunload`, e "Fechar" pergunta antes de descartar.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Capacidade } from "@/app/(staff)/capacidade/capacidade";
import { Engajamentos } from "@/app/(staff)/delivery/engajamentos";
import { Biblioteca } from "@/app/(staff)/ip/biblioteca";
import { zerarRoteador } from "../vitest-mocks/next-navigation";

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));
vi.mock("@/app/actions/ip-library", () => ({
  createIpAssetAction: vi.fn(),
  getIpAsset: vi.fn(),
  listIpAssets: vi.fn(),
  registrarReusoAction: vi.fn(),
  updateIpAssetAction: vi.fn(),
}));
vi.mock("@/app/actions/capacity", () => ({
  allocatePersonAction: vi.fn(),
  createPersonAction: vi.fn(),
  listCapacity: vi.fn(),
}));
vi.mock("@/app/actions/engagements", () => ({
  createEngagementAction: vi.fn(),
  listEngagements: vi.fn(),
  setEngagementStatusAction: vi.fn(),
}));

function dispararBeforeUnload(): Event {
  const evento = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(evento);
  return evento;
}

beforeEach(() => {
  zerarRoteador("/");
});

describe("Registrar ativo de IP — rascunho não some em silêncio", () => {
  function abrir() {
    render(
      <Biblioteca
        engajamentos={[]}
        iniciais={[]}
        pessoas={[]}
        podeEscrever
        servicos={[]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Novo" }));
  }

  it("com nome digitado, beforeunload é cancelado; vazio, não", () => {
    abrir();
    expect(dispararBeforeUnload().defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Playbook de onboarding" },
    });
    expect(dispararBeforeUnload().defaultPrevented).toBe(true);
  });

  it("Fechar com rascunho pergunta; Voltar mantém, Descartar fecha", () => {
    abrir();
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Playbook de onboarding" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(screen.getByText("Descartar o que foi digitado?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText("Nome")).toHaveProperty(
      "value",
      "Playbook de onboarding"
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByLabelText("Nome")).toBeNull();
    expect(dispararBeforeUnload().defaultPrevented).toBe(false);
  });

  it("Fechar sem rascunho fecha direto", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Descartar o que foi digitado?")).toBeNull();
    expect(screen.queryByLabelText("Nome")).toBeNull();
  });
});

describe("Nova pessoa da capacidade — rascunho não some em silêncio", () => {
  function abrir() {
    render(<Capacidade engajamentos={[]} iniciais={[]} podeEscrever />);
    fireEvent.click(screen.getByRole("button", { name: "Nova pessoa" }));
  }

  it("com nome digitado, beforeunload é cancelado", () => {
    abrir();
    expect(dispararBeforeUnload().defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Bia" },
    });
    expect(dispararBeforeUnload().defaultPrevented).toBe(true);
  });

  it("Fechar com rascunho pergunta; Descartar fecha", () => {
    abrir();
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Bia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.getByText("Descartar o que foi digitado?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByLabelText("Nome")).toBeNull();
  });
});

describe("Novo engajamento — rascunho não some ao fechar a aba", () => {
  it("com código digitado, beforeunload é cancelado; vazio, não", () => {
    render(
      <Engajamentos clientes={[]} iniciais={[]} podeEscrever servicos={[]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Novo engajamento" }));
    expect(dispararBeforeUnload().defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText("Código"), {
      target: { value: "ENG-09" },
    });
    expect(dispararBeforeUnload().defaultPrevented).toBe(true);
  });
});
