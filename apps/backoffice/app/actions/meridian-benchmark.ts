"use server";

import {
  ProvisioningError,
  platformDb,
  setMeridianBenchmarkEnablement,
} from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertCanWrite, requirePlatformStaff } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

export type MeridianBenchmarkState = {
  enabled: boolean;
  /** Última referência de aditivo gravada — fica após desligar, para a história
   *  do contrato. */
  agreementRef: string | null;
  updatedAt: string | null;
  /** Tenant interno liga sem aditivo (spec 012, FR-003). */
  isInternalTenant: boolean;
};

async function tenantBySlug(slug: string) {
  const tenant = await platformDb.tenant.findUnique({
    where: { slug },
    select: { id: true, isSystem: true, isInternalTenant: true },
  });
  if (!tenant || tenant.isSystem) {
    throw new ProvisioningError(
      "TENANT_NOT_FOUND",
      `Nenhum cliente com o slug ${slug}.`
    );
  }
  return tenant;
}

export async function getMeridianBenchmark(
  slug: string
): Promise<Result<MeridianBenchmarkState>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const tenant = await tenantBySlug(slug);
    const row = await platformDb.meridianBenchmarkEnablement.findUnique({
      where: { tenantId: tenant.id },
      select: { enabled: true, agreementRef: true, updatedAt: true },
    });

    return {
      enabled: row?.enabled ?? false,
      agreementRef: row?.agreementRef ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      isInternalTenant: tenant.isInternalTenant,
    };
  });
}

const SetBenchmarkInput = z.object({
  slug: z.string().min(1),
  enabled: z.boolean(),
  agreementRef: z
    .string()
    .trim()
    .max(200, "A referência do aditivo passa de 200 caracteres.")
    .nullish(),
});

export async function setMeridianBenchmarkAction(input: {
  slug: string;
  enabled: boolean;
  agreementRef?: string | null;
}): Promise<Result<null>> {
  return await safeAction(async () => {
    // O escritor não checa papel: a barreira de staff de leitura é esta.
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const parsed = SetBenchmarkInput.parse(input);
    const tenant = await tenantBySlug(parsed.slug);

    await setMeridianBenchmarkEnablement(platformDb, {
      tenantId: tenant.id,
      enabled: parsed.enabled,
      agreementRef: parsed.agreementRef ?? null,
      actorUserId: staff.userId,
      actorName: staff.name,
    });

    revalidatePath(`/clientes/${parsed.slug}`);
    return null;
  });
}
