/** @vitest-environment jsdom */
// policy-unsaved-guard.test.tsx — o corpo da seção é o texto que vira registro
// de auditoria, e ele se editava num Textarea em PÁGINA, não em modal. Clicar
// noutra seção da lista rodava `setSelId(s.id); setEditing(false)` e o que
// havia sido digitado sumia; "Cancelar" e a troca de aba faziam o mesmo.
//
// Molde: policy-gates.test.tsx (mesmos mocks hoisted, mesmas fixtures).
// Mutação de referência: tirar o `guard(...)` do onClick da lista → o primeiro
// teste daqui falha, porque a seleção volta a trocar na hora.

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PolicyView, SectionView } from "@/app/(charter)/actions/policy";

vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const getPolicyMock = vi.hoisted(() => vi.fn());
const getPolicyScopeMock = vi.hoisted(() => vi.fn());
const getOnboardingMock = vi.hoisted(() => vi.fn());
const editSectionMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/(charter)/actions/policy", () => ({
  getPolicy: (...a: unknown[]) => getPolicyMock(...a),
  getPolicyScope: (...a: unknown[]) => getPolicyScopeMock(...a),
  editSection: (...a: unknown[]) => editSectionMock(...a),
  getVersionDiff: vi.fn(),
  publishPolicyVersion: vi.fn(),
  setSectionStatus: vi.fn(),
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

const CORPO_S1 = "Texto original da seção um.";

function secao(over: Partial<SectionView> = {}): SectionView {
  return {
    id: "s1",
    ordinal: 1,
    name: "Uso aceitável",
    status: "DRAFT",
    owner: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    words: 5,
    body: CORPO_S1,
    generated: false,
    ...over,
  };
}

function politica(over: Partial<PolicyView> = {}): PolicyView {
  return {
    id: "pol-1",
    name: "Política de Uso de IA",
    version: null,
    publishedAt: null,
    nextReview: null,
    daysToReview: null,
    scope: null,
    sections: [
      secao(),
      secao({
        id: "s2",
        ordinal: 2,
        name: "Dados pessoais",
        body: "Texto original da seção dois.",
      }),
    ],
    versions: [],
    blockers: [],
    canPublish: false,
    can: { edit: true, publish: true },
    ...over,
  };
}

/** Renderiza, entra em edição da seção 01 e devolve o Textarea. */
async function entrarEmEdicao(): Promise<HTMLTextAreaElement> {
  render(<PolicyScreen />);
  fireEvent.click(await screen.findByRole("button", { name: /Editar texto/ }));
  return (await screen.findByRole("textbox")) as HTMLTextAreaElement;
}

function itemDaLista(nome: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(nome) });
}

describe("PolicyScreen — edição de seção não some sem perguntar", () => {
  beforeEach(() => {
    for (const m of [
      getPolicyMock,
      getPolicyScopeMock,
      getOnboardingMock,
      editSectionMock,
    ]) {
      m.mockReset();
    }
    getPolicyScopeMock.mockResolvedValue({ ok: true, data: null });
    getOnboardingMock.mockResolvedValue({ ok: true, data: null });
    getPolicyMock.mockResolvedValue({ ok: true, data: politica() });
  });

  it("com texto editado, clicar noutra seção não troca a seleção e abre a confirmação", async () => {
    const ta = await entrarEmEdicao();
    fireEvent.change(ta, { target: { value: "Texto novo, ainda não salvo." } });

    fireEvent.click(itemDaLista("Dados pessoais"));

    expect(await screen.findByText("Descartar alterações?")).toBeTruthy();
    // A seleção não mudou: o editor da seção 01 continua montado com o texto.
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Texto novo, ainda não salvo."
    );
    expect(itemDaLista("Uso aceitável").getAttribute("aria-current")).toBe(
      "true"
    );
  });

  it("confirmar o descarte troca de seção e sai da edição", async () => {
    const ta = await entrarEmEdicao();
    fireEvent.change(ta, { target: { value: "Texto novo, ainda não salvo." } });
    fireEvent.click(itemDaLista("Dados pessoais"));
    await screen.findByText("Descartar alterações?");

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() =>
      expect(itemDaLista("Dados pessoais").getAttribute("aria-current")).toBe(
        "true"
      )
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(editSectionMock).not.toHaveBeenCalled();
  });

  it("cancelar mantém a seleção e o texto digitado", async () => {
    const ta = await entrarEmEdicao();
    fireEvent.change(ta, { target: { value: "Texto novo, ainda não salvo." } });
    fireEvent.click(itemDaLista("Dados pessoais"));
    const dialogo = await screen.findByRole("dialog");

    fireEvent.click(within(dialogo).getByText("Cancelar"));

    await waitFor(() =>
      expect(screen.queryByText("Descartar alterações?")).toBeNull()
    );
    expect(itemDaLista("Uso aceitável").getAttribute("aria-current")).toBe(
      "true"
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Texto novo, ainda não salvo."
    );
  });

  it("'Cancelar' da edição com texto alterado pergunta antes de descartar", async () => {
    const ta = await entrarEmEdicao();
    fireEvent.change(ta, { target: { value: "Texto novo, ainda não salvo." } });

    fireEvent.click(
      screen.getByRole("button", { name: /^Cancelar$/ }) as HTMLElement
    );

    expect(await screen.findByText("Descartar alterações?")).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("trocar de aba com texto alterado pergunta antes de descartar", async () => {
    const ta = await entrarEmEdicao();
    fireEvent.change(ta, { target: { value: "Texto novo, ainda não salvo." } });

    fireEvent.click(screen.getByText("Histórico de versões"));

    expect(await screen.findByText("Descartar alterações?")).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("digitar e desfazer não pergunta — sujo é divergir do servidor, não ter tocado", async () => {
    const ta = await entrarEmEdicao();
    fireEvent.change(ta, { target: { value: "rabisco" } });
    fireEvent.change(ta, { target: { value: CORPO_S1 } });

    fireEvent.click(itemDaLista("Dados pessoais"));

    await waitFor(() =>
      expect(itemDaLista("Dados pessoais").getAttribute("aria-current")).toBe(
        "true"
      )
    );
    expect(screen.queryByText("Descartar alterações?")).toBeNull();
  });

  it("sem alteração nenhuma, 'Cancelar' sai da edição direto", async () => {
    await entrarEmEdicao();

    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/ }));

    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(screen.queryByText("Descartar alterações?")).toBeNull();
  });
});
