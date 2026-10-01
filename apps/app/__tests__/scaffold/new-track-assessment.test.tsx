import { createRequire } from "node:module";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "Nova trilha" e o diagnóstico do Meridian (D-27).
//
// Trilha de prontidão — template sem forma de trabalho — nasce de um assessment:
// a tela mostra os assessments do tenant (só os pontuados) e manda o escolhido
// como `sourceAssessmentId`. Sem assessment, a tela explica por que a trilha não
// pode ser criada e o botão fica desabilitado COM o motivo — nunca um botão que
// falha. Trilha por forma de trabalho não vê nada disso.

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

const TRIAGE = "clx0000000000000000templ1";
const FUNDACAO = "clx0000000000000000templ2";
const OWNER = "clx0000000000000000owner1";
const AS_120 = "clx000000000000000assess01";
const AS_104 = "clx000000000000000assess02";

const SUMMARY = {
  tracks: [],
  pendingPromotions: [],
  members: [
    { id: OWNER, name: "Marina", role: "PROCESS_OWNER" },
    { id: "clx000000000000000000cons1", name: "Rui", role: "CONSULTANT" },
  ],
  embeddedCount: 0,
  stalledCount: 0,
  gateReadyCount: 0,
  signedBaselineCount: 0,
  orgCount: 0,
  stallThresholdDays: 14,
  overrideRates: [],
};

const template = (id: string, name: string, archetype: string | null) => ({
  id,
  key: name,
  name,
  archetype,
  currentLabel: "v1",
  publishedAt: new Date(),
  versions: [],
  overlays: [],
});

const ASSESSMENTS = [
  {
    id: AS_120,
    code: "AS-120",
    orgName: "Atlas",
    status: "FINALISED",
    date: new Date("2026-09-30T12:00:00Z"),
  },
  {
    id: AS_104,
    code: "AS-104",
    orgName: "Atlas",
    status: "REVIEW",
    date: new Date("2026-08-12T12:00:00Z"),
  },
];

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
  h.listTemplates.mockResolvedValue({
    ok: true,
    data: [
      template(TRIAGE, "Triagem de suporte", "TRIAGE"),
      template(FUNDACAO, "Fundação de Prontidão de IA", null),
    ],
  });
  h.listAssessments.mockResolvedValue({ ok: true, data: ASSESSMENTS });
  h.createTrack.mockResolvedValue({
    ok: true,
    data: { trackId: "trk-new", code: "TR-001" },
  });
});

async function abrirModal() {
  render(<PortfolioScreen />);
  const botao = await screen.findByRole("button", { name: /nova trilha/i });
  await waitFor(() => expect(botao).toHaveProperty("disabled", false));
  fireEvent.click(botao);
  await screen.findByLabelText(/^processo/i);
  await waitFor(() =>
    expect(screen.getByLabelText(/^template/i)).toHaveProperty("value", TRIAGE)
  );
}

const escolherTemplate = (id: string) =>
  fireEvent.change(screen.getByLabelText(/^template/i), {
    target: { value: id },
  });

const preencher = () => {
  fireEvent.change(screen.getByLabelText(/^processo/i), {
    target: { value: "Fundação do Atlas" },
  });
  fireEvent.change(screen.getByLabelText(/dono do processo/i), {
    target: { value: OWNER },
  });
};

const criar = () =>
  screen
    .getAllByRole("button", { name: /criar trilha/i })
    .at(-1) as HTMLButtonElement;

describe("trilha por forma de trabalho", () => {
  it("não mostra nada do diagnóstico, não lê assessment e cria sem sourceAssessmentId", async () => {
    await abrirModal();
    expect(screen.queryByLabelText(/diagnóstico do meridian/i)).toBeNull();
    expect(h.listAssessments).not.toHaveBeenCalled();

    preencher();
    fireEvent.click(criar());
    await waitFor(() => expect(h.createTrack).toHaveBeenCalledTimes(1));
    expect(h.createTrack.mock.calls[0][0]).not.toHaveProperty(
      "sourceAssessmentId"
    );
  });
});

