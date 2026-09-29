"use server";

import type { ScaffoldRole } from "@repo/database";
import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";
import { AssignScaffoldRoleSchema } from "@/lib/scaffold/schemas";
import { FIELD_LABELS, logScaffoldAudit } from "./_shared";

// Papel de adoção (SA-05).
//
// `ScaffoldMembership` é a única fonte do papel de adoção e, até aqui, nada a
// escrevia: entrar no Scaffold exigia SQL. Atribuir papel é decidir quem pode
// fechar gate, então a permissão é própria (`membership.manage`) e não vai para
// quem só conduz trilha.
//
// Só se atribui a quem já é membro do MESMO tenant. Sem essa checagem, um
// `userId` adivinhado de outra organização ganharia papel aqui.

export type ScaffoldMemberRow = {
  userId: string;
  name: string;
  email: string | null;
  /** Nulo = a pessoa está na organização mas não tem papel no Scaffold. */
  role: ScaffoldRole | null;
};

/** Todas as pessoas da organização, com o papel de adoção de cada uma. */
export async function listScaffoldMembers(): Promise<
  ScaffoldResult<ScaffoldMemberRow[]>
> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("membership.manage");

    return withTenantDb(ctx.tenantId, async (db) => {
      const [people, memberships] = await Promise.all([
        db.tenantMember.findMany({
          where: { tenantId: ctx.tenantId },
          select: {
            userId: true,
            user: { select: { name: true, email: true } },
          },
        }),
        db.scaffoldMembership.findMany({
          where: { tenantId: ctx.tenantId },
          select: { userId: true, role: true },
        }),
      ]);
      const roleOf = new Map(memberships.map((m) => [m.userId, m.role]));

      return people.map(
        (p): ScaffoldMemberRow => ({
          userId: p.userId,
          name: p.user.name ?? p.user.email ?? p.userId,
          email: p.user.email ?? null,
          role: roleOf.get(p.userId) ?? null,
        })
      );
    });
  });
}

/** Atribui (ou troca) o papel de adoção de uma pessoa da organização. */
export async function assignScaffoldRole(
  raw: z.input<typeof AssignScaffoldRoleSchema>
): Promise<ScaffoldResult<{ userId: string; role: ScaffoldRole }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("membership.manage");
    const input = AssignScaffoldRoleSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const person = await db.tenantMember.findFirst({
        where: { tenantId: ctx.tenantId, userId: input.userId },
        select: { userId: true, user: { select: { name: true, email: true } } },
      });
      if (!person) {
        throw new ScaffoldRuleError("MEMBER_NOT_IN_TENANT");
      }

      const current = await db.scaffoldMembership.findUnique({
        where: {
          tenantId_userId: { tenantId: ctx.tenantId, userId: input.userId },
        },
        select: { role: true },
      });

      await db.scaffoldMembership.upsert({
        where: {
          tenantId_userId: { tenantId: ctx.tenantId, userId: input.userId },
        },
        create: {
          tenantId: ctx.tenantId,
          userId: input.userId,
          role: input.role,
          updatedBy: ctx.userId,
        },
        update: { role: input.role, updatedBy: ctx.userId },
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.membership.assign",
        entityType: "scaffold.membership",
        entityId: input.userId,
        target: person.user?.name ?? person.user?.email ?? input.userId,
        diff: [[FIELD_LABELS.scaffoldRole, current?.role ?? "—", input.role]],
      });
    });

    revalidatePath("/scaffold/members");
    return { userId: input.userId, role: input.role };
  });
}
