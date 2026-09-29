"use server";

import { withTenantDb } from "@repo/database";
import { invalidateSignalRoleCache, SIGNAL_ROLE_LABEL } from "@repo/rbac";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import { requireSignalPermissionContext } from "@/lib/signal/guards";
import { canAssignSignalRole } from "@/lib/signal/members";
import { nnStr } from "../../actions/_base";
import {
  type AuditDiff,
  FIELD_LABELS,
  logSignalAudit,
  type SignalResult,
  signalAction,
} from "./_shared";

// Configuração — US7.
//
// As réguas daqui não são preferência de tela: mudar `valueBar` muda o veredito
// de todas as iniciativas na próxima leitura, e portanto muda a conversa do
// próximo comitê. Por isso toda mudança vai para a trilha com de → para, e por
// isso os limites são validados no Zod e não só no formulário — o formulário é
// conveniência, o schema é a regra.
//
// O veredito NÃO é recalculado e gravado aqui: ele é derivado na leitura, como
// o ROI e a confiança. Guardar o veredito ao lado das réguas criaria o mesmo
// problema que o protótipo tinha com o ROI — dois lugares para a mesma verdade,
// e um deles desatualizado.

const SettingsSchema = z.object({
  /** 0–100 porque é porcentagem. Fora disso é erro de digitação, não escolha. */
  adoptionBar: z.coerce.number().int().min(0).max(100),
  /** Múltiplo. Zero significaria "qualquer retorno serve". */
  valueBar: z.coerce.number().min(0.1).max(100),
  lowAdoptionPct: z.coerce.number().int().min(0).max(100),
  lowAdoptionWeeks: z.coerce.number().int().min(1).max(52),
  weakRoi: z.coerce.number().min(0.1).max(100),
  staleHours: z.coerce.number().int().min(1).max(8760),
  currency: nnStr.default("BRL"),
  fiscalYearLabel: nnStr.nullable().optional(),
});

const MemberSchema = z.object({
  userId: nnStr,
  role: z.enum(["VIEWER", "OWNER", "ANALYST", "ADMIN"]),
});

export type SignalSettingsRow = z.infer<typeof SettingsSchema>;

export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  role: "VIEWER" | "OWNER" | "ANALYST" | "ADMIN";
  roleLabel: string;
};

const DEFAULTS: SignalSettingsRow = {
  adoptionBar: 60,
  valueBar: 1.5,
  lowAdoptionPct: 40,
  lowAdoptionWeeks: 8,
  weakRoi: 1.0,
  staleHours: 48,
  currency: "BRL",
  fiscalYearLabel: null,
};

export async function getSettings(): Promise<SignalResult<SignalSettingsRow>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");

    return withTenantDb(ctx.tenantId, async (db) => {
      const s = await db.signalSettings.findUnique({
        where: { tenantId: ctx.tenantId },
      });
      if (!s) {
        return DEFAULTS;
      }
      return {
        adoptionBar: s.adoptionBar,
        valueBar: Number(s.valueBar),
        lowAdoptionPct: s.lowAdoptionPct,
        lowAdoptionWeeks: s.lowAdoptionWeeks,
        weakRoi: Number(s.weakRoi),
        staleHours: s.staleHours,
        currency: s.currency,
        fiscalYearLabel: s.fiscalYearLabel,
      };
    });
  });
}

/** O de → para de cada régua que mudou. Só as que mudaram entram na trilha. */
function settingsDiff(
  before: SignalSettingsRow,
  after: SignalSettingsRow
): AuditDiff {
  const fields: [keyof SignalSettingsRow, string][] = [
    ["adoptionBar", FIELD_LABELS.adoptionBar],
    ["valueBar", FIELD_LABELS.valueBar],
    ["lowAdoptionPct", FIELD_LABELS.lowAdoptionPct],
    ["lowAdoptionWeeks", FIELD_LABELS.lowAdoptionWeeks],
    ["weakRoi", FIELD_LABELS.weakRoi],
    ["staleHours", FIELD_LABELS.staleHours],
    ["currency", "Moeda"],
    ["fiscalYearLabel", "Ano fiscal"],
  ];
  const diff: AuditDiff = [];
  for (const [key, label] of fields) {
    const from = before[key] ?? "—";
    const to = after[key] ?? "—";
    if (String(from) !== String(to)) {
      diff.push([label, String(from), String(to)]);
    }
  }
  return diff;
}

