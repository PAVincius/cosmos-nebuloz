import { Badge } from "@repo/design-system/components/ui/badge";
import { ShieldIcon, UserIcon } from "lucide-react";
import { appDesign } from "@/lib/app-design";
import {
  getMyProfile,
  getNotificationPreferences,
} from "../../actions/users/profile";
import { PageHeader } from "../components/page-header";
import { NotificationPreferencesForm } from "./components/notification-preferences-form";
import { ProfileForm } from "./components/profile-form";

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
    <div className={appDesign.shell}>
      <PageHeader
        subtitle="Gerencie suas informações e preferências de notificação"
        title="Meu Perfil"
      />
      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        {/* Avatar + Info */}
        <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
          <div className="border-hairline border-b bg-surface-2 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-sm">
              <UserIcon className="size-4 text-primary" />
              Identificação
            </h2>
          </div>
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/20 font-semibold text-primary text-xl">
              {user.image ? (
                <img className="size-full object-cover" src={user.image} />
              ) : (
                initials
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-lg">{user.name ?? "Sem nome"}</p>
              <p className="text-muted-foreground text-sm">{user.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge className="gap-1" variant="secondary">
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
          </div>
        </div>

        <ProfileForm image={user.image} name={user.name} />

        {/* Email (readonly) */}
        <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
          <div className="border-hairline border-b bg-surface-2 px-5 py-4">
            <h2 className="font-semibold text-sm">Email</h2>
            <p className="mt-0.5 text-muted-foreground text-xs">
              O email não pode ser alterado diretamente. Entre em contato com o
              suporte se necessário.
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="rounded-md bg-muted px-3 py-2 font-mono text-muted-foreground text-sm">
              {user.email}
            </p>
          </div>
        </div>

        <NotificationPreferencesForm initialPrefs={notifPrefs} />
      </div>
    </div>
  );
}
