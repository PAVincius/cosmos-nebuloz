"use client";

import {
  Badge,
  PageHeader,
  Tabs,
  useAction,
} from "@repo/design-system/cosmos/kit";
// settings.tsx — Settings tab shell (RF-84..RF-87). Was a SHELL screen (1 of
// 7 tabs, no tab shell at all — a flat "Users & Roles" list). This is the
// tab shell plus all 7 tabs, each wired to the mature action layer
// (apps/app/app/actions/*) via thin (cosmos)/actions/settings*.ts adapters:
//   1. Workspace       — settings-workspace-tab.tsx (real, ADMIN-editable)
//   2. Membros / RBAC  — settings-members-tab.tsx (real, ADMIN-editable)
//   3. Segurança / SSO — settings-security-tab.tsx (real; SSO status
//                        read-only by design, security policy ADMIN-editable)
//   4. Auditoria       — settings-audit-tab.tsx (real, tenant-scoped, capped)
//   5. Notificações    — settings-notifications-tab.tsx (real, self-scoped)
//   6. Configuração SAFe — settings-safe-tab.tsx (real, ADMIN/RTE-editable)
//   7. Plano & faturamento — honest "Em breve": no payment-provider
//      integration exists, so no invoices/seats/card are rendered — only
//      the real Tenant.plan tier, read-only.
// Tabs are client-side state, not routes, per the parity spec.
import { useState } from "react";
import { getWorkspaceTab } from "@/app/(cosmos)/actions/settings";
import { ModalProvider } from "../modal";
import SettingsAuditTab from "./settings-audit-tab";
import SettingsBillingTab from "./settings-billing-tab";
import SettingsMembersTab from "./settings-members-tab";
import SettingsNotificationsTab from "./settings-notifications-tab";
import SettingsSafeTab from "./settings-safe-tab";
import SettingsSecurityTab from "./settings-security-tab";
import SettingsWorkspaceTab from "./settings-workspace-tab";

const TABS = [
  { id: "workspace", label: "Workspace" },
  { id: "members", label: "Membros" },
  { id: "security", label: "Segurança" },
  { id: "audit", label: "Auditoria" },
  { id: "notifications", label: "Notificações" },
  { id: "safe", label: "SAFe" },
  { id: "billing", label: "Faturamento" },
];

// Auditoria (full admin audit trail) and Segurança (2FA/grace/IP posture)
// expose admin-only information — getAuditTab/getSecurityTab now enforce
// this server-side (requireRole ADMIN); hide the tab buttons too so a
// non-ADMIN never sees controls that only bounce off a 403.
const ADMIN_ONLY_TAB_IDS = new Set(["security", "audit"]);

function SettingsBody() {
  const [active, setActive] = useState("workspace");
  const { data } = useAction(getWorkspaceTab);
  const isAdmin = data?.currentUserRole === "ADMIN";
  const tabs = TABS.filter((t) => isAdmin || !ADMIN_ONLY_TAB_IDS.has(t.id));

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={<Badge tone="accent">{tabs.length} abas</Badge>}
        subtitle="Workspace, membros, segurança, auditoria, notificações, SAFe e faturamento."
        title="Settings"
      />
      <Tabs active={active} onChange={setActive} tabs={tabs} />

      {active === "workspace" && <SettingsWorkspaceTab />}
      {active === "members" && <SettingsMembersTab />}
      {active === "security" && isAdmin && <SettingsSecurityTab />}
      {active === "audit" && isAdmin && <SettingsAuditTab />}
      {active === "notifications" && <SettingsNotificationsTab />}
      {active === "safe" && <SettingsSafeTab />}
      {active === "billing" && <SettingsBillingTab />}
    </div>
  );
}

export default function SettingsScreen() {
  return (
    <ModalProvider>
      <SettingsBody />
    </ModalProvider>
  );
}
