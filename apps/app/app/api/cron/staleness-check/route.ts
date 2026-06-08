import { database } from "@repo/database";
import { NextResponse } from "next/server";
import { validateCronSecret } from "../_utils/validate-cron-secret";

const ROWS_PER_TENANT = 20;
const MAX_TENANTS = 50;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!validateCronSecret(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 20 * 3_600_000);
  const overdueWhere = {
    isArchived: false,
    OR: [{ lastStalenessCheck: null }, { lastStalenessCheck: { lt: cutoff } }],
  } as const;

  // Fair-share: discover distinct tenants with overdue snapshots first
  const tenantsWithWork = await database.flowMetricSnapshot.findMany({
    where: overdueWhere,
    select: { tenantId: true },
    distinct: ["tenantId"],
    take: MAX_TENANTS,
  });

  // Fetch up to ROWS_PER_TENANT per tenant so no single tenant monopolises the run
  const snapshots = (
    await Promise.all(
      tenantsWithWork.map(({ tenantId }) =>
        database.flowMetricSnapshot.findMany({
          where: { ...overdueWhere, tenantId },
          select: { id: true, tenantId: true },
          take: ROWS_PER_TENANT,
        })
      )
    )
  ).flat();

  // Touch lastStalenessCheck so these snapshots are not picked up again for 20 h.
  // Full re-scoring runs via checkSnapshotStaleness server action (requires a session);
  // the cron marks the check time and the next authenticated page-load re-scores if needed.
  const results = await Promise.allSettled(
    snapshots.map((s) =>
      database.flowMetricSnapshot.update({
        where: { id: s.id, tenantId: s.tenantId },
        data: { lastStalenessCheck: new Date() },
      })
    )
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ checked: snapshots.length, succeeded, failed });
}
