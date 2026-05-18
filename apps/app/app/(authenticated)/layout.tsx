import { auth, currentUser, redirectToSignIn } from "@repo/auth/server";
import { database } from "@repo/database";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { showBetaFeature } from "@repo/feature-flags";
import { secure } from "@repo/security";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { isOnboardingComplete } from "@/app/actions/onboarding/index";
import { NotificationsProvider } from "./components/notifications-provider";
import { GlobalSidebar } from "./components/sidebar";
import { getTeams } from "./teams/actions";

type AppLayoutProperties = {
  readonly children: ReactNode;
};

const AppLayout = async ({ children }: AppLayoutProperties) => {
  if (env.ARCJET_KEY) {
    await secure(["CATEGORY:PREVIEW"]);
  }

  const user = await currentUser();
  const betaFeature = await showBetaFeature();

  if (!user) {
    return redirectToSignIn();
  }

  const [teams, session, memberships] = await Promise.all([
    getTeams().then((list) => list.map((t) => ({ id: t.id, name: t.name }))),
    auth.api.getSession({ headers: await headers() }),
    database.tenantMember.findMany({
      where: { userId: user.id },
      include: { tenant: { select: { id: true, name: true, slug: true, logo: true } } },
    }),
  ]);

  const initialTenants = memberships.map((m) => ({
    id: m.tenant.id,
    name: m.tenant.name,
    slug: m.tenant.slug,
    logo: m.tenant.logo,
    role: m.role,
  }));

  const initialActiveTenantId =
    (session?.session as unknown as { activeTenantId?: string })?.activeTenantId ?? null;

  // Auto-redirect new tenants to onboarding if company_setup is not complete
  const pathname = (await headers()).get("x-pathname") ?? "";
  const skipOnboarding = ["/onboarding", "/settings", "/api", "/auth", "/profile"].some(
    (p) => pathname.startsWith(p)
  );

  if (!skipOnboarding) {
    if (initialActiveTenantId) {
      const complete = await isOnboardingComplete(initialActiveTenantId);
      if (!complete) {
        redirect("/onboarding");
      }
    } else if (initialTenants.length > 0) {
      // User has a tenant but no active tenant selected — redirect to onboarding
      // to let them set up the first tenant
      redirect("/onboarding");
    }
  }

  return (
    <NotificationsProvider userId={user.id}>
      <SidebarProvider>
        <GlobalSidebar
          user={{
            name: user.name ?? user.email,
            email: user.email,
            avatar: user.image ?? "",
          }}
          teams={teams}
          initialTenants={initialTenants}
          initialActiveTenantId={initialActiveTenantId}
        >
          {betaFeature && (
            <div className="m-4 rounded-full bg-blue-500 p-1.5 text-center text-sm text-white">
              Beta feature now available
            </div>
          )}
          {children}
        </GlobalSidebar>
      </SidebarProvider>
    </NotificationsProvider>
  );
};

export default AppLayout;