export async function updateSettings(
  raw: z.input<typeof SettingsSchema>
): Promise<SignalResult<SignalSettingsRow>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.settings.write");
    const input = SettingsSchema.parse(raw);

    if (input.lowAdoptionPct > input.adoptionBar) {
      // "Adoção baixa" acima da barra de "o time usa" abriria alerta LOW em
      // iniciativa que o próprio sistema considera adotada.
      throw new SignalRuleError(
        "settings.bars.order",
        `O limiar de adoção baixa (${input.lowAdoptionPct}%) está acima da barra de adoção (${input.adoptionBar}%) — assim o alerta acusaria de baixa uma iniciativa que a régua considera adotada.`
      );
    }

    const saved = await withTenantDb(ctx.tenantId, async (db) => {
      const existing = await db.signalSettings.findUnique({
        where: { tenantId: ctx.tenantId },
      });
      const before: SignalSettingsRow = existing
        ? {
            adoptionBar: existing.adoptionBar,
            valueBar: Number(existing.valueBar),
            lowAdoptionPct: existing.lowAdoptionPct,
            lowAdoptionWeeks: existing.lowAdoptionWeeks,
            weakRoi: Number(existing.weakRoi),
            staleHours: existing.staleHours,
            currency: existing.currency,
            fiscalYearLabel: existing.fiscalYearLabel,
          }
        : DEFAULTS;

      await db.signalSettings.upsert({
        where: { tenantId: ctx.tenantId },
        create: { tenantId: ctx.tenantId, ...input, updatedBy: ctx.userId },
        update: { ...input, updatedBy: ctx.userId },
      });

      await logSignalAudit(db, ctx, {
        action: "Réguas alteradas",
        entityType: "signal.settings",
        entityId: ctx.tenantId,
        target: "Configuração do Signal",
        note: "As réguas valem para a próxima leitura de todas as iniciativas.",
        diff: settingsDiff(before, input),
      });

      return input;
    });

    // Toda tela que mostra veredito depende destas réguas.
    revalidatePath("/signal/overview");
    revalidatePath("/signal/initiatives");
    revalidatePath("/signal/alerts");
    revalidatePath("/signal/settings");
    return saved;
  });
}

export async function listMembers(): Promise<SignalResult<MemberRow[]>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.read");

    return withTenantDb(ctx.tenantId, async (db) => {
      const rows = await db.signalMember.findMany({
        where: { tenantId: ctx.tenantId },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });

      return rows.map((m) => ({
        userId: m.userId,
        name: m.user.name ?? m.user.email,
        email: m.user.email,
        role: m.role,
        roleLabel: SIGNAL_ROLE_LABEL[m.role],
      }));
    });
  });
}

export async function setMemberRole(
  raw: z.input<typeof MemberSchema>
): Promise<SignalResult<{ role: string }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.member.write");
    const input = MemberSchema.parse(raw);

    if (input.userId === ctx.userId && input.role !== "ADMIN") {
      // Rebaixar a si mesmo pode deixar a organização sem ninguém que possa
      // promover alguém de volta — e o caminho de saída seria o suporte.
      throw new SignalRuleError(
        "member.self-demote",
        "Peça a outro administrador para mudar o seu papel: rebaixar a si mesmo pode deixar a organização sem quem promova de volta."
      );
    }

    await withTenantDb(ctx.tenantId, async (db) => {
      const before = await db.signalMember.findUnique({
        where: {
          tenantId_userId: { tenantId: ctx.tenantId, userId: input.userId },
        },
        include: { user: { select: { name: true, email: true } } },
      });
      if (!before) {
        throw new SignalRuleError(
          "member.not-found",
          "Esta pessoa não faz parte do Signal nesta organização."
        );
      }

      await db.signalMember.update({
        where: { id: before.id },
        data: { role: input.role, updatedBy: ctx.userId },
      });

      await logSignalAudit(db, ctx, {
        action: "Papel alterado",
        entityType: "signal.member",
        entityId: input.userId,
        target: before.user.name ?? before.user.email,
        diff: [
          [
            FIELD_LABELS.role,
            SIGNAL_ROLE_LABEL[before.role],
            SIGNAL_ROLE_LABEL[input.role],
          ],
        ],
      });
    });

    revalidatePath("/signal/settings");
    return { role: input.role };
  });
}

