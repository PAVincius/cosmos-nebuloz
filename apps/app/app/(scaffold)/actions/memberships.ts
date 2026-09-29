"use server";

import type { ScaffoldRole } from "@repo/database";
import { withTenantDb } from "@repo/database";
import {
  canAssignScaffoldRole,
  invalidateScaffoldRoleCache,
  SCAFFOLD_ROLE_LABEL,
} from "@repo/rbac";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import {
  type ScaffoldErrorCode,
  ScaffoldRuleError,
} from "@/lib/scaffold/errors";
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
  /** Papéis que o ator pode atribuir a esta pessoa. Vazio = a linha está
   *  travada e `lockedReason` diz por quê. É a MESMA regra de
   *  `assignScaffoldRole`: a tela nunca oferece o que o servidor vai recusar. */
  assignable: ScaffoldRole[];
  lockedReason: string | null;
};

const ALL_ROLES = Object.keys(SCAFFOLD_ROLE_LABEL) as ScaffoldRole[];

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

      return people.map((p): ScaffoldMemberRow => {
        const role = roleOf.get(p.userId) ?? null;
        const isSelf = p.userId === ctx.userId;
        const assignable = isSelf
          ? []
          : ALL_ROLES.filter((next) =>
              canAssignScaffoldRole(ctx.scaffoldRole, role, next)
            );
        let lockedReason: string | null = null;
        if (isSelf) {
          lockedReason = "Ninguém altera o próprio papel.";
        } else if (assignable.length === 0) {
          lockedReason =
            "Só um administrador altera o papel de administrador ou de consultor.";
        }
        return {
          userId: p.userId,
          name: p.user.name ?? p.user.email ?? p.userId,
          email: p.user.email ?? null,
          role,
          assignable,
          lockedReason,
        };
      });
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

    // A transação devolve o desfecho em vez de lançar nas recusas: lançar
    // desfaria a transação e levaria junto a auditoria da tentativa negada.
    // O erro sobe depois do commit.
    const outcome = await withTenantDb(
      ctx.tenantId,
      async (db): Promise<Outcome> => {
        const deny = async (
          code: ScaffoldErrorCode,
          target: string
        ): Promise<Outcome> => {
          await logScaffoldAudit(db, ctx, {
            action: "scaffold.membership.assign_denied",
            entityType: "scaffold.membership",
            entityId: input.userId,
            target,
            note: `${code}: tentou atribuir ${input.role}.`,
          });
          return { denied: code };
        };

        // Quem altera o próprio papel se promove.
        if (input.userId === ctx.userId) {
          return deny("SELF_ROLE_CHANGE", input.userId);
        }

        const person = await db.tenantMember.findFirst({
          where: { tenantId: ctx.tenantId, userId: input.userId },
          select: {
            userId: true,
            user: { select: { name: true, email: true } },
          },
        });
        if (!person) {
          return deny("MEMBER_NOT_IN_TENANT", input.userId);
        }
        const target = person.user?.name ?? person.user?.email ?? input.userId;

        // Trinco por tenant e pessoa, liberado no fim da transação. Sem ele,
        // duas atribuições concorrentes leem o mesmo papel atual e a segunda
        // grava por cima de uma decisão que já não a permitiria (ex.: consultor
        // "cria" TEAM_MEMBER enquanto o administrador acabou de fazer ADMIN).
        // Advisory lock, e não FOR UPDATE, porque cobre também a pessoa que
        // ainda não tem linha para bloquear.
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:${input.userId}`}, 0))`;

        const current = await db.scaffoldMembership.findUnique({
          where: {
            tenantId_userId: { tenantId: ctx.tenantId, userId: input.userId },
          },
          select: { role: true },
        });

        // Vale para o papel novo e para o atual: rebaixar é retirar.
        if (
          !canAssignScaffoldRole(
            ctx.scaffoldRole,
            current?.role ?? null,
            input.role
          )
        ) {
          return deny("ROLE_ASSIGNMENT_FORBIDDEN", target);
        }

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
          target,
          diff: [[FIELD_LABELS.scaffoldRole, current?.role ?? "—", input.role]],
        });
        return { denied: null };
      }
    );

    if (outcome.denied) {
      throw new ScaffoldRuleError(outcome.denied);
    }

    // Depois do commit: o papel vem de cache (300 s), e quem foi rebaixado
    // manteria a permissão antiga até ele expirar.
    await invalidateScaffoldRoleCache(ctx.tenantId, input.userId);

    revalidatePath("/scaffold/members");
    return { userId: input.userId, role: input.role };
  });
}

type Outcome = { denied: ScaffoldErrorCode | null };
