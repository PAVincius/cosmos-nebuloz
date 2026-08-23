// solution-train.test.tsx — rollup de Large Solution (/cosmos/solution). A tela
// já estava ligada a listSolutionTrains()/createCapability(); o que faltava era
// prova. Cobre o rollup por Solution Train (capabilities, progresso por ART,
// ROAM consolidado e dependências cross-ART), a criação de capability pela tela
// e os estados vazio/erro sem trem fabricado. Asserção sobre conteúdo — sem
// snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSolutionTrainsMock = vi.fn();
const createCapabilityMock = vi.fn();

vi.mock("@/app/(cosmos)/actions/solution-train", () => ({
  listSolutionTrains: (...args: unknown[]) => listSolutionTrainsMock(...args),
  createCapability: (...args: unknown[]) => createCapabilityMock(...args),
}));

// O modal de capability puxa EntityLinkField, que importa a server action
// entity-search no escopo do módulo — mockada aqui para a cadeia de import
// nunca tocar @repo/auth/server sob o env de cliente.
const searchEntitiesMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/entity-search", () => ({
  searchEntities: (...args: unknown[]) => searchEntitiesMock(...args),
}));

import SolutionTrainScreen from "../../components/cosmos/screens/solution-train";

const train = (over: Record<string, unknown>) => ({
  id: "st-1",
  name: "Solution Train Pagamentos",
  description: "Trem de solução do core de pagamentos",
  artCount: 2,
  epicCount: 3,
  capabilityCount: 1,
  capabilities: [
    {
      id: "cap-1",
      title: "Liquidação em tempo real",
      status: "IMPLEMENTING",
      milestone: "Marco Q3",
    },
  ],
  arts: [
    {
      id: "art-1",
      name: "ART Plataforma",
      epicCount: 4,
      epicDoneCount: 1,
      featureCount: 8,
      doneFeatureCount: 6,
    },
  ],
  roam: {
    counts: { RESOLVED: 1, OWNED: 2, ACCEPTED: 0, MITIGATED: 0 },
    risks: [
      {
        id: "sr-1",
        title: "Homologação do regulador fora do controle do trem",
        roamStatus: "OWNED",
        owner: "Marina Alves",
        affectedArtIds: ["art-1"],
      },
    ],
  },
  crossArtDependencies: [
    {
      id: "dep-1",
      sourceArtId: "art-1",
      sourceArtName: "ART Plataforma",
      targetArtId: "art-2",
      targetArtName: "ART Experiência",
      type: "BLOCKS",
    },
  ],
  ...over,
});

describe("SolutionTrainScreen", () => {
  beforeEach(() => {
    listSolutionTrainsMock.mockReset();
    createCapabilityMock.mockReset();
    searchEntitiesMock.mockReset();
    searchEntitiesMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("mostra o rollup do trem: capability, progresso por ART, ROAM e cross-ART", async () => {
    listSolutionTrainsMock.mockResolvedValue({ ok: true, data: [train({})] });

    render(<SolutionTrainScreen />);

    expect(await screen.findByText("Solution Train Pagamentos")).toBeTruthy();
    // Capability com marco e status traduzido.
    expect(screen.getByText("Liquidação em tempo real")).toBeTruthy();
    expect(screen.getByText("Marco Q3")).toBeTruthy();
    expect(screen.getByText("Implementando")).toBeTruthy();
    // Progresso do ART vem de feature completion real, não de percentual solto.
    // O nome aparece duas vezes: na barra de progresso e como origem da
    // dependência cross-ART.
    expect(screen.getAllByText("ART Plataforma")).toHaveLength(2);
    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("1/4 épicos · 6/8 features")).toBeTruthy();
    // ROAM consolidado do nível de solução.
    expect(screen.getByText("ROAM consolidado")).toBeTruthy();
    expect(
      screen.getByText("Homologação do regulador fora do controle do trem")
    ).toBeTruthy();
    // Dependência cross-ART nomeia os dois trens.
    expect(screen.getByText("Dependências cross-ART")).toBeTruthy();
    expect(screen.getByText("ART Experiência")).toBeTruthy();
    expect(screen.getByText("Bloqueia")).toBeTruthy();
  });

  it("diz que não há risco de solução em vez de inventar um", async () => {
    listSolutionTrainsMock.mockResolvedValue({
      ok: true,
      data: [
        train({
          roam: {
            counts: { RESOLVED: 0, OWNED: 0, ACCEPTED: 0, MITIGATED: 0 },
            risks: [],
          },
          crossArtDependencies: [],
        }),
      ],
    });

    render(<SolutionTrainScreen />);

    expect(
      await screen.findByText("Nenhum risco de solução registrado.")
    ).toBeTruthy();
    expect(
      screen.getByText("Nenhuma dependência cross-ART registrada.")
    ).toBeTruthy();
  });

  it("cria a capability pela tela e recarrega o rollup", async () => {
    listSolutionTrainsMock.mockResolvedValue({ ok: true, data: [train({})] });
    createCapabilityMock.mockResolvedValue({ ok: true, data: { id: "cap-2" } });

    render(<SolutionTrainScreen />);
    await screen.findByText("Solution Train Pagamentos");

    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar capability" })
    );
    fireEvent.change(screen.getByLabelText(/Título da capability/), {
      target: { value: "Antifraude compartilhado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar capability" }));

    await waitFor(() =>
      expect(createCapabilityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Antifraude compartilhado",
          status: "BACKLOG",
        })
      )
    );
    await waitFor(() =>
      expect(listSolutionTrainsMock).toHaveBeenCalledTimes(2)
    );
  });

  it("não chama o servidor quando a capability não tem título", async () => {
    listSolutionTrainsMock.mockResolvedValue({ ok: true, data: [train({})] });

    render(<SolutionTrainScreen />);
    await screen.findByText("Solution Train Pagamentos");

    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar capability" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Criar capability" }));

    expect(createCapabilityMock).not.toHaveBeenCalled();
  });

  it("mostra o estado vazio quando o tenant não tem solution train", async () => {
    listSolutionTrainsMock.mockResolvedValue({ ok: true, data: [] });

    render(<SolutionTrainScreen />);

    expect(
      await screen.findByText("Nenhum solution train cadastrado.")
    ).toBeTruthy();
  });

  it("mostra o estado de erro e nenhum trem quando a leitura falha", async () => {
    listSolutionTrainsMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<SolutionTrainScreen />);

    await waitFor(() =>
      expect(screen.queryByText("Nenhum solution train cadastrado.")).toBeNull()
    );
    expect(document.body.innerHTML).not.toContain("Solution Train Pagamentos");
  });
});
