"use server";

import { type CharterRole, withTenantDb } from "@repo/database";
import {
  CHARTER_MATRIX,
  CHARTER_PERMISSION_LABEL,
  CHARTER_PERMISSIONS,
  CHARTER_ROLE_LABEL,
  invalidateCharterRoleCache,
} from "@repo/rbac";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireCharterContext,
  requireCharterPermissionContext,
} from "@/lib/charter/guards";
import { type Result, safeAction } from "../../actions/_base";
import { GovernanceError, logCharterAudit } from "./_shared";

// Configurações — FR-12.

export type NotificationTrigger = {
  id: string;
  label: string;
  audience: string;
  on: boolean;
};

/** Os 8 gatilhos do PRD §14. `on` vem de CharterSettings.notificationTriggers;
 *  ausente = default do catálogo. */
const TRIGGER_CATALOG: Omit<NotificationTrigger, "on">[] = [
  {
    id: "policy.pending",
    label: "Versão de política aguardando aprovação",
    audience: "Legal · Compliance",
  },
  { id: "policy.published", label: "Política publicada", audience: "Todos" },
  {
    id: "case.submitted",
    label: "Caso de uso submetido",
    audience: "Revisores",
  },
  {
    id: "case.slaOverdue",
    label: "SLA de revisão vencido",
    audience: "Revisor · Compliance",
  },
  {
    id: "case.restrictionAck",
    label: "Aceite de restrição pendente",
    audience: "Requester",
  },
  {
    id: "mitigation.overdue",
    label: "Mitigação atrasada",
    audience: "Dono da mitigação",
  },
  {
    id: "vendor.renewal",
    label: "Renovação de fornecedor se aproximando",
    audience: "Compliance · Procurement",
  },
  {
    id: "onboarding.overdue",
    label: "Onboarding incompleto após prazo",
    audience: "Gestor · People Ops",
  },
];

const TRIGGER_DEFAULTS: Record<string, boolean> = {
  "policy.pending": true,
  "policy.published": true,
  "case.submitted": true,
  "case.slaOverdue": true,
  "case.restrictionAck": true,
  "mitigation.overdue": true,
  "vendor.renewal": false,
  "onboarding.overdue": true,
};

export type PermissionMatrixRow = {
  id: string;
  label: string;
  grants: CharterRole[];
};

export type SettingsView = {
  workspace: {
    name: string;
    slug: string;
    industry: string | null;
    geo: string | null;
    posture: string;
    employees: number | null;
    logRetentionDays: number;
  };
  roles: { id: CharterRole; label: string }[];
  permissions: PermissionMatrixRow[];
  activeRole: CharterRole;
  notifications: NotificationTrigger[];
  members: { userId: string; name: string; email: string; role: CharterRole }[];
  /** Gente do tenant sem CharterMembership — candidatos ao passo 3 da
   *  montagem ("Atribua papéis de governança"). Sem esta lista, o único
   *  controle da aba era editar quem já tinha papel, e um tenant novo só
   *  tem o Compliance lead: nada no /charter/settings dava para cumprir o
   *  passo. */
  unassignedMembers: { userId: string; name: string; email: string }[];
};

