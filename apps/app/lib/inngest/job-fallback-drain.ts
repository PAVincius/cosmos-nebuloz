import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "@/lib/inngest/client";

const BATCH_SIZE = 50;

// Drains PENDING jobs from JobFallbackQueue — runs every 5 minutes.
// When Inngest recovers from an outage, queued events are replayed automatically.
export const drainJobFallbackQueue = inngest.createFunction(
  {
    id: "drain-job-fallback-queue",
    name: "Drain Job Fallback Queue",
    triggers: [{ cron: "*/5 * * * *" }],
    concurrency: { limit: 1 },
    retries: 2,
  },
  async ({ step }) => {
    const pending = await step.run("fetch-pending", () =>
      database.jobFallbackQueue.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
      })
    );

    if (pending.length === 0) {
      return { drained: 0 };
    }

    let drained = 0;

    for (const job of pending) {
      await step.run(`drain-job-${job.id}`, async () => {
        try {
          const events = job.payload as Parameters<typeof inngest.send>[0];
          await inngest.send(events);

          await database.jobFallbackQueue.update({
            where: { id: job.id },
            data: { status: "DONE" },
          });

          drained++;
        } catch (e) {
          const attempts = job.attempts + 1;
          const status = attempts >= 3 ? "FAILED" : "PENDING";

          await database.jobFallbackQueue.update({
            where: { id: job.id },
            data: {
              status,
              attempts,
              lastError: e instanceof Error ? e.message : String(e),
            },
          });

          log.error("[drain-fallback] job failed", { jobId: job.id, attempts });
        }
      });
    }

    return { drained, total: pending.length };
  }
);
