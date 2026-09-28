import { type AuditWriter, logPlatformAudit } from "./audit";
import { CHARTER_CLAUSES } from "./charter-clauses";
import { ProvisioningError } from "./errors";

/** As nove seções do Charter, na ordem do SRD. Só a estrutura: o corpo nasce
 *  vazio e é escrito pelo cliente na tela de Política. */
export const POLICY_SECTIONS: { ordinal: number; name: string }[] = [
  { ordinal: 1, name: "Perfil organizacional e contexto" },
  { ordinal: 2, name: "Classificação de dados" },
  { ordinal: 3, name: "Usos permitidos" },
  { ordinal: 4, name: "Usos restritos" },
  { ordinal: 5, name: "Usos proibidos" },
  { ordinal: 6, name: "IA voltada ao cliente" },
  { ordinal: 7, name: "Requisitos de aprovação" },
  { ordinal: 8, name: "Human-in-the-loop" },
  { ordinal: 9, name: "Escalonamento e exceções" },
];

/** O que o bootstrap usa do client com contexto de tenant, com argumento
 *  `unknown`: o client real do Prisma tem argumentos genéricos que não
 *  encaixam numa forma descrita à mão, e o retorno — o que a lógica de fato
 *  consome — segue checado. Sintaxe de método em tudo: sob `strictFunctionTypes`
 *  a forma com seta seria contravariante e o `withTenantDb` real deixaria de
 *  ser atribuível a `BootstrapCharterDeps`. */
export type CharterDb = AuditWriter & {
  tenant: {
    findUnique(args: unknown): Promise<{ id: string; slug: string } | null>;
  };
  user: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  tenantMember: { findFirst(args: unknown): Promise<{ id: string } | null> };
  charterMembership: { upsert(args: unknown): Promise<{ id: string }> };
  charterSettings: { upsert(args: unknown): Promise<{ id: string }> };
  charterPolicy: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  charterPolicySection: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
  charterClause: {
    createMany(args: unknown): Promise<{ count: number }>;
  };
};

export type BootstrapCharterDeps = {
  withTenantDb<T>(
    tenantId: string,
    fn: (db: CharterDb) => Promise<T>
  ): Promise<T>;
};

export type BootstrapCharterInput = {
  tenantId: string;
  complianceEmail: string;
  actorUserId: string;
  actorName?: string | null;
};

/** Cria as cláusulas do catálogo que ainda faltam para o tenant, sem duplicar
 *  nem sobrescrever cláusula existente (`skipDuplicates` sobre a chave natural
 *  `(tenantId, code)`, já garantida pelo schema). Chamada tanto quando a
 *  política nasce quanto quando ela já existia (US2): re-provisionar é seguro. */
async function ensureCharterClauses(
  db: CharterDb,
  tenant: { id: string; slug: string },
  input: BootstrapCharterInput
): Promise<void> {
  const { count } = await db.charterClause.createMany({
    data: CHARTER_CLAUSES.map((clause) => ({
      tenantId: input.tenantId,
      ...clause,
    })),
    skipDuplicates: true,
  });

  // Re-provisionamento com as 8 já presentes cria 0 — nada de novo aconteceu,
  // então não há evento pra auditar (mesmo raciocínio de `bootstrap_skipped`
  // pra política, mas por contagem em vez de por existência).
  if (count === 0) {
    return;
  }

  await logPlatformAudit(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: "charter.clauses_bootstrapped",
    entityType: "CharterClause",
    entityId: input.tenantId,
    target: `${tenant.slug} · ${count} cláusulas`,
  });
}

/**
 * Deixa o Charter utilizável para um tenant: papel COMPLIANCE, configurações e
 * a política com as nove seções em DRAFT.
 *
 * Existe porque nenhuma action do produto cria política — só o seed criava, e
 * seed não roda em produção. Sem isto, um cliente com o módulo contratado abre
 * a tela de Política e não tem por onde começar.
 *
 * Roda inteiro dentro de `withTenantDb`: a RLS do Charter está FORCE e recusa
 * INSERT sem `app.tenant_id`, inclusive para o dono da tabela.
 */
export async function bootstrapCharter(
  deps: BootstrapCharterDeps,
  input: BootstrapCharterInput
): Promise<{ policyId: string; created: boolean }> {
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

    const email = input.complianceEmail.trim().toLowerCase();
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

    // A conta existir na plataforma não basta: o papel é DESTE tenant. Sem
    // checar a associação, quem soubesse o e-mail de qualquer conta poderia
    // pôr essa pessoa como COMPLIANCE no tenant de um cliente.
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

    await db.charterMembership.upsert({
      where: {
        tenantId_userId: { tenantId: input.tenantId, userId: user.id },
      },
      create: {
        tenantId: input.tenantId,
        userId: user.id,
        role: "COMPLIANCE",
        updatedBy: input.actorUserId,
      },
      update: { role: "COMPLIANCE", updatedBy: input.actorUserId },
    });

    await db.charterSettings.upsert({
      where: { tenantId: input.tenantId },
      create: { tenantId: input.tenantId },
      update: {},
    });

    const existing = await db.charterPolicy.findFirst({
      where: { tenantId: input.tenantId },
      select: { id: true },
    });

    if (existing) {
      await ensureCharterClauses(db, tenant, input);

      await logPlatformAudit(db, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        action: "charter.bootstrap_skipped",
        entityType: "CharterPolicy",
        entityId: existing.id,
        target: `${tenant.slug} · política já existia`,
      });
      return { policyId: existing.id, created: false };
    }

    const policy = await db.charterPolicy.create({
      data: { tenantId: input.tenantId, name: "Política de Uso de IA" },
    });

    await db.charterPolicySection.createMany({
      data: POLICY_SECTIONS.map((section) => ({
        tenantId: input.tenantId,
        policyId: policy.id,
        ordinal: section.ordinal,
        name: section.name,
        status: "DRAFT",
        body: "",
      })),
    });

    await ensureCharterClauses(db, tenant, input);

    await logPlatformAudit(db, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: "charter.bootstrapped",
      entityType: "CharterPolicy",
      entityId: policy.id,
      target: `${tenant.slug} · ${POLICY_SECTIONS.length} seções`,
    });

    return { policyId: policy.id, created: true };
  });
}
