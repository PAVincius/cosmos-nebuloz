// Story-031: CRDT board reconciliation — Prisma wins strategy (AC-006)
import { createHash } from "node:crypto";
import { database } from "@repo/database";

export type AssignmentSnapshot = {
  featureId: string;
  teamId: string;
  sprintId: string;
  rank: number;
};

export type ReconciliationResult = {
  diverged: boolean;
  lbCount: number;
  dbCount: number;
  divergenceCount: number;
  resolution: "PRISMA_WINS" | "NO_DIVERGENCE";
};

function hashAssignments(assignments: AssignmentSnapshot[]): string {
  const sorted = [...assignments].sort((a, b) =>
    a.featureId.localeCompare(b.featureId)
  );
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

function countDivergence(
  lbMap: Map<string, AssignmentSnapshot>,
  dbMap: Map<string, AssignmentSnapshot>
): number {
  let count = 0;
  for (const [id, dbVal] of dbMap) {
    const lbVal = lbMap.get(id);
    if (
      !lbVal ||
      lbVal.teamId !== dbVal.teamId ||
      lbVal.sprintId !== dbVal.sprintId
    ) {
      count += 1;
    }
  }
  for (const id of lbMap.keys()) {
    if (!dbMap.has(id)) {
      count += 1;
    }
  }
  return count;
}

// AC-006: compare Liveblocks CRDT vs Prisma state, apply Prisma wins if diverged
export async function reconcileBoard(
  tenantId: string,
  piPlanId: string,
  liveblocksAssignments: AssignmentSnapshot[]
): Promise<ReconciliationResult> {
  const dbRows = await database.pIPlanFeatureAssignment.findMany({
    where: { tenantId, piPlanId },
    select: { featureId: true, teamId: true, sprintId: true, rank: true },
  });

  const lbHash = hashAssignments(liveblocksAssignments);
  const dbHash = hashAssignments(dbRows);

  if (lbHash === dbHash) {
    return {
      diverged: false,
      lbCount: liveblocksAssignments.length,
      dbCount: dbRows.length,
      divergenceCount: 0,
      resolution: "NO_DIVERGENCE",
    };
  }

  const lbMap = new Map(liveblocksAssignments.map((a) => [a.featureId, a]));
  const dbMap = new Map(dbRows.map((a) => [a.featureId, a]));
  const divergenceCount = countDivergence(lbMap, dbMap);

  await database.boardReconciliationLog.create({
    data: {
      tenantId,
      surface: "pi-planning",
      entityId: piPlanId,
      lbCount: liveblocksAssignments.length,
      dbCount: dbRows.length,
      divergenceCount,
      resolution: "PRISMA_WINS",
    },
  });

  return {
    diverged: true,
    lbCount: liveblocksAssignments.length,
    dbCount: dbRows.length,
    divergenceCount,
    resolution: "PRISMA_WINS",
  };
}
