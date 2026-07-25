"use client";

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
import { Badge, PageHeader, Tabs } from "../kit";
import { ModalProvider } from "../modal";
import SettingsSafeTab from "./settings-safe-tab";
import { PlaceholderTab } from "./settings-shared";
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

function SettingsBody() {
  const [active, setActive] = useState("workspace");

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={<Badge tone="accent">7 abas</Badge>}
        subtitle="Workspace, membros, segurança, auditoria, notificações, SAFe e faturamento."
        title="Settings"
      />
      <Tabs active={active} onChange={setActive} tabs={TABS} />

      {active === "workspace" && <SettingsWorkspaceTab />}
      {active === "members" && (
        <PlaceholderTab
          icon="users"
          note="Aba de membros e RBAC ainda não wireada nesta versão."
          title="Membros"
        />
      )}
      {active === "security" && (
        <PlaceholderTab
          icon="shield"
          note="Aba de segurança/SSO ainda não wireada nesta versão."
          title="Segurança"
        />
      )}
      {active === "audit" && (
        <PlaceholderTab
          icon="book"
          note="Aba de log de auditoria ainda não wireada nesta versão."
          title="Auditoria"
        />
      )}
      {active === "notifications" && (
        <PlaceholderTab
          icon="bell"
          note="Aba de notificações ainda não wireada nesta versão."
          title="Notificações"
        />
      )}
      {active === "safe" && <SettingsSafeTab />}
      {active === "billing" && (
        <PlaceholderTab
          icon="wallet"
          note="Aba de faturamento ainda não wireada nesta versão."
          title="Faturamento"
        />
      )}
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
