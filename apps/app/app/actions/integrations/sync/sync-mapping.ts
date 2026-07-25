import { database } from "@repo/database";

// ─── Linear ───────────────────────────────────────────────────────────────────

export function upsertLinearMapping(args: {
  tenantId: string;
  linearId: string;
  linearType: string;
  cosmosId: string;
  cosmosType: string;
}) {
  return database.linearSync.upsert({
    where: {
      tenantId_linearId_linearType: {
        tenantId: args.tenantId,
        linearId: args.linearId,
        linearType: args.linearType,
      },
    },
    create: {
      tenantId: args.tenantId,
      linearId: args.linearId,
      linearType: args.linearType,
      cosmosId: args.cosmosId,
      cosmosType: args.cosmosType,
    },
    update: {
      cosmosId: args.cosmosId,
      cosmosType: args.cosmosType,
      lastSyncedAt: new Date(),
    },
  });
}

export function findLinearMapping(args: {
  tenantId: string;
  linearId: string;
  linearType: string;
}) {
  return database.linearSync.findUnique({
    where: {
      tenantId_linearId_linearType: {
        tenantId: args.tenantId,
        linearId: args.linearId,
        linearType: args.linearType,
      },
    },
  });
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

export function upsertGitHubMapping(args: {
  tenantId: string;
  githubRepo: string;
  githubNumber: number;
  githubType: string;
  cosmosId: string;
  cosmosType: string;
}) {
  return database.gitHubSync.upsert({
    where: {
      tenantId_githubRepo_githubNumber_githubType: {
        tenantId: args.tenantId,
        githubRepo: args.githubRepo,
        githubNumber: args.githubNumber,
        githubType: args.githubType,
      },
    },
    create: {
      tenantId: args.tenantId,
      githubRepo: args.githubRepo,
      githubNumber: args.githubNumber,
      githubType: args.githubType,
      cosmosId: args.cosmosId,
      cosmosType: args.cosmosType,
    },
    update: {
      cosmosId: args.cosmosId,
      cosmosType: args.cosmosType,
      lastSyncedAt: new Date(),
    },
  });
}

export function findGitHubMapping(args: {
  tenantId: string;
  githubRepo: string;
  githubNumber: number;
  githubType: string;
}) {
  return database.gitHubSync.findUnique({
    where: {
      tenantId_githubRepo_githubNumber_githubType: {
        tenantId: args.tenantId,
        githubRepo: args.githubRepo,
        githubNumber: args.githubNumber,
        githubType: args.githubType,
      },
    },
  });
}
