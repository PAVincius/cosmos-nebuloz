"use server";

import { type ProductModule, withTenantDb } from "@repo/database";
import {
  bootstrapCharter,
  contractModule,
  ProvisioningError,
  platformDb,
  provisionTenant,
  setModuleStatus,
} from "@repo/provisioning";
import { invalidateModuleCache } from "@repo/rbac";
import { revalidatePath } from "next/cache";
import { assertCanWrite, requirePlatformStaff } from "@/lib/guard";
import { assertDentroDoLimite } from "@/lib/rate-limit";
import { type Result, safeAction } from "@/lib/safe-action";

async function tenantIdBySlug(slug: string): Promise<string> {
  const tenant = await platformDb.tenant.findUnique({
    where: { slug },
    select: { id: true, isSystem: true },
  });
  if (!tenant || tenant.isSystem) {
    throw new ProvisioningError(
      "TENANT_NOT_FOUND",
      `Nenhum cliente com o slug ${slug}.`
    );
  }
  return tenant.id;
}

export async function contractModuleAction(input: {
  slug: string;
  module: ProductModule;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED";
}): Promise<Result<null>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const tenantId = await tenantIdBySlug(input.slug);

    await contractModule(
      platformDb,
      { invalidateModuleCache },
      {
        tenantId,
        module: input.module,
        status: input.status,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath(`/clientes/${input.slug}`);
    return null;
  });
}

export async function setModuleStatusAction(input: {
  slug: string;
  module: ProductModule;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELED";
}): Promise<Result<null>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const tenantId = await tenantIdBySlug(input.slug);

    await setModuleStatus(
      platformDb,
      { invalidateModuleCache },
      {
        tenantId,
        module: input.module,
        status: input.status,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath(`/clientes/${input.slug}`);
    return null;
  });
}

export async function bootstrapCharterAction(input: {
  slug: string;
  complianceEmail: string;
}): Promise<Result<{ created: boolean }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    // Cota própria: esta operação cria tenant e roda bootstrap, e o teto de
    // navegação seria teto nenhum para ela.
    await assertDentroDoLimite("provisionamento", staff.userId);

    const tenantId = await tenantIdBySlug(input.slug);

    const result = await bootstrapCharter(
      { withTenantDb },
      {
        tenantId,
        complianceEmail: input.complianceEmail,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath(`/clientes/${input.slug}`);
    return { created: result.created };
  });
}

export async function provisionTenantAction(input: {
  name: string;
  ownerEmail: string;
  modules: {
    module: ProductModule;
    status: "ACTIVE" | "TRIAL";
  }[];
}): Promise<Result<{ slug: string; ownerLinked: boolean }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    // Cota própria: esta operação cria tenant e roda bootstrap, e o teto de
    // navegação seria teto nenhum para ela.
    await assertDentroDoLimite("provisionamento", staff.userId);

    const result = await provisionTenant(
      platformDb,
      { invalidateModuleCache },
      {
        name: input.name,
        ownerEmail: input.ownerEmail,
        modules: input.modules,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath("/");
    return { slug: result.slug, ownerLinked: result.ownerLinked };
  });
}
