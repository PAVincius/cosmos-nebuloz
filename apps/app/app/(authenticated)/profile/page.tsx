import { getMyProfile, getNotificationPreferences } from "../../actions/users/profile";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
import { ProfileForm } from "./components/profile-form";
import { NotificationPreferencesForm } from "./components/notification-preferences-form";
import { UserIcon, ShieldIcon } from "lucide-react";

export const metadata = {
  title: "Meu Perfil | COSMOS",
  description: "Gerencie suas informações pessoais e preferências",
};

const PLAN_LABELS: Record<string, string> = {
  ORBIT: "Orbit",
  GALAXY: "Galaxy",
  NEBULA: "Nebula",
  UNIVERSE: "Universe",
};

const PLAN_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  ORBIT: "outline",
  GALAXY: "secondary",
  NEBULA: "default",
  UNIVERSE: "default",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  STE: "STE",
  RTE: "RTE",
  SM: "Scrum Master",
  PO: "Product Owner",
  DEV: "Desenvolvedor",
  MEMBER: "Membro",
};

export default async function ProfilePage() {
  const [{ user, member, tenant }, notifPrefs] = await Promise.all([
    getMyProfile(),
    getNotificationPreferences(),
  ]);

  const initials = (user.name ?? user.email)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie suas informações e preferências de notificação
        </p>
      </div>

      {/* Avatar + Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="size-4" />
            Identificação
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/20 text-primary text-xl font-semibold shrink-0 overflow-hidden">
            {user.image ? (
              // biome-ignore lint/a11y/useAltText: decorative avatar
              <img src={user.image} className="size-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-lg">{user.name ?? "Sem nome"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="gap-1">
                <ShieldIcon className="size-3" />
                {ROLE_LABELS[member.role] ?? member.role}
              </Badge>
              {tenant && (
                <Badge variant={PLAN_VARIANTS[tenant.plan] ?? "outline"}>
                  Plano {PLAN_LABELS[tenant.plan] ?? tenant.plan}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Edit Form */}
      <ProfileForm name={user.name} image={user.image} />

      <Separator />

      {/* Email (readonly) */}
      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            O email não pode ser alterado diretamente. Entre em contato com o suporte se necessário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm bg-muted px-3 py-2 rounded-md text-muted-foreground font-mono">
            {user.email}
          </p>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <NotificationPreferencesForm initialPrefs={notifPrefs} />
    </div>
  );
}
