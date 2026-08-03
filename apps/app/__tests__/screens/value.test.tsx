// value.test.tsx — Value Realization (/cosmos/value). Cobre os critérios da
// story-055 visíveis na tela: AC-003 (realização derivada, "sem dados" quando
// não há medição), AC-004 (vazio e erro) e a metade de tela do AC-001 (status
// terminal sem justificativa não chega ao servidor).
// Asserção sobre conteúdo — sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listValueRealizationsMock = vi.fn();
const recordActualValueMock = vi.fn();

// EntityLinkField (usado pelo modal de criação) importa a server action de
// busca no escopo do módulo — sem este mock a cadeia de import encosta em
// @repo/database sob o guard de ambiente cliente do vitest.
vi.mock("@/app/(cosmos)/actions/entity-search", () => ({
  searchEntities: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

vi.mock("@/app/(cosmos)/actions/value-realization", () => ({
  createValueMetric: vi.fn(),
  listValueRealizations: (...args: unknown[]) =>
    listValueRealizationsMock(...args),
  recordActualValue: (...args: unknown[]) => recordActualValueMock(...args),
}));

import ValueScreen from "../../components/cosmos/screens/value";

const METRICS = [
  {
    id: "vm-1",
    epicId: "epic-1",
    epicTitle: "Onboarding self-serve",
    metricLabel: "Redução de churn",
    unit: "%",
    plannedValue: 15,
    actualValue: 12,
    status: "tracking",
    measuredAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "vm-2",
    epicId: "epic-2",
    epicTitle: "Novo checkout",
    metricLabel: "MRR incremental",
    unit: "USD",
    plannedValue: 5000,
    actualValue: null,
    status: "pending",
    measuredAt: null,
  },
];

describe("ValueScreen", () => {
  beforeEach(() => {
    listValueRealizationsMock.mockReset();
    recordActualValueMock.mockReset();
  });

  it("renders tracked epics with their business-value metric and status", async () => {
    listValueRealizationsMock.mockResolvedValue({ ok: true, data: METRICS });

    render(<ValueScreen />);

    expect(await screen.findByText("Onboarding self-serve")).toBeTruthy();
    expect(screen.getByText("Redução de churn")).toBeTruthy();
    expect(screen.getByText("Novo checkout")).toBeTruthy();
    expect(screen.getByText("Em medição")).toBeTruthy();
    expect(screen.getByText("Aguardando dados")).toBeTruthy();
  });

  it("mostra a realização derivada e 'sem dados' para o indicador sem medição (AC-003)", async () => {
    listValueRealizationsMock.mockResolvedValue({ ok: true, data: METRICS });

    render(<ValueScreen />);

    // 12 de 15 = 80% do alvo, calculado na leitura
    expect(await screen.findByText("80% do alvo")).toBeTruthy();
    // o indicador sem valor realizado não vira 0%
    expect(screen.getByText("sem dados")).toBeTruthy();
    expect(screen.queryByText("0% do alvo")).toBeNull();
  });

  it("mostra o estado vazio quando não há indicador (AC-004)", async () => {
    listValueRealizationsMock.mockResolvedValue({ ok: true, data: [] });

    render(<ValueScreen />);

    expect(await screen.findByText("Nenhum valor rastreado")).toBeTruthy();
    expect(
      screen.getByText(
        "Nenhum épico tem um indicador de negócio rastreado ainda."
      )
    ).toBeTruthy();
  });

  it("mostra o erro e nenhum indicador quando a leitura falha (AC-004)", async () => {
    listValueRealizationsMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<ValueScreen />);

    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar os indicadores de valor.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("Onboarding self-serve")).toBeNull();
  });

  it("não envia o resultado quando o status terminal está sem justificativa (AC-001)", async () => {
    listValueRealizationsMock.mockResolvedValue({ ok: true, data: METRICS });

    render(<ValueScreen />);
    await screen.findByText("Onboarding self-serve");

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Registrar resultado realizado",
      })[0]
    );

    const status = await screen.findByLabelText("Status");
    fireEvent.change(status, { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText(
        "Encerrar a hipótese exige uma justificativa registrada."
      )
    ).toBeTruthy();
    expect(recordActualValueMock).not.toHaveBeenCalled();
  });
});
