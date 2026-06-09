// Story-025: GitHub SAFe-Aware Sync — PR linking, deployment tracking, DORA
import { database } from "@repo/database";
import {
  extractStorySequenceIds,
  type GitHubPR,
  isLinkedPR,
} from "@/lib/github/pr-linking";
import { upsertGitHubMapping } from "./sync-mapping";

export type GitHubWebhookPayload =
  | GitHubPRPayload
  | GitHubDeploymentStatusPayload
  | GitHubGenericPayload;

type GitHubGenericPayload = {
  action: string;
  issue?: {
    number: number;
    title: string;
    body?: string;
    updated_at: string;
    state: "open" | "closed";
  };
  repository?: { full_name: string };
};

type GitHubPRPayload = {
  action: "opened" | "edited" | "closed" | "reopened" | "synchronize";
  pull_request: {
    number: number;
    title: string;
    body?: string | null;
    html_url: string;
    head: { ref: string };
    state: "open" | "closed";
    merged: boolean;
    merged_at?: string | null;
  };
  repository: { full_name: string };
};

type GitHubDeploymentStatusPayload = {
  action: "created";
  deployment_status: {
    id: number;
    state: "success" | "failure" | "error" | "pending";
    environment: string;
  };
  deployment: {
    id: number;
    sha: string;
    ref: string;
    created_at: string;
    payload?: { prNumber?: number };
  };
  repository: { full_name: string };
};

function isPRPayload(p: GitHubWebhookPayload): p is GitHubPRPayload {
  return "pull_request" in p;
}

function isDeploymentStatusPayload(
  p: GitHubWebhookPayload
): p is GitHubDeploymentStatusPayload {
  return "deployment_status" in p;
}

export async function handleGitHubWebhook(
  tenantId: string,
  integrationId: string,
  payload: GitHubWebhookPayload
): Promise<void> {
  if (isPRPayload(payload)) {
    await handlePREvent(tenantId, integrationId, payload);
    return;
  }

  if (isDeploymentStatusPayload(payload)) {
    await handleDeploymentStatus(tenantId, integrationId, payload);
    return;
  }

  // Legacy issue handling (backwards-compatible)
  const gp = payload as GitHubGenericPayload;
  if (gp.issue && gp.repository && gp.action !== "deleted") {
    await handleLegacyIssue(tenantId, gp);
  }
}

// ─── PR handling ──────────────────────────────────────────────────────────────

async function handlePREvent(
  tenantId: string,
  integrationId: string,
  payload: GitHubPRPayload
): Promise<void> {
  const { pull_request: pr, repository } = payload;

  const githubPR: GitHubPR = {
    number: pr.number,
    title: pr.title,
    body: pr.body,
    headBranch: pr.head.ref,
    url: pr.html_url,
    state: pr.merged ? "merged" : pr.state === "open" ? "open" : "closed",
    mergedAt: pr.merged_at,
  };

  const storySequenceIds = extractStorySequenceIds(githubPR);

  // AC-004: unlinked PR — save to panel, don't drop silently
  if (!isLinkedPR(githubPR)) {
    if (pr.merged) {
      await database.gitHubUnlinkedPR.create({
        data: {
          tenantId,
          githubRepo: repository.full_name,
          prNumber: pr.number,
          prTitle: pr.title,
          prUrl: pr.html_url,
          prStatus: "MERGED",
          headBranch: pr.head.ref,
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        },
      });
    }
    return;
  }

  // Look up Stories by ART-scoped sequence IDs
  const prStatus = pr.merged
    ? "MERGED"
    : pr.state === "open"
      ? "OPEN"
      : "CLOSED";
  const stories = await database.story.findMany({
    where: {
      tenantId,
      // Stories with matching artScopedId-like sequential number
      // Fallback: match externalId pattern COSMOS-{n}
    },
    select: { id: true, status: true, featureId: true },
    take: storySequenceIds.length * 2, // over-fetch; filter below
  });

  // Also try to find by externalId = COSMOS-{n}
  const cosmosIdStories = await database.story.findMany({
    where: {
      tenantId,
      externalId: {
        in: storySequenceIds.map((n) => `COSMOS-${n}`),
      },
    },
    select: { id: true, status: true, featureId: true },
  });

  const allStories = [...stories, ...cosmosIdStories];

  for (const story of allStories) {
    await database.story.updateMany({
      where: { id: story.id, tenantId },
      data: {
        prStatus,
        prUrl: pr.html_url,
        ...(pr.merged && story.status !== "DONE"
          ? {
              status: "DONE",
              completedAt: pr.merged_at ? new Date(pr.merged_at) : new Date(),
            }
          : {}),
      },
    });

    // AC-001: StateTransitionHistory on merge
    if (pr.merged && story.status !== "DONE") {
      await database.stateTransitionHistory.create({
        data: {
          tenantId,
          entityType: "Story",
          entityId: story.id,
          fromStatus: story.status,
          toStatus: "DONE",
          userId: null,
          externalRef: `${repository.full_name}#${pr.number}`,
        },
      });
    }

    // Upsert GitHub mapping
    await upsertGitHubMapping({
      tenantId,
      githubRepo: repository.full_name,
      githubNumber: pr.number,
      githubType: "pull_request",
      cosmosId: story.id,
      cosmosType: "Story",
    });

    await writeSyncEvent({
      tenantId,
      integrationId,
      direction: "INBOUND",
      action: "UPDATED",
      entityType: "Story",
      entityId: story.id,
      externalId: `${repository.full_name}#${pr.number}`,
    });
  }
}

