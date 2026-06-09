import { requireTenantSession } from "@repo/auth/server";
import { Badge } from "@repo/design-system/components/ui/badge";
import { AlertTriangleIcon, CrownIcon } from "lucide-react";
import { headers } from "next/headers";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { getWorkspaceSettings } from "../../../actions/settings/workspace";
import { InviteForm } from "./components/invite-form";
import { MembersTable } from "./components/members-table";
import { WorkspaceForm } from "./components/workspace-form";

export const metadata = {
  title: "Workspace | Configurações | COSMOS",
  description: "Configurações do workspace, membros e convites",
};

const PLAN_LABELS: Record<string, string> = {
  ORBIT: "Orbit",
  GALAXY: "Galaxy",
  NEBULA: "Nebula",
  UNIVERSE: "Universe",
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  ORBIT: "Plano inicial — até 5 membros, 3 ARTs",
  GALAXY: "Plano intermediário — até 25 membros, 10 ARTs",
  NEBULA: "Plano avançado — até 100 membros, ARTs ilimitados",
  UNIVERSE: "Plano enterprise — ilimitado, SLA dedicado",
};

export default async function WorkspaceSettingsPage() {
  const ctx = await requireTenantSession(await headers());
  const { tenant, membersCount, members, invitations, currentUserRole } =
    await getWorkspaceSettings();

  const isAdmin = currentUserRole === "ADMIN";

  return (
    <div className={appDesign.shell}>
      <PageHeader
        subtitle="Gerencie as configurações gerais, membros e convites"
        title="Workspace"
      />

      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        {/* Workspace Settings Form */}
        <WorkspaceForm
          isAdmin={isAdmin}
          logo={tenant.logo}
          name={tenant.name}
          slug={tenant.slug}
        />

        {/* Members Table */}
        <MembersTable
          currentUserId={ctx.userId}
          isAdmin={isAdmin}
          members={members}
        />

        {/* Invite Form (admin only) */}
        {isAdmin && <InviteForm pendingInvitations={invitations} />}

        {/* Plan Info */}
        <div className="rounded-xl border border-amber-400/30 bg-surface shadow-[var(--card-shadow)]">
          <div className="border-amber-400/20 border-b bg-surface-2 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-amber-500 text-sm tracking-tight dark:text-amber-400">
              <AlertTriangleIcon className="size-4" />
              Informações do Plano
            </h2>
            <p className="mt-1 text-muted-foreground text-xs">
              Seu plano atual e limites do workspace.
            </p>
          </div>
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CrownIcon className="size-4 text-amber-500" />
                <span className="font-medium">
                  Plano {PLAN_LABELS[tenant.plan] ?? tenant.plan}
                </span>
              </div>
              <Badge>{tenant.plan}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {PLAN_DESCRIPTIONS[tenant.plan] ?? ""}
            </p>
            <p className="text-muted-foreground text-sm">
              Membros atuais:{" "}
              <span className="font-medium text-foreground">
                {membersCount}
              </span>
            </p>
            {!isAdmin && (
              <p className="text-muted-foreground text-xs">
                Apenas administradores podem alterar o plano.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
