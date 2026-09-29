import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// S-01 na tela. `createTrackFromGap` tinha zero chamadores: o Meridian dizia
// "Promovido para o SCAFFOLD" e nenhuma trilha nascia. O portfólio agora lista
// a promoção pendente e o modal a transforma em trilha, carregando o id da
// promoção — é ele que preenche `targetEntityId` do outro lado.

const h = vi.hoisted(() => ({
  listTracks: vi.fn(),
  listTemplates: vi.fn(),
  createTrackFromGap: vi.fn(),
  createTrack: vi.fn(),
  push: vi.fn(),
  getAccess: vi.fn(),
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
vi.mock("@/app/(scaffold)/actions/templates", () => ({
  listTemplates: h.listTemplates,
}));

import PortfolioScreen from "@/components/scaffold/screens/portfolio";

const PROMOTION = {
  id: "clx00000000000000000prom1",
  gapId: "clx000000000000000000gap1",
  gapCode: "G-07",
  statement: "Triagem de autorizações: 40% das guias voltam por dado faltante",
  promotedAt: new Date("2026-09-10"),
};

const SUMMARY = {
  tracks: [],
  pendingPromotions: [PROMOTION],
  members: [
    { id: "clx0000000000000000owner1", name: "Marina", role: "PROCESS_OWNER" },
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

const ACCESS = (allowed: boolean) => ({
  ok: true,
  data: {
    role: allowed ? "CONSULTANT" : "SPONSOR",
    can: {
      "track.manage": allowed
        ? { allowed: true, reason: null }
        : { allowed: false, reason: "Requer papel Consultor — criar trilhas" },
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.getAccess.mockResolvedValue(ACCESS(true));
  h.listTracks.mockResolvedValue({ ok: true, data: SUMMARY });
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
      {
        id: "clx0000000000000000templ2",
        key: "draft",
        name: "Sem versão publicada",
        archetype: "REPORTING",
        currentLabel: null,
        publishedAt: null,
        versions: [],
        overlays: [],
      },
    ],
  });
  h.createTrackFromGap.mockResolvedValue({
    ok: true,
    data: { trackId: "trk-new", code: "TR-105" },
  });
  h.createTrack.mockResolvedValue({
    ok: true,
    data: { trackId: "trk-manual", code: "TR-106" },
  });
});

describe("portfólio — promoção pendente vira trilha", () => {
  it("lista a promoção e cria a trilha carregando gapId e promotionId", async () => {
    render(<PortfolioScreen />);
    expect(await screen.findByText("G-07")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /criar trilha/i }));
    // Nome vem da lacuna, até os dois-pontos.
    const name = (await screen.findByLabelText(
      /^processo/i
    )) as HTMLInputElement;
    expect(name.value).toBe("Triagem de autorizações");

    await waitFor(() =>
      expect(screen.getByLabelText(/^template/i)).toHaveProperty(
        "value",
        "clx0000000000000000templ1"
      )
    );
    // Template sem versão publicada não é opção — ST-01.
    expect(screen.queryByText(/sem versão publicada/i)).toBeNull();

    fireEvent.change(screen.getByLabelText(/dono do processo/i), {
      target: { value: "clx0000000000000000owner1" },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /criar trilha/i })
        .at(-1) as HTMLElement
    );

    await waitFor(() => expect(h.createTrackFromGap).toHaveBeenCalledTimes(1));
    expect(h.createTrackFromGap.mock.calls[0][0]).toMatchObject({
      gapId: PROMOTION.gapId,
      promotionId: PROMOTION.id,
      templateId: "clx0000000000000000templ1",
      processName: "Triagem de autorizações",
      ownerId: "clx0000000000000000owner1",
    });
    expect(h.createTrack).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(h.push).toHaveBeenCalledWith("/scaffold/track/trk-new")
    );
  });

  it("Nova trilha sem lacuna usa createTrack e não manda promoção", async () => {
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /nova trilha/i })
    );

    const name = await screen.findByLabelText(/^processo/i);
    fireEvent.change(name, { target: { value: "Fechamento contábil" } });
    await waitFor(() =>
      expect(screen.getByLabelText(/^template/i)).toHaveProperty(
        "value",
        "clx0000000000000000templ1"
      )
    );
    fireEvent.change(screen.getByLabelText(/dono do processo/i), {
      target: { value: "clx0000000000000000owner1" },
    });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: /criar trilha/i })
        .at(-1) as HTMLElement
    );

    await waitFor(() => expect(h.createTrack).toHaveBeenCalledTimes(1));
    expect(h.createTrack.mock.calls[0][0]).not.toHaveProperty("promotionId");
    expect(h.createTrackFromGap).not.toHaveBeenCalled();
  });

  it("sem dono, o botão fica desabilitado", async () => {
    render(<PortfolioScreen />);
    fireEvent.click(
      await screen.findByRole("button", { name: /nova trilha/i })
    );
    await screen.findByLabelText(/^processo/i);
    const submit = screen
      .getAllByRole("button", { name: /criar trilha/i })
      .at(-1) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});

// Crivo F2: papel só-leitura via "Nova trilha" habilitado.
describe("portfólio — papel só-leitura", () => {
  it("Nova trilha e Criar trilha ficam desabilitados, com o motivo", async () => {
    h.getAccess.mockResolvedValue(ACCESS(false));
    render(<PortfolioScreen />);
    await screen.findByText("G-07");

    for (const name of [/nova trilha/i, /criar trilha/i]) {
      const button = screen.getByRole("button", { name });
      await waitFor(() => expect(button).toHaveProperty("disabled", true));
      expect(button.getAttribute("title")).toMatch(/Requer papel/);
    }
    fireEvent.click(screen.getByRole("button", { name: /nova trilha/i }));
    expect(screen.queryByLabelText(/^processo/i)).toBeNull();
  });

  it("quem pode abre o modal", async () => {
    render(<PortfolioScreen />);
    const nova = await screen.findByRole("button", { name: /nova trilha/i });
    await waitFor(() => expect(nova).toHaveProperty("disabled", false));
    fireEvent.click(nova);
    expect(await screen.findByLabelText(/^processo/i)).toBeDefined();
  });
});
