/** @vitest-environment jsdom */
// seletor-de-periodo.test.tsx — presets, entrada digitada e o contrato de
// aplicar/cancelar do seletor de intervalo (spec 2026-09-06 §2).
import { fireEvent, render, screen } from "@testing-library/react";
import {
  cloneElement,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import { describe, expect, it, vi } from "vitest";
import { PRESETS_COMPETENCIA } from "../lib/empresa/periodo";

vi.mock("@repo/design-system/components/ui/calendar", () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

// O Popover real do Radix não renderiza PopoverContent sob jsdom sem portal
// + act. Este dublê é só um repasse controlado por contexto: `Popover`
// recebe `open`/`onOpenChange` de SeletorDePeriodo e os disponibiliza para
// `PopoverTrigger` (alterna) e `PopoverContent` (só renderiza quando aberto)
// — sem estado próprio, então fechar via Aplicar/Cancelar tem efeito real.
const PopoverCtx = createContext<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
}>({ onOpenChange: () => {}, open: false });

vi.mock("@repo/design-system/components/ui/popover", () => {
  function Popover({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    children: ReactNode;
  }) {
    return (
      <PopoverCtx.Provider value={{ onOpenChange, open }}>
        {children}
      </PopoverCtx.Provider>
    );
  }

  function PopoverTrigger({
    children,
  }: {
    children: ReactElement;
    asChild?: boolean;
  }) {
    const ctx = useContext(PopoverCtx);
    // asChild real do Radix injeta o onClick no filho em vez de envolver
    // num elemento próprio; cloneElement reproduz isso aqui.
    return cloneElement(children, {
      onClick: () => ctx.onOpenChange(!ctx.open),
    } as Record<string, unknown>);
  }

  function PopoverContent({ children }: { children: ReactNode }) {
    const ctx = useContext(PopoverCtx);
    return ctx.open ? children : null;
  }

  return { Popover, PopoverContent, PopoverTrigger };
});

const { SeletorDePeriodo } = await import("../components/seletor-de-periodo");

describe("SeletorDePeriodo", () => {
  const valor = { ate: "2026-09-30", de: "2026-07-01" };

  it("mostra o rótulo do preset no gatilho e abre com os presets", () => {
    render(
      <SeletorDePeriodo
        onAplicar={() => {}}
        presets={PRESETS_COMPETENCIA}
        valor={valor}
      />
    );
    const gatilho = screen.getByRole("button", { name: /Últimos 3 meses/ });
    fireEvent.click(gatilho);
    expect(screen.getByRole("button", { name: "Este mês" })).toBeTruthy();
    expect(screen.getByTestId("calendar")).toBeTruthy();
  });

  it("preset + Aplicar chama onAplicar com o intervalo do preset", () => {
    const onAplicar = vi.fn();
    render(
      <SeletorDePeriodo
        onAplicar={onAplicar}
        presets={PRESETS_COMPETENCIA}
        valor={valor}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    fireEvent.click(screen.getByRole("button", { name: "Este ano" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    const ano = new Date().getUTCFullYear();
    expect(onAplicar).toHaveBeenCalledWith({
      ate: `${ano}-12-31`,
      de: `${ano}-01-01`,
    });
  });

  it("Aplicar sem mudança não chama onAplicar; Cancelar descarta", () => {
    const onAplicar = vi.fn();
    render(
      <SeletorDePeriodo
        onAplicar={onAplicar}
        presets={PRESETS_COMPETENCIA}
        valor={valor}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onAplicar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onAplicar).not.toHaveBeenCalled();
  });

  it("data digitada inválida não muda o intervalo", () => {
    const onAplicar = vi.fn();
    render(
      <SeletorDePeriodo
        onAplicar={onAplicar}
        presets={PRESETS_COMPETENCIA}
        valor={valor}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    const dia = screen.getByLabelText("Início — dia");
    fireEvent.change(dia, { target: { value: "31" } }); // 31/07 é válido
    fireEvent.change(screen.getByLabelText("Início — mês"), {
      target: { value: "02" },
    }); // 31/02 inválido → não aplica
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onAplicar).toHaveBeenCalledWith({
      ate: "2026-09-30",
      de: "2026-07-31",
    });
  });
});
