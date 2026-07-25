// Story-028 AC-008: SLA breach detection for BPMN wait-states
// Cron: finds stories in wait-state exceeding cosmos:slaHours, escalates, creates HIGH anomaly.
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import type { MachineConfig } from "@/lib/bpmn/compiler";
import { inngest } from "./client";

const SM_ROLE = "SCRUM_MASTER";

export const checkWorkflowSla = inngest.createFunction(
  {
    id: "workflow-sla-check",
    triggers: [{ cron: "0 * * * *" }], // every hour
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    // 1. Find all stories currently in a custom workflow state
    const stories = await step.run("find-stories-in-workflow", () =>
      database.story.findMany({
        where: { workflowState: { not: null } },
        select: {
          id: true,
          tenantId: true,
          title: true,
          workflowState: true,
          featureId: true,
          assigneeUserId: true,
          sprintId: true,
        },
      })
    );

    if (stories.length === 0) {
      return { checked: 0, breaches: 0 };
    }

    let breaches = 0;

    for (const story of stories) {
      await step.run(`check-sla-${story.id}`, async () => {
        const { tenantId, workflowState } = story;
        if (!workflowState) {
          return;
        }

        // Load active BpmnDefinition for this story's team
        const bpmnDef = await database.bpmnDefinition.findFirst({
          where: {
            tenantId,
            ownerId: story.featureId ?? story.id,
            active: true,
          },
          select: { id: true, compiledMachine: true },
        });

        if (!bpmnDef?.compiledMachine) {
          return;
        }

        const machine = bpmnDef.compiledMachine as MachineConfig;
        const stateConfig = machine.states[workflowState];
        const slaHours = stateConfig?.meta?.slaHours as number | undefined;
        if (!slaHours) {
          return; // no SLA on this state
        }

        // Find when story entered this state
        const lastTransition = await database.stateTransitionHistory.findFirst({
          where: { tenantId, entityId: story.id, toStatus: workflowState },
          orderBy: { transitionedAt: "desc" },
          select: { transitionedAt: true },
        });

        if (!lastTransition) {
          return;
        }

        const elapsedHours =
          (Date.now() - lastTransition.transitionedAt.getTime()) / 3_600_000;

        if (elapsedHours < slaHours) {
          return; // within SLA
        }

        // SLA breached — find escalation state (NEXT from current)
        const nextTransition = stateConfig?.on?.NEXT;
        const escalationState = nextTransition?.target ?? "ESCALATED";

        // Transition story to escalation state
        await database.$transaction([
          database.story.update({
            where: { id: story.id },
            data: { workflowState: escalationState },
          }),
          database.stateTransitionHistory.create({
            data: {
              tenantId,
              entityId: story.id,
              entityType: "Story",
              fromStatus: workflowState,
              toStatus: escalationState,
              userId: null,
              reason: `AUTO: WORKFLOW_SLA_BREACH after ${Math.round(elapsedHours)}h (limit: ${slaHours}h)`,
            },
          }),
        ]);

        // Create anomaly detection run + HIGH anomaly
        const run = await database.anomalyDetectionRun.create({
          data: {
            tenantId,
            scope: "story",
            scopeId: story.id,
            snapshotId: story.id, // synthetic: no FlowMetricSnapshot for workflow SLA
            trigger: "cron",
            status: "COMPLETED",
            source: "CRON",
            anomaliesFound: 1,
            completedAt: new Date(),
          },
        });

        await database.anomaly.create({
          data: {
            tenantId,
            runId: run.id,
            rule: "WORKFLOW_SLA_BREACH",
            severity: "HIGH",
            metric: "sla_hours",
            delta: elapsedHours - slaHours,
            entityId: story.id,
            entityType: "Story",
            status: "OPEN",
            metadata: {
              storyTitle: story.title,
              workflowState,
              slaHours,
              elapsedHours: Math.round(elapsedHours),
            },
          },
        });

        // Notify SM — find SM for the ART that owns the team
        let smUserId: string | null = null;
        if (story.sprintId) {
          const sprint = await database.sprint.findFirst({
            where: { id: story.sprintId },
            select: { team: { select: { artId: true } } },
          });
          const artId = sprint?.team?.artId;
          if (artId) {
            const smMembership = await database.aRTMembership.findFirst({
              where: { artId, role: SM_ROLE },
              select: { userId: true },
            });
            smUserId = smMembership?.userId ?? null;
          }
        }
        smUserId ??= story.assigneeUserId;

        if (smUserId) {
          await database.notification.create({
            data: {
              tenantId,
              userId: smUserId,
              type: "anomaly",
              title: `SLA breach: "${story.title}"`,
              body: `Story has been in "${workflowState}" for ${Math.round(elapsedHours)}h (SLA: ${slaHours}h). Escalated automatically.`,
              metadata: {
                rule: "WORKFLOW_SLA_BREACH",
                entityId: story.id,
                entityType: "Story",
                elapsedHours: Math.round(elapsedHours),
                slaHours,
              },
            },
          });
        }

        breaches++;
        log.warn("[workflow-sla] SLA breach escalated", {
          storyId: story.id,
          workflowState,
          elapsedHours: Math.round(elapsedHours),
          slaHours,
        });
      });
    }

    return { checked: stories.length, breaches };
  }
);
