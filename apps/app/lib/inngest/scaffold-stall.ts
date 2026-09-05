import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import {
  DEFAULT_STALL_THRESHOLD_DAYS,
  isStalled,
  stalledDays,
} from "../scaffold/stall";
import { inngest } from "./client";

// S-09 / SN-07 — varredura de estagnação.
//
// Uma trilha parada não avisa ninguém sozinha: o gate não fecha, o cliente não
// reclama, e o silêncio parece progresso. Esta função é o que transforma
// ausência em sinal.
//
// Roda de madrugada, uma vez por dia, com concorrência 1 — espelha
// `solution-staleness.ts`, que resolve a mesma forma de problema. Diária basta:
// o limiar é de 14 dias, e varrer de hora em hora só multiplicaria escrita para
// detectar o mesmo fato meio dia antes.
//
// A varredura NÃO usa `platformDb`: ela roda no app do cliente e percorre
// tenant a tenant. Ler todos de uma vez seria mais rápido e quebraria a
// ADR-0013 por conveniência de job.

export const checkScaffoldStall = inngest.createFunction(
  {
    id: "scaffold-stall-check",
    triggers: [{ cron: "0 3 * * *" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    // Tenants com Scaffold contratado e vigente. Varrer quem não contratou
    // seria trabalho sobre tabela vazia.
    const tenants = await step.run("tenants-com-scaffold", () =>
      database.tenantModule.findMany({
        where: {
          module: "SCAFFOLD",
          status: { in: ["ACTIVE", "TRIAL"] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { tenantId: true },
      })
    );

    let flagged = 0;
    let cleared = 0;

    for (const { tenantId } of tenants) {
      const result = await step.run(`stall-${tenantId}`, async () => {
        const settings = await database.scaffoldSettings.findUnique({
          where: { tenantId },
          select: { stallThresholdDays: true },
        });
        const threshold =
          settings?.stallThresholdDays ?? DEFAULT_STALL_THRESHOLD_DAYS;

        const tracks = await database.scaffoldTrack.findMany({
          where: { tenantId, status: { in: ["ACTIVE", "STALLED"] } },
          select: {
            id: true,
            code: true,
            processName: true,
            status: true,
            lastGateAt: true,
            startedAt: true,
            ownerId: true,
            consultantId: true,
          },
        });

        let marked = 0;
        let unmarked = 0;

        for (const t of tracks) {
          const days = stalledDays(t.lastGateAt, t.startedAt);
          const stalled = isStalled(days, threshold);

          // Escreve só quando o estado MUDA. Sem isto, toda trilha estagnada
          // gera uma escrita por noite e o audit vira ruído — e o dono para de
          // ler a notificação que importa.
          if (stalled && t.status !== "STALLED") {
            await database.scaffoldTrack.update({
              where: { id: t.id },
              data: { status: "STALLED" },
            });
            marked++;

            // Fire-and-forget, conforme o princípio II da constituição: o
            // provedor de notificação fora do ar não pode derrubar a varredura
            // e deixar as outras trilhas sem verificação.
            try {
              await database.auditLog.create({
                data: {
                  tenantId,
                  actorId: "system",
                  actorType: "system",
                  action: "scaffold.track.stalled",
                  entityType: "scaffold.track",
                  entityId: t.id,
                  metadata: {
                    target: `${t.code} · ${t.processName}`,
                    days,
                    threshold,
                    // Quem precisa saber: o dono do processo e quem responde
                    // pela entrega.
                    notify: [t.ownerId, t.consultantId].filter(Boolean),
                  },
                },
              });
            } catch (e) {
              log.error("[scaffold-stall] audit falhou", {
                trackId: t.id,
                error: String(e),
              });
            }
          } else if (!stalled && t.status === "STALLED") {
            // Trilha voltou a andar. Limpar é tão importante quanto marcar: uma
            // bandeira que nunca sai deixa de ser sinal.
            await database.scaffoldTrack.update({
              where: { id: t.id },
              data: { status: "ACTIVE" },
            });
            unmarked++;
          }
        }

        return { marked, unmarked };
      });

      flagged += result.marked;
      cleared += result.unmarked;
    }

    log.info("[scaffold-stall] varredura concluída", {
      tenants: tenants.length,
      flagged,
      cleared,
    });

    return { tenants: tenants.length, flagged, cleared };
  }
);
