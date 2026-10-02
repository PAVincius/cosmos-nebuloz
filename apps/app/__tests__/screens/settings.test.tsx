// settings.test.tsx — tab-shell coverage: all 7 tabs render, switching tabs
// works, and each tab shows real data and gates its edit controls by the
// role the action layer returned (not a client-only guess). Billing never
// renders invoices/seats/card — only the real plan tier plus "Em breve".
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getWorkspaceTabMock = vi.fn();
const updateWorkspaceInfoMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings", () => ({
  getWorkspaceTab: (...args: unknown[]) => getWorkspaceTabMock(...args),
  updateWorkspaceInfo: (...args: unknown[]) => updateWorkspaceInfoMock(...args),
}));

const getSafeConfigTabMock = vi.fn();
const saveArtCadenceActionMock = vi.fn();
const saveWsjfSettingsActionMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings-safe", () => ({
  getSafeConfigTab: (...args: unknown[]) => getSafeConfigTabMock(...args),
  saveArtCadenceAction: (...args: unknown[]) =>
    saveArtCadenceActionMock(...args),
  saveWsjfSettingsAction: (...args: unknown[]) =>
    saveWsjfSettingsActionMock(...args),
}));

const getMembersTabMock = vi.fn();
const inviteMemberActionMock = vi.fn();
const updateMemberRoleActionMock = vi.fn();
const removeMemberActionMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings-members", () => ({
  getMembersTab: (...args: unknown[]) => getMembersTabMock(...args),
  inviteMemberAction: (...args: unknown[]) => inviteMemberActionMock(...args),
  updateMemberRoleAction: (...args: unknown[]) =>
    updateMemberRoleActionMock(...args),
  removeMemberAction: (...args: unknown[]) => removeMemberActionMock(...args),
}));

const getAuditTabMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings-audit", () => ({
  getAuditTab: (...args: unknown[]) => getAuditTabMock(...args),
}));

const getSecurityTabMock = vi.fn();
const toggleSsoEnabledMock = vi.fn();
const saveSecurityPolicyActionMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings-security", () => ({
  getSecurityTab: (...args: unknown[]) => getSecurityTabMock(...args),
  toggleSsoEnabled: (...args: unknown[]) => toggleSsoEnabledMock(...args),
  saveSecurityPolicyAction: (...args: unknown[]) =>
    saveSecurityPolicyActionMock(...args),
}));

const getNotificationsTabMock = vi.fn();
const updateNotificationsActionMock = vi.fn();
vi.mock("@/app/(cosmos)/actions/settings-notifications", () => ({
  getNotificationsTab: (...args: unknown[]) => getNotificationsTabMock(...args),
  updateNotificationsAction: (...args: unknown[]) =>
    updateNotificationsActionMock(...args),
}));

import SettingsScreen from "../../components/cosmos/screens/settings";

