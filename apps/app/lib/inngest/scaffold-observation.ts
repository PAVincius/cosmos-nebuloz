import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { observationVerdict } from "../scaffold/observation";
import { inngest } from "./client";

// SG-06 — fecha a janela de observação de 30 dias.
//
// `closePhase` ABRE a janela; nada a fechava. Este é o outro lado: sem ele, uma
// trilha que sobreviveu os 30 dias ficaria em `OBSERVING` para sempre, e o
// critério de sucesso do PRD — "o processo sobrevive 30 dias sem a Nebuloz" —
// nunca seria atingido por ninguém.
//
// Roda de madrugada, uma vez por dia. Diária basta: a janela é de 30 dias, e
// varrer de hora em hora só entregaria a trilha meio dia antes.
//
// Esta função NÃO fecha gate. Ela lê o veredito de uma janela que já foi aberta
// por uma decisão humana e marca a trilha como entregue. `state = CLOSED`
// continua com um dono só (`closePhase`), e o teste de arquitetura continua
// verde.

export const closeScaffoldObservation = inngest.createFunction(
  {
    id: "scaffold-observation-close",
    triggers: [{ cron: "0 4 * * *" }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const due = await step.run("janelas-vencidas", () =>
      database.scaffoldPhaseInstance.findMany({
        where: {
          state: "OBSERVING",
          phase: "EMBED",
          observationEndsAt: { lte: new Date() },
          track: { status: { in: ["ACTIVE", "STALLED"] } },
        },
        select: {
          id: true,
          observationEndsAt: true,
          reopenCount: true,
          reopenCountAtClose: true,
          track: {
            select: {
              id: true,
              tenantId: true,
              code: true,
              processName: true,
            },
          },
        },
      })
    );

    let embedded = 0;
    let reopened = 0;

    for (const p of due) {
      const result = await step.run(`observation-${p.id}`, async () => {
        const verdict = observationVerdict({
          // `step.run` serializa o resultado em JSON: a `Date` volta como
          // string, e comparar string com `Date.now()` daria NaN em silêncio.
          observationEndsAt: p.observationEndsAt
            ? new Date(p.observationEndsAt)
            : null,
          reopenCount: p.reopenCount,
          reopenCountAtClose: p.reopenCountAtClose,
        });

        // Reaberta depois que a contagem começou: o processo NÃO sobreviveu
        // sozinho. A trilha não é entregue, e a fase fica onde está — quem
        // reabriu decide o próximo passo, não este job.
        if (verdict.status !== "embedded") {
          return { embedded: false, reopened: verdict.status === "reopened" };
        }

        const now = new Date();
        await database.scaffoldTrack.update({
          where: { id: p.track.id },
          data: { status: "EMBEDDED", embeddedAt: now },
        });

        // A FASE NÃO É TOCADA, de propósito.
        //
        // A primeira versão deste job zerava `observationEndsAt`, e o teste de
        // arquitetura reprovou — com razão. `closePhase` é o único dono da
        // escrita de fase, e abrir exceção "só para limpar um campo" é como a
        // regra morre: o próximo job precisa de "só mais um campo".
        //
        // Não é preciso: `observationEndsAt` no passado com a trilha em
        // EMBEDDED já é o estado correto, e `observationVerdict` lê exatamente
        // isso. O que mudou foi a TRILHA, não a decisão sobre o gate.

        try {
          await database.auditLog.create({
            data: {
              tenantId: p.track.tenantId,
              actorId: "system",
              actorType: "system",
              action: "scaffold.track.embedded",
              entityType: "scaffold.track",
              entityId: p.track.id,
              metadata: {
                target: `${p.track.code} · ${p.track.processName}`,
                note: "Janela de observação de 30 dias concluída sem reabertura.",
              },
            },
          });
        } catch (e) {
          // Fire-and-forget, constituição §II: audit fora do ar não pode
          // impedir a entrega de uma trilha que cumpriu o critério.
          log.error("[scaffold-observation] audit falhou", {
            trackId: p.track.id,
            error: String(e),
          });
        }

        return { embedded: true, reopened: false };
      });

      if (result.embedded) {
        embedded++;
      }
      if (result.reopened) {
        reopened++;
      }
    }

    log.info("[scaffold-observation] varredura concluída", {
      due: due.length,
      embedded,
      reopened,
    });

    return { due: due.length, embedded, reopened };
  }
);
