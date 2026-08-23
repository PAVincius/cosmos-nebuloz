// themes.test.tsx — Strategy Map de investimento (/cosmos/themes). Cobre os
// critérios da story-053 que são visíveis na tela: AC-001 (só tema ativo no
// grid + contagem de arquivados), AC-004 (aviso de concentração acima de 60%)
// e AC-006 (vazio e erro sem tema fabricado). Asserção sobre conteúdo — sem
// snapshot: o audit de 2026-07-23 mostrou que casca passa em snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listThemesMock = vi.fn();
const createThemeMock = vi.fn();
const listThemeLinkOptionsMock = vi.fn();
const archiveThemeMock = vi.fn();
const rebalanceThemeTargetsMock = vi.fn();
const createEpicMock = vi.fn();

// O quick-create dos campos de vínculo chama server action de outro módulo.
vi.mock("@/app/(cosmos)/actions/kanban", () => ({
  createEpic: (...args: unknown[]) => createEpicMock(...args),
}));

vi.mock("@/app/actions/lean-budget", () => ({
  createLeanBudget: vi.fn(),
}));

vi.mock("@/app/(cosmos)/actions/themes", () => ({
  listThemes: (...args: unknown[]) => listThemesMock(...args),
  archiveTheme: (...args: unknown[]) => archiveThemeMock(...args),
  createTheme: (...args: unknown[]) => createThemeMock(...args),
  listThemeLinkOptions: (...args: unknown[]) =>
    listThemeLinkOptionsMock(...args),
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
    createThemeMock.mockReset();
    createEpicMock.mockReset();
    listThemeLinkOptionsMock.mockReset();
    listThemeLinkOptionsMock.mockResolvedValue({
      ok: true,
      data: { budgets: [], epics: [], budgetTotalPortfolio: 0 },
    });
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

  it("cria o tema com budget e épicos vinculados numa chamada só", async () => {
    // O ponto do modal: um tema sem budget real e sem épicos reais é uma
    // caixa de texto com nome bonito.
    listThemesMock.mockResolvedValue({ ok: true, data: [] });
    listThemeLinkOptionsMock.mockResolvedValue({
      ok: true,
      data: {
        budgets: [
          {
            id: "clb00000000000000000000a",
            label: "Plataforma",
            sub: "R$ 2M · PI-2026-Q3",
            amount: 2_000_000,
          },
        ],
        epics: [
          {
            id: "cle00000000000000000000a",
            label: "Carteira digital",
            sub: "FUNNEL",
          },
          {
            id: "cle00000000000000000000b",
            label: "Antifraude",
            sub: "ANALYZING",
          },
        ],
        budgetTotalPortfolio: 8_000_000,
      },
    });
    createThemeMock.mockResolvedValue({ ok: true, data: { id: "th-novo" } });

    render(<ThemesScreen />);
    fireEvent.click(await screen.findByText("Novo tema"));

    fireEvent.change(await screen.findByPlaceholderText(/Modernização/), {
      target: { value: "Expansão LATAM" },
    });

    // Vincula o budget aprovado.
    fireEvent.focus(screen.getByPlaceholderText(/budget já aprovado/));
    fireEvent.click(await screen.findByText("Plataforma"));

    // Vincula dois épicos — multi.
    fireEvent.focus(screen.getByPlaceholderText(/épicos existentes/));
    fireEvent.click(await screen.findByText("Carteira digital"));
    fireEvent.focus(screen.getByPlaceholderText(/épicos existentes/));
    fireEvent.click(await screen.findByText("Antifraude"));

    fireEvent.click(screen.getByText("Criar tema"));

    await waitFor(() =>
      expect(createThemeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Expansão LATAM",
          leanBudgetId: "clb00000000000000000000a",
          epicIds: ["cle00000000000000000000a", "cle00000000000000000000b"],
        })
      )
    );
  });

  it("o preview mostra o desvio do alvo assim que o budget é vinculado", async () => {
    listThemesMock.mockResolvedValue({ ok: true, data: [] });
    listThemeLinkOptionsMock.mockResolvedValue({
      ok: true,
      data: {
        // 2M de 8M = 25% alocado, contra alvo padrão de 15% → +10pp.
        budgets: [
          {
            id: "clb00000000000000000000a",
            label: "Plataforma",
            sub: "R$ 2M",
            amount: 2_000_000,
          },
        ],
        epics: [],
        budgetTotalPortfolio: 8_000_000,
      },
    });

    render(<ThemesScreen />);
    fireEvent.click(await screen.findByText("Novo tema"));

    // Antes de vincular, o preview diz o que falta em vez de fingir um número.
    expect(
      screen.getByText(/Vincule um budget para calcular o desvio/)
    ).toBeTruthy();

    fireEvent.focus(screen.getByPlaceholderText(/budget já aprovado/));
    fireEvent.click(await screen.findByText("Plataforma"));

    expect(await screen.findByText(/desvio de \+10pp do alvo/)).toBeTruthy();
    expect(screen.getByText("Alocado ~25%")).toBeTruthy();
  });

  it("cria o épico pelo dropdown e já o leva vinculado no payload do tema", async () => {
    // O vínculo do SAFe não pode exigir abandonar o formulário no meio para
    // cadastrar o épico noutra tela — o que já foi preenchido aqui se perde.
    listThemesMock.mockResolvedValue({ ok: true, data: [] });
    listThemeLinkOptionsMock.mockResolvedValue({
      ok: true,
      data: { budgets: [], epics: [], budgetTotalPortfolio: 0 },
    });
    createEpicMock.mockResolvedValue({
      ok: true,
      data: { id: "cle00000000000000000009z" },
    });
    createThemeMock.mockResolvedValue({ ok: true, data: { id: "th-novo" } });

    render(<ThemesScreen />);
    fireEvent.click(await screen.findByText("Novo tema"));

    fireEvent.change(await screen.findByPlaceholderText(/Modernização/), {
      target: { value: "Expansão LATAM" },
    });

    fireEvent.focus(screen.getByPlaceholderText(/épicos existentes/));
    fireEvent.click(await screen.findByText("+ Criar novo épico"));
    fireEvent.change(screen.getByLabelText("Título do épico"), {
      target: { value: "Antifraude" },
    });
    fireEvent.click(screen.getByText("Criar e vincular"));

    // "funnel" é onde épico novo nasce — a coluna não é escolha do formulário.
    await waitFor(() =>
      expect(createEpicMock).toHaveBeenCalledWith({
        title: "Antifraude",
        column: "funnel",
      })
    );

    // O chip mostra o rótulo digitado, não o id cru devolvido pela action.
    expect(await screen.findByText("Antifraude")).toBeTruthy();

    fireEvent.click(screen.getByText("Criar tema"));

    await waitFor(() =>
      expect(createThemeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Expansão LATAM",
          epicIds: ["cle00000000000000000009z"],
        })
      )
    );
  });

  it("não oferece o épico que já foi escolhido", async () => {
    listThemesMock.mockResolvedValue({ ok: true, data: [] });
    listThemeLinkOptionsMock.mockResolvedValue({
      ok: true,
      data: {
        budgets: [],
        epics: [
          {
            id: "cle00000000000000000000a",
            label: "Carteira digital",
            sub: "FUNNEL",
          },
        ],
        budgetTotalPortfolio: 0,
      },
    });

    render(<ThemesScreen />);
    fireEvent.click(await screen.findByText("Novo tema"));

    fireEvent.focus(screen.getByPlaceholderText(/épicos existentes/));
    fireEvent.click(await screen.findByText("Carteira digital"));

    // Continua visível como chip escolhido, mas some da lista de opções. Com
    // quick-create ligado o vazio não é mais "Nenhum resultado": o dropdown
    // oferece criar, que é o que resta a fazer quando não há o que escolher.
    fireEvent.focus(screen.getByPlaceholderText(/épicos existentes/));
    expect(await screen.findByText("+ Criar novo épico")).toBeTruthy();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
