import { type AuditWriter, logPlatformAudit } from "./audit";
import { ProvisioningError } from "./errors";

/** O que o bootstrap usa do client com contexto de tenant. Mesma forma de
 *  `CharterDb`: argumento `unknown` e sintaxe de método, para o `withTenantDb`
 *  real continuar atribuível sob `strictFunctionTypes`. */
export type ScaffoldDb = AuditWriter & {
  tenant: {
    findUnique(args: unknown): Promise<{ id: string; slug: string } | null>;
  };
  user: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  scaffoldMembership: {
    findUnique(args: unknown): Promise<{ id: string; role: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  scaffoldSettings: { upsert(args: unknown): Promise<{ id: string }> };
};

export type BootstrapScaffoldDeps = {
  withTenantDb<T>(
    tenantId: string,
    fn: (db: ScaffoldDb) => Promise<T>
  ): Promise<T>;
};

export type BootstrapScaffoldInput = {
  tenantId: string;
  adminEmail: string;
  actorUserId: string;
  actorName?: string | null;
};

/**
 * Dá o papel ADMIN do Scaffold ao primeiro administrador do tenant e cria as
 * configurações. Decisão provisória (SA-05/SA-09 do SRD): nenhuma escrita de
 * `ScaffoldMembership` existia em `apps/` ou `packages/`, então um cliente com o
 * módulo contratado não tinha como atribuir papel a ninguém. Este é o caminho
 * mínimo até o papel de adoção derivar do modelo de papéis do Charter (mapa de
 * fronteiras, entidade 3).
 *
 * ADMIN administra acesso; não fecha gate nem assina caso de negócio
 * (`scaffold-matrix.ts`). Quem conduz a trilha recebe o papel depois, pela
 * gestão de membros que o ADMIN passa a ter.
 *
 * Não rebaixa nem troca o papel de quem já tem membership: uma consultora que
 * já opera o tenant perderia o poder de gate. Nesse caso mantém e audita.
 *
 * Roda inteiro dentro de `withTenantDb`: a RLS do Scaffold está FORCE e recusa
 * INSERT sem `app.tenant_id`.
 */
export async function bootstrapScaffold(
  deps: BootstrapScaffoldDeps,
  input: BootstrapScaffoldInput
): Promise<{ membershipId: string; created: boolean }> {
  return await deps.withTenantDb(input.tenantId, async (db) => {
    const tenant = await db.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, slug: true },
    });
    if (!tenant) {
      throw new ProvisioningError(
        "TENANT_NOT_FOUND",
        `Nenhum tenant com id ${input.tenantId}.`
      );
    }

    const email = input.adminEmail.trim().toLowerCase();
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      throw new ProvisioningError(
        "USER_NOT_FOUND",
        `Nenhuma conta com o e-mail ${email}. A pessoa precisa entrar ao menos uma vez antes de receber o papel.`
      );
    }

    await db.scaffoldSettings.upsert({
      where: { tenantId: input.tenantId },
      create: { tenantId: input.tenantId },
      update: {},
    });

    const existing = await db.scaffoldMembership.findUnique({
      where: {
        tenantId_userId: { tenantId: input.tenantId, userId: user.id },
      },
      select: { id: true, role: true },
    });

    if (existing) {
      await logPlatformAudit(db, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        action: "scaffold.bootstrap_skipped",
        entityType: "ScaffoldMembership",
        entityId: existing.id,
        target: `${tenant.slug} · ${email} já era ${existing.role}`,
      });
      return { membershipId: existing.id, created: false };
    }

    const membership = await db.scaffoldMembership.create({
      data: {
        tenantId: input.tenantId,
        userId: user.id,
        role: "ADMIN",
        updatedBy: input.actorUserId,
      },
    });

    await logPlatformAudit(db, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: "scaffold.bootstrapped",
      entityType: "ScaffoldMembership",
      entityId: membership.id,
      target: `${tenant.slug} · ${email} · ADMIN`,
    });

    return { membershipId: membership.id, created: true };
  });
}
