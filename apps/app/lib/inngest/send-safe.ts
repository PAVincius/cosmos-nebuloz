import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { inngest } from "@/lib/inngest/client";

type InngestEvent = Parameters<typeof inngest.send>[0];

// Sends event to Inngest; on failure, enqueues in JobFallbackQueue for later drain.
export async function sendSafe(
  event: InngestEvent,
  tenantId?: string
): Promise<void> {
  try {
    await inngest.send(event);
  } catch (e) {
    log.error("[sendSafe] inngest.send failed — falling back to DB queue", {
      error: String(e),
    });

    const name = Array.isArray(event) ? event[0]?.name : event.name;
    const payload = Array.isArray(event) ? event : [event];

    await database.jobFallbackQueue
      .create({
        data: {
          tenantId: tenantId ?? null,
          jobType: String(name ?? "unknown"),
          payload: payload as object[],
          status: "PENDING",
        },
      })
      .catch((dbErr) => {
        log.error("[sendSafe] fallback DB write also failed", dbErr);
      });
  }
}
