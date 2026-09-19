/** @vitest-environment jsdom */
// biblioteca-rascunho.test.tsx — trocar de ativo com o editor sujo não
// descarta em silêncio. O outro ativo não abre; aparece a pergunta inline com
// o nome do atual; "Voltar" mantém, "Descartar" troca. E enquanto está sujo,
// fechar a aba passa pelo `beforeunload`.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Biblioteca } from "@/app/(staff)/ip/biblioteca";
import type { IpAssetDetail, IpAssetRow } from "@/app/actions/ip-library";
import {
  replaceStateMock,
  zerarRoteador,
} from "../vitest-mocks/next-navigation";

const { getIpAssetMock } = vi.hoisted(() => ({ getIpAssetMock: vi.fn() }));

vi.mock("next/navigation", () => import("../vitest-mocks/next-navigation"));

vi.mock("@/app/actions/ip-library", () => ({
  createIpAssetAction: vi.fn(),
  getIpAsset: getIpAssetMock,
  registrarReusoAction: vi.fn(),
  updateIpAssetAction: vi.fn(),
}));

function linha(id: string, nome: string): IpAssetRow {
  return {
    atualizadoEm: "2026-09-01T00:00:00.000Z",
    descricao: null,
    dono: null,
    horasPoupadas: 0,
    id,
    licenca: "INTERNA",
    link: null,
    maturidade: "RASCUNHO",
    nome,
    origem: null,
    procedencia: "PROPRIA",
    reusos: 0,
    servicos: [],
    slug: id,
    tipo: "PLAYBOOK",
    versoes: 1,
  };
}

function detalhe(id: string, nome: string): IpAssetDetail {
  return { ...linha(id, nome), conteudo: `conteudo-${id}`, historico: [] };
}

const LISTA = [linha("a1", "Playbook Um"), linha("a2", "Playbook Dois")];

const PERGUNTA = "Descartar alterações em «Playbook Um»?";

function montar() {
  return render(
    <Biblioteca
      engajamentos={[]}
      iniciais={LISTA}
      pessoas={[]}
      podeEscrever={true}
      servicos={[]}
    />
  );
}

async function montarComA1Sujo() {
  zerarRoteador("/ip", "ativo=a1");
  montar();
  const editor = await screen.findByDisplayValue("conteudo-a1");
  fireEvent.change(editor, { target: { value: "conteudo-a1 editado" } });
  replaceStateMock.mockClear();
  getIpAssetMock.mockClear();
}

function tentarAbrirA2() {
  fireEvent.click(screen.getByRole("button", { name: "Trocar" }));
  fireEvent.click(screen.getByRole("button", { name: /Playbook Dois/ }));
}

function dispararBeforeUnload(): Event {
  const evento = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(evento);
  return evento;
}

beforeEach(() => {
  getIpAssetMock.mockReset().mockImplementation(async (id: string) => ({
    data: detalhe(id, id === "a1" ? "Playbook Um" : "Playbook Dois"),
    ok: true,
  }));
});

describe("Biblioteca — rascunho sujo", () => {
  it("com o editor sujo, clicar noutro ativo não abre e pergunta com o nome do atual", async () => {
    await montarComA1Sujo();

    tentarAbrirA2();

    expect(screen.getByText(PERGUNTA)).toBeTruthy();
    expect(screen.getByDisplayValue("conteudo-a1 editado")).toBeTruthy();
    expect(screen.queryByDisplayValue("conteudo-a2")).toBeNull();
    expect(replaceStateMock).not.toHaveBeenCalled();
    expect(getIpAssetMock).not.toHaveBeenCalledWith("a2");

    const botoes = screen.getAllByRole("button", {
      name: /^(Voltar|Descartar)$/,
    });
    expect(botoes.map((b) => b.textContent)).toEqual(["Voltar", "Descartar"]);
  });

  it("Descartar abre o outro ativo", async () => {
    await montarComA1Sujo();
    tentarAbrirA2();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));

    expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/ip?ativo=a2");
    expect(await screen.findByDisplayValue("conteudo-a2")).toBeTruthy();
    expect(screen.queryByText(PERGUNTA)).toBeNull();
  });

  it("Voltar mantém o ativo atual, com a edição, e some com a pergunta", async () => {
    await montarComA1Sujo();
    tentarAbrirA2();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(screen.queryByText(PERGUNTA)).toBeNull();
    expect(screen.getByDisplayValue("conteudo-a1 editado")).toBeTruthy();
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  it("sem sujeira, trocar de ativo não pergunta nada", async () => {
    zerarRoteador("/ip", "ativo=a1");
    montar();
    await screen.findByDisplayValue("conteudo-a1");

    tentarAbrirA2();

    expect(screen.queryByText(PERGUNTA)).toBeNull();
    expect(await screen.findByDisplayValue("conteudo-a2")).toBeTruthy();
  });

  it("enquanto está sujo, beforeunload é cancelado; limpo, não", async () => {
    zerarRoteador("/ip", "ativo=a1");
    montar();
    const editor = await screen.findByDisplayValue("conteudo-a1");

    expect(dispararBeforeUnload().defaultPrevented).toBe(false);

    fireEvent.change(editor, { target: { value: "mudou" } });
    await waitFor(() =>
      expect(dispararBeforeUnload().defaultPrevented).toBe(true)
    );
  });
});
