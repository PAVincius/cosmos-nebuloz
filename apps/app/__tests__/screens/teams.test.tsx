// teams.test.tsx — diretório de squads do ART (/cosmos/teams). Cobre os
// critérios da story-056 visíveis na tela: AC-001 (time sem ART sinalizado, não
// silenciado), AC-002 (vincular pela tela e recarregar) e AC-004 (vazio e erro
// sem time fabricado). Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listTeamsMock = vi.fn();
const assignTeamToArtMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/teams", () => ({
  listTeams: (...args: unknown[]) => listTeamsMock(...args),
  assignTeamToArt: (...args: unknown[]) => assignTeamToArtMock(...args),
  createTeam: vi.fn(),
}));

// NewTeamModal e o modal de vínculo puxam EntityLinkField, que importa a server
// action entity-search no escopo do módulo — mockada aqui para a cadeia de
// import nunca tocar @repo/auth/server sob o env de cliente.
const searchEntitiesMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/entity-search", () => ({
  searchEntities: (...args: unknown[]) => searchEntitiesMock(...args),
}));

import TeamsScreen from "../../components/cosmos/screens/teams";

const team = (over: Record<string, unknown>) => ({
  id: "tm-x",
  name: "Squad X",
  focusArea: null,
  color: "#6366f1",
  wip: 0,
  velocity: null,
  memberCount: 0,
  artId: "art-1",
  artName: "ART Pagamentos",
  capacity: null,
  predictabilityPct: null,
  ...over,
});

describe("TeamsScreen", () => {
  beforeEach(() => {
    // mockReset e não clearAllMocks: só o reset esvazia a fila de
    // mockResolvedValueOnce, e um `once` sobrando vaza para o teste seguinte.
    listTeamsMock.mockReset();
    assignTeamToArtMock.mockReset();
    searchEntitiesMock.mockReset();
    searchEntitiesMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("sinaliza os times sem ART e não sinaliza os que têm (AC-001)", async () => {
    listTeamsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        team({ id: "tm1", name: "Squad Pagamentos" }),
        team({ id: "tm2", name: "Squad Órfão", artId: null, artName: null }),
      ],
    });

    render(<TeamsScreen />);

    expect(await screen.findByText("Times sem ART")).toBeTruthy();
    expect(
      screen.getByText(
        "Um time sem ART não entra em PI Planning: não recebe sprint nem aparece no Program Board."
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Vincular Squad Órfão a um ART" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", {
        name: "Vincular Squad Pagamentos a um ART",
      })
    ).toBeNull();
  });

  it("não mostra a seção quando todo time já tem ART (AC-001)", async () => {
    listTeamsMock.mockResolvedValueOnce({
      ok: true,
      data: [team({ id: "tm1", name: "Squad Pagamentos" })],
    });

    render(<TeamsScreen />);

    await screen.findByText("Squad Pagamentos");
    expect(screen.queryByText("Times sem ART")).toBeNull();
  });

  it("vincula o time ao ART pela tela e recarrega a lista (AC-002)", async () => {
    listTeamsMock
      .mockResolvedValueOnce({
        ok: true,
        data: [
          team({ id: "tm2", name: "Squad Órfão", artId: null, artName: null }),
          team({ id: "tm1", name: "Squad Pagamentos" }),
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        data: [
          team({ id: "tm2", name: "Squad Órfão" }),
          team({ id: "tm1", name: "Squad Pagamentos" }),
        ],
      });
    assignTeamToArtMock.mockResolvedValue({ ok: true, data: { id: "tm2" } });
    searchEntitiesMock.mockResolvedValue({
      ok: true,
      data: [{ id: "art-1", label: "ART Pagamentos" }],
    });

    render(<TeamsScreen />);
    await screen.findByText("Times sem ART");

    fireEvent.click(
      screen.getByRole("button", { name: "Vincular Squad Órfão a um ART" })
    );
    // O ART é escolhido pelo mesmo EntityLinkField que o resto do app usa —
    // nenhum id é digitado à mão.
    fireEvent.focus(screen.getByPlaceholderText("Buscar..."));
    fireEvent.click(
      await screen.findByRole("button", { name: "ART Pagamentos" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Vincular ao ART" }));

    await waitFor(() =>
      expect(assignTeamToArtMock).toHaveBeenCalledWith({
        teamId: "tm2",
        artId: "art-1",
      })
    );
    await waitFor(() => expect(listTeamsMock).toHaveBeenCalledTimes(2));
  });

  it("mostra o estado vazio quando o tenant não tem time (AC-004)", async () => {
    listTeamsMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<TeamsScreen />);

    expect(await screen.findByText("Nenhum time encontrado.")).toBeTruthy();
    expect(screen.queryByText("Times sem ART")).toBeNull();
  });

  it("mostra o estado de erro e nenhum time quando listTeams falha (AC-004)", async () => {
    listTeamsMock.mockResolvedValueOnce({ ok: false, error: "boom" });

    render(<TeamsScreen />);

    await waitFor(() => expect(screen.queryByText("Carregando...")).toBeNull());
    expect(screen.queryByText("Nenhum time encontrado.")).toBeNull();
    expect(screen.queryByText("Times sem ART")).toBeNull();
    expect(document.body.innerHTML).not.toContain("Squad Pagamentos");
  });
});
