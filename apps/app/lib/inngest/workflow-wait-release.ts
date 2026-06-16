// Story-028 AC-007: wait-state webhook release with Redis SETNX idempotency
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import type { MachineConfig } from "@/lib/bpmn/compiler";
import { inngest } from "./client";

const IDEMPOTENCY_TTL = 86_400 * 7; // 7 days

async function acquireReleaseLock(
  storyId: string,
  prId: string
): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return true; // CI: skip
  }
  const { redis } = await import("@repo/rate-limit");
  // SETNX: returns "OK" on first set, null if key exists
  const result = await redis.set(
    `workflow:wait-release:${storyId}:${prId}`,
    "1",
    { nx: true, ex: IDEMPOTENCY_TTL }
  );
  return result !== null; // null = already processed
}

export const releaseWorkflowWaitState = inngest.createFunction(
  {
    id: "workflow-wait-state-release",
    triggers: [{ event: "integration/github.webhook" }],
    concurrency: { limit: 5 },
  },
  async ({ event, step }) => {
    const {
      tenantId,
      event: ghEvent,
      pull_request,
    } = event.data as {
      tenantId: string;
      event: string;
      pull_request?: {
        number: number;
        merged: boolean;
        action?: string;
        html_url?: string;
      };
      action?: string;
    };

    // Only act on PR merged events
    const action = event.data.action as string | undefined;
    if (
      ghEvent !== "pull_request" ||
      action !== "closed" ||
      !pull_request?.merged
    ) {
      return { skipped: true };
    }

    const prId = String(pull_request.number);

    // Find stories in a wait-state waiting for this PR
    const stories = await step.run("find-waiting-stories", () =>
      database.story.findMany({
        where: {
          tenantId,
          workflowState: { not: null },
          workflowContext: { path: ["prId"], equals: prId },
        },
        select: {
          id: true,
          tenantId: true,
          title: true,
          workflowState: true,
          featureId: true,
        },
      })
    );

    if (stories.length === 0) {
      log.info("[workflow-wait-release] no stories waiting for PR", {
        prId,
        tenantId,
      });
      return { released: 0 };
    }

    let released = 0;

    for (const story of stories) {
      await step.run(`release-story-${story.id}`, async () => {
        // Idempotency check
        const acquired = await acquireReleaseLock(story.id, prId);
        if (!acquired) {
          log.info("[workflow-wait-release] already processed (idempotent)", {
            storyId: story.id,
            prId,
          });
          return;
        }

        // Load compiled machine to find next state
        const bpmnDef = await database.bpmnDefinition.findFirst({
          where: {
            tenantId,
            ownerId: story.featureId ?? story.id,
            ownerType: "TEAM",
            active: true,
          },
          select: { compiledMachine: true },
        });

        if (!bpmnDef?.compiledMachine) {
          return;
        }

        const machine = bpmnDef.compiledMachine as MachineConfig;
        const stateConfig = machine.states[story.workflowState ?? ""];
        const nextTransition = stateConfig?.on?.NEXT;
        if (!nextTransition) {
          return;
        }

        const newState = nextTransition.target;

        await database.$transaction([
          database.story.update({
            where: { id: story.id },
            data: { workflowState: newState },
          }),
          database.stateTransitionHistory.create({
            data: {
              tenantId,
              entityId: story.id,
              entityType: "Story",
              fromStatus: story.workflowState ?? "",
              toStatus: newState,
              userId: null,
              reason: `AUTO: github.pr.merged prId=${prId}`,
              externalRef: prId,
            },
          }),
        ]);

        released++;
        log.info("[workflow-wait-release] story released from wait-state", {
          storyId: story.id,
          prId,
          newState,
        });
      });
    }

    return { released };
  }
);
