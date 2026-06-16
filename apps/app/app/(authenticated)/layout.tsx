import {
  AuthError,
  auth,
  currentUser,
  redirectToSignIn,
} from "@repo/auth/server";
import { database } from "@repo/database";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { showBetaFeature } from "@repo/feature-flags";
import { secure } from "@repo/security";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isOnboardingComplete } from "@/app/actions/onboarding/index";
import { env } from "@/env";
import { CommandPalette } from "./components/command-palette";
import { CopilotProvider } from "./components/copilot/copilot-provider";
import { KeyboardProvider } from "./components/keyboard-provider";
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
    getTeams()
      .then((list) => list.map((t) => ({ id: t.id, name: t.name })))
      .catch((err) => {
        if (err instanceof AuthError && err.code === "NO_ACTIVE_ORGANIZATION") {
          return [];
        }
        throw err;
      }),
    auth.api.getSession({ headers: await headers() }),
    database.tenantMember.findMany({
      where: { userId: user.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true, logo: true } },
      },
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
    (session?.session as unknown as { activeTenantId?: string })
      ?.activeTenantId ?? null;

  const activeMembership =
    memberships.find((m) => m.tenant.id === initialActiveTenantId) ??
    memberships[0];
  const memberRole = activeMembership?.role ?? "MEMBER";

  // Auto-redirect new tenants to onboarding if company_setup is not complete
  const pathname = (await headers()).get("x-pathname") ?? "";
  const skipOnboarding = [
    "/onboarding",
    "/settings",
    "/api",
    "/auth",
    "/profile",
  ].some((p) => pathname.startsWith(p));

  if (!skipOnboarding) {
    // cookieCache (Better Auth) may be stale: DB-only session updates
    // (e.g. createOnboardingWorkspace) don't invalidate the cookie.
    // Fall back to the first membership fetched above — zero extra DB query.
    const effectiveTenantId =
      initialActiveTenantId ?? memberships[0]?.tenant.id ?? null;

    if (effectiveTenantId) {
      const complete = await isOnboardingComplete(effectiveTenantId);
      if (!complete) {
        redirect("/onboarding");
      }
    } else {
      redirect("/onboarding");
    }
  }

  const cookieStore = await cookies();
  const defaultSidebarOpen =
    cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <NotificationsProvider userId={user.id}>
      <SidebarProvider defaultOpen={defaultSidebarOpen}>
        <CopilotProvider role={memberRole}>
          <GlobalSidebar
            initialActiveTenantId={initialActiveTenantId}
            initialTenants={initialTenants}
            role={memberRole}
            teams={teams}
            user={{
              name: user.name ?? user.email,
              email: user.email,
              avatar: user.image ?? "",
            }}
          >
            <CommandPalette />
            <KeyboardProvider />
            {!!betaFeature && (
              <div className="m-4 rounded-full bg-blue-500 p-1.5 text-center text-sm text-white">
                Beta feature now available
              </div>
            )}
            {children}
          </GlobalSidebar>
        </CopilotProvider>
      </SidebarProvider>
    </NotificationsProvider>
  );
};

export default AppLayout;
