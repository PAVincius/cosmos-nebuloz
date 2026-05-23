"use server";

import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function createOnboardingWorkspace(name: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }

  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error("Nome muito curto.");
  }

  const baseSlug = slugify(trimmed);
  let slug = baseSlug;
  let attempt = 0;

  while (attempt < 10) {
    const exists = await database.tenant.findUnique({ where: { slug } });
    if (!exists) {
      break;
    }
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  const tenant = await database.tenant.create({
    data: {
      name: trimmed,
      slug,
      members: {
        create: {
          userId: session.user.id,
          role: "ADMIN",
        },
      },
    },
  });

  await database.session.updateMany({
    where: { userId: session.user.id },
    data: { activeTenantId: tenant.id },
  });

  await database.onboardingProgress.upsert({
    where: {
      tenantId_flowType: { tenantId: tenant.id, flowType: "company_setup" },
    },
    create: {
      tenantId: tenant.id,
      flowType: "company_setup",
      status: "completed",
      completedSteps: [],
    },
    update: { status: "completed" },
  });

  return { tenantId: tenant.id, slug: tenant.slug };
}
