import { database, withTenantDb } from "@repo/database";
import { log } from "@repo/observability/log";
import { captureException } from "@sentry/nextjs";
import { inngest } from "./client";
import { emitProductEvent } from "./emit-product-event";

// CH-DEV-07 / CH-PO-04 — vencimento por cadência.
//
// Duas coisas envelhecem sozinhas no plano de controles:
//   • evidência ACEITA cuja validade (pela cadência) passou => VENCIDA. Vencido
//     bloqueia a decisão do caso (CH-DEV-06) e avisa o Scaffold e o Signal por
//     `charter/control.expired`;
//   • controle DISPENSADO cujo prazo de revisão passou => REABERTO, com evento.
//     Dispensa sem fim vira exceção permanente sem dono.
//
// Roda de madrugada, uma vez por dia, com concorrência 1 (mesma forma de
// `scaffold-stall.ts`). Diária basta: a menor cadência é semanal.
//
// Não usa `platformDb`: roda no app do cliente e percorre tenant a tenant, cada
// um dentro do seu `withTenantDb`. Um tenant que falha não derruba os outros.
//
// Idempotente: cada UPDATE leva o estado esperado no where, e só quem de fato
// mudou gera evento e anúncio. Reexecutar no mesmo dia não faz nada.

type Expired = { id: string; useCaseId: string; code: string };

export type ExpiryResult = { expired: Expired[]; reopened: number };

export async function expireDueControls(
  tenantId: string,
  now: Date
): Promise<ExpiryResult> {
  return await withTenantDb(tenantId, async (db) => {
    const acceptedDue = await db.charterCaseControl.findMany({
      where: { tenantId, state: "ACCEPTED", expiresAt: { lte: now } },
      select: { id: true, useCaseId: true, code: true },
    });
    const dispensedDue = await db.charterCaseControl.findMany({
      where: { tenantId, state: "DISPENSED", dispensedUntil: { lte: now } },
      select: { id: true, useCaseId: true, code: true },
    });

    const events: {
      tenantId: string;
      caseControlId: string;
      action: "EXPIRE" | "REOPEN";
      actorId: null;
      fromState: "ACCEPTED" | "DISPENSED";
      toState: "EXPIRED" | "REOPENED";
      comment: string | null;
    }[] = [];
    const audits: {
      tenantId: string;
      userId: null;
      actorId: null;
      actorType: "system";
      action: string;
      entityType: "charter.casecontrol";
      entityId: string;
      diff: [string, string, string][];
      metadata: { target: string; origin: string };
    }[] = [];
    const audit = (
      control: Expired,
      action: string,
      from: string,
      to: string
    ) =>
      audits.push({
        tenantId,
        userId: null,
        actorId: null,
        actorType: "system",
        action,
        entityType: "charter.casecontrol",
        entityId: control.id,
        diff: [["Estado", from, to]],
        metadata: {
          target: `${control.code}`,
          origin: "charter-control-expiry",
        },
      });
    const expired: Expired[] = [];

    for (const control of acceptedDue) {
      // A condição de vencimento repete no UPDATE: entre o SELECT e o UPDATE a
      // evidência pode ter sido renovada (expiresAt novo).
      const updated = await db.charterCaseControl.updateMany({
        where: {
          id: control.id,
          tenantId,
          state: "ACCEPTED",
          expiresAt: { lte: now },
        },
        data: { state: "EXPIRED" },
      });
      if (updated.count === 0) {
        continue;
      }
      expired.push(control);
      audit(control, "Controle vencido", "ACCEPTED", "EXPIRED");
      events.push({
        tenantId,
        caseControlId: control.id,
        action: "EXPIRE",
        actorId: null,
        fromState: "ACCEPTED",
        toState: "EXPIRED",
        comment: "A validade da evidência aceita terminou.",
      });
    }

    let reopened = 0;
    for (const control of dispensedDue) {
      const updated = await db.charterCaseControl.updateMany({
        where: {
          id: control.id,
          tenantId,
          state: "DISPENSED",
          dispensedUntil: { lte: now },
        },
        data: {
          state: "REOPENED",
          dispensedUntil: null,
          dispensedReason: null,
        },
      });
      if (updated.count === 0) {
        continue;
      }
      reopened += 1;
      audit(
        control,
        "Controle reaberto por prazo de dispensa",
        "DISPENSED",
        "REOPENED"
      );
      events.push({
        tenantId,
        caseControlId: control.id,
        action: "REOPEN",
        actorId: null,
        fromState: "DISPENSED",
        toState: "REOPENED",
        comment: "O prazo de revisão da dispensa venceu.",
      });
    }

    if (events.length > 0) {
      await db.charterCaseControlEvent.createMany({ data: events });
      // Ato do sistema também deixa a trilha de auditoria do Charter. Ator
      // "system": não há pessoa no job.
      await db.auditLog.createMany({ data: audits });
    }
    return { expired, reopened };
  });
}

export const expireCharterControls = inngest.createFunction(
  {
    id: "charter-control-expiry",
    triggers: [{ cron: "0 4 * * *" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    // Tenants com Charter contratado e vigente. Varrer quem não contratou seria
    // trabalho sobre tabela vazia.
    const tenants = await step.run("tenants-com-charter", () =>
      database.tenantModule.findMany({
        where: {
          module: "CHARTER",
          status: { in: ["ACTIVE", "TRIAL"] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { tenantId: true },
      })
    );

    let expired = 0;
    let reopened = 0;
    let failedTenants = 0;

    for (const { tenantId } of tenants) {
      const outcome = await step.run(`vencimento-${tenantId}`, async () => {
        try {
          const now = new Date();
          const result = await expireDueControls(tenantId, now);
          // Depois da transação: o anúncio é de um fato já confirmado (X-04).
          for (const control of result.expired) {
            await emitProductEvent("charterControlExpired", {
              tenantId,
              useCaseId: control.useCaseId,
              caseControlId: control.id,
              controlCode: control.code,
              at: now.toISOString(),
            });
          }
          return {
            expired: result.expired.length,
            reopened: result.reopened,
            failed: false,
          };
        } catch (error) {
          log.error("[charter-control-expiry] tenant falhou", {
            tenantId,
            error: String(error),
          });
          // Job noturno que falha em silêncio deixa controle vencido sem
          // bloquear a decisão: vai ao Sentry, não só ao log.
          captureException(error, {
            tags: { job: "charter-control-expiry" },
            extra: { tenantId },
          });
          return { expired: 0, reopened: 0, failed: true };
        }
      });
      expired += outcome.expired;
      reopened += outcome.reopened;
      failedTenants += outcome.failed ? 1 : 0;
    }

    return { tenants: tenants.length, expired, reopened, failedTenants };
  }
);
