"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import {
  buildPortabilityExport,
  type PortabilityPayload,
} from "@/lib/inngest/lgpd-dsr";
import { type Result, safeAction } from "../_base";

// ─── Submit erasure request (LGPD Art. 18.I — right to erasure) ──────────────

export async function submitErasureRequest(): Promise<
  Result<{ requestId: string }>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const existing = await database.dataSubjectRequest.findFirst({
      where: {
        tenantId: ctx.tenantId,
        subjectId: ctx.userId,
        type: "ERASURE",
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    if (existing) {
      return { requestId: existing.id };
    }

    // O pedido PENDING é o outbox: `/api/cron/lgpd-erasure` (Vercel Cron)
    // processa os PENDING, inclusive os que ficaram sem evento antes.
    const request = await database.dataSubjectRequest.create({
      data: {
        tenantId: ctx.tenantId,
        subjectId: ctx.userId,
        type: "ERASURE",
        status: "PENDING",
      },
    });

    return { requestId: request.id };
  });
}

// ─── Portability export (LGPD Art. 18.IV — right to data portability) ────────

export async function requestPortabilityExport(): Promise<
  Result<PortabilityPayload>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const exportedAt = new Date().toISOString();

    const payload = await buildPortabilityExport(
      ctx.userId,
      ctx.tenantId,
      exportedAt
    );

    database.dataSubjectRequest
      .create({
        data: {
          tenantId: ctx.tenantId,
          subjectId: ctx.userId,
          type: "PORTABILITY",
          status: "COMPLETED",
          processedAt: new Date(),
        },
      })
      .catch(() => null);

    return payload;
  });
}
