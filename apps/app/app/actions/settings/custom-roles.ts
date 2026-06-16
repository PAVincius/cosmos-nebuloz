"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { err, ok, type Result } from "../_base";

const ALLOWED_PERMISSIONS = [
  "epic:read",
  "epic:write",
  "epic:transition",
  "feature:read",
  "feature:write",
  "story:read",
  "story:write",
  "sprint:read",
  "sprint:manage",
  "standup:write",
  "art:manage",
  "pi-plan:read",
  "pi-plan:manage",
  "governance:approve",
  "budget:read",
  "budget:write",
  "member:read",
  "analytics:read",
  "reporting:export",
  "impediment:manage",
  "retro:manage",
  "wsjf:write",
] as const;

type AllowedPermission = (typeof ALLOWED_PERMISSIONS)[number];

const CreateRoleSchema = z.object({
  name: z.string().min(1).max(80),
  permissions: z.array(z.string()).default([]),
});

export type CustomRoleRow = {
  id: string;
  name: string;
  permissions: string[];
  assignmentCount: number;
};

export async function listCustomRoles(): Promise<Result<CustomRoleRow[]>> {
  try {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.customRole.findMany({
      where: { tenantId: ctx.tenantId },
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        permissions: r.permissions,
        assignmentCount: r._count.assignments,
      }))
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao listar roles");
  }
}

export async function createCustomRole(
  raw: unknown
): Promise<Result<CustomRoleRow>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const input = CreateRoleSchema.parse(raw);
    const permissions = input.permissions.filter((p) =>
      ALLOWED_PERMISSIONS.includes(p as AllowedPermission)
    );

    const role = await database.customRole.create({
      data: { tenantId: ctx.tenantId, name: input.name, permissions },
      include: { _count: { select: { assignments: true } } },
    });

    revalidatePath("/settings/roles");
    return ok({
      id: role.id,
      name: role.name,
      permissions: role.permissions,
      assignmentCount: 0,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao criar role");
  }
}

export async function updateCustomRole(
  id: string,
  raw: unknown
): Promise<Result<CustomRoleRow>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const input = CreateRoleSchema.parse(raw);
    const permissions = input.permissions.filter((p) =>
      ALLOWED_PERMISSIONS.includes(p as AllowedPermission)
    );

    const existing = await database.customRole.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return err("Role não encontrada");
    }

    const updated = await database.customRole.update({
      where: { id },
      data: { name: input.name, permissions },
      include: { _count: { select: { assignments: true } } },
    });

    revalidatePath("/settings/roles");
    return ok({
      id: updated.id,
      name: updated.name,
      permissions: updated.permissions,
      assignmentCount: updated._count.assignments,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao atualizar role");
  }
}

export async function deleteCustomRole(
  id: string
): Promise<Result<{ deleted: true }>> {
  try {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN"], ctx);

    const existing = await database.customRole.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      return err("Role não encontrada");
    }

    await database.customRole.delete({ where: { id } });
    revalidatePath("/settings/roles");
    return ok({ deleted: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Erro ao excluir role");
  }
}

export { ALLOWED_PERMISSIONS };
