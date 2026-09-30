import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Benchmark travado por tenant (specs/012, FR-006/FR-010): a caixa de opt-in só
// existe na criação de assessment quando a habilitação do tenant está ligada.

const h = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  createAssessment: vi.fn(),
  listAssessments: vi.fn(),
  getBenchmarkEnablement: vi.fn(),
}));

vi.mock("@/app/(meridian)/actions/assessments", () => ({
  listTemplates: h.listTemplates,
  createAssessment: h.createAssessment,
  listAssessments: h.listAssessments,
}));
vi.mock("@/app/(meridian)/actions/benchmark", () => ({
  getBenchmarkEnablement: h.getBenchmarkEnablement,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/cosmos/use-action-toast", () => ({
  useActionToast: (fn: () => Promise<unknown>) => fn(),
}));

import { NewAssessmentModal } from "@/components/meridian/screens/assessments";

const ok = <T,>(data: T) => ({ ok: true as const, data });
const BOX = /Contribuir para o pool de benchmark/;

beforeEach(() => {
  vi.clearAllMocks();
  h.listTemplates.mockResolvedValue(
    ok([{ id: "tpl-1", version: "v3.2", locked: true }])
  );
  h.createAssessment.mockResolvedValue(ok({ id: "as-1", code: "AS-001" }));
});
afterEach(cleanup);

const abrir = () =>
  render(<NewAssessmentModal onClose={vi.fn()} onCreated={vi.fn()} />);

describe("NewAssessmentModal — opt-in de benchmark", () => {
  it("habilitação desligada: a caixa não aparece", async () => {
    h.getBenchmarkEnablement.mockResolvedValue(ok({ enabled: false }));
    abrir();
    await waitFor(() => expect(h.getBenchmarkEnablement).toHaveBeenCalled());
    await waitFor(() => expect(h.listTemplates).toHaveBeenCalled());
    expect(screen.queryByText(BOX)).toBeNull();
  });

  it("enquanto a habilitação não chegou, a caixa também não aparece", () => {
    h.getBenchmarkEnablement.mockReturnValue(new Promise(() => {}));
    abrir();
    expect(screen.queryByText(BOX)).toBeNull();
  });

  it("falha ao ler a habilitação: fica travado, sem caixa", async () => {
    h.getBenchmarkEnablement.mockResolvedValue({ ok: false, error: "x" });
    abrir();
    await waitFor(() => expect(h.getBenchmarkEnablement).toHaveBeenCalled());
    expect(screen.queryByText(BOX)).toBeNull();
  });

  it("habilitação ligada: a caixa aparece, desmarcada", async () => {
    h.getBenchmarkEnablement.mockResolvedValue(ok({ enabled: true }));
    abrir();
    const box = (await screen.findByLabelText(BOX)) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });

  it("habilitação desligada: criar manda benchmarkOptIn=false", async () => {
    h.getBenchmarkEnablement.mockResolvedValue(ok({ enabled: false }));
    abrir();
    await waitFor(() => expect(h.listTemplates).toHaveBeenCalled());
    fireEvent.change(await screen.findByLabelText(/Organização/i), {
      target: { value: "Helix" },
    });
    fireEvent.change(screen.getByLabelText(/Setor/i), {
      target: { value: "Agro" },
    });
    fireEvent.change(screen.getByLabelText(/Porte/i), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText(/Prazo/i), {
      target: { value: "2030-01-01" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /Criar assessment/ })
    );
    await waitFor(() => expect(h.createAssessment).toHaveBeenCalled());
    expect(h.createAssessment.mock.calls[0][0].benchmarkOptIn).toBe(false);
  });
});
