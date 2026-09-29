"use server";

import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";
import { upsertProcessRegistry } from "@/lib/scaffold/process-registry";
import { logScaffoldAudit } from "./_shared";

// X-01 — liga os ids dos quatro produtos ao mesmo processo.
//
// Permissão: `track.manage`, de quem abre a trilha a partir do gap e cujo gate
// protege o vínculo. Cada id é conferido no mesmo tenant dentro do
// `withTenantDb` (ver lib/scaffold/process-registry.ts).

const LinkSchema = z.object({
  name: z.string().trim().min(1).max(255),
  workForm: z
    .enum(["CONVERSATIONAL", "ANALYSIS", "DOC_REVIEW", "TRIAGE", "REPORTING"])
    .optional(),
  meridianGapId: z.string().trim().min(1).optional(),
  scaffoldTrackId: z.string().trim().min(1).optional(),
  signalInitiativeId: z.string().trim().min(1).optional(),
  charterUseCaseId: z.string().trim().min(1).optional(),
});

export async function linkProcess(
  raw: z.input<typeof LinkSchema>
): Promise<ScaffoldResult<{ registryId: string; created: boolean }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("track.manage");
    const input = LinkSchema.parse(raw);

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const linked = await upsertProcessRegistry(db, {
        tenantId: ctx.tenantId,
        ...input,
      });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.process.link",
        entityType: "scaffold.processlink",
        entityId: linked.id,
        target: input.name,
        note: linked.created
          ? "Registro de processo criado."
          : "Registro de processo completado.",
      });
      return linked;
    });

    revalidatePath("/scaffold");
    return { registryId: result.id, created: result.created };
  });
}
