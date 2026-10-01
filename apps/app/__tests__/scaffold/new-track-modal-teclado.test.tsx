import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "Nova trilha" só pelo teclado (D-28, FR-011 a FR-013).
//
// O ModalShell punha as ações (Cancelar, Criar trilha) no cabeçalho, antes do
// corpo na ordem do DOM, e fora do ModalProvider — que é o caso das telas do
// Scaffold — não prendia o Tab nem fechava com Esc. Quem navega por teclado
// chegava a "Criar trilha" antes de qualquer campo e escapava para a página.

const h = vi.hoisted(() => ({
  listTracks: vi.fn(),
  listTemplates: vi.fn(),
  listAssessments: vi.fn(),
  createTrackFromGap: vi.fn(),
  createTrack: vi.fn(),
  push: vi.fn(),
  getAccess: vi.fn(),
  listScaffoldGaps: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@/app/(scaffold)/actions/tracks", () => ({
  listTracks: h.listTracks,
  createTrackFromGap: h.createTrackFromGap,
  createTrack: h.createTrack,
}));
vi.mock("@/app/(scaffold)/actions/access", () => ({
  getScaffoldAccess: h.getAccess,
}));
vi.mock("@/app/(scaffold)/actions/gaps", () => ({
  listScaffoldGaps: h.listScaffoldGaps,
}));
vi.mock("@/app/(scaffold)/actions/templates", () => ({
  listTemplates: h.listTemplates,
}));
vi.mock("@/app/(scaffold)/actions/assessments", () => ({
  listScaffoldAssessments: h.listAssessments,
}));

import PortfolioScreen from "@/components/scaffold/screens/portfolio";

const SUMMARY = {
  tracks: [],
  pendingPromotions: [],
  members: [
    { id: "clx0000000000000000owner1", name: "Marina", role: "PROCESS_OWNER" },
  ],
  embeddedCount: 0,
  stalledCount: 0,
  gateReadyCount: 0,
  signedBaselineCount: 0,
  orgCount: 0,
  stallThresholdDays: 14,
  overrideRates: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.getAccess.mockResolvedValue({
    ok: true,
    data: {
      role: "CONSULTANT",
      can: { "track.manage": { allowed: true, reason: null } },
    },
  });
  h.listScaffoldGaps.mockResolvedValue({ ok: true, data: [] });
  h.listTracks.mockResolvedValue({ ok: true, data: SUMMARY });
  h.listAssessments.mockResolvedValue({ ok: true, data: [] });
  h.listTemplates.mockResolvedValue({
    ok: true,
    data: [
      {
        id: "clx0000000000000000templ1",
        key: "triage",
        name: "Triagem de suporte",
        archetype: "TRIAGE",
        currentLabel: "v4",
        publishedAt: new Date(),
        versions: [],
        overlays: [],
      },
    ],
  });
});

async function abrir() {
  render(<PortfolioScreen />);
  const opener = await screen.findByRole("button", { name: /nova trilha/i });
  await waitFor(() => expect(opener).toHaveProperty("disabled", false));
  opener.focus();
  fireEvent.click(opener);
  const dialog = await screen.findByRole("dialog");
  await waitFor(() =>
    expect(screen.getByLabelText(/^template/i)).toHaveProperty(
      "value",
      "clx0000000000000000templ1"
    )
  );
  return { opener, dialog };
}

/** Focáveis do diálogo, na ordem do DOM (o que o Tab percorre). */
const focusables = (dialog: HTMLElement) =>
  [
    ...dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => el.tabIndex >= 0);

describe("ordem do DOM (FR-011)", () => {
  it("os campos do formulário vêm antes de Cancelar e de Criar trilha", async () => {
    const { dialog } = await abrir();
    // `a` vem antes de `b` quando `b` a SEGUE no documento (bit 4 do resultado).
    const antes = (a: Element, b: Element) =>
      Math.floor(a.compareDocumentPosition(b) / 4) % 2 === 1;

    const cancelar = screen.getByRole("button", { name: /^cancelar$/i });
    const criar = screen.getByRole("button", { name: /criar trilha/i });
    for (const campo of [
      screen.getByLabelText(/^processo/i),
      screen.getByLabelText(/^template/i),
      screen.getByLabelText(/dono do processo/i),
      screen.getByLabelText(/consultor nebuloz/i),
    ]) {
      expect(antes(campo, cancelar)).toBe(true);
      expect(antes(campo, criar)).toBe(true);
    }
    expect(dialog.contains(cancelar) && dialog.contains(criar)).toBe(true);
  });

  it("o foco abre no primeiro campo, não num botão de ação", async () => {
    await abrir();
    expect(document.activeElement).toBe(screen.getByLabelText(/^processo/i));
  });
});

describe("Tab preso no modal (FR-012)", () => {
  it("Tab no último controle volta ao primeiro, sem sair do diálogo", async () => {
    const { dialog } = await abrir();
    const todos = focusables(dialog);
    const ultimo = todos.at(-1) as HTMLElement;
    ultimo.focus();
    fireEvent.keyDown(ultimo, { key: "Tab" });
    expect(document.activeElement).toBe(todos[0]);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("Shift+Tab no primeiro vai ao último", async () => {
    const { dialog } = await abrir();
    const todos = focusables(dialog);
    (todos[0] as HTMLElement).focus();
    fireEvent.keyDown(todos[0] as HTMLElement, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(todos.at(-1));
  });

  it("no meio do caminho o Tab é do navegador: o modal não o intercepta", async () => {
    const { dialog } = await abrir();
    const todos = focusables(dialog);
    (todos[1] as HTMLElement).focus();
    const nota = fireEvent.keyDown(todos[1] as HTMLElement, { key: "Tab" });
    // `true` = ninguém chamou preventDefault.
    expect(nota).toBe(true);
  });
});

describe("Esc fecha e devolve o foco (FR-013)", () => {
  it("Esc fecha o modal e o foco volta ao botão que o abriu", async () => {
    const { opener } = await abrir();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("Cancelar também devolve o foco", async () => {
    const { opener } = await abrir();
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("Esc com o foco num campo (digitando) também fecha", async () => {
    await abrir();
    const nome = screen.getByLabelText(/^processo/i);
    fireEvent.keyDown(nome, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
