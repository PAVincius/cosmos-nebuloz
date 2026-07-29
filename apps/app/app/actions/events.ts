/**
 * Domain event system — single dispatch point for cross-entity communication.
 *
 * dispatchEvent() is fire-and-forget for notifications, audit, and webhooks.
 * It NEVER throws — failures in side effects must not block the main mutation.
 *
 * Called from server actions after a successful DB write:
 *   void dispatchEvent({ type: "sprint.activated", ... })
 */
import "server-only";
import { webhooks } from "@repo/webhooks";
import { logAudit } from "./audit/log-audit";
import { pushNotification } from "./notifications/push-notification";
import { findRecipientsByRole } from "./notify-recipients";

// ─── Event union ──────────────────────────────────────────────────────────────

export type DomainEvent =
  // Sprint lifecycle
  | {
      type: "sprint.activated";
      sprintId: string;
      sprintName: string;
      teamId: string;
      tenantId: string;
      userId: string;
    }
  | {
      type: "sprint.completed";
      sprintId: string;
      sprintName: string;
      teamId: string;
      velocity: number;
      tenantId: string;
      userId: string;
    }
  // Story lifecycle
  | {
      type: "story.status_changed";
      storyId: string;
      storyTitle: string;
      from: string;
      to: string;
      assigneeUserId?: string;
      tenantId: string;
      userId: string;
    }
  | {
      type: "story.assigned";
      storyId: string;
      storyTitle: string;
      assigneeUserId: string;
      tenantId: string;
      userId: string;
    }
  // Risk lifecycle
  | {
      type: "risk.created";
      riskId: string;
      riskTitle: string;
      impact: string;
      tenantId: string;
      userId: string;
    }
  | {
      type: "risk.status_changed";
      riskId: string;
      riskTitle: string;
      from: string;
      to: string;
      ownerUserId?: string;
      tenantId: string;
      userId: string;
    }
  // PI lifecycle
  | {
      type: "pi.created";
      piPlanId: string;
      artId: string;
      tenantId: string;
      userId: string;
    }
  | {
      type: "pi.confidence_vote_required";
      piSessionId: string;
      piPlanId: string;
      artId: string;
      tenantId: string;
    }
  // Feature lifecycle
  | {
      type: "feature.created";
      featureId: string;
      featureTitle: string;
      epicId: string;
      tenantId: string;
      userId: string;
    }
  | {
      type: "feature.updated";
      featureId: string;
      featureTitle: string;
      tenantId: string;
      userId: string;
    }
  | {
      type: "feature.wsjf_updated";
      featureId: string;
      featureTitle: string;
      oldScore: number;
      newScore: number;
      tenantId: string;
      userId: string;
    }
  // Impediment + Defect
  | {
      type: "impediment.created";
      impedimentId: string;
      impedimentTitle: string;
      teamId?: string;
      tenantId: string;
      userId: string;
    }
  | {
      type: "defect.created";
      defectId: string;
      defectTitle: string;
      severity: string;
      teamId?: string;
      tenantId: string;
      userId: string;
    }
  // Epic
  | {
      type: "epic.created";
      epicId: string;
      epicTitle: string;
      tenantId: string;
      userId: string;
    };

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export function dispatchEvent(event: DomainEvent): void {
  // All three are fire-and-forget — errors must never propagate to callers
  void handleNotifications(event).catch(() => null);
  void handleAudit(event).catch(() => null);
  void webhooks.send(event.type, event).catch(() => null);
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function handleNotifications(event: DomainEvent): Promise<void> {
  switch (event.type) {
    case "sprint.activated": {
      const sms = await findRecipientsByRole(event.tenantId, ["SM"]);
      for (const userId of sms) {
        pushNotification(event.tenantId, {
          userId,
          type: "system",
          title: `Sprint "${event.sprintName}" ativado`,
          metadata: { sprintId: event.sprintId, teamId: event.teamId },
        });
      }
      break;
    }

    case "sprint.completed": {
      const recipients = await findRecipientsByRole(event.tenantId, [
        "RTE",
        "SM",
      ]);
      for (const userId of recipients) {
        pushNotification(event.tenantId, {
          userId,
          type: "system",
          title: `Sprint "${event.sprintName}" concluído — velocity: ${event.velocity} SP`,
          metadata: {
            sprintId: event.sprintId,
            teamId: event.teamId,
            velocity: event.velocity,
          },
        });
      }
      break;
    }

    case "story.assigned": {
      pushNotification(event.tenantId, {
        userId: event.assigneeUserId,
        type: "assignment",
        title: `Nova story atribuída: "${event.storyTitle}"`,
        metadata: { storyId: event.storyId },
      });
      break;
    }

    case "story.status_changed": {
      if (event.to === "DONE") {
        const recipients = await findRecipientsByRole(event.tenantId, [
          "PO",
          "SM",
        ]);
        for (const userId of recipients) {
          pushNotification(event.tenantId, {
            userId,
            type: "system",
            title: `Story concluída: "${event.storyTitle}"`,
            metadata: { storyId: event.storyId },
          });
        }
      }
      break;
    }

    case "risk.created": {
      if (event.impact === "critical") {
        const recipients = await findRecipientsByRole(event.tenantId, [
          "RTE",
          "STE",
        ]);
        for (const userId of recipients) {
          pushNotification(event.tenantId, {
            userId,
            type: "risk",
            title: `Risco crítico identificado: "${event.riskTitle}"`,
            metadata: { riskId: event.riskId },
          });
        }
      }
      break;
    }

    case "risk.status_changed": {
      if (event.ownerUserId) {
        pushNotification(event.tenantId, {
          userId: event.ownerUserId,
          type: "system",
          title: `Risco atualizado: "${event.riskTitle}" → ${event.to}`,
          metadata: { riskId: event.riskId, from: event.from, to: event.to },
        });
      }
      break;
    }

    case "pi.confidence_vote_required": {
      const recipients = await findRecipientsByRole(event.tenantId, [
        "RTE",
        "STE",
        "SM",
        "PO",
        "DEV",
      ]);
      for (const userId of recipients) {
        pushNotification(event.tenantId, {
          userId,
          type: "system",
          title: "Votação de confiança do PI iniciada — vote agora",
          metadata: {
            piSessionId: event.piSessionId,
            piPlanId: event.piPlanId,
          },
        });
      }
      break;
    }

    case "impediment.created": {
      const sms = await findRecipientsByRole(event.tenantId, ["SM"]);
      for (const userId of sms) {
        pushNotification(event.tenantId, {
          userId,
          type: "system",
          title: `Novo impedimento: "${event.impedimentTitle}"`,
          metadata: { impedimentId: event.impedimentId, teamId: event.teamId },
        });
      }
      break;
    }

    case "defect.created": {
      if (event.severity === "critical") {
        const sms = await findRecipientsByRole(event.tenantId, ["SM"]);
        for (const userId of sms) {
          pushNotification(event.tenantId, {
            userId,
            type: "risk",
            title: `Defect crítico criado: "${event.defectTitle}"`,
            metadata: { defectId: event.defectId, teamId: event.teamId },
          });
        }
      }
      break;
    }
  }
}

// ─── Audit ────────────────────────────────────────────────────────────────────

async function handleAudit(event: DomainEvent): Promise<void> {
  type AuditMapping = {
    action: "created" | "updated" | "deleted";
    entityType: string;
    entityId: string;
  };

  const e = event as Record<string, unknown>;
  const userId = typeof e.userId === "string" ? e.userId : undefined;

  const mapping = ((): AuditMapping | null => {
    switch (event.type) {
      case "sprint.activated":
        return {
          action: "updated",
          entityType: "Sprint",
          entityId: event.sprintId,
        };
      case "sprint.completed":
        return {
          action: "updated",
          entityType: "Sprint",
          entityId: event.sprintId,
        };
      case "story.status_changed":
        return {
          action: "updated",
          entityType: "Story",
          entityId: event.storyId,
        };
      case "story.assigned":
        return {
          action: "updated",
          entityType: "Story",
          entityId: event.storyId,
        };
      case "risk.created":
        return {
          action: "created",
          entityType: "Risk",
          entityId: event.riskId,
        };
      case "risk.status_changed":
        return {
          action: "updated",
          entityType: "Risk",
          entityId: event.riskId,
        };
      case "pi.created":
        return {
          action: "created",
          entityType: "PIPlan",
          entityId: event.piPlanId,
        };
      case "feature.created":
        return {
          action: "created",
          entityType: "Feature",
          entityId: event.featureId,
        };
      case "feature.updated":
        return {
          action: "updated",
          entityType: "Feature",
          entityId: event.featureId,
        };
      case "feature.wsjf_updated":
        return {
          action: "updated",
          entityType: "Feature",
          entityId: event.featureId,
        };
      case "impediment.created":
        return {
          action: "created",
          entityType: "Impediment",
          entityId: event.impedimentId,
        };
      case "defect.created":
        return {
          action: "created",
          entityType: "Defect",
          entityId: event.defectId,
        };
      case "epic.created":
        return {
          action: "created",
          entityType: "Epic",
          entityId: event.epicId,
        };
      default:
        return null;
    }
  })();

  if (!mapping) {
    return;
  }

  logAudit(event.tenantId, {
    userId,
    action: mapping.action,
    entityType: mapping.entityType,
    entityId: mapping.entityId,
    diff: { eventType: event.type },
  });
}
