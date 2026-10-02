"use server";

import { type ProductModule, withTenantDb } from "@repo/database";
import { log } from "@repo/observability/log";
import {
  bootstrapCharter,
  bootstrapMeridian,
  bootstrapScaffold,
  bootstrapSignal,
  contractModule,
  ProvisioningError,
  platformDb,
  provisionTenant,
  setModuleStatus,
} from "@repo/provisioning";
import { invalidateModuleCache, invalidateSignalRoleCache } from "@repo/rbac";
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
}): Promise<Result<{ created: boolean; clausesCreated: number }>> {
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
    return { created: result.created, clausesCreated: result.clausesCreated };
  });
}

export async function bootstrapMeridianAction(input: {
  slug: string;
  consultantEmail: string;
}): Promise<Result<{ created: boolean }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    // Mesma cota do bootstrap do Charter: escreve papel e template, e o teto de
    // navegação seria teto nenhum para ela.
    await assertDentroDoLimite("provisionamento", staff.userId);

    const tenantId = await tenantIdBySlug(input.slug);

    const result = await bootstrapMeridian(
      { withTenantDb },
      {
        tenantId,
        consultantEmail: input.consultantEmail,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath(`/clientes/${input.slug}`);
    return { created: result.created };
  });
}

export async function bootstrapScaffoldAction(input: {
  slug: string;
  adminEmail: string;
}): Promise<Result<{ created: boolean; role: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    // Mesma cota dos bootstraps do Charter e do Meridian: escreve papel e
    // configuração, e o teto de navegação seria teto nenhum para ela.
    await assertDentroDoLimite("provisionamento", staff.userId);

    const tenantId = await tenantIdBySlug(input.slug);

    const result = await bootstrapScaffold(
      { withTenantDb },
      {
        tenantId,
        adminEmail: input.adminEmail,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    revalidatePath(`/clientes/${input.slug}`);
    return { created: result.created, role: result.role };
  });
}

export async function bootstrapSignalAction(input: {
  slug: string;
  adminEmail: string;
}): Promise<Result<{ created: boolean; role: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    // Mesma cota dos outros bootstraps: escreve papel, e o teto de navegação
    // seria teto nenhum para ela.
    await assertDentroDoLimite("provisionamento", staff.userId);

    const tenantId = await tenantIdBySlug(input.slug);

    const result = await bootstrapSignal(
      { withTenantDb },
      {
        tenantId,
        adminEmail: input.adminEmail,
        actorUserId: staff.userId,
        actorName: staff.name,
      }
    );

    // Melhor-esforço, depois do commit: o papel vem de cache (300 s) e "sem
    // papel" também fica lá, então a pessoa continuaria em signal-indisponivel
    // até ele expirar. Redis fora do ar não desfaz o bootstrap.
    try {
      await invalidateSignalRoleCache(tenantId, result.userId);
    } catch (error) {
      log.error("[bootstrapSignalAction] cache de papel não invalidado", {
        error: String(error),
      });
    }

    revalidatePath(`/clientes/${input.slug}`);
    return { created: result.created, role: result.role };
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

    // A carteira mora em `/clientes` desde a rodada 5; `/` é a Home, que conta
    // clientes e também muda com o provisionamento.
    revalidatePath("/clientes");
    revalidatePath("/");
    return { slug: result.slug, ownerLinked: result.ownerLinked };
  });
}
