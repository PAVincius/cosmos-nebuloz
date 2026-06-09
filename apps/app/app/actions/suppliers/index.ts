"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database, type Supplier } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  buildPage,
  type Page,
  paginationArgs,
  type Result,
  safeAction,
} from "../_base";
import {
  type CreateSupplierInput,
  CreateSupplierSchema,
  type SupplierFilters,
  SupplierFiltersSchema,
  type SupplierWithART,
  type UpdateSupplierInput,
  UpdateSupplierSchema,
} from "./schema";

export type {
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierFilters,
  SupplierWithART,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listSuppliers(
  raw?: unknown
): Promise<Result<Page<Supplier>>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const filters = SupplierFiltersSchema.parse(raw ?? {});
    const { page, limit, artId, status, search } = filters;

    const where = {
      tenantId: ctx.tenantId,
      ...(artId ? { artId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { contact: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      database.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paginationArgs(page, limit),
      }),
      database.supplier.count({ where }),
    ]);

    return buildPage(items as Supplier[], total, page, limit);
  });
}

export async function getSupplierById(id: string): Promise<Result<Supplier>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const supplier = await database.supplier.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!supplier) {
      throw new Error("Fornecedor não encontrado.");
    }
    return supplier as Supplier;
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createSupplier(raw: unknown): Promise<Result<Supplier>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = CreateSupplierSchema.parse(raw);

    if (data.artId) {
      const art = await database.aRT.findFirst({
        where: { id: data.artId, tenantId: ctx.tenantId },
      });
      if (!art) {
        throw new Error("ART não encontrada ou não pertence ao tenant.");
      }
    }

    const supplier = await database.supplier.create({
      data: {
        tenantId: ctx.tenantId,
        artId: data.artId ?? null,
        name: data.name,
        contact: data.contact ?? null,
        description: data.description ?? null,
        status: data.status,
      },
    });

    revalidatePath("/suppliers");
    revalidatePath("/solution-trains");
    return supplier;
  });
}

export async function updateSupplier(
  id: string,
  raw: unknown
): Promise<Result<Supplier>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpdateSupplierSchema.parse(raw);

    const existing = await database.supplier.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("Fornecedor não encontrado.");
    }

    const updated = await database.supplier.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.contact !== undefined
          ? { contact: data.contact ?? null }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description ?? null }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });

    revalidatePath("/suppliers");
    revalidatePath("/solution-trains");
    return updated;
  });
}

export async function deactivateSupplier(
  id: string
): Promise<Result<Supplier>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const existing = await database.supplier.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("Fornecedor não encontrado.");
    }

    const updated = await database.supplier.update({
      where: { id },
      data: { status: "INACTIVE" },
    });

    revalidatePath("/suppliers");
    revalidatePath("/solution-trains");
    return updated;
  });
}

export async function deleteSupplier(
  id: string
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const existing = await database.supplier.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("Fornecedor não encontrado.");
    }

    await database.supplier.delete({ where: { id } });

    revalidatePath("/suppliers");
    revalidatePath("/solution-trains");
    return { id };
  });
}

// ─── Legacy helpers (plain return, no Result wrapper) ─────────────────────────

/** Returns all suppliers directly (no Result wrapper). Used by pages that predate the Result pattern. */
export async function getSuppliers(): Promise<Supplier[]> {
  const ctx = await requireTenantSession(await headers());
  return database.supplier.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { createdAt: "asc" },
  }) as Promise<Supplier[]>;
}
