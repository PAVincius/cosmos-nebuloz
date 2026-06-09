"use server";

import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../_base";
import { listDecisions } from "./decision-log";

const ExportSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine(
    (d) => d.to.getTime() - d.from.getTime() <= 365 * 24 * 60 * 60 * 1000,
    { message: "Export period cannot exceed 1 year" }
  );

export async function exportDecisionsCSV(
  raw: unknown
): Promise<Result<{ csv: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = ExportSchema.parse(raw);
    const entries = await listDecisions(ctx.tenantId, {
      from: input.from,
      to: input.to,
    });

    const header =
      "data,tipo,target_type,target_id,decisao,justificativa,decisor_id";

    const rows = entries.map((e) => {
      const ts =
        (e as Record<string, unknown>).dataDecisao ??
        (e as Record<string, unknown>).createdAt;
      const date = ts ? new Date(ts as string).toISOString().slice(0, 10) : "";
      const esc = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      return [
        date,
        esc(e.tipo),
        esc(e.targetType),
        esc(e.targetId),
        esc(e.decisao),
        esc(e.justificativa),
        esc(e.decisorId),
      ].join(",");
    });

    return { csv: [header, ...rows].join("\n") };
  });
}
