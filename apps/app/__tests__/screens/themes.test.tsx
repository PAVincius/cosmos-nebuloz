// themes.test.tsx — Strategy Map de investimento (/cosmos/themes). Cobre os
// critérios da story-053 que são visíveis na tela: AC-001 (só tema ativo no
// grid + contagem de arquivados), AC-004 (aviso de concentração acima de 60%)
// e AC-006 (vazio e erro sem tema fabricado). Asserção sobre conteúdo — sem
// snapshot: o audit de 2026-07-23 mostrou que casca passa em snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listThemesMock = vi.fn();
const archiveThemeMock = vi.fn();
const rebalanceThemeTargetsMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/themes", () => ({
  listThemes: (...args: unknown[]) => listThemesMock(...args),
  archiveTheme: (...args: unknown[]) => archiveThemeMock(...args),
  createTheme: vi.fn(),
  rebalanceThemeTargets: (...args: unknown[]) =>
    rebalanceThemeTargetsMock(...args),
}));

import ThemesScreen from "../../components/cosmos/screens/themes";

const theme = (over: Record<string, unknown>) => ({
  id: "th-x",
  title: "Tema X",
  description: null,
  color: "#6366f1",
  healthStatus: "on",
  targetAllocationPct: 50,
  actualAllocationPct: null,
  horizon: null,
  epicCount: 0,
  avgProgress: 0,
  status: "ACTIVE",
  epicSharePct: null,
  overConcentrated: false,
  ...over,
});

describe("ThemesScreen", () => {
  beforeEach(() => {
    // mockReset e não clearAllMocks: só o reset esvazia a fila de
    // mockResolvedValueOnce, e um `once` sobrando vaza para o teste seguinte.
    listThemesMock.mockReset();
    archiveThemeMock.mockReset();
    rebalanceThemeTargetsMock.mockReset();
  });

  it("arquiva o tema pela tela e recarrega a lista (AC-003)", async () => {
    listThemesMock
      .mockResolvedValueOnce({
        ok: true,
        data: [theme({ id: "th1", title: "Expansão LATAM" })],
      })
      .mockResolvedValueOnce({ ok: true, data: [] });
    archiveThemeMock.mockResolvedValue({ ok: true, data: { id: "th1" } });

    render(<ThemesScreen />);
    await screen.findByText("Expansão LATAM");

    fireEvent.click(
      screen.getByRole("button", { name: "Arquivar Expansão LATAM" })
    );

    await waitFor(() =>
      expect(archiveThemeMock).toHaveBeenCalledWith({ id: "th1" })
    );
    await waitFor(() => expect(listThemesMock).toHaveBeenCalledTimes(2));
  });

  it("mostra só tema ativo no grid e informa quantos foram arquivados (AC-001)", async () => {
    listThemesMock.mockResolvedValueOnce({
      ok: true,
      data: [
        theme({ id: "th1", title: "Expansão LATAM", epicCount: 3 }),
        theme({
          id: "th2",
          title: "Iniciativa Descontinuada",
          status: "ARCHIVED",
          targetAllocationPct: null,
        }),
      ],
    });

    render(<ThemesScreen />);

    expect(await screen.findByText("Expansão LATAM")).toBeTruthy();
    expect(screen.queryByText("Iniciativa Descontinuada")).toBeNull();
    expect(screen.getByText("1 arquivado")).toBeTruthy();
    // o contador do cabeçalho conta tema ativo, não linha na tabela
    expect(screen.getByText("1 tema")).toBeTruthy();
  });

  it("sinaliza o tema acima da diretriz de 60% dos épicos e não sinaliza os demais (AC-004)", async () => {
    listThemesMock.mockResolvedValueOnce({
      ok: true,
      data: [
        theme({
          id: "th1",
          title: "Segurança",
          epicCount: 8,
          epicSharePct: 66.7,
          overConcentrated: true,
        }),
        theme({
          id: "th2",
          title: "Plataforma",
          epicCount: 2,
          epicSharePct: 16.7,
        }),
        theme({
          id: "th3",
          title: "Crescimento",
          epicCount: 2,
          epicSharePct: 16.7,
        }),
      ],
    });

    render(<ThemesScreen />);

    expect(
      await screen.findByText("66.7% dos épicos — acima da diretriz de 60%")
    ).toBeTruthy();
    expect(
      screen.queryByText("16.7% dos épicos — acima da diretriz de 60%")
    ).toBeNull();
  });

  it("mostra o estado vazio quando o tenant não tem tema (AC-006)", async () => {
    listThemesMock.mockResolvedValueOnce({ ok: true, data: [] });

    render(<ThemesScreen />);

    expect(await screen.findByText("Nenhum tema")).toBeTruthy();
    expect(screen.getByText("Crie um tema estratégico")).toBeTruthy();
  });

  it("mostra o estado de erro e nenhum tema quando listThemes falha (AC-006)", async () => {
    listThemesMock.mockResolvedValueOnce({ ok: false, error: "boom" });

    render(<ThemesScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar os temas estratégicos.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("Nenhum tema")).toBeNull();
    expect(document.body.innerHTML).not.toContain("Expansão LATAM");
  });

  it("esconde 'Rebalancear alocação' até os temas carregarem, e completa o rebalanceamento depois (corrida)", async () => {
    // modal.open(<RebalanceTargetsModal themes={active} />) congela `active`
    // no clique. Aberto antes de listThemes responder, o modal nasceria sem
    // linha nenhuma, sumValid ficaria false para sempre e o guard do `save`
    // devolveria mudo.
    const withOneTheme = {
      ok: true,
      data: [
        theme({
          id: "th1",
          title: "Expansão LATAM",
          targetAllocationPct: 100,
        }),
      ],
    };
    // Fallback para o reload que RebalanceTargetsModal dispara via `onSaved`
    // depois de salvar (o `mockImplementationOnce` abaixo só cobre a
    // primeira chamada, a que a corrida testa).
    listThemesMock.mockResolvedValue(withOneTheme);
    listThemesMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(withOneTheme), 50))
    );
    rebalanceThemeTargetsMock.mockResolvedValue({
      ok: true,
      data: { updated: 1 },
    });

    render(<ThemesScreen />);

    expect(
      screen.queryByRole("button", { name: "Rebalancear alocação" })
    ).toBeNull();

    fireEvent.click(
      await screen.findByRole("button", { name: "Rebalancear alocação" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar rebalanceamento" })
    );

    await waitFor(() =>
      expect(rebalanceThemeTargetsMock).toHaveBeenCalledWith({
        targets: [{ themeId: "th1", targetAllocationPct: 100 }],
      })
    );
  });
});
