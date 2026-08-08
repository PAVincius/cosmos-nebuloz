import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { isDue, previousFireTime } from "@/lib/reporting/schedule";
import { inngest } from "./client";

/**
 * Varredura dos relatórios agendados.
 *
 * O `ScheduledReport.cronExpression` era gravado pela UI e lido por ninguém:
 * `runScheduledReport` só tem trigger de evento, e o único emissor era o
 * botão manual de PDF. Esta função é o emissor que faltava.
 *
 * LEITURA CROSS-TENANT DELIBERADA: a varredura precisa enxergar os
 * relatórios de todos os tenants — é job de plataforma, não requisição de
 * usuário. É a única consulta de relatório sem `tenantId` no `where`, e o
 * `tenantId` de cada linha é propagado para a execução criada.
 */

type StepLike = {
  run: <T>(id: string, fn: () => T | Promise<T>) => Promise<T>;
};

type RelatorioCarregado = {
  id: string;
  tenantId: string;
  cronExpression: string;
  timezone: string;
  lastRunAt: Date | string | null;
};

export async function dispatchScheduledReports({
  step,
  now,
}: {
  step: StepLike;
  now: Date;
}): Promise<{ examinados: number; disparados: number }> {
  const carregados = await step.run("carregar-habilitados", () =>
    database.scheduledReport.findMany({
      where: { enabled: true },
      select: {
        id: true,
        tenantId: true,
        cronExpression: true,
        timezone: true,
        lastRunAt: true,
      },
    })
  );

  // `step.run` serializa seu retorno em JSON para poder retomar a execução:
  // do outro lado, `lastRunAt` chega como string ISO, não Date. Sem reidratar,
  // `isDue` compara string com número e decide errado em produção — e o teste
  // não pega, porque o mock de step.run devolve o objeto sem serializar.
  const reports = (carregados as RelatorioCarregado[]).map((r) => ({
    ...r,
    lastRunAt: r.lastRunAt ? new Date(r.lastRunAt) : null,
  }));

  let disparados = 0;

  for (const report of reports) {
    // `isDue` devolve `false` tanto para "não venceu" quanto para "cron ou
    // timezone inválidos" — sem distinguir os dois casos aqui, um relatório
    // mal configurado nunca dispara e nada acusa o motivo. Checar
    // `previousFireTime` primeiro isola o caso de configuração quebrada.
    const anterior = previousFireTime(
      { cronExpression: report.cronExpression, timezone: report.timezone },
      now
    );
    if (!anterior) {
      log.error("[scheduled-report-dispatch] cron ou timezone inválidos", {
        reportId: report.id,
        tenantId: report.tenantId,
        cronExpression: report.cronExpression,
        timezone: report.timezone,
      });
      continue;
    }

    if (
      !isDue(
        {
          cronExpression: report.cronExpression,
          timezone: report.timezone,
          lastRunAt: report.lastRunAt,
        },
        now
      )
    ) {
      continue;
    }

    try {
      // `lastRunAt` primeiro. A varredura roda a cada 15 minutos e pode se
      // sobrepor sob retry; gravando depois do envio, a segunda varredura
      // reenviaria o mesmo relatório.
      await step.run(`marcar-${report.id}`, () =>
        database.scheduledReport.update({
          where: { id: report.id },
          data: { lastRunAt: now },
        })
      );

      const execution = await step.run(`criar-execucao-${report.id}`, () =>
        database.scheduledReportExecution.create({
          data: {
            tenantId: report.tenantId,
            reportId: report.id,
            status: "PENDING",
          },
        })
      );

      await step.run(`emitir-${report.id}`, () =>
        inngest.send({
          name: "reporting/scheduled-report.run",
          data: {
            reportId: report.id,
            executionId: execution.id,
            triggeredBy: "cron",
          },
        })
      );

      disparados += 1;
    } catch (e) {
      // Um relatório que falha não pode levar os outros junto.
      log.error("[scheduled-report-dispatch] falha ao disparar", {
        reportId: report.id,
        error: String(e),
      });
    }
  }

  return { examinados: reports.length, disparados };
}

export const scheduledReportDispatch = inngest.createFunction(
  {
    id: "scheduled-report-dispatch",
    triggers: [{ cron: "*/15 * * * *" }],
    concurrency: { limit: 1 },
  },
  ({ step }) =>
    // O `step` real do Inngest é estruturalmente mais rico que `StepLike`
    // (retorno tipado via `Jsonify`); o cast mantém o handler testável sem
    // acoplar `dispatchScheduledReports` aos tipos internos do SDK.
    dispatchScheduledReports({ step: step as StepLike, now: new Date() })
);
