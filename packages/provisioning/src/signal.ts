import { type AuditWriter, logPlatformAudit } from "./audit";
import { ProvisioningError } from "./errors";

/** O que o bootstrap usa do client com contexto de tenant. Mesma forma de
 *  `ScaffoldDb`: argumento `unknown` e sintaxe de método, para o `withTenantDb`
 *  real continuar atribuível sob `strictFunctionTypes`. */
export type SignalDb = AuditWriter & {
  tenant: {
    findUnique(args: unknown): Promise<{ id: string; slug: string } | null>;
  };
  user: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  tenantMember: { findFirst(args: unknown): Promise<{ id: string } | null> };
  signalMember: {
    findUnique(args: unknown): Promise<{ id: string; role: string } | null>;
    createMany(args: unknown): Promise<{ count: number }>;
  };
};

export type BootstrapSignalDeps = {
  withTenantDb<T>(
    tenantId: string,
    fn: (db: SignalDb) => Promise<T>
  ): Promise<T>;
};

export type BootstrapSignalInput = {
  tenantId: string;
  adminEmail: string;
  actorUserId: string;
  actorName?: string | null;
};

/**
 * Dá o papel ADMIN do Signal ao primeiro administrador do tenant. Sem isto, um
 * cliente com o módulo contratado não tinha como entrar: `SignalMember` é a
 * única fonte do papel, quem não tem linha cai em signal-indisponivel, e a tela
 * de Configurações (onde o ADMIN adiciona o resto da equipe) fica atrás do
 * mesmo portão.
 *
 * ADMIN administra acesso; não move o plano de medição (SG-PO-03). Quem conduz
 * as iniciativas recebe o papel depois, pela tela de Configurações.
 *
 * Não rebaixa nem troca o papel de quem já tem linha: um Analista que já opera
 * o tenant perderia o poder de escrever. Nesse caso mantém, audita e DEVOLVE o
 * papel que a pessoa já tinha (`role`), para o chamador não supor que ela virou
 * ADMIN.
 *
 * Só dá o papel a quem já é membro do tenant (`TenantMember`): ter conta na
 * plataforma não basta. A criação é INSERT ... ON CONFLICT DO NOTHING, e não
 * find + create: dois bootstraps em corrida não podem estourar violação de
 * unicidade, que aborta a transação do `withTenantDb`.
 *
 * Não cria `SignalSettings`: a tela lê os padrões enquanto o tenant não gravar
 * as próprias réguas.
 */
export async function bootstrapSignal(
  deps: BootstrapSignalDeps,
  input: BootstrapSignalInput
): Promise<{
  memberId: string;
  userId: string;
  created: boolean;
  role: string;
}> {
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

    const inserted = await db.signalMember.createMany({
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
    const row = await db.signalMember.findUnique({
      where: {
        tenantId_userId: { tenantId: input.tenantId, userId: user.id },
      },
      select: { id: true, role: true },
    });
    if (!row) {
      throw new ProvisioningError(
        "USER_NOT_FOUND",
        `Papel do Signal de ${email} não encontrado depois do insert.`
      );
    }

    const created = inserted.count > 0;
    await logPlatformAudit(db, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: created ? "signal.bootstrapped" : "signal.bootstrap_skipped",
      entityType: "SignalMember",
      entityId: row.id,
      target: created
        ? `${tenant.slug} · ${email} · ADMIN`
        : `${tenant.slug} · ${email} já era ${row.role}`,
    });

    return { memberId: row.id, userId: user.id, created, role: row.role };
  });
}
