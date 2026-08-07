/** @vitest-environment jsdom */
// setup-panel.test.tsx — painel de montagem no topo do dashboard: mostra os
// cinco passos e o "porquê" de cada um, nomeia quem pode agir quando o papel
// de quem olha não pode e nunca oferece controle habilitado nesse caso, se
// recolhe a um resumo de uma linha quando a montagem termina, não inventa
// "0 de 0" nos passos sem `progresso`, e — o teste que mais importa — não
// derruba o dashboard quando a leitura do progresso falha: o painel é
// aditivo. Asserção sobre conteúdo, sem snapshot: um ajuste de Tailwind não
// pode quebrar este arquivo.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/app/(charter)/actions/dashboard";
import type {
  SetupProgress,
  SetupStep,
  SetupStepId,
} from "@/app/(charter)/actions/setup";

const pushMock = vi.fn();
const getSetupProgressMock = vi.fn();
const getDashboardMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/app/(charter)/actions/setup", () => ({
  getSetupProgress: (...args: unknown[]) => getSetupProgressMock(...args),
}));
vi.mock("@/app/(charter)/actions/dashboard", () => ({
  getDashboard: (...args: unknown[]) => getDashboardMock(...args),
}));

import DashboardScreen from "../../components/charter/screens/dashboard";
import { SetupPanel } from "../../components/charter/setup-panel";

function passo(over: Partial<SetupStep> = {}): SetupStep {
  return {
    id: "usecase.first",
    titulo: "Passo",
    porque: "Motivo do passo.",
    estado: "feito",
    href: "/charter/x",
    podeAgir: true,
    ...over,
  };
}

const CINCO_IDS: SetupStepId[] = [
  "policy.write",
  "policy.publish",
  "roles.assign",
  "usecase.first",
  "decision.first",
];

/** Os cinco passos reais, com um builder por índice — evita repetir os oito
 *  campos de `SetupStep` cinco vezes em cada teste. */
function cincoPassos(
  build: (index: number) => Partial<SetupStep>
): SetupStep[] {
  return CINCO_IDS.map((id, i) => passo({ id, ...build(i) }));
}

function dashboardFixture(): DashboardData {
  return {
    org: { name: "Aurora Bank", posture: "Moderada", geo: "BR" },
    kpis: {
      pending: 0,
      slaAtRisk: 0,
      highRisk: 0,
      ackPct: 0,
      ackDone: 0,
      ackAll: 0,
      vendorsInReview: 0,
      vendorsTotal: 0,
    },
    queue: [],
    policy: null,
    categoryExposure: [],
    activeCount: 0,
    alerts: [],
  };
}

