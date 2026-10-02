import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TrackDetail } from "@/app/(scaffold)/actions/tracks";
import type { DeliverableItem } from "@/components/scaffold/deliverable-list";
import { TrackCanvas } from "@/components/scaffold/track-canvas";

// O canvas é leitura: aqui se prova o que ele mostra e como se opera (seleção,
// Esc, foco preso), e que o gate decidido mostra o snapshot congelado.

beforeAll(() => {
  class RO {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("ResizeObserver", RO);
  // jsdom não faz layout: sem isto o viewport mede 0x0 e nada enquadra.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 1000,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 700,
  });
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("reduce"),
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(cleanup);

const phase = (
  p: "ASSESS" | "PILOT" | "SCALE" | "EMBED",
  state: string,
  extra: Record<string, unknown> = {}
) => ({
  id: `pi-${p}`,
  phase: p,
  state,
  openedAt: null,
  closedAt: null,
  steps: [] as unknown[],
  criteria: [
    { key: "k1", statement: "Baseline medido", evaluationType: "MANUAL" },
  ],
  result: null,
  ...extra,
});

const track = {
  id: "t1",
  code: "TR-104",
  processName: "Triagem de suporte",
  templateLabel: "v3",
  currentPhase: "ASSESS",
  businessCase: null,
  phases: [
    phase("ASSESS", "CLOSED", {
      steps: [
        {
          id: "s1",
          seq: 1,
          code: "A1",
          statement: "Medir o processo",
          state: "DONE",
        },
      ],
      result: {
        outcome: "PASSED",
        decidedAt: new Date(),
        cycle: 0,
        override: null,
        criteriaSnapshot: [
          {
            key: "k1",
            statement: "Baseline no momento da decisão",
            met: true,
            note: null,
          },
        ],
      },
    }),
    phase("PILOT", "OPEN", {
      steps: [
        {
          id: "s2",
          seq: 1,
          code: "B1",
          statement: "Rodar o piloto",
          state: "TODO",
        },
      ],
    }),
    phase("SCALE", "IDLE"),
    phase("EMBED", "IDLE"),
  ],
} as unknown as TrackDetail;

const dv = (over: Partial<DeliverableItem>): DeliverableItem =>
  ({
    id: "d1",
    phaseInstanceId: "pi-ASSESS",
    stepCode: "A1",
    code: "A1.1",
    title: "Baseline do processo",
    description: "Linha de base medida.",
    kind: "DOCUMENT",
    producer: "OWNER",
    status: "APPROVED",
    version: 2,
    dueAt: null,
    summary: null,
    dispensedReason: null,
    lastReview: null,
    hasFile: false,
    fileName: null,
    required: true,
    ...over,
  }) as DeliverableItem;

const items = [
  dv({}),
  dv({
    id: "d2",
    phaseInstanceId: "pi-PILOT",
    stepCode: "B1",
    code: "B1.1",
    title: "Plano de rollback",
    status: "ADJUSTMENT_REQUESTED",
    version: 1,
    lastReview: {
      action: "REQUEST_ADJUSTMENT",
      comment: "Faltou o dono do rollback",
      byName: "Marina",
      at: new Date(),
    },
  }),
  dv({
    id: "d3",
    phaseInstanceId: "pi-PILOT",
    stepCode: "B1",
    code: "B1.2",
    title: "Termo de piloto",
    status: "NOT_STARTED",
    version: 0,
    dispensedReason: "Cliente já tem contrato",
  }),
];

const open = (over: Partial<Parameters<typeof TrackCanvas>[0]> = {}) => {
  const onClose = vi.fn();
  const onOpenPhase = vi.fn();
  render(
    <TrackCanvas
      deliverables={items}
      onClose={onClose}
      onOpenPhase={onOpenPhase}
      track={track}
      {...over}
    />
  );
  return { onClose, onOpenPhase };
};

describe("TrackCanvas", () => {
  it("é um diálogo modal nomeado pela trilha, com a legenda só dos estados que existem", () => {
    open();
    const dlg = screen.getByRole("dialog", { name: "Canvas da trilha TR-104" });
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    const legend = within(dlg).getByRole("list", {
      name: "Entregáveis por estado",
    });
    expect(within(legend).getByText("Aprovado")).toBeTruthy();
    expect(within(legend).getByText("Ajuste pedido")).toBeTruthy();
    expect(within(legend).getByText("Dispensado")).toBeTruthy();
    // Estado sem entregável não vira "0".
    expect(within(legend).queryByText("Em revisão")).toBeNull();
  });

  it("todo nó diz o estado em palavra, e o dispensado não passa por 'não iniciado'", () => {
    open();
    expect(
      screen.getByRole("button", {
        name: /A1\.1 Baseline do processo, Aprovado/,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /B1\.1 .*Ajuste pedido/ })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /B1\.2 .*Dispensado/ })
    ).toBeTruthy();
  });

  it("selecionar um entregável abre o detalhe com o motivo do ajuste na tela", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /B1\.1 / }));
    const panel = screen.getByRole("complementary");
    expect(within(panel).getByText(/B1\.1 · Plano de rollback/)).toBeTruthy();
    expect(within(panel).getByText(/Faltou o dono do rollback/)).toBeTruthy();
    expect(within(panel).getByText(/Marina/)).toBeTruthy();
  });

  it("o dispensado mostra o motivo", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /B1\.2 / }));
    expect(screen.getByText(/Cliente já tem contrato/)).toBeTruthy();
  });

  it("o gate decidido mostra o snapshot congelado, não os critérios de hoje", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /Gate Assess/ }));
    const panel = screen.getByRole("complementary");
    expect(
      within(panel).getByText("Baseline no momento da decisão")
    ).toBeTruthy();
    expect(within(panel).queryByText("Baseline medido")).toBeNull();
    expect(within(panel).getByText("Atendido")).toBeTruthy();
  });

  it("o gate futuro tem palavra e o painel não inventa veredito", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /Gate Scale/ }));
    const panel = screen.getByRole("complementary");
    expect(within(panel).getByText("Futuro")).toBeTruthy();
    expect(within(panel).getByText("Em aberto")).toBeTruthy();
  });

  it("fase sem entregável diz 'sem entregáveis', não 0/0", () => {
    open();
    expect(screen.getAllByText("sem entregáveis").length).toBeGreaterThan(0);
    expect(screen.queryByText("0/0")).toBeNull();
  });

  it("'Abrir na trilha' devolve a fase do que está selecionado", () => {
    const { onOpenPhase } = open();
    fireEvent.click(screen.getByRole("button", { name: /B1\.1 / }));
    fireEvent.click(
      screen.getByRole("button", { name: /Abrir Pilot na trilha/ })
    );
    expect(onOpenPhase).toHaveBeenCalledWith("PILOT");
  });

  it("Esc fecha", () => {
    const { onClose } = open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Tab não sai do diálogo: do último elemento volta ao primeiro", () => {
    open();
    const dlg = screen.getByRole("dialog");
    const focusables = dlg.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    const last = [...focusables].at(-1) as HTMLElement;
    last.focus();
    fireEvent.keyDown(dlg, { key: "Tab" });
    expect(document.activeElement).toBe(focusables[0]);
  });

  it("o foco entra no diálogo ao abrir", () => {
    open();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
      true
    );
  });

  it("teclado na área do desenho: mais e menos mudam o zoom, zero enquadra", () => {
    open();
    const area = screen.getByRole("group", { name: /Área do desenho/ });
    const pct = () => screen.getByText(/%$/).textContent;
    fireEvent.keyDown(area, { key: "0" });
    const fitted = pct();
    fireEvent.keyDown(area, { key: "+" });
    expect(pct()).not.toBe(fitted);
    fireEvent.keyDown(area, { key: "0" });
    expect(pct()).toBe(fitted);
  });
});
