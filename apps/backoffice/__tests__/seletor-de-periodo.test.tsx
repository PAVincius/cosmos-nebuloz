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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRESETS_COMPETENCIA } from "../lib/empresa/periodo";

vi.mock("@repo/design-system/components/ui/calendar", () => ({
  // Grava o mês de `defaultMonth` recebido para o teste de fuso (Fix round 1,
  // achado 2) poder inspecionar sem precisar do react-day-picker real.
  Calendar: (props: { defaultMonth?: Date }) => (
    <div data-month={props.defaultMonth?.getMonth()} data-testid="calendar" />
  ),
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

  // "Últimos 3 meses" (o preset usado como gatilho em quase todo teste
  // abaixo) só rotula `valor` assim enquanto hoje está em setembro de 2026 —
  // congelar o relógio é o que separa isto de virar time-bomb em 1º de
  // outubro (final-review.md, Important 2).
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-06T15:00:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("defaultMonth do calendário usa o mês local de `de`, não UTC (Fix round 1)", () => {
    // `de` = "2026-07-01": interpretado como UTC meia-noite ele vira 30/06 em
    // qualquer fuso a oeste de Greenwich, ou seja mês 5 (junho) em vez de 6
    // (julho). O componente deve passar o mês local.
    render(
      <SeletorDePeriodo
        onAplicar={() => {}}
        presets={PRESETS_COMPETENCIA}
        valor={valor}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    expect(screen.getByTestId("calendar").getAttribute("data-month")).toBe("6");
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
    expect(onAplicar).toHaveBeenCalledWith({
      ate: "2026-12-31",
      de: "2026-01-01",
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

  it("um novo objeto de `valor` com o mesmo intervalo não reseta o rascunho enquanto aberto (Fix round 1)", () => {
    const onAplicar = vi.fn();
    const { rerender } = render(
      <SeletorDePeriodo
        onAplicar={onAplicar}
        presets={PRESETS_COMPETENCIA}
        valor={valor}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));

    // Mesmo `de`/`ate` de `valor`, mas um objeto NOVO — só a referência
    // muda. Antes do fix, o useEffect via isso como "valor mudou" e
    // reescrevia o rascunho por cima da escolha do preset.
    rerender(
      <SeletorDePeriodo
        onAplicar={onAplicar}
        presets={PRESETS_COMPETENCIA}
        valor={{ ate: valor.ate, de: valor.de }}
      />
    );

    expect(
      screen
        .getByRole("button", { name: "Este mês" })
        .getAttribute("aria-pressed")
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onAplicar).toHaveBeenCalledWith({
      de: "2026-09-01",
      ate: "2026-09-30",
    });
  });
});