describe("SetupPanel", () => {
  it("tenant novo: mostra os cinco títulos, o porquê do passo 1, e 0 de 9", () => {
    const passos = cincoPassos((i) => ({
      titulo: `Passo ${i + 1}`,
      porque: `Motivo do passo ${i + 1}.`,
      estado: i === 0 ? "disponivel" : "bloqueado",
      progresso: i === 0 ? { feito: 0, total: 9 } : undefined,
      bloqueadoPor:
        i === 0 ? undefined : "Passo anterior ainda não foi concluído.",
    }));
    const progresso: SetupProgress = {
      passos,
      concluidos: 0,
      total: 5,
      completo: false,
    };

    render(<SetupPanel progresso={progresso} />);

    for (const step of passos) {
      expect(screen.getByText(step.titulo)).toBeTruthy();
    }
    expect(screen.getByText("Motivo do passo 1.")).toBeTruthy();
    expect(screen.getByText("0 de 9")).toBeTruthy();
  });

  it("passo bloqueado mostra o texto de bloqueadoPor", () => {
    const step = passo({
      estado: "bloqueado",
      bloqueadoPor: "Publique a política primeiro.",
    });

    render(
      <SetupPanel
        progresso={{ passos: [step], concluidos: 0, total: 1, completo: false }}
      />
    );

    expect(screen.getByText("Publique a política primeiro.")).toBeTruthy();
  });

  it("passo com podeAgir false mostra quemPode e não oferece controle habilitado", () => {
    const step = passo({
      estado: "disponivel",
      podeAgir: false,
      quemPode: "Compliance",
    });

    render(
      <SetupPanel
        progresso={{ passos: [step], concluidos: 0, total: 1, completo: false }}
      />
    );

    expect(screen.getByText("Só Compliance pode fazer isso.")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Abrir" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("completo: true recolhe o painel para um resumo, e os cinco títulos deixam de aparecer", () => {
    const passos = cincoPassos((i) => ({
      titulo: `Passo ${i + 1}`,
      estado: "feito",
    }));

    render(
      <SetupPanel
        progresso={{ passos, concluidos: 5, total: 5, completo: true }}
      />
    );

    for (const step of passos) {
      expect(screen.queryByText(step.titulo)).toBeNull();
    }
    expect(
      screen.getByText(/passos de montagem inicial foram feitos/i)
    ).toBeTruthy();
  });

  it("progresso ausente nos passos 2 a 5: não renderiza 0 de 0 nem NaN", () => {
    const passos = cincoPassos((i) => ({
      titulo: `Passo ${i + 1}`,
      estado: i === 0 ? "disponivel" : "bloqueado",
      progresso: i === 0 ? { feito: 2, total: 9 } : undefined,
      bloqueadoPor:
        i === 0 ? undefined : "Passo anterior ainda não foi concluído.",
    }));

    render(
      <SetupPanel
        progresso={{ passos, concluidos: 0, total: 5, completo: false }}
      />
    );

    expect(screen.getByText("2 de 9")).toBeTruthy();
    expect(screen.queryByText(/0 de 0/)).toBeNull();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("dashboard renderiza quando getSetupProgress falha", async () => {
    getDashboardMock.mockResolvedValue({ ok: true, data: dashboardFixture() });
    getSetupProgressMock.mockResolvedValue({
      ok: false,
      error: "Falha ao carregar o progresso de montagem.",
    });

    render(<DashboardScreen />);

    // Sinal de que `getDashboard` já resolveu e o loading acabou — não pode
    // mais ser o texto tranquilizador do card de fila: com a leitura de
    // progresso indisponível, esse texto é exatamente o que a Task 3 proíbe
    // de aparecer (ver os três testes abaixo).
    expect(await screen.findByText(/Aurora Bank/)).toBeTruthy();
    expect(screen.getByText("Visão Geral de Governança")).toBeTruthy();
    // O painel é aditivo: leitura de progresso que falhou não aparece, mas
    // também não derruba o resto da tela.
    expect(screen.queryByText("Comece por aqui")).toBeNull();
  });

  it("montagem incompleta: card de fila não afirma o texto tranquilizador", async () => {
    // O produto afirmando conformidade que ninguém construiu é o defeito que
    // este trabalho existe para tirar da primeira tela que o cliente vê: com
    // a montagem incompleta, "toda submissão foi revisada dentro do SLA" é
    // uma frase sobre um processo que nunca rodou.
    getDashboardMock.mockResolvedValue({ ok: true, data: dashboardFixture() });
    getSetupProgressMock.mockResolvedValue({
      ok: true,
      data: { passos: [], concluidos: 0, total: 5, completo: false },
    });

    render(<DashboardScreen />);

    expect(await screen.findByText(/nenhum caso foi submetido/i)).toBeTruthy();
    // `{setupProgress && <SetupPanel/>}` (Task 2) não tinha teste de caminho
    // de sucesso: apagar essa linha deixava os outros 8 testes deste arquivo
    // verdes (achado da revisão do branch inteiro).
    expect(screen.getByText("Comece por aqui")).toBeTruthy();
    expect(screen.queryByText(/revisada dentro do SLA/i)).toBeNull();
  });

  it("montagem completa: card de fila volta a mostrar o texto tranquilizador", async () => {
    getDashboardMock.mockResolvedValue({ ok: true, data: dashboardFixture() });
    getSetupProgressMock.mockResolvedValue({
      ok: true,
      data: { passos: [], concluidos: 5, total: 5, completo: true },
    });

    render(<DashboardScreen />);

    expect(await screen.findByText(/revisada dentro do SLA/i)).toBeTruthy();
  });

  it("getSetupProgress falhou: card de fila não afirma o texto tranquilizador", async () => {
    getDashboardMock.mockResolvedValue({ ok: true, data: dashboardFixture() });
    getSetupProgressMock.mockResolvedValue({
      ok: false,
      error: "Falha ao carregar o progresso de montagem.",
    });

    render(<DashboardScreen />);

    // Mesmo sinal de assentamento do teste de falha acima: o nome da org só
    // aparece depois que `getDashboard` resolve, independente do que
    // aconteça com `getSetupProgress`.
    await screen.findByText(/Aurora Bank/);
    expect(screen.queryByText(/revisada dentro do SLA/i)).toBeNull();
  });

  it("alertas: enquanto o dashboard ainda carrega, não mostra o texto tranquilizador", async () => {
    // getDashboard nunca resolve nesta suíte: reproduz a janela real, em que
    // setupProgress (um punhado de count()s) assenta antes de data (fila,
    // política, KPIs e alertas — a leitura pesada). O card de fila já tem o
    // gate `loading || !data`; o de alertas, achado da revisão do branch
    // inteiro, caía direto no `data?.alerts ?? []` vazio e afirmava um texto
    // sobre dado que ainda não chegou — trocando uma falsa afirmação de
    // falha por uma falsa afirmação de calma.
    getDashboardMock.mockReturnValue(new Promise(() => {}));
    getSetupProgressMock.mockResolvedValue({
      ok: true,
      data: { passos: [], concluidos: 5, total: 5, completo: true },
    });

    render(<DashboardScreen />);

    // Sinal de assentamento independente de `data`: o resumo do painel só
    // depende de `setupProgress`, que aqui resolve mesmo com `data` preso.
    expect(
      await screen.findByText(/passos de montagem inicial foram feitos/i)
    ).toBeTruthy();
    expect(screen.queryByText("Nada exige ação agora")).toBeNull();
    expect(
      screen.queryByText(/nenhum sla vencido, nenhuma mitigação atrasada/i)
    ).toBeNull();
  });
});
