"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";
import { tenantPorSlug } from "@/lib/tenants";

/**
 * Aba Usuários do detalhe do tenant (SRD FR-4.2).
 *
 * A regra que carrega esta action é o **guard de último ADMIN** (FR-4.2.4), que
 * o README lista entre as que "não podem ser reimplementadas por aproximação" —
 * e que não existia: `LAST_ADMIN_BLOCKED` aparece mockado num teste do app como
 * se fosse rejeição de uma camada madura, mas um grep em `apps` e `packages`
 * não acha a implementação em lugar nenhum.
 *
 * Vocabulário: o handoff fala em OWNER. O enum `MemberRole` deste schema é
 * ADMIN|STE|RTE|SM|PO|DEV|MEMBER, sem OWNER — ADMIN é quem administra o tenant,
 * então é ele que o guard protege. Inventar OWNER só para casar com o texto do
 * handoff exigiria migration e quebraria todo o RBAC existente.
 */

const PAPEIS = ["ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"] as const;

export type TenantMemberRow = {
  id: string;
  nome: string | null;
  email: string;
  role: string;
  desde: string;
};

export async function listTenantMembers(
  slug: string
): Promise<Result<TenantMemberRow[]>> {
  return await safeAction(async () => {
    // Sem assertCanWrite: leitura é de todo staff (FR-0.4).
    await requirePlatformStaff();
    const tenant = await tenantPorSlug(slug);

    const membros = await database.tenantMember.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });

    return membros.map((m) => ({
      id: m.id,
      nome: m.user.name,
      email: m.user.email,
      role: m.role,
      desde: m.createdAt.toISOString(),
    }));
  });
}

const MudarPapelSchema = z.object({
  slug: z.string().min(1),
  memberId: z.string().min(1),
  role: z.enum(PAPEIS),
});

export async function updateTenantMemberRoleAction(
  input: z.input<typeof MudarPapelSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = MudarPapelSchema.parse(input);
    const tenant = await tenantPorSlug(dados.slug);

    // Guard de IDOR: o memberId vem do cliente e só vale dentro deste tenant.
    const membro = await database.tenantMember.findFirst({
      where: { id: dados.memberId, tenantId: tenant.id },
      select: {
        id: true,
        role: true,
        user: { select: { email: true } },
      },
    });
    if (!membro) {
      throw new StaffAuthError("FORBIDDEN", "Membro não encontrado.");
    }

    // FR-4.2.4 — o tenant não pode ficar sem dono.
    //
    // A contagem só acontece quando se está TIRANDO um ADMIN: promover alguém
    // nunca deixa o tenant órfão, e contar sempre seria uma ida ao banco por
    // mudança de papel sem decisão nenhuma a tomar.
    const estaRemovendoAdmin =
      membro.role === "ADMIN" && dados.role !== "ADMIN";
    if (estaRemovendoAdmin) {
      const admins = await database.tenantMember.count({
        where: { tenantId: tenant.id, role: "ADMIN" },
      });
      if (admins <= 1) {
        throw new StaffAuthError(
          "FORBIDDEN",
          `${membro.user.email} é o último ADMIN de ${tenant.slug}. Promova outro membro antes de rebaixar este — o tenant não pode ficar sem dono.`
        );
      }
    }

    await database.tenantMember.update({
      where: { id: membro.id },
      data: { role: dados.role },
    });

    await logPlatformAudit(database, {
      tenantId: tenant.id,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "tenant_member",
      entityId: membro.id,
      target: `${tenant.slug} · ${membro.user.email}: ${membro.role} → ${dados.role}`,
      // Tupla [campo, antes, depois] — é a forma que o AuditLog carrega e a
      // que o DATA-MODEL especifica; objeto aninhado não é aceito pelo tipo.
      diff: [["role", membro.role, dados.role]],
    });

    revalidatePath(`/clientes/${tenant.slug}`);
    return { id: membro.id };
  });
}
