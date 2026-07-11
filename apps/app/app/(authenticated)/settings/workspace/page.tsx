import { requireTenantSession } from "@repo/auth/server";
import { Badge } from "@repo/design-system/components/cosmos/badge";
import { LockIcon, UsersIcon } from "lucide-react";
import { headers } from "next/headers";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { appDesign } from "@/lib/app-design";
import { getWorkspaceSettings } from "../../../actions/settings/workspace";
import { IdentityCard } from "./components/identity-card";
import { MembersPreviewCard } from "./components/members-preview-card";
import { NotificationsCard } from "./components/notifications-card";
import { PlanCard } from "./components/plan-card";
import { PLAN_LABELS } from "./components/plan-labels";
import { SettingsNav } from "./components/settings-nav";

export const metadata = {
  title: "Workspace | Configurações | COSMOS",
  description: "Configurações do workspace, membros e convites",
};

export default async function WorkspaceSettingsPage() {
  await requireTenantSession(await headers());
  const { tenant, membersCount, members, invitations, currentUserRole } =
    await getWorkspaceSettings();

  const isAdmin = currentUserRole === "ADMIN";
  const planLabel = PLAN_LABELS[tenant.plan] ?? tenant.plan;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        badge={
          <>
            <Badge tone="accent">{tenant.name}</Badge>
            <Badge tone="neutral">Plano {planLabel}</Badge>
            <RelationChip
              eyebrow="Papéis"
              href="/settings/members"
              icon={<UsersIcon />}
              label="Membros"
              tone="accent"
            />
            <RelationChip
              eyebrow="Acesso"
              href="/settings/sso"
              icon={<LockIcon />}
              label="Segurança & SSO"
              tone="neutral"
            />
          </>
        }
        subtitle={`Configurações do workspace ${tenant.name} — membros, plano, segurança e a parametrização do framework SAFe.`}
        title="Settings"
      />

      <div
        className={appDesign.bodyScroll}
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <SettingsNav />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <IdentityCard
            createdAt={tenant.createdAt}
            isAdmin={isAdmin}
            logo={tenant.logo}
            membersCount={membersCount}
            name={tenant.name}
            plan={tenant.plan}
            slug={tenant.slug}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.3fr 1fr",
              gap: 24,
              alignItems: "start",
            }}
          >
            <MembersPreviewCard
              invitations={invitations}
              isAdmin={isAdmin}
              members={members}
              membersCount={membersCount}
            />
            <div id="notificacoes">
              <NotificationsCard />
            </div>
          </div>

          <div id="plano">
            <PlanCard
              isAdmin={isAdmin}
              membersCount={membersCount}
              plan={tenant.plan}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
