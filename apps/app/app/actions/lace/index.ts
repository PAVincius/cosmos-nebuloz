"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database, type LACE } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { type Result, safeAction } from "../_base";
import {
  type AddPrincipleInput,
  AddPrincipleSchema,
  type UpsertLACEInput,
  UpsertLACESchema,
} from "./schema";

export type { UpsertLACEInput, AddPrincipleInput };

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getLACE(): Promise<Result<LACE | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    return database.lACE.findFirst({
      where: { tenantId: ctx.tenantId },
    });
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function upsertLACE(raw: unknown): Promise<Result<LACE>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const data = UpsertLACESchema.parse(raw);

    const lace = await database.lACE.upsert({
      where: { tenantId: ctx.tenantId },
      create: {
        tenantId: ctx.tenantId,
        name: data.name,
        description: data.description ?? null,
        principles: data.principles,
      },
      update: {
        name: data.name,
        description: data.description ?? null,
        principles: data.principles,
      },
    });

    revalidatePath("/lace");
    return lace;
  });
}

export async function addPrinciple(raw: unknown): Promise<Result<LACE>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const { principle } = AddPrincipleSchema.parse(raw);

    const existing = await database.lACE.findFirst({
      where: { tenantId: ctx.tenantId },
    });

    const current = Array.isArray(existing?.principles)
      ? (existing.principles as string[])
      : [];

    if (current.includes(principle)) {
      throw new Error("Princípio já existe.");
    }

    const updated = await database.lACE.upsert({
      where: { tenantId: ctx.tenantId },
      create: {
        tenantId: ctx.tenantId,
        name: "LACE",
        principles: [principle],
      },
      update: {
        principles: [...current, principle],
      },
    });

    revalidatePath("/lace");
    return updated;
  });
}

export async function removePrinciple(
  principle: string
): Promise<Result<LACE>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const existing = await database.lACE.findFirst({
      where: { tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("LACE não encontrado.");
    }

    const current = Array.isArray(existing.principles)
      ? (existing.principles as string[])
      : [];

    const updated = await database.lACE.update({
      where: { tenantId: ctx.tenantId },
      data: {
        principles: current.filter((p) => p !== principle),
      },
    });

    revalidatePath("/lace");
    return updated;
  });
}

export async function reorderPrinciples(
  principles: string[]
): Promise<Result<LACE>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const validated = z
      .array(z.string().min(1).max(200))
      .max(50)
      .parse(principles);

    const existing = await database.lACE.findFirst({
      where: { tenantId: ctx.tenantId },
    });
    if (!existing) {
      throw new Error("LACE não encontrado.");
    }

    const updated = await database.lACE.update({
      where: { tenantId: ctx.tenantId },
      data: { principles: validated },
    });

    revalidatePath("/lace");
    return updated;
  });
}
