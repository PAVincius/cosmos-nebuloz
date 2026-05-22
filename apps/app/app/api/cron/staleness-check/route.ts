import crypto from "node:crypto";
import { database } from "@repo/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${cronSecret}`, "utf8");
  const actual = Buffer.from(authHeader, "utf8");

  if (
    expected.length !== actual.length ||
    !crypto.timingSafeEqual(expected, actual)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 20 * 3_600_000);
  const snapshots = await database.flowMetricSnapshot.findMany({
    where: {
      isArchived: false,
      OR: [
        { lastStalenessCheck: null },
        { lastStalenessCheck: { lt: cutoff } },
      ],
    },
    select: { id: true, tenantId: true },
    take: 200,
  });

  // Touch lastStalenessCheck so these snapshots are not picked up again for 20 h.
  // Full re-scoring logic runs via checkSnapshotStaleness server action (requires a session);
  // the cron marks the check time and the next authenticated page-load will re-score if needed.
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
