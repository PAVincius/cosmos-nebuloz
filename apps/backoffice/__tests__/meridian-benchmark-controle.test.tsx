/** @vitest-environment jsdom */
// Controle "Benchmark do Meridian" na ficha do cliente (specs/012, US1):
// estado atual, referência do aditivo, ligar/desligar com confirmação e o erro
// do servidor dito com clareza.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MeridianBenchmarkControle } from "@/app/(staff)/clientes/[slug]/meridian-benchmark-controle";
import { MOTIVO_SOMENTE_LEITURA } from "@/components/write-button";

const mocks = vi.hoisted(() => ({ setMeridianBenchmarkAction: vi.fn() }));

vi.mock("@/app/actions/meridian-benchmark", () => ({
  setMeridianBenchmarkAction: mocks.setMeridianBenchmarkAction,
}));

const DESLIGADO = {
  enabled: false,
  agreementRef: null,
  updatedAt: null,
  isInternalTenant: false,
};
const LIGADO = {
  enabled: true,
  agreementRef: "ADT-2026-014",
  updatedAt: "2026-09-29T12:00:00.000Z",
  isInternalTenant: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setMeridianBenchmarkAction.mockResolvedValue({ ok: true, data: null });
});

const campo = () => screen.getByLabelText(/Referência do aditivo/);

describe("MeridianBenchmarkControle", () => {
  it("desligado: diz o estado e não mostra referência", () => {
    render(
      <MeridianBenchmarkControle canWrite estado={DESLIGADO} slug="acme" />
    );

    expect(screen.getByText("Desligado")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ligar" })).toBeTruthy();
  });

  it("ligado: diz o estado, a referência gravada e oferece desligar", () => {
    render(<MeridianBenchmarkControle canWrite estado={LIGADO} slug="acme" />);

    expect(screen.getByText("Ligado")).toBeTruthy();
    expect(screen.getByText(/ADT-2026-014/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Desligar" })).toBeTruthy();
    expect(screen.queryByLabelText(/Referência do aditivo/)).toBeNull();
  });

  it("externo sem referência: Ligar fica desabilitado e explica por quê", () => {
    render(
      <MeridianBenchmarkControle canWrite estado={DESLIGADO} slug="acme" />
    );

    expect(
      (screen.getByRole("button", { name: "Ligar" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(screen.getByText(/Obrigatória para ligar um cliente/)).toBeTruthy();
  });

  it("liga só depois de confirmar, mandando a referência aparada", async () => {
    render(
      <MeridianBenchmarkControle canWrite estado={DESLIGADO} slug="acme" />
    );

    fireEvent.change(campo(), { target: { value: "  ADT-2026-014 " } });
    fireEvent.click(screen.getByRole("button", { name: "Ligar" }));
    expect(mocks.setMeridianBenchmarkAction).not.toHaveBeenCalled();
    expect(screen.getByText(/passam a poder contribuir/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(mocks.setMeridianBenchmarkAction).toHaveBeenCalledWith({
        slug: "acme",
        enabled: true,
        agreementRef: "ADT-2026-014",
      })
    );
    expect((await screen.findByRole("status")).textContent).toMatch(/ligado/i);
  });

  it("interno liga sem referência", async () => {
    render(
      <MeridianBenchmarkControle
        canWrite
        estado={{ ...DESLIGADO, isInternalTenant: true }}
        slug="nebuloz"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Ligar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(mocks.setMeridianBenchmarkAction).toHaveBeenCalledWith({
        slug: "nebuloz",
        enabled: true,
        agreementRef: null,
      })
    );
  });

  it("desligar pede confirmação e avisa que o já contribuído fica", async () => {
    render(<MeridianBenchmarkControle canWrite estado={LIGADO} slug="acme" />);

    fireEvent.click(screen.getByRole("button", { name: "Desligar" }));
    expect(screen.getByText(/não é apagado/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(mocks.setMeridianBenchmarkAction).toHaveBeenCalledWith({
        slug: "acme",
        enabled: false,
        agreementRef: null,
      })
    );
  });

  it("erro do servidor aparece como alerta, sem mensagem de sucesso", async () => {
    mocks.setMeridianBenchmarkAction.mockResolvedValue({
      ok: false,
      error: "Informe a referência do aditivo contratual (DPA §2.1).",
    });
    render(
      <MeridianBenchmarkControle canWrite estado={DESLIGADO} slug="acme" />
    );

    fireEvent.change(campo(), { target: { value: "ADT-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Ligar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /referência do aditivo/
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("somente leitura: trigger desabilitado e motivo escrito", () => {
    render(
      <MeridianBenchmarkControle
        canWrite={false}
        estado={DESLIGADO}
        slug="acme"
      />
    );

    expect(
      (screen.getByRole("button", { name: "Ligar" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect((campo() as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(MOTIVO_SOMENTE_LEITURA)).toBeTruthy();
  });
});
