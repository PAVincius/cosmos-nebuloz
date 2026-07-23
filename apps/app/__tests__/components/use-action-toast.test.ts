import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: h.loading,
    success: h.success,
    error: h.error,
  },
}));

import { useActionToast } from "../../components/cosmos/use-action-toast";

beforeEach(() => {
  vi.clearAllMocks();
  h.loading.mockReturnValue("toast-id-1");
});

describe("useActionToast", () => {
  it("shows a loading toast, then a success toast (same id) on Result.ok, and returns the result", async () => {
    const data = { id: "ep-1" };
    const action = vi.fn().mockResolvedValue({ ok: true, data });

    const res = await useActionToast(action, {
      loading: "Movendo épico...",
      success: "Épico movido.",
    });

    expect(h.loading).toHaveBeenCalledWith("Movendo épico...");
    expect(h.success).toHaveBeenCalledWith("Épico movido.", {
      id: "toast-id-1",
    });
    expect(h.error).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, data });
  });

  it("supports a success message derived from the resolved data", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: true, data: { title: "Antifraude" } });

    await useActionToast(action, {
      loading: "Criando épico...",
      success: (d: { title: string }) => `Épico "${d.title}" criado.`,
    });

    expect(h.success).toHaveBeenCalledWith('Épico "Antifraude" criado.', {
      id: "toast-id-1",
    });
  });

  it("shows an error toast (same id) with the action's error message on Result err, and returns the result", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Falha ao mover épico." });

    const res = await useActionToast(action, {
      loading: "Movendo épico...",
      success: "Épico movido.",
    });

    expect(h.error).toHaveBeenCalledWith("Falha ao mover épico.", {
      id: "toast-id-1",
    });
    expect(h.success).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: false, error: "Falha ao mover épico." });
  });

  it("supports a custom error message override", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "raw" });

    await useActionToast(action, {
      loading: "...",
      success: "...",
      error: (err: string) => `Erro: ${err}`,
    });

    expect(h.error).toHaveBeenCalledWith("Erro: raw", { id: "toast-id-1" });
  });
});