describe("trilha de prontidão (template sem forma de trabalho)", () => {
  it("mostra os assessments do tenant com código, organização, data e estado", async () => {
    await abrirModal();
    escolherTemplate(FUNDACAO);
    const campo = await screen.findByLabelText(/diagnóstico do meridian/i);
    const opcoes = [...(campo as HTMLSelectElement).options].map((o) => o.text);
    expect(opcoes).toEqual([
      "Escolha o assessment",
      "AS-120 · Atlas · 30/09/2026 · Finalizado",
      "AS-104 · Atlas · 12/08/2026 · Em revisão",
    ]);
  });

  it("sem escolher o assessment, não cria — e diz por quê na tela, não só no botão", async () => {
    await abrirModal();
    escolherTemplate(FUNDACAO);
    await screen.findByLabelText(/diagnóstico do meridian/i);
    preencher();
    expect(criar().disabled).toBe(true);
    expect(
      screen.getByText(
        /escolha o assessment do meridian para criar esta trilha/i
      )
    ).toBeDefined();
    expect(h.createTrack).not.toHaveBeenCalled();
  });

  it("com o assessment escolhido, cria mandando sourceAssessmentId", async () => {
    await abrirModal();
    escolherTemplate(FUNDACAO);
    const campo = await screen.findByLabelText(/diagnóstico do meridian/i);
    preencher();
    fireEvent.change(campo, { target: { value: AS_120 } });
    expect(criar().disabled).toBe(false);
    fireEvent.click(criar());

    await waitFor(() => expect(h.createTrack).toHaveBeenCalledTimes(1));
    expect(h.createTrack.mock.calls[0][0]).toMatchObject({
      templateId: FUNDACAO,
      sourceAssessmentId: AS_120,
    });
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith("/scaffold/track/trk-new")
    );
  });

  it("voltar para uma forma de trabalho solta o assessment: não vai na criação", async () => {
    await abrirModal();
    escolherTemplate(FUNDACAO);
    fireEvent.change(await screen.findByLabelText(/diagnóstico do meridian/i), {
      target: { value: AS_120 },
    });
    escolherTemplate(TRIAGE);
    expect(screen.queryByLabelText(/diagnóstico do meridian/i)).toBeNull();
    preencher();
    fireEvent.click(criar());
    await waitFor(() => expect(h.createTrack).toHaveBeenCalledTimes(1));
    expect(h.createTrack.mock.calls[0][0]).not.toHaveProperty(
      "sourceAssessmentId"
    );
  });

  it("sem nenhum assessment pontuado, explica a origem da trilha e não oferece campo quebrado", async () => {
    h.listAssessments.mockResolvedValue({ ok: true, data: [] });
    await abrirModal();
    escolherTemplate(FUNDACAO);

    expect(
      await screen.findByText(/nasce de um diagnóstico do meridian/i)
    ).toBeDefined();
    expect(screen.getByText(/nenhum assessment com pontuação/i)).toBeDefined();
    expect(screen.queryByLabelText(/diagnóstico do meridian/i)).toBeNull();
    preencher();
    expect(criar().disabled).toBe(true);
    // A saída está dita: onde fazer o diagnóstico.
    expect(screen.getByText(/consultora da nebuloz/i)).toBeDefined();
  });

  it("não escreve código de requisito na tela do cliente", async () => {
    h.listAssessments.mockResolvedValue({ ok: true, data: [] });
    await abrirModal();
    escolherTemplate(FUNDACAO);
    await screen.findByText(/nasce de um diagnóstico do meridian/i);
    expect(document.body.textContent).not.toMatch(/\bD-27\b/);
  });

  it("se a lista falhar, mostra o motivo e não deixa criar", async () => {
    h.listAssessments.mockResolvedValue({ ok: false, error: "Sem permissão." });
    await abrirModal();
    escolherTemplate(FUNDACAO);
    expect(await screen.findByText(/sem permissão\./i)).toBeDefined();
    preencher();
    expect(criar().disabled).toBe(true);
  });
});

describe("acessibilidade", () => {
  // axe-core chega como dependência do @axe-core/playwright; o teste o resolve
  // por ele em vez de acrescentar dependência.
  const requireHere = createRequire(import.meta.url);
  const axe = createRequire(requireHere.resolve("@axe-core/playwright"))(
    "axe-core"
  ) as {
    run: (
      ctx: Element,
      opts?: unknown
    ) => Promise<{ violations: { id: string; nodes: unknown[] }[] }>;
  };

  const violacoes = async () => {
    const modal =
      (await screen.findByRole("dialog").catch(() => null)) ?? document.body;
    const r = await axe.run(modal, {
      // jsdom não calcula cor nem layout: contraste e landmarks ficam para o
      // axe no navegador.
      rules: {
        "color-contrast": { enabled: false },
        region: { enabled: false },
      },
    });
    return r.violations.map((v) => v.id);
  };

  it("o modal com o seletor de assessment não tem violação de axe", async () => {
    await abrirModal();
    escolherTemplate(FUNDACAO);
    await screen.findByLabelText(/diagnóstico do meridian/i);
    expect(await violacoes()).toEqual([]);
  });

  it("o estado sem assessment também não tem", async () => {
    h.listAssessments.mockResolvedValue({ ok: true, data: [] });
    await abrirModal();
    escolherTemplate(FUNDACAO);
    await screen.findByText(/nasce de um diagnóstico do meridian/i);
    expect(await violacoes()).toEqual([]);
  });

  it("o axe deste teste enxerga violação (select sem rótulo), então o verde não é cego", async () => {
    const solto = document.createElement("div");
    solto.innerHTML = "<select><option>a</option></select>";
    document.body.append(solto);
    const r = await axe.run(solto, {
      rules: {
        "color-contrast": { enabled: false },
        region: { enabled: false },
      },
    });
    solto.remove();
    expect(r.violations.map((v) => v.id)).toContain("select-name");
  });

  it("o campo é um select nativo com rótulo, operável por teclado", async () => {
    await abrirModal();
    escolherTemplate(FUNDACAO);
    const campo = (await screen.findByLabelText(
      /diagnóstico do meridian/i
    )) as HTMLSelectElement;
    expect(campo.tagName).toBe("SELECT");
    expect(campo.disabled).toBe(false);
    expect(campo.tabIndex).toBeGreaterThanOrEqual(0);
  });
});
