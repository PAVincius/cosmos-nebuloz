/** @vitest-environment jsdom */
// policy-gates.test.tsx — três ações de policy.tsx fingiam desabilitar com
// `pointer-events:none` + `title` no hover: o motivo só aparecia passando o
// mouse, e nada impedia Tab+Enter de disparar a action mesmo assim (o span
// não desabilita o <button> dentro dele). Este arquivo prova, por ação:
//   1. o `<button>` renderizado tem `disabled` real quando a condição falha;
//   2. clicar nele não chama a action (mutação: voltar ao span → estes testes
//      falham, porque o clique volta a disparar o handler);
//   3. o motivo aparece como texto na tela, não só em `title`.
// Cobre também "Reabrir para revisão", que passou a exigir confirmação antes
// de rebaixar uma seção publicada, e o gate de corpo vazio em "Solicitar
// revisão".
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PolicyView, SectionView } from "@/app/(charter)/actions/policy";

vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const getPolicyMock = vi.hoisted(() => vi.fn());
const getPolicyScopeMock = vi.hoisted(() => vi.fn());
const getOnboardingMock = vi.hoisted(() => vi.fn());
const setSectionStatusMock = vi.hoisted(() => vi.fn());
const publishPolicyVersionMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/(charter)/actions/policy", () => ({
  getPolicy: (...a: unknown[]) => getPolicyMock(...a),
  getPolicyScope: (...a: unknown[]) => getPolicyScopeMock(...a),
  editSection: vi.fn(),
  getVersionDiff: vi.fn(),
  publishPolicyVersion: (...a: unknown[]) => publishPolicyVersionMock(...a),
  setSectionStatus: (...a: unknown[]) => setSectionStatusMock(...a),
  linkPolicy: vi.fn(),
  unlinkPolicy: vi.fn(),
  saveGeneratedDraft: vi.fn(),
}));
vi.mock("@/app/(charter)/actions/policy-generate", () => ({
  generatePolicyDraft: vi.fn(),
}));
vi.mock("@/app/(charter)/actions/onboarding", () => ({
  getOnboarding: (...a: unknown[]) => getOnboardingMock(...a),
}));

import PolicyScreen from "../../components/charter/screens/policy";

function politica(over: Partial<PolicyView> = {}): PolicyView {
  return {
    id: "pol-1",
    name: "Política de Uso de IA",
    version: null,
    publishedAt: null,
    nextReview: null,
    daysToReview: null,
    scope: null,
    sections: [],
    versions: [],
    blockers: [],
    canPublish: false,
    can: { edit: true, publish: true },
    ...over,
  };
}

function secao(over: Partial<SectionView> = {}): SectionView {
  return {
    id: "s1",
    ordinal: 1,
    name: "Uso aceitável",
    status: "DRAFT",
    owner: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    words: 3,
    body: "Texto da seção.",
    generated: false,
    ...over,
  };
}

