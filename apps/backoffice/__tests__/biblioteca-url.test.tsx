/** @vitest-environment jsdom */
// biblioteca-url.test.tsx — o ativo aberto na Biblioteca de IP vive em
// `?ativo=`. F5 reabre o mesmo; id fora da lista cai no estado padrão sem
// erro; clicar noutro ativo escreve na URL preservando os demais params, e é
// a URL que abre o ativo.
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

beforeEach(() => {
  zerarRoteador("/ip");
  getIpAssetMock.mockReset().mockImplementation(async (id: string) => ({
    data: detalhe(id, id === "a1" ? "Playbook Um" : "Playbook Dois"),
    ok: true,
  }));
});

describe("Biblioteca — ativo aberto na URL", () => {
  it("?ativo=a2 abre o ativo a2 ao montar, com o conteúdo no editor", async () => {
    zerarRoteador("/ip", "ativo=a2");
    montar();

    expect(await screen.findByDisplayValue("conteudo-a2")).toBeTruthy();
    expect(getIpAssetMock).toHaveBeenCalledWith("a2");
  });

  it("sem param, nada está aberto", () => {
    montar();
    expect(screen.getByText("Nenhum ativo aberto")).toBeTruthy();
    expect(getIpAssetMock).not.toHaveBeenCalled();
  });

  it("id que não está na lista cai no estado padrão, sem buscar nem mostrar erro", async () => {
    zerarRoteador("/ip", "ativo=nao-existe");
    montar();

    expect(screen.getByText("Nenhum ativo aberto")).toBeTruthy();
    await waitFor(() => expect(getIpAssetMock).not.toHaveBeenCalled());
  });

  it("clicar num ativo escreve ?ativo= preservando os outros params, e a URL abre o ativo", async () => {
    zerarRoteador("/ip", "q=playbook");
    montar();

    fireEvent.click(screen.getByRole("button", { name: /Playbook Um/ }));

    expect(replaceStateMock).toHaveBeenCalledWith(
      null,
      "",
      "/ip?q=playbook&ativo=a1"
    );
    expect(await screen.findByDisplayValue("conteudo-a1")).toBeTruthy();
  });
});
