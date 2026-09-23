/** @vitest-environment jsdom */
// dashboard-initial-state.test.tsx — o dashboard para de mentir no estado
// inicial. Tenant que nunca publicou: `getDashboard` devolve `policy.version`
// nulo e `daysToReview` nulo, e a tela interpolava "Política null publicada"
// com dot verde e "Revisão em null dias". O header tinha fixo "Publicar
// atualização" (sem nada publicável) e "Exportar resumo" (que só navegava
// para /charter/audit). E a fila vazia, sem leitura de progresso, dizia
// "Nada aqui." sem dizer o que fazer. Asserção sobre conteúdo, sem snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/app/(charter)/actions/dashboard";
import type { SetupStep } from "@/app/(charter)/actions/setup";

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

const pushMock = vi.hoisted(() => vi.fn());
const getDashboardMock = vi.hoisted(() => vi.fn());
const getSetupProgressMock = vi.hoisted(() => vi.fn());
const exportEvidenceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/app/(charter)/actions/dashboard", () => ({
  getDashboard: (...a: unknown[]) => getDashboardMock(...a),
}));
vi.mock("@/app/(charter)/actions/setup", () => ({
  getSetupProgress: (...a: unknown[]) => getSetupProgressMock(...a),
}));
vi.mock("@/app/(charter)/actions/audit", () => ({
  exportEvidence: (...a: unknown[]) => exportEvidenceMock(...a),
}));

import DashboardScreen from "../../components/charter/screens/dashboard";

function passo(over: Partial<SetupStep>): SetupStep {
  return {
    id: "policy.write",
    titulo: "Passo",
    porque: "Motivo.",
    estado: "feito",
    href: "/charter/x",
    podeAgir: true,
    ...over,
  };
}

/** Tenant novo: política existe (provisionada) mas nunca foi publicada. */
function nuncaPublicada(): DashboardData {
  return {
    org: { name: "Aurora Bank", posture: "Moderada", geo: "BR" },
    kpis: {
      pending: 0,
      slaAtRisk: 0,
      highRisk: 0,
      ackPct: 0,
      ackDone: 0,
      ackAll: 0,
      vendorsInReview: 4,
      vendorsTotal: 4,
    },
    queue: [],
    policy: {
      name: "Política de Uso de IA",
      version: null,
      publishedAt: null,
      nextReview: null,
      daysToReview: null,
      approver: null,
      sections: [],
      publishedCount: 0,
      blockerCount: 9,
    },
    categoryExposure: [],
    activeCount: 0,
    alerts: [],
  };
}

describe("DashboardScreen no estado inicial", () => {
  beforeEach(() => {
    for (const m of [
      pushMock,
      getDashboardMock,
      getSetupProgressMock,
      exportEvidenceMock,
      toastMocks.loading,
      toastMocks.success,
      toastMocks.error,
    ]) {
      m.mockReset();
    }
    toastMocks.loading.mockReturnValue("toast-1");
    getDashboardMock.mockResolvedValue({ ok: true, data: nuncaPublicada() });
    getSetupProgressMock.mockResolvedValue({
      ok: true,
      data: {
        passos: [
          passo({
            id: "policy.write",
            titulo: "Escreva as seções da política",
          }),
          passo({
            id: "policy.publish",
            titulo: "Publique a primeira versão",
            estado: "disponivel",
            href: "/charter/policy",
          }),
          passo({
            id: "usecase.first",
            titulo: "Submeta o primeiro caso de uso",
            estado: "bloqueado",
            href: "/charter/cases",
          }),
        ],
        concluidos: 1,
        total: 3,
        completo: false,
      },
    });
  });

  it("política nunca publicada: badge âmbar, sem 'Revisão em', sem null no texto", async () => {
    const { container } = render(<DashboardScreen />);

    expect(await screen.findByText("Política nunca publicada")).toBeTruthy();
    expect(screen.queryByText(/Política null publicada/)).toBeNull();
    expect(screen.queryByText(/Revisão em/)).toBeNull();
    expect(container.textContent).not.toMatch(/\bnull\b/);
    expect(container.textContent).not.toMatch(/\bundefined\b/);
  });

  it("primário é o próximo passo não concluído da montagem, com o mesmo href", async () => {
    render(<DashboardScreen />);

    const btn = await screen.findByRole("button", {
      name: "Publique a primeira versão",
    });
    fireEvent.click(btn);

    expect(pushMock).toHaveBeenCalledWith("/charter/policy");
    expect(
      screen.queryByRole("button", { name: /Publicar atualização/ })
    ).toBeNull();
  });

  it("montagem completa: primário vira 'Ver fila'", async () => {
    getSetupProgressMock.mockResolvedValue({
      ok: true,
      data: { passos: [], concluidos: 6, total: 6, completo: true },
    });
    render(<DashboardScreen />);

    fireEvent.click(await screen.findByRole("button", { name: /Ver fila/ }));

    expect(pushMock).toHaveBeenCalledWith("/charter/cases");
  });

  it("'Exportar resumo' some; exportar abre o pacote de evidência e chama exportEvidence", async () => {
    exportEvidenceMock.mockResolvedValue({
      ok: true,
      data: {
        filename: "charter-evidencia.csv",
        mimeType: "text/csv",
        content: "a,b",
        recordCount: 2,
      },
    });
    // jsdom não implementa createObjectURL; o download é efeito colateral do
    // browser, não do que este teste prova.
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<DashboardScreen />);

    await screen.findByText(/Aurora Bank/);
    expect(
      screen.queryByRole("button", { name: /Exportar resumo/ })
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Exportar pacote/ }));

    expect(
      await screen.findByRole("dialog", { name: /pacote de evidência/i })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Gerar pacote/ }));

    await waitFor(() =>
      expect(exportEvidenceMock).toHaveBeenCalledWith(
        expect.objectContaining({ format: "csv" })
      )
    );
    expect(pushMock).not.toHaveBeenCalledWith("/charter/audit");
  });

  it("fila vazia sem leitura de progresso: fato honesto e a próxima ação", async () => {
    // Promise que nunca resolve: a janela em que o progresso ainda não chegou
    // (ou falhou) — o card não sabe se é primeiro uso, mas sabe que a fila
    // está vazia e sabe o que fazer a respeito.
    getSetupProgressMock.mockReturnValue(new Promise(() => {}));
    render(<DashboardScreen />);

    expect(
      await screen.findByText("Nenhum caso aguardando decisão")
    ).toBeTruthy();
    expect(screen.queryByText("Nada aqui.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Submeter caso/ }));
    expect(pushMock).toHaveBeenCalledWith("/charter/cases");
  });

  it("caso na fila sem pontuação: a coluna Risco escreve 'sem pontuação', sem número nem separador solto", async () => {
    getDashboardMock.mockResolvedValue({
      ok: true,
      data: {
        ...nuncaPublicada(),
        queue: [
          {
            code: "UC-004",
            title: "Classificador de chamados",
            status: "SUBMITTED",
            dataClass: "INTERNAL",
            score: null,
            riskLabel: "sem pontuação",
            riskTone: "accent",
            reviewerName: null,
            sla: 3,
            slaTotal: 3,
          },
        ],
      },
    });
    render(<DashboardScreen />);

    expect(await screen.findByText("sem pontuação")).toBeTruthy();
    expect(screen.queryByText(/·\s*sem pontuação/)).toBeNull();
  });
});
