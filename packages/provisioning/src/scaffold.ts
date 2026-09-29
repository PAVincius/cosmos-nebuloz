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
  tenantMember: { findFirst(args: unknown): Promise<{ id: string } | null> };
  scaffoldMembership: {
    findUnique(args: unknown): Promise<{ id: string; role: string } | null>;
    createMany(args: unknown): Promise<{ count: number }>;
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
 * já opera o tenant perderia o poder de gate. Nesse caso mantém, audita e
 * DEVOLVE o papel que a pessoa já tinha (`role`), para o chamador não supor que
 * ela virou ADMIN.
 *
 * Só dá o papel a quem já é membro do tenant (`TenantMember`): ter conta na
 * plataforma não basta. A criação é INSERT ... ON CONFLICT DO NOTHING, e não
 * find + create: dois bootstraps em corrida não podem estourar violação de
 * unicidade, que aborta a transação do `withTenantDb`.
 *
 * Roda inteiro dentro de `withTenantDb`: a RLS do Scaffold está FORCE e recusa
 * INSERT sem `app.tenant_id`.
 */
export async function bootstrapScaffold(
  deps: BootstrapScaffoldDeps,
  input: BootstrapScaffoldInput
): Promise<{ membershipId: string; created: boolean; role: string }> {
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

    const member = await db.tenantMember.findFirst({
      where: { tenantId: input.tenantId, userId: user.id },
      select: { id: true },
    });
    if (!member) {
      throw new ProvisioningError(
        "USER_NOT_MEMBER",
        `${email} tem conta, mas não é membro desta organização. Convide a pessoa para o tenant antes de dar o papel.`
      );
    }

    await db.scaffoldSettings.upsert({
      where: { tenantId: input.tenantId },
      create: { tenantId: input.tenantId },
      update: {},
    });

    const where = {
      tenantId_userId: { tenantId: input.tenantId, userId: user.id },
    };
    const inserted = await db.scaffoldMembership.createMany({
      data: [
        {
          tenantId: input.tenantId,
          userId: user.id,
          role: "ADMIN",
          updatedBy: input.actorUserId,
        },
      ],
      skipDuplicates: true,
    });
    const membership = await db.scaffoldMembership.findUnique({
      where,
      select: { id: true, role: true },
    });
    if (!membership) {
      throw new ProvisioningError(
        "USER_NOT_FOUND",
        `Papel do Scaffold de ${email} não encontrado depois do insert.`
      );
    }

    if (inserted.count === 0) {
      await logPlatformAudit(db, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        action: "scaffold.bootstrap_skipped",
        entityType: "ScaffoldMembership",
        entityId: membership.id,
        target: `${tenant.slug} · ${email} já era ${membership.role}`,
      });
      return {
        membershipId: membership.id,
        created: false,
        role: membership.role,
      };
    }

    await logPlatformAudit(db, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: "scaffold.bootstrapped",
      entityType: "ScaffoldMembership",
      entityId: membership.id,
      target: `${tenant.slug} · ${email} · ADMIN`,
    });

    return {
      membershipId: membership.id,
      created: true,
      role: membership.role,
    };
  });
}