export async function getSettings(): Promise<Result<SettingsView>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();

    return withTenantDb(ctx.tenantId, async (db) => {
      const [tenant, settings, memberships, tenantMembers] = await Promise.all([
        db.tenant.findUniqueOrThrow({
          where: { id: ctx.tenantId },
          select: { name: true, slug: true },
        }),
        db.charterSettings.findUnique({ where: { tenantId: ctx.tenantId } }),
        db.charterMembership.findMany({
          where: { tenantId: ctx.tenantId },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { role: "asc" },
        }),
        db.tenantMember.findMany({
          where: { tenantId: ctx.tenantId },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const comCharterRole = new Set(memberships.map((m) => m.userId));
      const unassignedMembers = tenantMembers
        .filter((tm) => !comCharterRole.has(tm.userId))
        .map((tm) => ({
          userId: tm.userId,
          name: tm.user.name ?? tm.user.email,
          email: tm.user.email,
        }));

      const stored =
        (settings?.notificationTriggers as Record<string, boolean> | null) ??
        null;

      return {
        workspace: {
          name: tenant.name,
          slug: tenant.slug,
          industry: settings?.industry ?? null,
          geo: settings?.geo ?? null,
          posture: settings?.posture ?? "MODERATE",
          employees: settings?.employees ?? null,
          logRetentionDays: settings?.logRetentionDays ?? 365,
        },
        roles: (Object.keys(CHARTER_MATRIX) as CharterRole[]).map((id) => ({
          id,
          label: CHARTER_ROLE_LABEL[id],
        })),
        permissions: CHARTER_PERMISSIONS.map((p) => ({
          id: p,
          label: CHARTER_PERMISSION_LABEL[p],
          grants: (Object.keys(CHARTER_MATRIX) as CharterRole[]).filter((r) =>
            CHARTER_MATRIX[r].includes(p)
          ),
        })),
        activeRole: ctx.charterRole,
        notifications: TRIGGER_CATALOG.map((t) => ({
          ...t,
          on: stored?.[t.id] ?? TRIGGER_DEFAULTS[t.id],
        })),
        members: memberships.map((m) => ({
          userId: m.userId,
          name: m.user.name ?? m.user.email,
          email: m.user.email,
          role: m.role,
        })),
        unassignedMembers,
      };
    });
  });
}

const WorkspaceSchema = z.object({
  industry: z.string().trim().max(120).optional(),
  geo: z.string().trim().max(120).optional(),
  posture: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]),
  employees: z.number().int().min(0).max(2_000_000).optional(),
  logRetentionDays: z.union([z.literal(30), z.literal(90), z.literal(365)]),
});

export async function updateWorkspace(
  input: z.input<typeof WorkspaceSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    // Perfil da organização alimenta o Policy Builder — quem edita política
    // edita o contexto que gera o rascunho.
    const ctx = await requireCharterPermissionContext("policy.edit");
    const data = WorkspaceSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const before = await db.charterSettings.findUnique({
        where: { tenantId: ctx.tenantId },
      });

      await db.charterSettings.upsert({
        where: { tenantId: ctx.tenantId },
        create: {
          tenantId: ctx.tenantId,
          industry: data.industry ?? null,
          geo: data.geo ?? null,
          posture: data.posture,
          employees: data.employees ?? null,
          logRetentionDays: data.logRetentionDays,
        },
        update: {
          industry: data.industry ?? null,
          geo: data.geo ?? null,
          posture: data.posture,
          employees: data.employees ?? null,
          logRetentionDays: data.logRetentionDays,
        },
      });

      await logCharterAudit(db, ctx, {
        action: "Atualizou perfil da organização",
        entityType: "charter.settings",
        entityId: ctx.tenantId,
        target: "Workspace",
        diff: [
          ["Indústria", before?.industry ?? "—", data.industry ?? "—"],
          ["Geografia", before?.geo ?? "—", data.geo ?? "—"],
          ["Postura", before?.posture ?? "—", data.posture],
          [
            "Retenção de log",
            String(before?.logRetentionDays ?? "—"),
            String(data.logRetentionDays),
          ],
        ],
      });

      revalidatePath("/charter", "layout");
      return null;
    });
  });
}

const NotificationSchema = z.object({
  id: z.string().min(1),
  on: z.boolean(),
});

export async function setNotificationTrigger(
  input: z.infer<typeof NotificationSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("policy.edit");
    const data = NotificationSchema.parse(input);

    if (!TRIGGER_CATALOG.some((t) => t.id === data.id)) {
      throw new GovernanceError(
        "notification.unknown",
        "Gatilho de notificação desconhecido."
      );
    }

    return withTenantDb(ctx.tenantId, async (db) => {
      const settings = await db.charterSettings.findUnique({
        where: { tenantId: ctx.tenantId },
      });
      const current =
        (settings?.notificationTriggers as Record<string, boolean> | null) ??
        TRIGGER_DEFAULTS;

      await db.charterSettings.upsert({
        where: { tenantId: ctx.tenantId },
        create: {
          tenantId: ctx.tenantId,
          notificationTriggers: { ...TRIGGER_DEFAULTS, [data.id]: data.on },
        },
        update: {
          notificationTriggers: { ...current, [data.id]: data.on },
        },
      });

      await logCharterAudit(db, ctx, {
        action: "Alterou notificação",
        entityType: "charter.settings",
        entityId: ctx.tenantId,
        target: TRIGGER_CATALOG.find((t) => t.id === data.id)?.label ?? data.id,
        diff: [
          [
            "Ativa",
            (current[data.id] ?? TRIGGER_DEFAULTS[data.id]) ? "Sim" : "Não",
            data.on ? "Sim" : "Não",
          ],
        ],
      });

      revalidatePath("/charter", "layout");
      return null;
    });
  });
}

const MemberRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum([
    "COMPLIANCE",
    "LEGAL",
    "SECURITY",
    "HR",
    "REQUESTER",
    "EXEC",
    "AUDITOR",
  ]),
});

/** Atribuir papel de governança. Só Compliance faz — é a permissão que
 *  distribui todas as outras. */
export async function setMemberCharterRole(
  input: z.infer<typeof MemberRoleSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    if (ctx.charterRole !== "COMPLIANCE") {
      throw new GovernanceError(
        "membership.forbidden",
        "Apenas o papel Compliance atribui papéis de governança."
      );
    }
    const data = MemberRoleSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const member = await db.tenantMember.findFirst({
        where: { tenantId: ctx.tenantId, userId: data.userId },
        select: { id: true },
      });
      if (!member) {
        throw new GovernanceError(
          "membership.notTenantMember",
          "Pessoa não é membro desta organização."
        );
      }

      const before = await db.charterMembership.findUnique({
        where: {
          tenantId_userId: { tenantId: ctx.tenantId, userId: data.userId },
        },
        select: { role: true },
      });

      // Compliance é o único papel que atribui papel (comparação direta,
      // acima) e o único que publica política (CHARTER_MATRIX). Deixar o
      // tenant sem nenhum não é um estado ruim — é um estado sem saída pelo
      // produto: ninguém mais teria como criar outro Compliance.
      //
      // TOCTOU conhecido, não fechado aqui: `count` e o `upsert` abaixo
      // correm na mesma transação, mas cada chamada a setMemberCharterRole
      // abre a sua própria — não há lock entre requests. Duas chamadas
      // concorrentes demovendo dois Compliance diferentes do mesmo tenant
      // podem as duas ler `restantes` = 2, as duas passar neste `if`, as
      // duas commitar: o tenant termina com zero Compliance, o mesmo beco
      // sem saída que este guard existe para evitar — só que agora exige
      // dois atores em vez de um. Fechar isso de verdade pede isolamento
      // serializable nesta transação ou uma constraint no banco (ex.: índice
      // parcial que recusa a linha COMPLIANCE sair de count=1); nenhuma das
      // duas cabe aqui — `withTenantDb` é compartilhado por toda action do
      // Charter, e mudar a semântica de transação dele não é ajuste desta
      // rodada.
      if (before?.role === "COMPLIANCE" && data.role !== "COMPLIANCE") {
        const restantes = await db.charterMembership.count({
          where: { tenantId: ctx.tenantId, role: "COMPLIANCE" },
        });
        if (restantes <= 1) {
          throw new GovernanceError(
            "membership.lastCompliance",
            "Esta é a última pessoa com papel Compliance. Atribua Compliance a outra pessoa antes de trocar este papel."
          );
        }
      }

      await db.charterMembership.upsert({
        where: {
          tenantId_userId: { tenantId: ctx.tenantId, userId: data.userId },
        },
        create: {
          tenantId: ctx.tenantId,
          userId: data.userId,
          role: data.role,
          updatedBy: ctx.userId,
        },
        update: { role: data.role, updatedBy: ctx.userId },
      });

      await logCharterAudit(db, ctx, {
        action: "Atribuiu papel de governança",
        entityType: "charter.settings",
        entityId: data.userId,
        target: `Usuário ${data.userId}`,
        diff: [["Papel", before?.role ?? "—", data.role]],
      });

      await invalidateCharterRoleCache(ctx.tenantId, data.userId);
      revalidatePath("/charter", "layout");
      return null;
    });
  });
}
