import { logPlatformAudit } from "./audit";
import { ProvisioningError } from "./errors";

/** Só o que o escritor usa do client, em forma estrutural (mesmo padrão de
 *  `ModuleDb`). O model `MeridianBenchmarkEnablement` é criado pela migration
 *  do Alicerce; até lá o client gerado não o tem, e a forma estrutural deixa
 *  esta função testável e tipada sem ele. */
export type MeridianBenchmarkDb = {
  tenant: {
    findUnique(
      args: unknown
    ): Promise<{ id: string; slug: string; isInternalTenant: boolean } | null>;
  };
  meridianBenchmarkEnablement: {
    upsert(args: unknown): Promise<unknown>;
  };
  auditLog: { create(args: { data: unknown }): Promise<unknown> };
};

export type SetMeridianBenchmarkEnablementInput = {
  tenantId: string;
  enabled: boolean;
  /** Referência do aditivo contratual (DPA §2.1). Obrigatória para ligar um
   *  tenant que não é interno. */
  agreementRef?: string | null;
  actorUserId: string;
  actorName?: string | null;
};

/**
 * Liga ou desliga a habilitação de benchmark do Meridian de um tenant
 * (specs/012-benchmark-travado-tenant). É o único escritor: só staff Nebuloz
 * chama, pelo back-office, e quem chama é quem garante o papel de staff — o
 * app do cliente não importa esta função.
 *
 * Ligar tenant externo exige a referência do aditivo. Tenant interno liga sem
 * ela (a Nebuloz já é controladora do próprio dado). Desligar não exige nada e
 * mantém a última referência, para a história do contrato. Toda mudança grava
 * auditoria com ator, momento e referência.
 */
export async function setMeridianBenchmarkEnablement(
  db: MeridianBenchmarkDb,
  input: SetMeridianBenchmarkEnablementInput
): Promise<void> {
  const tenant = await db.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, slug: true, isInternalTenant: true },
  });
  if (!tenant) {
    throw new ProvisioningError(
      "TENANT_NOT_FOUND",
      `Nenhum tenant com id ${input.tenantId}.`
    );
  }

  const ref = input.agreementRef?.trim() || null;
  if (input.enabled && !tenant.isInternalTenant && !ref) {
    throw new ProvisioningError(
      "BENCHMARK_AGREEMENT_REQUIRED",
      "Informe a referência do aditivo contratual (DPA §2.1) para ligar o benchmark deste cliente."
    );
  }

  await db.meridianBenchmarkEnablement.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      enabled: input.enabled,
      agreementRef: input.enabled ? ref : null,
      updatedById: input.actorUserId,
    },
    update: {
      enabled: input.enabled,
      ...(input.enabled ? { agreementRef: ref } : {}),
      updatedById: input.actorUserId,
    },
  });

  await logPlatformAudit(db, {
    tenantId: tenant.id,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: input.enabled
      ? "meridian.benchmark.enabled"
      : "meridian.benchmark.disabled",
    entityType: "MeridianBenchmarkEnablement",
    entityId: tenant.id,
    target: `${tenant.slug} · benchmark`,
    note: input.enabled
      ? `Aditivo: ${ref ?? "tenant interno, sem aditivo"}.`
      : "Contribuições futuras bloqueadas; o que já contribuiu não é apagado.",
    diff: [
      input.enabled
        ? ["Benchmark", "desligado", "ligado"]
        : ["Benchmark", "ligado", "desligado"],
    ],
  });
}
