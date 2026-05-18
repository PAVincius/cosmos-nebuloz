import { getWorkspaceSettings } from "../../../actions/settings/workspace";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
import { WorkspaceForm } from "./components/workspace-form";
import { MembersTable } from "./components/members-table";
import { InviteForm } from "./components/invite-form";
import { AlertTriangleIcon, CrownIcon } from "lucide-react";
import { appDesign } from "@/lib/app-design";

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
    <div className={`${appDesign.shell} gap-6 p-6`}>
      <header>
        <h1 className={appDesign.pageTitle}>Workspace</h1>
        <p className={appDesign.pageSubtitle}>
          Gerencie as configurações gerais, membros e convites
        </p>
        <div className={appDesign.accentBar} aria-hidden />
      </header>

      {/* Workspace Settings Form */}
      <WorkspaceForm
        name={tenant.name}
        slug={tenant.slug}
        logo={tenant.logo}
        isAdmin={isAdmin}
      />

      <Separator />

      {/* Members Table */}
      <MembersTable
        members={members}
        isAdmin={isAdmin}
        currentUserId={ctx.userId}
      />

      {/* Invite Form (admin only) */}
      {isAdmin && (
        <InviteForm pendingInvitations={invitations} />
      )}

      <Separator />

      {/* Danger Zone / Plan Info */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangleIcon className="size-4" />
            Informações do Plano
          </CardTitle>
          <CardDescription>
            Seu plano atual e limites do workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CrownIcon className="size-4 text-amber-500" />
              <span className="font-medium">Plano {PLAN_LABELS[tenant.plan] ?? tenant.plan}</span>
            </div>
            <Badge>{tenant.plan}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {PLAN_DESCRIPTIONS[tenant.plan] ?? ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Membros atuais: <span className="font-medium text-foreground">{membersCount}</span>
          </p>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">
              Apenas administradores podem alterar o plano.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