// ─── Deployment status handling ───────────────────────────────────────────────

async function handleDeploymentStatus(
  tenantId: string,
  integrationId: string,
  payload: GitHubDeploymentStatusPayload
): Promise<void> {
  const { deployment_status, deployment, repository } = payload;

  // Record deployment event for DORA computation
  await database.gitHubDeploymentEvent.create({
    data: {
      tenantId,
      integrationId,
      githubRepo: repository.full_name,
      deploymentId: String(deployment.id),
      environment: deployment_status.environment,
      state: deployment_status.state,
      sha: deployment.sha,
      prNumber: deployment.payload?.prNumber ?? null,
      deployedAt: new Date(),
    },
  });

  if (
    deployment_status.state !== "success" ||
    !["production", "prod"].includes(
      deployment_status.environment.toLowerCase()
    )
  ) {
    return;
  }

  // AC-003: mark linked Stories as DEPLOYED, check Feature.deployedAt
  const prNumber = deployment.payload?.prNumber;
  if (!prNumber) {
    return;
  }

  const linkedStories = await database.story.findMany({
    where: { tenantId, prUrl: { contains: `/pull/${prNumber}` } },
    select: { id: true, featureId: true },
  });

  for (const story of linkedStories) {
    await database.story.updateMany({
      where: { id: story.id, tenantId },
      data: { status: "DEPLOYED" } as Record<string, unknown>,
    });
  }

  // Check if all stories under each feature are DEPLOYED → set Feature.deployedAt
  const featureIds = [
    ...new Set(
      linkedStories
        .map((s) => s.featureId)
        .filter((id): id is string => id !== null)
    ),
  ];

  for (const featureId of featureIds) {
    const allStories = await database.story.findMany({
      where: { tenantId, featureId },
      select: { status: true },
    });
    const allDeployed = allStories.every((s) => s.status === "DEPLOYED");
    if (allDeployed && allStories.length > 0) {
      await database.feature.updateMany({
        where: { id: featureId, tenantId },
        data: { deployedAt: new Date() },
      });
    }
  }
}

// ─── Legacy issue handling (backwards-compatible) ─────────────────────────────

async function handleLegacyIssue(
  tenantId: string,
  payload: GitHubGenericPayload
): Promise<void> {
  const { issue, repository } = payload;
  if (!(issue && repository)) {
    return;
  }

  const mapping = await database.gitHubSync.findFirst({
    where: {
      tenantId,
      githubRepo: repository.full_name,
      githubNumber: issue.number,
      githubType: "issue",
    },
  });

  if (!mapping) {
    return;
  }

  if (mapping.cosmosType === "Epic") {
    await database.epic.updateMany({
      where: { id: mapping.cosmosId, tenantId },
      data: { title: issue.title, descriptionMd: issue.body ?? null },
    });
  } else if (mapping.cosmosType === "Feature") {
    await database.feature.updateMany({
      where: { id: mapping.cosmosId, tenantId },
      data: { title: issue.title },
    });
  } else if (mapping.cosmosType === "Story") {
    await database.story.updateMany({
      where: { id: mapping.cosmosId, tenantId },
      data: { title: issue.title, description: issue.body ?? null },
    });
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function writeSyncEvent(args: {
  tenantId: string;
  integrationId: string;
  direction: string;
  action: string;
  entityType: string;
  entityId: string;
  externalId?: string;
}): Promise<void> {
  await database.gitHubSyncEvent.create({
    data: {
      tenantId: args.tenantId,
      integrationId: args.integrationId,
      direction: args.direction,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      externalId: args.externalId ?? null,
    },
  });
}
