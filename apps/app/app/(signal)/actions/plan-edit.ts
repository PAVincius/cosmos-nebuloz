"use server";

import { withTenantDb } from "@repo/database";
import { z } from "zod";
import { SignalRuleError } from "@/lib/signal/errors";
import { requireInitiativeOwnership } from "@/lib/signal/guards";
import { diffMetricEdit } from "@/lib/signal/plan";
import { nnStr } from "../../actions/_base";
import {
  type Db,
  logSignalAudit,
  type SignalResult,
  signalAction,
} from "./_shared";
import {
  decisionContext,
  Id,
  loadMetric,
  recordEvent,
  revalidate,
  writeGuarded,
} from "./plan-shared";

// Edição de métrica: cria versão nova.
// Regras e ordem dos portões: ver plan-shared.ts.

// ── Editar (nova versão) ──────────────────────────────────────────────────────

const EditSchema = Id.extend({
  name: nnStr.optional(),
  formula: z.string().trim().min(3).max(2000).optional(),
  targetValue: z.number().finite().nullable().optional(),
  ownerId: nnStr.nullable().optional(),
});

export async function editMetric(
  raw: z.input<typeof EditSchema>
): Promise<SignalResult<{ version: number }>> {
  return await signalAction(async () => {
    const ctx = await decisionContext("edit");
    const input = EditSchema.parse(raw);

    const result = await withTenantDb(ctx.tenantId, async (db) => {
      const metric = await loadMetric(db, ctx.tenantId, input.id);
      requireInitiativeOwnership(ctx, metric.initiative);

      const { patch, changes } = diffMetricEdit(metric, input);
      if (patch.ownerId) {
        await requireTenantMember(db, ctx.tenantId, String(patch.ownerId));
      }

      const version = metric.version + 1;
      await writeGuarded(db, ctx, metric, { ...patch, version });
      await recordEvent(db, ctx, metric, {
        action: "EDIT",
        fromState: metric.state,
        toState: metric.state,
        version,
        changes,
      });
      await logSignalAudit(db, ctx, {
        action: "Métrica editada (nova versão)",
        entityType: "signal.planmetric",
        entityId: metric.id,
        target: `${metric.initiative.code} · ${metric.name}`,
        diff: changes,
      });
      return { version, code: metric.initiative.code };
    });

    revalidate(result.code);
    return { version: result.version };
  });
}

/** Responsável precisa ser da organização E ter papel no Signal: quem não tem
 *  papel não enxerga o plano que estaria respondendo. */
async function requireTenantMember(db: Db, tenantId: string, userId: string) {
  const member = await db.signalMember.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });
  if (!member) {
    throw new SignalRuleError(
      "plan.owner.not-member",
      "O responsável precisa ser membro desta organização com papel no Signal."
    );
  }
}