export type AddableMember = { userId: string; name: string; email: string };

/** Pessoas da organização que ainda não têm papel no Signal. */
export async function listAddableMembers(): Promise<
  SignalResult<AddableMember[]>
> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.member.write");

    return withTenantDb(ctx.tenantId, async (db) => {
      const [people, existing] = await Promise.all([
        db.tenantMember.findMany({
          where: { tenantId: ctx.tenantId },
          select: {
            userId: true,
            user: { select: { name: true, email: true } },
          },
        }),
        db.signalMember.findMany({
          where: { tenantId: ctx.tenantId },
          select: { userId: true },
        }),
      ]);
      const has = new Set(existing.map((m) => m.userId));
      return people
        .filter((p) => !has.has(p.userId))
        .map((p) => ({
          userId: p.userId,
          name: p.user.name ?? p.user.email,
          email: p.user.email,
        }));
    });
  });
}

/**
 * Dá papel no Signal a uma pessoa da organização (P1-c da QA). `setMemberRole`
 * só troca papel de quem já tem linha; sem este caminho, quem tinha o módulo e
 * nenhum papel caía em signal-indisponivel sem saída. Mesmo desenho do SA-05 do
 * Scaffold: só quem já é do MESMO tenant, sem autoalteração, teto de papel.
 */
export async function addSignalMember(
  raw: z.input<typeof MemberSchema>
): Promise<SignalResult<{ role: string }>> {
  return await signalAction(async () => {
    const ctx = await requireSignalPermissionContext("signal.member.write");
    const input = MemberSchema.parse(raw);

    if (input.userId === ctx.userId) {
      throw new SignalRuleError(
        "member.self",
        "Ninguém altera o próprio papel. Peça a outro administrador do Signal."
      );
    }
    if (!canAssignSignalRole(ctx.signalRole, input.role)) {
      throw new SignalRuleError(
        "member.role-ceiling",
        "Você não atribui um papel acima do seu."
      );
    }

    await withTenantDb(ctx.tenantId, async (db) => {
      const person = await db.tenantMember.findFirst({
        where: { tenantId: ctx.tenantId, userId: input.userId },
        select: { userId: true, user: { select: { name: true, email: true } } },
      });
      if (!person) {
        throw new SignalRuleError(
          "member.not-in-tenant",
          "Esta pessoa não faz parte da organização."
        );
      }

      // Trinco por tenant e pessoa: duas adições ao mesmo tempo não criam a
      // linha duas vezes nem uma passa por cima da outra.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:${input.userId}`}, 0))`;

      const existing = await db.signalMember.findUnique({
        where: {
          tenantId_userId: { tenantId: ctx.tenantId, userId: input.userId },
        },
        select: { id: true },
      });
      if (existing) {
        throw new SignalRuleError(
          "member.exists",
          "Esta pessoa já está no Signal. Para mudar o papel, use a lista de pessoas."
        );
      }

      await db.signalMember.create({
        data: {
          tenantId: ctx.tenantId,
          userId: input.userId,
          role: input.role,
          updatedBy: ctx.userId,
        },
      });
      await logSignalAudit(db, ctx, {
        action: "Pessoa adicionada ao Signal",
        entityType: "signal.member",
        entityId: input.userId,
        target: person.user.name ?? person.user.email,
        diff: [[FIELD_LABELS.role, "—", SIGNAL_ROLE_LABEL[input.role]]],
      });
    });

    // Depois do commit: o papel vem de cache, e quem acabou de ganhar acesso
    // continuaria vendo "indisponível" até ele expirar.
    await invalidateSignalRoleCache(ctx.tenantId, input.userId);

    revalidatePath("/signal/settings");
    return { role: input.role };
  });
}
