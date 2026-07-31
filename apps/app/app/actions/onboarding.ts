"use server";

import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { provisionTenant } from "@repo/provisioning";
import { invalidateModuleCache } from "@repo/rbac";
import { headers } from "next/headers";

const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_NAME_LENGTH = 2;

/** O que um cadastro self-service ganha. TRIAL com prazo, não ACTIVE: quem se
 *  cadastra sozinho não fechou venda. Trocar aqui muda o produto inteiro. */
export const SELF_SERVICE_MODULES = [
  {
    module: "COSMOS" as const,
    status: "TRIAL" as const,
    trialDays: TRIAL_DAYS,
  },
];

export async function createOnboardingWorkspace(name: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }

  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_LENGTH) {
    throw new Error("Nome muito curto.");
  }

  const dbUser = await database.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true },
  });
  if (!dbUser) {
    throw new Error("Usuário não encontrado no banco de dados.");
  }

  // Mesma função que o back-office usa. Uma verdade só sobre como um cliente
  // nasce — antes daqui, tenant self-service nascia sem módulo nenhum.
  const { tenantId, slug } = await provisionTenant(
    database,
    { invalidateModuleCache },
    {
      name: trimmed,
      ownerEmail: dbUser.email,
      modules: SELF_SERVICE_MODULES.map((m) => ({
        module: m.module,
        status: m.status,
        expiresAt: new Date(Date.now() + m.trialDays * DAY_MS),
      })),
      actorUserId: dbUser.id,
      actorName: dbUser.name,
    }
  );

  await database.session.updateMany({
    where: { userId: dbUser.id },
    data: { activeTenantId: tenantId },
  });

  await database.onboardingProgress.upsert({
    where: {
      tenantId_flowType: { tenantId, flowType: "company_setup" },
    },
    create: {
      tenantId,
      flowType: "company_setup",
      status: "completed",
      completedSteps: [],
    },
    update: { status: "completed" },
  });

  return { tenantId, slug };
}