const WORKSPACE_DATA = {
  tenant: {
    id: "t1",
    name: "Acme",
    slug: "acme",
    logo: null,
    plan: "ORBIT",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  membersCount: 3,
  currentUserRole: "MEMBER",
};

const SAFE_DATA = {
  arts: [
    {
      id: "art-1",
      name: "ART Nebulosa",
      status: "ACTIVE",
      piCadenceWeeks: 10,
      sprintLengthWeeks: 2,
      ipSprintEnabled: true,
    },
  ],
  wsjf: null,
  currentUserRole: "MEMBER",
};

const MEMBERS_DATA = {
  members: [
    {
      userId: "u1",
      name: "Marina Alves",
      email: "marina@cosmos.local",
      image: null,
      role: "ADMIN",
    },
    {
      userId: "u2",
      name: "Bruno Silva",
      email: "bruno@cosmos.local",
      image: null,
      role: "PO",
    },
  ],
  currentUserRole: "MEMBER",
  currentUserId: "u2",
};

const AUDIT_DATA = {
  items: [
    {
      id: "log-1",
      actorName: "Marina Alves",
      action: "created",
      entityType: "Epic",
      entityId: "epic-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  page: 1,
  hasNext: false,
  hasPrev: false,
};

describe("SettingsScreen", () => {
  it("renders the tab shell with all 7 tabs for an ADMIN, Workspace tab active by default", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: { ...WORKSPACE_DATA, currentUserRole: "ADMIN" },
    });
    render(<SettingsScreen />);

    expect(screen.getByText("Settings")).toBeTruthy();
    // ADMIN renders the tenant name inside an editable input (see the
    // "shows editable fields..." test below) — wait on its value, not text.
    //
    // Timeout explícito porque este é o PRIMEIRO teste do arquivo e paga
    // sozinho a inicialização do módulo: aqui ele leva ~1,5s, e o padrão de
    // `findBy*` é 1s. Verde em máquina de dev, vermelho no CI de 4 cores — foi
    // assim que derrubou o deploy do merge #56. Não é o elemento faltando: o
    // teste "shows editable fields and a save control for an ADMIN" assere o
    // mesmo input em ~160ms com o módulo já quente. Aumentar o orçamento não
    // esconde defeito — se o input nunca renderizar, isto continua falhando.
    expect(
      await screen.findByDisplayValue("Acme", undefined, { timeout: 5000 })
    ).toBeTruthy();
    for (const label of [
      "Workspace",
      "Membros",
      "Segurança",
      "Auditoria",
      "Notificações",
      "SAFe",
      "Faturamento",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("hides the Auditoria and Segurança tab buttons for a non-ADMIN — both actions are now admin-gated server-side too", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: WORKSPACE_DATA, // currentUserRole: "MEMBER"
    });
    render(<SettingsScreen />);

    expect(await screen.findByText("Acme")).toBeTruthy();
    for (const label of [
      "Workspace",
      "Membros",
      "Notificações",
      "SAFe",
      "Faturamento",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Segurança" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Auditoria" })).toBeNull();
  });

  it("renders Workspace fields read-only for a non-ADMIN role", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: WORKSPACE_DATA,
    });
    render(<SettingsScreen />);

    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(screen.getByText("Somente leitura")).toBeTruthy();
    expect(screen.queryByLabelText("Nome")).toBeNull();
  });

  it("shows editable fields and a save control for an ADMIN", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: { ...WORKSPACE_DATA, currentUserRole: "ADMIN" },
    });
    render(<SettingsScreen />);

    expect(await screen.findByText("Editável (ADMIN)")).toBeTruthy();
    expect(screen.getByLabelText("Nome")).toBeTruthy();
  });

  it("switches to the SAFe tab and renders real ART cadence read-only for a non-privileged role", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: WORKSPACE_DATA,
    });
    getSafeConfigTabMock.mockResolvedValueOnce({ ok: true, data: SAFE_DATA });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "SAFe" }));

    expect(await screen.findByText("ART Nebulosa")).toBeTruthy();
    // MEMBER can't edit cadence — no numeric input, no "Salvar" button on the row.
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("shows the error state when the workspace action fails", async () => {
    getWorkspaceTabMock.mockResolvedValue({ ok: false, error: "boom" });
    render(<SettingsScreen />);

    expect(
      await screen.findByText("Não foi possível carregar os dados.")
    ).toBeTruthy();
  });

  it("switches to the Membros tab and shows the real member list without invite/remove controls for a non-ADMIN", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: WORKSPACE_DATA,
    });
    getMembersTabMock.mockResolvedValueOnce({ ok: true, data: MEMBERS_DATA });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Membros" }));

    expect(await screen.findByText("Marina Alves")).toBeTruthy();
    expect(screen.getByText("Bruno Silva")).toBeTruthy();
    expect(screen.queryByText("Convidar")).toBeNull();
    expect(screen.queryByText("Remover")).toBeNull();
  });

  it("shows invite/remove controls on the Membros tab for an ADMIN", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: WORKSPACE_DATA,
    });
    getMembersTabMock.mockResolvedValueOnce({
      ok: true,
      data: { ...MEMBERS_DATA, currentUserRole: "ADMIN", currentUserId: "u1" },
    });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Membros" }));

    expect(await screen.findByText("Convidar")).toBeTruthy();
    // Self (u1) has no Remover button; the other member does.
    expect(screen.getAllByText("Remover")).toHaveLength(1);
  });

  it("switches to the Auditoria tab and renders real, tenant-scoped log entries", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: { ...WORKSPACE_DATA, currentUserRole: "ADMIN" }, // Auditoria is admin-only
    });
    getAuditTabMock.mockResolvedValueOnce({ ok: true, data: AUDIT_DATA });
    render(<SettingsScreen />);

    // ADMIN renders the tenant name inside an editable input, not as text.
    await screen.findByDisplayValue("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Auditoria" }));

    expect(await screen.findByText("Marina Alves")).toBeTruthy();
    expect(screen.getByText("created")).toBeTruthy();
    expect(screen.getByText(/Epic · epic-1/)).toBeTruthy();
    expect(screen.getByText("Exportar CSV")).toBeTruthy();
  });

  it("shows an honest empty state on the Auditoria tab with zero entries", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: { ...WORKSPACE_DATA, currentUserRole: "ADMIN" }, // Auditoria is admin-only
    });
    getAuditTabMock.mockResolvedValueOnce({
      ok: true,
      data: { items: [], page: 1, hasNext: false, hasPrev: false },
    });
    render(<SettingsScreen />);

    // ADMIN renders the tenant name inside an editable input, not as text.
    await screen.findByDisplayValue("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Auditoria" }));

    expect(
      await screen.findByText("Nenhum evento de auditoria registrado ainda.")
    ).toBeTruthy();
    expect(screen.queryByText("Exportar CSV")).toBeNull();
  });

  it("switches to the Segurança tab and shows SSO status without any cert/metadata content, read-only for non-ADMIN", async () => {
    // Segurança is admin-gated at the shell too — reaching the tab requires
    // an ADMIN session. This test then exercises the tab's own independent
    // read-only rendering (defense in depth) for a currentUserRole that
    // getSecurityTab itself reports as non-ADMIN.
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: { ...WORKSPACE_DATA, currentUserRole: "ADMIN" },
    });
    getSecurityTabMock.mockResolvedValueOnce({
      ok: true,
      data: {
        ssoEnabled: true,
        ssoUpdatedAt: "2026-01-01T00:00:00.000Z",
        ssoConfigured: true,
        securityPolicy: {
          require2FA: true,
          gracePeriodDays: 14,
          allowedIpRanges: ["10.0.0.0/8"],
        },
        currentUserRole: "MEMBER",
      },
    });
    render(<SettingsScreen />);

    // ADMIN renders the tenant name inside an editable input, not as text.
    await screen.findByDisplayValue("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Segurança" }));

    expect(await screen.findByText("SSO ativo")).toBeTruthy();
    // No secret-shaped content ever rendered on this tab.
    expect(
      screen.queryByText(/certificate|metadataUrl|idpEntityId/i)
    ).toBeNull();
    // Non-ADMIN: no switch role/checkbox controls for SSO or the policy.
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.getByText("2FA obrigatório")).toBeTruthy();
  });

  it("shows SSO and security-policy edit controls on the Segurança tab for an ADMIN", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: { ...WORKSPACE_DATA, currentUserRole: "ADMIN" },
    });
    getSecurityTabMock.mockResolvedValueOnce({
      ok: true,
      data: {
        ssoEnabled: false,
        ssoConfigured: true,
        ssoUpdatedAt: null,
        securityPolicy: null,
        currentUserRole: "ADMIN",
      },
    });
    render(<SettingsScreen />);

    // ADMIN renders the tenant name inside an editable input, not as text.
    await screen.findByDisplayValue("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Segurança" }));

    await screen.findByText("SSO desativado");
    expect(screen.getAllByRole("switch").length).toBeGreaterThan(0);
  });

  it("não oferece o botão de ativar SSO quando não há IdP configurado, e diz por quê (AC-002)", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: { ...WORKSPACE_DATA, currentUserRole: "ADMIN" },
    });
    getSecurityTabMock.mockResolvedValueOnce({
      ok: true,
      data: {
        ssoEnabled: false,
        ssoConfigured: false,
        ssoUpdatedAt: null,
        securityPolicy: null,
        currentUserRole: "ADMIN",
      },
    });
    render(<SettingsScreen />);

    await screen.findByDisplayValue("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Segurança" }));

    expect(await screen.findByText("IdP não configurado")).toBeTruthy();
    expect(
      screen.getByText(
        /Configure o provedor de identidade antes de ativar o SSO/
      )
    ).toBeTruthy();
    // o único switch restante é o de 2FA da política — o de SSO não é
    // renderizado, porque o servidor recusaria a ativação de qualquer forma
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  it("switches to the Notificações tab and shows real, self-scoped preferences", async () => {
    getWorkspaceTabMock.mockResolvedValue({
      ok: true,
      data: WORKSPACE_DATA,
    });
    getNotificationsTabMock.mockResolvedValueOnce({
      ok: true,
      data: {
        pi_planning: true,
        risk_alerts: false,
        feature_updates: true,
        team_changes: false,
        weekly_digest: true,
      },
    });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Notificações" }));

    expect(await screen.findByText("Eventos de PI Planning")).toBeTruthy();
    expect(screen.getByText("Alertas de risco")).toBeTruthy();
    expect(screen.getAllByRole("switch")).toHaveLength(5);
  });

  it("switches to the Faturamento tab and shows only the real plan tier plus an honest 'Em breve' — never invoices/seats/card", async () => {
    // Called by the shell (tab gating), the default Workspace tab, and
    // Billing's own fetch — same data serves all three call sites.
    getWorkspaceTabMock.mockResolvedValue({ ok: true, data: WORKSPACE_DATA });
    render(<SettingsScreen />);

    await screen.findByText("Acme");
    fireEvent.click(screen.getByRole("button", { name: "Faturamento" }));

    expect(await screen.findByText("ORBIT")).toBeTruthy();
    expect(screen.getByText("Em breve")).toBeTruthy();
    // No fabricated monetary amount, invoice, or card content — only the
    // real plan tier and the honest disclaimer prose.
    expect(
      screen.queryByText(/R\$|cartão de crédito|\d+ assentos/i)
    ).toBeNull();
    // A saída honesta para quem quer mudar de plano é falar com gente, não um
    // formulário de cobrança que não existe (AC-006). O endereço é o mesmo já
    // usado pelo template de convite do repo — nenhum contato é inventado.
    expect(
      screen.getByRole("link", { name: "suporte@nebuloz.ai" })
    ).toBeTruthy();
  });
});
