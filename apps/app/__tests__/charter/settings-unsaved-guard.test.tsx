/** @vitest-environment jsdom */
// settings-unsaved-guard.test.tsx — os cinco campos do perfil organizacional
// (setor, colaboradores, postura, retenção, residência) vivem em useState com
// um único "Salvar" no fim. Trocar para "Papéis e permissões" desmontava a aba
// e apagava os cinco sem avisar.
//
// Molde: settings-screen.test.tsx. Mutação de referência: tirar o
// `guardUnsaved(...)` do onChange dos Tabs → o primeiro teste daqui falha.

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: toastMocks }));

const getSettingsMock = vi.hoisted(() => vi.fn());
const updateWorkspaceMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/(charter)/actions/settings", () => ({
  getSettings: (...a: unknown[]) => getSettingsMock(...a),
  setMemberCharterRole: vi.fn(),
  setNotificationTrigger: vi.fn(),
  updateWorkspace: (...a: unknown[]) => updateWorkspaceMock(...a),
}));

import SettingsScreen from "../../components/charter/screens/settings";

const SETOR_DO_SERVIDOR = "Healthtech";

function baseSettings() {
  return {
    ok: true as const,
    data: {
      workspace: {
        name: "Aurora Bank",
        slug: "aurora",
        industry: SETOR_DO_SERVIDOR,
        geo: "BR",
        posture: "MODERATE",
        employees: 120,
        logRetentionDays: 365,
      },
      roles: [
        { id: "COMPLIANCE", label: "Compliance" },
        { id: "LEGAL", label: "Legal" },
        { id: "SECURITY", label: "Segurança" },
        { id: "HR", label: "People Ops" },
        { id: "REQUESTER", label: "Requester" },
        { id: "EXEC", label: "Executivo" },
        { id: "AUDITOR", label: "Auditor" },
      ],
      permissions: [],
      activeRole: "COMPLIANCE",
      activeUserId: "cuser0000000000000000001",
      notifications: [],
      members: [],
      unassignedMembers: [],
    },
  };
}

function campoSetor(): HTMLInputElement {
  return screen.getByPlaceholderText(
    "Healthtech · Pagamentos"
  ) as HTMLInputElement;
}

async function renderNaAbaWorkspace(): Promise<HTMLInputElement> {
  render(<SettingsScreen />);
  await screen.findByText("Perfil organizacional");
  return campoSetor();
}

describe("SettingsScreen — perfil do workspace não some ao trocar de aba", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    updateWorkspaceMock.mockReset();
    toastMocks.loading.mockReset();
    toastMocks.success.mockReset();
    toastMocks.error.mockReset();
    toastMocks.loading.mockReturnValue("toast-1");
    window.localStorage.clear();
    getSettingsMock.mockResolvedValue(baseSettings());
  });

  it("com campo alterado, trocar de aba não troca e abre a confirmação", async () => {
    const setor = await renderNaAbaWorkspace();
    fireEvent.change(setor, { target: { value: "Pagamentos" } });

    fireEvent.click(screen.getByText("Papéis e permissões"));

    expect(await screen.findByText("Descartar alterações?")).toBeTruthy();
    // Continua na aba Workspace, com o que foi digitado.
    expect(campoSetor().value).toBe("Pagamentos");
  });

  it("confirmar troca de aba e descarta os campos digitados", async () => {
    const setor = await renderNaAbaWorkspace();
    fireEvent.change(setor, { target: { value: "Pagamentos" } });
    fireEvent.click(screen.getByText("Papéis e permissões"));
    await screen.findByText("Descartar alterações?");

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() =>
      expect(screen.getByText("Matriz de permissões")).toBeTruthy()
    );
    // Voltar para Workspace mostra o valor do servidor, não o rascunho morto.
    fireEvent.click(screen.getByText("Workspace"));
    await screen.findByText("Perfil organizacional");
    expect(campoSetor().value).toBe(SETOR_DO_SERVIDOR);
  });

  it("cancelar mantém a aba e o que foi digitado", async () => {
    const setor = await renderNaAbaWorkspace();
    fireEvent.change(setor, { target: { value: "Pagamentos" } });
    fireEvent.click(screen.getByText("Papéis e permissões"));
    const dialogo = await screen.findByRole("dialog");

    fireEvent.click(within(dialogo).getByText("Cancelar"));

    await waitFor(() =>
      expect(screen.queryByText("Descartar alterações?")).toBeNull()
    );
    expect(screen.getByText("Perfil organizacional")).toBeTruthy();
    expect(campoSetor().value).toBe("Pagamentos");
  });

  it("digitar e desfazer não pergunta — sujo é divergir do servidor", async () => {
    const setor = await renderNaAbaWorkspace();
    fireEvent.change(setor, { target: { value: "rabisco" } });
    fireEvent.change(setor, { target: { value: SETOR_DO_SERVIDOR } });

    fireEvent.click(screen.getByText("Papéis e permissões"));

    await waitFor(() =>
      expect(screen.getByText("Matriz de permissões")).toBeTruthy()
    );
    expect(screen.queryByText("Descartar alterações?")).toBeNull();
  });

  it("sem tocar em nada, trocar de aba vai direto", async () => {
    await renderNaAbaWorkspace();

    fireEvent.click(screen.getByText("Papéis e permissões"));

    await waitFor(() =>
      expect(screen.getByText("Matriz de permissões")).toBeTruthy()
    );
    expect(screen.queryByText("Descartar alterações?")).toBeNull();
  });
});