describe("PolicyScreen — gates reais", () => {
  beforeEach(() => {
    for (const m of [
      getPolicyMock,
      getPolicyScopeMock,
      getOnboardingMock,
      setSectionStatusMock,
      publishPolicyVersionMock,
    ]) {
      m.mockReset();
    }
    getPolicyScopeMock.mockResolvedValue({ ok: true, data: null });
    getOnboardingMock.mockResolvedValue({ ok: true, data: null });
    setSectionStatusMock.mockResolvedValue({
      ok: true,
      data: { status: "REVIEW" },
    });
  });

  it("'Publicar versão' sem permissão: botão desabilitado, motivo visível, clique não abre o modal", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({ can: { edit: true, publish: false } }),
    });
    render(<PolicyScreen />);

    const btn = await screen.findByRole("button", { name: /Publicar versão/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Somente o papel Compliance publica versão")
    ).toBeTruthy();

    fireEvent.click(btn);
    expect(
      screen.queryByText(/a versão vigente só muda ao confirmar/)
    ).toBeNull();
  });

  it("'Publicar versão' com permissão: botão habilitado, clique abre o modal de publicação", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({ can: { edit: true, publish: true } }),
    });
    render(<PolicyScreen />);

    const btn = await screen.findByRole("button", { name: /Publicar versão/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(btn);
    expect(
      await screen.findByText(/a versão vigente só muda ao confirmar/)
    ).toBeTruthy();
  });

  it("'Editar texto' sem permissão: botão desabilitado, clique não entra em modo de edição", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({
        can: { edit: false, publish: true },
        sections: [secao()],
      }),
    });
    render(<PolicyScreen />);

    const btn = await screen.findByRole("button", { name: /Editar texto/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    // Escopado ao wrapper do próprio botão: `policy-draft-preview.tsx` (rascunho
    // assistido, também na tela porque a seção está em DRAFT) usa o mesmo motivo
    // para o próprio gate dele, então o texto solto existe em dois lugares.
    expect(
      within(btn.parentElement as HTMLElement).getByText(
        "Somente Legal ou Compliance edita seção"
      )
    ).toBeTruthy();

    fireEvent.click(btn);
    expect(screen.queryByRole("button", { name: /Salvar/ })).toBeNull();
  });

  it("'Editar texto' com permissão: clique entra em modo de edição", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({
        can: { edit: true, publish: true },
        sections: [secao()],
      }),
    });
    render(<PolicyScreen />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Editar texto/ })
    );
    expect(await screen.findByRole("button", { name: /Salvar/ })).toBeTruthy();
  });

  it("'Aprovar seção' sem permissão: botão desabilitado, clique não chama a action", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({
        can: { edit: false, publish: true },
        sections: [secao({ status: "REVIEW" })],
      }),
    });
    render(<PolicyScreen />);

    const btn = await screen.findByRole("button", { name: /Aprovar seção/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Somente Legal ou Compliance aprova seção")
    ).toBeTruthy();

    fireEvent.click(btn);
    expect(setSectionStatusMock).not.toHaveBeenCalled();
  });

  it("'Aprovar seção' com permissão: clique chama a action com PUBLISHED", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({
        can: { edit: true, publish: true },
        sections: [secao({ status: "REVIEW" })],
      }),
    });
    render(<PolicyScreen />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Aprovar seção/ })
    );
    expect(setSectionStatusMock).toHaveBeenCalledWith({
      sectionId: "s1",
      status: "PUBLISHED",
    });
  });

  it("'Solicitar revisão' com corpo vazio: botão desabilitado, clique não chama a action", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({
        can: { edit: true, publish: true },
        sections: [secao({ status: "DRAFT", body: "   " })],
      }),
    });
    render(<PolicyScreen />);

    const btn = await screen.findByRole("button", {
      name: /Solicitar revisão/,
    });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Escreva o texto da seção antes de solicitar revisão")
    ).toBeTruthy();

    fireEvent.click(btn);
    expect(setSectionStatusMock).not.toHaveBeenCalled();
  });

  it("'Solicitar revisão' com corpo preenchido: clique chama a action com REVIEW", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({
        can: { edit: true, publish: true },
        sections: [secao({ status: "DRAFT", body: "Texto real." })],
      }),
    });
    render(<PolicyScreen />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Solicitar revisão/ })
    );
    expect(setSectionStatusMock).toHaveBeenCalledWith({
      sectionId: "s1",
      status: "REVIEW",
    });
  });

  it("'Reabrir para revisão' pede confirmação antes de chamar a action", async () => {
    getPolicyMock.mockResolvedValue({
      ok: true,
      data: politica({
        can: { edit: true, publish: true },
        sections: [secao({ status: "PUBLISHED", name: "Uso aceitável" })],
      }),
    });
    render(<PolicyScreen />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Reabrir para revisão/ })
    );

    const dialog = await screen.findByRole("dialog");
    // `getByText` só casa texto que é filho direto de UM elemento; o nome da
    // seção mora num `<strong>` aninhado, então checa o textContent inteiro
    // do diálogo em vez de escopar num nó só.
    expect(dialog.textContent).toMatch(
      /A seção Uso aceitável volta para revisão e deixa de contar para a próxima publicação/
    );
    // Ainda não confirmou: a action não pode ter sido chamada só por abrir o modal.
    expect(setSectionStatusMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(setSectionStatusMock).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByRole("button", { name: /Reabrir para revisão/ })
    );
    const dialog2 = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog2).getByRole("button", { name: "Reabrir seção" })
    );
    expect(setSectionStatusMock).toHaveBeenCalledWith({
      sectionId: "s1",
      status: "REVIEW",
    });
  });
});
