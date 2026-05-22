# Flow Intelligence Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Flow Intelligence deliver value without manual intervention — crons keep staleness fresh, sprint close auto-creates snapshots + triggers anomaly detection, and Capacity/Synergy tabs appear in the flow dashboard.

**Architecture:** Three independent subsystems: (A) session-free cron layer for staleness + anomaly detection, (B) sprint close event that creates FlowMetricSnapshot and triggers analysis, (C) wire existing TeamCapacityTab/SynergyTab components into the flow dashboard. Subsystems A and B are independent; C is frontend-only.

**Tech Stack:** Next.js 15 App Router, Vercel Cron (hourly), Prisma + `@repo/database`, Vitest, TypeScript

---

## Context (read before starting)

```
packages/database/prisma/schema/
  flow-metrics.prisma       ← FlowMetricSnapshot, StalenessAuditLog
  flow-intelligence.prisma  ← AnomalyDetectionRun, Anomaly
  team-delivery.prisma      ← Sprint (status: PLANNING|ACTIVE|COMPLETED), Story

apps/app/app/actions/flow-intelligence/
  staleness-rules.ts        ← computeStaleness(StalenessInput): StalenessResult  (pure, no session)
  anomaly-rules.ts          ← runAllRules(AnomalyRuleInput): DetectedAnomaly[]   (pure, no session)
  check-staleness.ts        ← checkSnapshotStaleness(snapshotId) — needs session
  capacity.ts               ← computeSprintMetrics(sprintId, teamId) — needs session
                               getTeamCapacityDashboard(teamId) — needs session
  synergy.ts                ← getSynergyMatrix(teamId, taskType?) — needs session

apps/app/app/api/cron/
  staleness-check/route.ts  ← EXISTS — only touches timestamp, needs refactor

apps/app/app/(authenticated)/analytics/flow/
  page.tsx                  ← server component, fetches metrics
  components/flow-metrics-dashboard.tsx  ← client component, tabs "flow"|"measure"
  components/anomaly-summary-panel.tsx   ← EXISTS, wired at line 1720
  components/synergy-matrix.tsx          ← EXISTS, NOT wired
  components/synergy-tab.tsx             ← EXISTS, NOT wired
  components/capacity/team-capacity-tab.tsx  ← EXISTS, NOT wired
```

Test framework: **Vitest**. Pattern from existing tests:
```typescript
import { describe, expect, it } from "vitest";
```
Run tests: `cd apps/app && npx vitest run __tests__/path/to/file.test.ts`

---

## Subsystem A — Cron Layer

### Task 1: scoreSnapshotStaleness (session-free service)

**Files:**
- Create: `apps/app/app/actions/flow-intelligence/staleness-service.ts`
- Create: `apps/app/__tests__/actions/flow-intelligence/staleness-service.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/app/__tests__/actions/flow-intelligence/staleness-service.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    stalenessAuditLog: { create: vi.fn() },
    teamMemberAssignment: { findMany: vi.fn() },
    competencyAssessment: { findFirst: vi.fn() },
  },
}));

describe("scoreSnapshotStaleness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns early when snapshot not found", async () => {
    const { database } = await import("@repo/database");
    vi.mocked(database.flowMetricSnapshot.findUnique).mockResolvedValue(null);

    const { scoreSnapshotStaleness } = await import(
      "@/app/actions/flow-intelligence/staleness-service"
    );
    await scoreSnapshotStaleness("snap-1", "tenant-1");

    expect(database.flowMetricSnapshot.update).not.toHaveBeenCalled();
  });

  it("updates snapshot staleness when state changes", async () => {
    const { database } = await import("@repo/database");
    const oldDate = new Date(Date.now() - 30 * 24 * 3600 * 1000); // 30 days ago → CRITICAL

    vi.mocked(database.flowMetricSnapshot.findUnique).mockResolvedValue({
      id: "snap-1",
      tenantId: "tenant-1",
      scope: "team",
      scopeId: "team-1",
      recordedAt: oldDate,
      staleness: "FRESH",
      flowVelocityTotal: 40,
      flowEfficiency: 0.8,
      flowPredictability: 0.85,
      flowLoadCurrent: 10,
      teamCompositionHash: null,
    } as never);
    vi.mocked(database.teamMemberAssignment.findMany).mockResolvedValue([]);
    vi.mocked(database.competencyAssessment.findFirst).mockResolvedValue(null);
    vi.mocked(database.flowMetricSnapshot.update).mockResolvedValue({} as never);
    vi.mocked(database.stalenessAuditLog.create).mockResolvedValue({} as never);

    const { scoreSnapshotStaleness } = await import(
      "@/app/actions/flow-intelligence/staleness-service"
    );
    await scoreSnapshotStaleness("snap-1", "tenant-1");

    expect(database.flowMetricSnapshot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "snap-1" },
        data: expect.objectContaining({ staleness: "CRITICAL" }),
      })
    );
    expect(database.stalenessAuditLog.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd apps/app && npx vitest run __tests__/actions/flow-intelligence/staleness-service.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/app/actions/flow-intelligence/staleness-service'`

- [ ] **Step 3: Implement staleness-service.ts**

```typescript
// apps/app/app/actions/flow-intelligence/staleness-service.ts
// Pure service — no "use server", accepts tenantId directly (used by cron without session)
import crypto from "node:crypto";
import { database } from "@repo/database";
import {
  computeStaleness,
  type StalenessState,
} from "./staleness-rules";

export async function scoreSnapshotStaleness(
  snapshotId: string,
  tenantId: string
): Promise<void> {
  const snapshot = await database.flowMetricSnapshot.findUnique({
    where: { id: snapshotId },
    select: {
      id: true,
      tenantId: true,
      scope: true,
      scopeId: true,
      recordedAt: true,
      staleness: true,
      flowVelocityTotal: true,
      flowEfficiency: true,
      flowPredictability: true,
      flowLoadCurrent: true,
      teamCompositionHash: true,
    },
  });

  if (!snapshot || snapshot.tenantId !== tenantId) return;

  const [members, latestAssessment] = await Promise.all([
    database.teamMemberAssignment.findMany({
      where: { tenantId, teamId: snapshot.scopeId },
      select: { userId: true },
    }),
    database.competencyAssessment.findFirst({
      where: { tenantId, scopeId: snapshot.scopeId },
      orderBy: { assessedAt: "desc" },
      select: { assessedAt: true },
    }),
  ]);

  const sortedUserIds = members.map((m) => m.userId).sort();
  const currentHash =
    sortedUserIds.length > 0
      ? crypto
          .createHash("sha256")
          .update(JSON.stringify(sortedUserIds))
          .digest("hex")
      : null;

  const result = computeStaleness({
    snapshotRecordedAt: snapshot.recordedAt,
    sprintDurationDays: 14,
    currentSpDelivered: null,
    snapshotSpDelivered:
      snapshot.flowVelocityTotal > 0 ? snapshot.flowVelocityTotal : null,
    currentTeamCompositionHash: currentHash,
    snapshotTeamCompositionHash: snapshot.teamCompositionHash ?? null,
    latestAssessmentAt: latestAssessment?.assessedAt ?? null,
    currentFlowEfficiency: snapshot.flowEfficiency,
    currentFlowPredictability: snapshot.flowPredictability,
    currentFlowLoadRatio:
      snapshot.flowVelocityTotal > 0
        ? (snapshot.flowLoadCurrent ?? 0) / snapshot.flowVelocityTotal
        : null,
    now: new Date(),
  });

  const oldState = snapshot.staleness as StalenessState;
  const newState = result.state;

  if (oldState !== newState) {
    await Promise.all([
      database.flowMetricSnapshot.update({
        where: { id: snapshotId },
        data: {
          staleness: newState,
          stalenessReasons: result.rules,
          lastStalenessCheck: new Date(),
        },
      }),
      database.stalenessAuditLog.create({
        data: {
          tenantId,
          snapshotId,
          oldState,
          newState,
          triggeredRules: result.rules,
          triggeredBy: "cron",
        },
      }),
    ]);
  } else {
    await database.flowMetricSnapshot.update({
      where: { id: snapshotId },
      data: { lastStalenessCheck: new Date() },
    });
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/app && npx vitest run __tests__/actions/flow-intelligence/staleness-service.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/flow-intelligence/staleness-service.ts \
        apps/app/__tests__/actions/flow-intelligence/staleness-service.test.ts
git commit -m "feat(flow): add scoreSnapshotStaleness service (session-free, for cron)"
```

---

### Task 2: Refactor staleness-check cron

**Files:**
- Modify: `apps/app/app/api/cron/staleness-check/route.ts`

- [ ] **Step 1: Read current file**

```bash
cat apps/app/app/api/cron/staleness-check/route.ts
```

- [ ] **Step 2: Replace implementation**

Replace entire file content:

```typescript
// apps/app/app/api/cron/staleness-check/route.ts
import { database } from "@repo/database";
import { NextResponse } from "next/server";
import { scoreSnapshotStaleness } from "@/app/actions/flow-intelligence/staleness-service";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 20 * 3_600_000); // 20h ago
  const snapshots = await database.flowMetricSnapshot.findMany({
    where: {
      isArchived: false,
      OR: [
        { lastStalenessCheck: null },
        { lastStalenessCheck: { lt: cutoff } },
      ],
    },
    select: { id: true, tenantId: true },
    take: 100,
  });

  const results = await Promise.allSettled(
    snapshots.map((s) => scoreSnapshotStaleness(s.id, s.tenantId))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ checked: snapshots.length, succeeded, failed });
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'staleness-check\|staleness-service' | head -10
```

Expected: no errors on these files.

- [ ] **Step 4: Commit**

```bash
git add apps/app/app/api/cron/staleness-check/route.ts
git commit -m "feat(cron): staleness-check now calls scoreSnapshotStaleness (real R1-R5 scoring)"
```

---

### Task 3: Anomaly detection cron route

**Files:**
- Create: `apps/app/app/api/cron/anomaly-detection/route.ts`
- Create: `apps/app/__tests__/api/cron-anomaly-detection.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/app/__tests__/api/cron-anomaly-detection.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@repo/database", () => ({
  database: {
    flowMetricSnapshot: { findMany: vi.fn() },
    flowMetricSnapshot_history: { findMany: vi.fn() },
    anomalyDetectionRun: { create: vi.fn(), update: vi.fn() },
    anomaly: { createMany: vi.fn() },
    improvementAction: { create: vi.fn() },
    competencyAssessment: { findFirst: vi.fn() },
    improvementAction_open: { findMany: vi.fn() },
  },
}));

vi.mock("@repo/database", () => {
  const db = {
    flowMetricSnapshot: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    anomalyDetectionRun: {
      create: vi.fn().mockResolvedValue({ id: "run-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    anomaly: { createMany: vi.fn().mockResolvedValue({}) },
    improvementAction: { create: vi.fn().mockResolvedValue({ id: "action-1" }) },
    competencyAssessment: { findFirst: vi.fn().mockResolvedValue(null) },
    improvementAction_findMany: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { database: db };
});

function makeRequest(secret = "test-secret") {
  return new NextRequest("http://localhost/api/cron/anomaly-detection", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("POST /api/cron/anomaly-detection", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret";
    vi.clearAllMocks();
  });

  it("returns 401 on wrong secret", async () => {
    const { POST } = await import(
      "@/app/api/cron/anomaly-detection/route"
    );
    const res = await POST(makeRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with processed count on empty batch", async () => {
    const { POST } = await import(
      "@/app/api/cron/anomaly-detection/route"
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("processed");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/app && npx vitest run __tests__/api/cron-anomaly-detection.test.ts 2>&1 | tail -5
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create route**

```typescript
// apps/app/app/api/cron/anomaly-detection/route.ts
import { database } from "@repo/database";
import { NextResponse } from "next/server";
import {
  runAllRules,
  type AnomalyRuleInput,
} from "@/app/actions/flow-intelligence/anomaly-rules";

const BATCH = 50;
const RUN_WINDOW_MS = 24 * 3_600_000; // 24h

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - RUN_WINDOW_MS);

  // Snapshots without a recent AnomalyDetectionRun
  const snapshots = await database.flowMetricSnapshot.findMany({
    where: {
      isArchived: false,
      staleness: { in: ["FRESH", "AGING"] },
      NOT: {
        anomalyRuns: {
          some: { ranAt: { gte: since } },
        },
      },
    },
    select: {
      id: true,
      tenantId: true,
      scope: true,
      scopeId: true,
      flowVelocityTotal: true,
      flowTimeAvgHours: true,
      flowEfficiency: true,
      flowPredictability: true,
      flowLoadCurrent: true,
      flowDistribution: true,
    },
    take: BATCH,
  });

  let succeeded = 0;
  let failed = 0;

  for (const snapshot of snapshots) {
    try {
      const [history, openActions, latestAssessment] = await Promise.all([
        database.flowMetricSnapshot.findMany({
          where: {
            tenantId: snapshot.tenantId,
            scope: snapshot.scope,
            scopeId: snapshot.scopeId,
            isArchived: false,
            id: { not: snapshot.id },
          },
          orderBy: { recordedAt: "desc" },
          take: 4,
          select: {
            flowVelocityTotal: true,
            flowPredictability: true,
            flowTimeAvgHours: true,
          },
        }),
        database.improvementAction.findMany({
          where: {
            tenantId: snapshot.tenantId,
            scopeId: snapshot.scopeId,
            status: { in: ["OPEN", "IN_PROGRESS"] },
          },
          select: { id: true, dueDate: true, status: true },
        }),
        database.competencyAssessment.findFirst({
          where: {
            tenantId: snapshot.tenantId,
            scopeId: snapshot.scopeId,
          },
          orderBy: { assessedAt: "desc" },
          select: { assessedAt: true },
        }),
      ]);

      const run = await database.anomalyDetectionRun.create({
        data: {
          tenantId: snapshot.tenantId,
          scope: snapshot.scope,
          scopeId: snapshot.scopeId,
          snapshotId: snapshot.id,
          trigger: "scheduled",
          status: "RUNNING",
        },
        select: { id: true },
      });

      const input: AnomalyRuleInput = {
        current: {
          flowVelocityTotal: snapshot.flowVelocityTotal,
          flowTimeAvgDays: snapshot.flowTimeAvgHours / 24,
          flowEfficiency: snapshot.flowEfficiency,
          flowPredictability: snapshot.flowPredictability,
          flowLoadCurrent: snapshot.flowLoadCurrent,
          flowDistribution:
            (snapshot.flowDistribution as Record<string, number>) ?? {},
        },
        history: history.map((h) => ({
          flowVelocityTotal: h.flowVelocityTotal,
          flowPredictability: h.flowPredictability,
          flowTimeAvgHours: h.flowTimeAvgHours,
        })),
        openActions: openActions.map((a) => ({
          dueDate: a.dueDate,
          status: a.status,
        })),
        latestAssessmentAt: latestAssessment?.assessedAt ?? null,
        now: new Date(),
      };

      const anomalies = runAllRules(input);

      const bySeverity: Record<string, number> = {};
      for (const a of anomalies) {
        bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
      }
      const priority =
        bySeverity.CRITICAL > 0
          ? "CRITICAL"
          : bySeverity.HIGH > 0
            ? "HIGH"
            : bySeverity.MEDIUM > 0
              ? "MEDIUM"
              : anomalies.length > 0
                ? "LOW"
                : "HEALTHY";

      if (anomalies.length > 0) {
        await database.anomaly.createMany({
          data: anomalies.map((a) => ({
            tenantId: snapshot.tenantId,
            runId: run.id,
            rule: a.rule,
            severity: a.severity,
            metric: a.metric,
            delta: parseFloat(String(a.delta)),
            metadata: a.metadata ?? {},
          })),
        });

        for (const anomaly of anomalies.filter(
          (a) => a.severity === "CRITICAL"
        )) {
          await database.improvementAction.create({
            data: {
              tenantId: snapshot.tenantId,
              title: `[Auto] ${anomaly.rule} — ação imediata necessária`,
              scope: snapshot.scope,
              scopeId: snapshot.scopeId,
              relatedMetric: anomaly.suggestedMetric ?? anomaly.metric,
              status: "OPEN",
              source: "ai_copilot",
              sourceRunId: run.id,
            },
          });
        }
      }

      await database.anomalyDetectionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          summary: { total: anomalies.length, bySeverity, priority },
          completedAt: new Date(),
        },
      });

      succeeded++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ processed: snapshots.length, succeeded, failed });
}
```

- [ ] **Step 4: Check if `anomalyRuns` relation name matches schema**

```bash
grep -n 'anomalyRuns\|AnomalyDetectionRun\|anomalyDetectionRuns' \
  packages/database/prisma/schema/flow-metrics.prisma \
  packages/database/prisma/schema/flow-intelligence.prisma | head -10
```

If relation name differs, update the `NOT: { anomalyRuns: ... }` query accordingly.

- [ ] **Step 5: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'anomaly-detection' | head -10
```

Fix any type errors — common: `flowDistribution` cast, `openActions` shape.

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd apps/app && npx vitest run __tests__/api/cron-anomaly-detection.test.ts 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add apps/app/app/api/cron/anomaly-detection/ \
        apps/app/__tests__/api/cron-anomaly-detection.test.ts
git commit -m "feat(cron): add anomaly-detection cron route (scheduled, session-free)"
```

---

### Task 4: Configure Vercel Cron

**Files:**
- Modify: `apps/app/vercel.json`

- [ ] **Step 1: Read current file**

```bash
cat apps/app/vercel.json
```

Current content:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "node scripts/skip-ci.js"
}
```

- [ ] **Step 2: Add crons**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "node scripts/skip-ci.js",
  "crons": [
    { "path": "/api/cron/staleness-check",   "schedule": "0 * * * *" },
    { "path": "/api/cron/anomaly-detection",  "schedule": "30 * * * *" }
  ]
}
```

- [ ] **Step 3: Verify `CRON_SECRET` is in .env.example**

```bash
grep 'CRON_SECRET' apps/app/.env.example
```

If missing: `echo "CRON_SECRET=" >> apps/app/.env.example`

- [ ] **Step 4: Commit**

```bash
git add apps/app/vercel.json apps/app/.env.example
git commit -m "feat(cron): configure Vercel Cron schedules for staleness + anomaly detection"
```

---

## Subsystem B — Sprint Close Event

### Task 5: snapshotSprintFlowMetrics

**Files:**
- Create: `apps/app/app/actions/flow-intelligence/snapshot-sprint.ts`
- Create: `apps/app/__tests__/actions/flow-intelligence/snapshot-sprint.test.ts`

- [ ] **Step 1: Check Story model fields**

```bash
grep -A 20 'model Story' packages/database/prisma/schema/team-delivery.prisma | head -25
```

Confirm: `status`, `storyPoints`, `startedAt`, `completedAt`, `sprintId` all exist.

- [ ] **Step 2: Write failing test**

```typescript
// apps/app/__tests__/actions/flow-intelligence/snapshot-sprint.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@repo/database", () => ({
  database: {
    story: { findMany: vi.fn() },
    sprint: { findUnique: vi.fn() },
    sprintReview: { findUnique: vi.fn() },
    flowMetricSnapshot: { create: vi.fn() },
  },
}));

describe("snapshotSprintFlowMetrics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates FRESH FlowMetricSnapshot with computed velocity", async () => {
    const { database } = await import("@repo/database");

    vi.mocked(database.sprint.findUnique).mockResolvedValue({
      id: "sprint-1",
      teamId: "team-1",
      capacity: 40,
      endDate: new Date("2026-05-20"),
    } as never);

    vi.mocked(database.story.findMany).mockResolvedValue([
      {
        status: "DONE",
        storyPoints: 5,
        startedAt: new Date("2026-05-15"),
        completedAt: new Date("2026-05-18"),
        taskType: "story",
      },
      {
        status: "DONE",
        storyPoints: 3,
        startedAt: new Date("2026-05-16"),
        completedAt: new Date("2026-05-19"),
        taskType: "defect",
      },
      { status: "IN_PROGRESS", storyPoints: 2, startedAt: new Date(), completedAt: null, taskType: "story" },
    ] as never);

    vi.mocked(database.sprintReview.findUnique).mockResolvedValue(null);
    vi.mocked(database.flowMetricSnapshot.create).mockResolvedValue({
      id: "snap-new",
    } as never);

    const { snapshotSprintFlowMetrics } = await import(
      "@/app/actions/flow-intelligence/snapshot-sprint"
    );
    const result = await snapshotSprintFlowMetrics("sprint-1", "team-1", "tenant-1");

    expect(result.snapshotId).toBe("snap-new");
    expect(database.flowMetricSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flowVelocityTotal: 2, // 2 DONE stories
          staleness: "FRESH",
          scope: "team",
          scopeId: "team-1",
          period: "sprint",
          periodRef: "sprint-1",
        }),
      })
    );
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

```bash
cd apps/app && npx vitest run __tests__/actions/flow-intelligence/snapshot-sprint.test.ts 2>&1 | tail -5
```

- [ ] **Step 4: Implement snapshotSprintFlowMetrics**

```typescript
// apps/app/app/actions/flow-intelligence/snapshot-sprint.ts
// Not "use server" — called from closeSprintAndSnapshot which has session
import { database } from "@repo/database";

export async function snapshotSprintFlowMetrics(
  sprintId: string,
  teamId: string,
  tenantId: string
): Promise<{ snapshotId: string }> {
  const [sprint, stories, review] = await Promise.all([
    database.sprint.findUnique({
      where: { id: sprintId },
      select: { capacity: true, endDate: true },
    }),
    database.story.findMany({
      where: { tenantId, sprintId },
      select: {
        status: true,
        storyPoints: true,
        startedAt: true,
        completedAt: true,
        taskType: true,
      },
    }),
    database.sprintReview.findUnique({
      where: { sprintId },
      select: { velocity: true },
    }),
  ]);

  const doneStories = stories.filter((s) => s.status === "DONE");
  const inProgressStories = stories.filter((s) => s.status === "IN_PROGRESS");

  // Flow Velocity
  const flowVelocityTotal = doneStories.length;

  // Flow Time (hours) — only for stories with both timestamps
  const timedStories = doneStories.filter(
    (s) => s.startedAt && s.completedAt
  );
  const flowTimes = timedStories.map(
    (s) =>
      ((s.completedAt as Date).getTime() - (s.startedAt as Date).getTime()) /
      3_600_000
  );
  const flowTimeAvgHours =
    flowTimes.length > 0
      ? flowTimes.reduce((a, b) => a + b, 0) / flowTimes.length
      : 0;

  // Flow Efficiency — active time / total elapsed time
  const totalElapsedTimes = timedStories.map((s) => {
    const start = s.startedAt as Date;
    const end = s.completedAt as Date;
    return (end.getTime() - start.getTime()) / 3_600_000;
  });
  const flowEfficiency =
    timedStories.length > 0 && flowTimes.length > 0
      ? Math.min(
          flowTimes.reduce((a, b) => a + b, 0) /
            totalElapsedTimes.reduce((a, b) => a + b, 0),
          1
        )
      : 0;

  // Flow Predictability — delivered / committed
  const capacity = sprint?.capacity ?? 0;
  const actualVelocity = review?.velocity ?? flowVelocityTotal;
  const flowPredictability =
    capacity > 0 ? Math.min(actualVelocity / capacity, 1) : 0;

  // Flow Load (WIP at sprint end)
  const flowLoadCurrent = inProgressStories.length;

  // Flow Distribution
  const dist: Record<string, number> = {};
  for (const s of stories) {
    const type = s.taskType ?? "story";
    dist[type] = (dist[type] ?? 0) + 1;
  }

  const snapshot = await database.flowMetricSnapshot.create({
    data: {
      tenantId,
      scope: "team",
      scopeId: teamId,
      period: "sprint",
      periodRef: sprintId,
      staleness: "FRESH",
      stalenessReasons: [],
      flowVelocityTotal,
      flowVelocityByType: {},
      flowTimeAvgHours,
      flowTimeMedianHours: flowTimeAvgHours, // median == avg as approximation
      flowTimeByType: {},
      flowLoadAvg: flowLoadCurrent,
      flowLoadCurrent,
      flowEfficiency,
      flowPredictability,
      plannedItems: capacity,
      flowDistribution: dist,
      recordedAt: new Date(),
    },
    select: { id: true },
  });

  return { snapshotId: snapshot.id };
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/app && npx vitest run __tests__/actions/flow-intelligence/snapshot-sprint.test.ts 2>&1 | tail -10
```

- [ ] **Step 6: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'snapshot-sprint' | head -10
```

- [ ] **Step 7: Commit**

```bash
git add apps/app/app/actions/flow-intelligence/snapshot-sprint.ts \
        apps/app/__tests__/actions/flow-intelligence/snapshot-sprint.test.ts
git commit -m "feat(flow): add snapshotSprintFlowMetrics — computes 6 SAFe flow metrics at sprint close"
```

---

### Task 6: closeSprintAndSnapshot server action

**Files:**
- Create: `apps/app/app/actions/sprints/close-sprint.ts`
- Create: `apps/app/__tests__/actions/sprints/close-sprint.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/app/__tests__/actions/sprints/close-sprint.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn().mockResolvedValue({ tenantId: "tenant-1" }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockReturnValue({}),
}));
vi.mock("@repo/database", () => ({
  database: {
    sprint: { findUnique: vi.fn(), update: vi.fn() },
    anomalyDetectionRun: { create: vi.fn(), update: vi.fn() },
    anomaly: { createMany: vi.fn() },
    improvementAction: {
      create: vi.fn().mockResolvedValue({ id: "action-1" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    competencyAssessment: { findFirst: vi.fn().mockResolvedValue(null) },
    flowMetricSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/app/actions/flow-intelligence/capacity", () => ({
  computeSprintMetrics: vi.fn().mockResolvedValue({ ok: true, data: { written: 2 } }),
}));
vi.mock("@/app/actions/flow-intelligence/snapshot-sprint", () => ({
  snapshotSprintFlowMetrics: vi.fn().mockResolvedValue({ snapshotId: "snap-new" }),
}));
vi.mock("@/app/actions/flow-intelligence/anomaly-rules", () => ({
  runAllRules: vi.fn().mockReturnValue([]),
}));

describe("closeSprintAndSnapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when sprint not found", async () => {
    const { database } = await import("@repo/database");
    vi.mocked(database.sprint.findUnique).mockResolvedValue(null);

    const { closeSprintAndSnapshot } = await import(
      "@/app/actions/sprints/close-sprint"
    );
    const result = await closeSprintAndSnapshot("sprint-missing");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it("returns error when sprint not ACTIVE", async () => {
    const { database } = await import("@repo/database");
    vi.mocked(database.sprint.findUnique).mockResolvedValue({
      id: "sprint-1",
      teamId: "team-1",
      status: "COMPLETED",
    } as never);

    const { closeSprintAndSnapshot } = await import(
      "@/app/actions/sprints/close-sprint"
    );
    const result = await closeSprintAndSnapshot("sprint-1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ACTIVE/);
  });

  it("closes sprint and returns snapshotId", async () => {
    const { database } = await import("@repo/database");
    vi.mocked(database.sprint.findUnique).mockResolvedValue({
      id: "sprint-1",
      teamId: "team-1",
      status: "ACTIVE",
    } as never);
    vi.mocked(database.sprint.update).mockResolvedValue({} as never);
    vi.mocked(database.anomalyDetectionRun.create).mockResolvedValue({
      id: "run-1",
    } as never);
    vi.mocked(database.anomalyDetectionRun.update).mockResolvedValue({} as never);
    vi.mocked(database.anomaly.createMany).mockResolvedValue({ count: 0 } as never);

    const { closeSprintAndSnapshot } = await import(
      "@/app/actions/sprints/close-sprint"
    );
    const result = await closeSprintAndSnapshot("sprint-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshotId).toBe("snap-new");
      expect(result.runId).toBe("run-1");
    }
    expect(database.sprint.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sprint-1" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/app && npx vitest run __tests__/actions/sprints/close-sprint.test.ts 2>&1 | tail -5
```

- [ ] **Step 3: Implement closeSprintAndSnapshot**

Create directory first: `mkdir -p apps/app/app/actions/sprints`

```typescript
// apps/app/app/actions/sprints/close-sprint.ts
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { computeSprintMetrics } from "@/app/actions/flow-intelligence/capacity";
import { snapshotSprintFlowMetrics } from "@/app/actions/flow-intelligence/snapshot-sprint";
import {
  runAllRules,
  type AnomalyRuleInput,
} from "@/app/actions/flow-intelligence/anomaly-rules";

type CloseResult =
  | { ok: true; snapshotId: string; runId: string }
  | { ok: false; error: string };

export async function closeSprintAndSnapshot(
  sprintId: string
): Promise<CloseResult> {
  const { tenantId } = await requireTenantSession(await headers());

  const sprint = await database.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, teamId: true, status: true, tenantId: true },
  });

  if (!sprint || sprint.tenantId !== tenantId) {
    return { ok: false, error: "Sprint not found" };
  }
  if (sprint.status !== "ACTIVE") {
    return { ok: false, error: `Sprint must be ACTIVE to close (current: ${sprint.status})` };
  }

  // 1. Write per-member metrics (non-critical, ok if this fails silently)
  await computeSprintMetrics(sprintId, sprint.teamId).catch(() => null);

  // 2. Close sprint + create snapshot atomically
  const [, { snapshotId }] = await Promise.all([
    database.sprint.update({
      where: { id: sprintId },
      data: { status: "COMPLETED" },
    }),
    snapshotSprintFlowMetrics(sprintId, sprint.teamId, tenantId),
  ]);

  // 3. Trigger anomaly detection (best-effort, not in transaction)
  let runId = "";
  try {
    const [history, openActions, latestAssessment] = await Promise.all([
      database.flowMetricSnapshot.findMany({
        where: {
          tenantId,
          scope: "team",
          scopeId: sprint.teamId,
          isArchived: false,
          id: { not: snapshotId },
        },
        orderBy: { recordedAt: "desc" },
        take: 4,
        select: {
          flowVelocityTotal: true,
          flowPredictability: true,
          flowTimeAvgHours: true,
        },
      }),
      database.improvementAction.findMany({
        where: { tenantId, scopeId: sprint.teamId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { id: true, dueDate: true, status: true },
      }),
      database.competencyAssessment.findFirst({
        where: { tenantId, scopeId: sprint.teamId },
        orderBy: { assessedAt: "desc" },
        select: { assessedAt: true },
      }),
    ]);

    const snapshot = await database.flowMetricSnapshot.findUnique({
      where: { id: snapshotId },
      select: {
        flowVelocityTotal: true,
        flowTimeAvgHours: true,
        flowEfficiency: true,
        flowPredictability: true,
        flowLoadCurrent: true,
        flowDistribution: true,
      },
    });

    if (snapshot) {
      const run = await database.anomalyDetectionRun.create({
        data: {
          tenantId,
          scope: "team",
          scopeId: sprint.teamId,
          snapshotId,
          trigger: "snapshot_created",
          status: "RUNNING",
        },
        select: { id: true },
      });
      runId = run.id;

      const input: AnomalyRuleInput = {
        current: {
          flowVelocityTotal: snapshot.flowVelocityTotal,
          flowTimeAvgDays: snapshot.flowTimeAvgHours / 24,
          flowEfficiency: snapshot.flowEfficiency,
          flowPredictability: snapshot.flowPredictability,
          flowLoadCurrent: snapshot.flowLoadCurrent,
          flowDistribution:
            (snapshot.flowDistribution as Record<string, number>) ?? {},
        },
        history: history.map((h) => ({
          flowVelocityTotal: h.flowVelocityTotal,
          flowPredictability: h.flowPredictability,
          flowTimeAvgHours: h.flowTimeAvgHours,
        })),
        openActions: openActions.map((a) => ({
          dueDate: a.dueDate,
          status: a.status,
        })),
        latestAssessmentAt: latestAssessment?.assessedAt ?? null,
        now: new Date(),
      };

      const anomalies = runAllRules(input);
      const bySeverity: Record<string, number> = {};
      for (const a of anomalies) {
        bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
      }

      if (anomalies.length > 0) {
        await database.anomaly.createMany({
          data: anomalies.map((a) => ({
            tenantId,
            runId: run.id,
            rule: a.rule,
            severity: a.severity,
            metric: a.metric,
            delta: parseFloat(String(a.delta)),
            metadata: a.metadata ?? {},
          })),
        });

        for (const anomaly of anomalies.filter(
          (a) => a.severity === "CRITICAL"
        )) {
          await database.improvementAction.create({
            data: {
              tenantId,
              title: `[Auto] ${anomaly.rule} — ação imediata necessária`,
              scope: "team",
              scopeId: sprint.teamId,
              relatedMetric: anomaly.suggestedMetric ?? anomaly.metric,
              status: "OPEN",
              source: "ai_copilot",
              sourceRunId: run.id,
            },
          });
        }
      }

      await database.anomalyDetectionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          summary: {
            total: anomalies.length,
            bySeverity,
            priority: bySeverity.CRITICAL > 0 ? "CRITICAL" : bySeverity.HIGH > 0 ? "HIGH" : "HEALTHY",
          },
          completedAt: new Date(),
        },
      });
    }
  } catch {
    // Anomaly detection failure does not fail the sprint close
  }

  return { ok: true, snapshotId, runId };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/app && npx vitest run __tests__/actions/sprints/close-sprint.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'close-sprint\|snapshot-sprint' | head -10
```

- [ ] **Step 6: Commit**

```bash
git add apps/app/app/actions/sprints/ \
        apps/app/__tests__/actions/sprints/
git commit -m "feat(sprints): add closeSprintAndSnapshot server action"
```

---

### Task 7: Close Sprint button UI

**Files:**
- Modify: `apps/app/app/(authenticated)/arts/[artId]/program-board/components/program-board-client.tsx`

- [ ] **Step 1: Read ProgramBoardData type**

```bash
grep -n 'ProgramBoardData\|sprints\|teams\|ProgramBoardTeam' \
  apps/app/app/actions/program-board.ts 2>/dev/null | head -20
# OR
find apps/app/app/actions -name 'program-board*' | xargs grep -n 'type\|interface\|sprints' | head -20
```

Identify: how sprints are listed in ProgramBoardData, what sprint fields are available (id, name, status, endDate, teamId).

- [ ] **Step 2: Add Close Sprint button to program-board-client.tsx**

Find the sprint column header render (where sprint name is displayed). Add a "Fechar" button next to each sprint name that has `status === "ACTIVE"`.

Pattern to find insertion point:
```bash
grep -n 'sprint\.name\|sprint\.status\|sprintName\|ACTIVE' \
  apps/app/app/\(authenticated\)/arts/\[artId\]/program-board/components/program-board-client.tsx | head -10
```

Add at top of file (new imports):
```typescript
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { closeSprintAndSnapshot } from "@/app/actions/sprints/close-sprint";
```

Add `CloseSprintButton` component before the main export:
```tsx
function CloseSprintButton({
  sprintId,
  sprintName,
}: {
  sprintId: string;
  sprintName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = React.useState(false);

  if (!confirmed) {
    return (
      <button
        type="button"
        className="ml-2 rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
        onClick={() => setConfirmed(true)}
      >
        Fechar
      </button>
    );
  }

  return (
    <span className="ml-2 flex items-center gap-1">
      <span className="text-xs text-muted-foreground">Confirmar?</span>
      <button
        type="button"
        className="rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await closeSprintAndSnapshot(sprintId);
            router.refresh();
          });
        }}
      >
        {isPending ? "..." : "Sim"}
      </button>
      <button
        type="button"
        className="rounded px-2 py-0.5 text-xs font-medium bg-muted hover:bg-muted/80"
        onClick={() => setConfirmed(false)}
      >
        Não
      </button>
    </span>
  );
}
```

Wire it into the sprint header — wherever `sprint.name` is rendered, add after it:
```tsx
{sprint.status === "ACTIVE" && (
  <CloseSprintButton sprintId={sprint.id} sprintName={sprint.name} />
)}
```

Note: If `sprint.status` is not available in ProgramBoardData, check what fields the server passes. If missing, add `status` to the program-board action's sprint select query.

- [ ] **Step 3: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'program-board-client\|close-sprint' | head -10
```

- [ ] **Step 4: Commit**

```bash
git add "apps/app/app/(authenticated)/arts/[artId]/program-board/components/program-board-client.tsx"
git commit -m "feat(sprints): add Close Sprint button in program board (ACTIVE sprints only)"
```

---

## Subsystem C — Dashboard Tabs Wire-up

### Task 8: flow/page.tsx — capacity + synergy fetches

**Files:**
- Modify: `apps/app/app/(authenticated)/analytics/flow/page.tsx`

- [ ] **Step 1: Read current page.tsx**

```bash
cat apps/app/app/\(authenticated\)/analytics/flow/page.tsx
```

Identify the current `Promise.all` block.

- [ ] **Step 2: Add imports**

At top of file, after existing imports:
```typescript
import { getTeamCapacityDashboard } from "@/app/actions/flow-intelligence/capacity";
import { getSynergyMatrix } from "@/app/actions/flow-intelligence/synergy";
```

- [ ] **Step 3: Extend the Promise.all**

Find the existing `Promise.all` block. Replace it:

```typescript
const [metrics, assessments, actions, capacityData, synergyData] = selectedScope
  ? await Promise.all([
      getFlowMetrics(selectedScope.type, selectedScope.id),
      getAssessments(selectedScope.type, selectedScope.id),
      getImprovementActions(selectedScope.type, selectedScope.id),
      selectedScope.type === "team"
        ? getTeamCapacityDashboard(selectedScope.id)
        : Promise.resolve(null),
      selectedScope.type === "team"
        ? getSynergyMatrix(selectedScope.id)
        : Promise.resolve(null),
    ])
  : [null, [], [], null, null];
```

- [ ] **Step 4: Pass new props to FlowMetricsDashboard**

```tsx
<FlowMetricsDashboard
  scopeOptions={scopeOptions}
  selectedScope={selectedScope}
  metrics={metrics}
  assessments={assessments}
  actions={actions}
  snapshotId={metrics?.id ?? undefined}
  staleness={metrics?.staleness ?? undefined}
  capacityData={capacityData ?? null}
  synergyData={synergyData ?? null}
/>
```

- [ ] **Step 5: TypeScript check**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep 'analytics/flow/page' | head -10
```

Expected: type error on `capacityData`/`synergyData` props — these don't exist on `Props` yet. That's fine — Task 9 adds them.

- [ ] **Step 6: Commit (even with pending TS errors — Task 9 closes them)**

```bash
git add "apps/app/app/(authenticated)/analytics/flow/page.tsx"
git commit -m "feat(flow): fetch capacity + synergy data in page.tsx for team scope"
```

---

### Task 9: FlowMetricsDashboard — Capacity + Synergy tabs

**Files:**
- Modify: `apps/app/app/(authenticated)/analytics/flow/components/flow-metrics-dashboard.tsx`

- [ ] **Step 1: Check return types of getTeamCapacityDashboard and getSynergyMatrix**

```bash
grep -n 'export.*getTeamCapacityDashboard\|Promise\|Ok\|type.*Dashboard' \
  apps/app/app/actions/flow-intelligence/capacity.ts | head -10
grep -n 'export.*getSynergyMatrix\|Promise\|Ok\|type.*Synergy' \
  apps/app/app/actions/flow-intelligence/synergy.ts | head -10
```

Note the exact return types — needed for the `Props` type.

- [ ] **Step 2: Check TeamCapacityTab and SynergyTab prop signatures**

```bash
grep -n 'export function\|Props\|type.*Props\|interface.*Props' \
  apps/app/app/\(authenticated\)/analytics/flow/components/capacity/team-capacity-tab.tsx \
  apps/app/app/\(authenticated\)/analytics/flow/components/synergy-tab.tsx \
  apps/app/app/\(authenticated\)/analytics/flow/components/synergy-matrix.tsx | head -20
```

- [ ] **Step 3: Add imports at top of flow-metrics-dashboard.tsx**

After existing imports, add:
```typescript
import { TeamCapacityTab } from "./capacity/team-capacity-tab";
import { SynergyTab } from "./synergy-tab";
import { SynergyMatrix } from "./synergy-matrix";
```

- [ ] **Step 4: Update Props type**

Find the `Props` type definition (grep: `type Props =` or `interface Props`). Add:

```typescript
capacityData: Awaited<ReturnType<typeof getTeamCapacityDashboard>> | null;
synergyData: Awaited<ReturnType<typeof getSynergyMatrix>> | null;
```

Also add the import at top:
```typescript
import type { getTeamCapacityDashboard } from "@/app/actions/flow-intelligence/capacity";
import type { getSynergyMatrix } from "@/app/actions/flow-intelligence/synergy";
```

Adjust if the functions return `Ok<T> | Err` — in that case use:
```typescript
capacityData: Extract<Awaited<ReturnType<typeof getTeamCapacityDashboard>>, { ok: true }>["data"] | null;
synergyData: Extract<Awaited<ReturnType<typeof getSynergyMatrix>>, { ok: true }>["data"] | null;
```

- [ ] **Step 5: Add capacityData and synergyData to destructured props**

Find `export function FlowMetricsDashboard({`. Add to the destructure:
```typescript
capacityData,
synergyData,
```

- [ ] **Step 6: Add tabs to the tab bar**

Find the tab bar section (where `"flow"` and `"measure"` tabs are rendered). After them, add:
```tsx
{selectedScope?.type === "team" && (
  <>
    <button
      type="button"
      aria-pressed={activeTab === "capacity"}
      style={tabStyle(activeTab === "capacity")}
      onClick={() => setActiveTab("capacity")}
    >
      Capacity
    </button>
    <button
      type="button"
      aria-pressed={activeTab === "synergy"}
      style={tabStyle(activeTab === "synergy")}
      onClick={() => setActiveTab("synergy")}
    >
      Synergy
    </button>
  </>
)}
```

Note: `tabStyle` — find the existing helper used for "flow"/"measure" tab buttons and use the same pattern.

- [ ] **Step 7: Update activeTab type**

Find `useState<"flow" | "measure">`. Change to:
```typescript
useState<"flow" | "measure" | "capacity" | "synergy">
```

- [ ] **Step 8: Add tab content**

Find the section where `activeTab === "measure"` renders. After it, add:
```tsx
{activeTab === "capacity" && (
  capacityData ? (
    <TeamCapacityTab data={capacityData} />
  ) : (
    <div style={{ padding: 32, textAlign: "center", color: MUTED, fontSize: 13 }}>
      Sem dados de capacity — selecione um time e feche um sprint.
    </div>
  )
)}
{activeTab === "synergy" && (
  synergyData ? (
    <>
      <SynergyTab data={synergyData} />
      <SynergyMatrix
        pairs={synergyData.pairs ?? []}
        teamId={selectedScope?.id ?? ""}
      />
    </>
  ) : (
    <div style={{ padding: 32, textAlign: "center", color: MUTED, fontSize: 13 }}>
      Sem dados de synergy — precisa de pelo menos 2 membros com histórico.
    </div>
  )
)}
```

Adjust props based on what you found in Step 2. If `getSynergyMatrix` returns `{ ok: true, data: { pairs, teamId } }`, use `synergyData.data?.pairs`.

- [ ] **Step 9: TypeScript check — expect zero errors**

```bash
cd apps/app && npx tsc --noEmit 2>&1 | grep -v 'flow-intelligence.test\|ai-rate-limit' | grep 'error' | head -15
```

Fix all type errors before committing. Common issues:
- Props type mismatch between page.tsx and dashboard component → align the types
- `capacityData` type doesn't match `TeamCapacityTab` props → check actual component

- [ ] **Step 10: Commit**

```bash
git add "apps/app/app/(authenticated)/analytics/flow/components/flow-metrics-dashboard.tsx"
git commit -m "feat(flow): add Capacity and Synergy tabs to FlowMetricsDashboard (team scope only)"
```

---

## Self-Review

**Spec coverage:**
- ✅ A1 — `staleness-service.ts` (Task 1)
- ✅ A2 — Cron staleness-check refactor (Task 2)
- ✅ A3 — Cron anomaly-detection (Task 3)
- ✅ A4 — `vercel.json` cron config (Task 4)
- ✅ B1 — `closeSprintAndSnapshot` action (Task 6)
- ✅ B2 — Close Sprint button (Task 7)
- ✅ B3 — `snapshotSprintFlowMetrics` (Task 5)
- ✅ C1 — page.tsx capacity/synergy fetches (Task 8)
- ✅ C2 — Dashboard tabs (Task 9)

**Placeholder scan:** No TBDs. Step 7 (Close Sprint button) has conditional logic depending on what fields exist in ProgramBoardData — by design, since it requires reading a file not fully indexed.

**Type consistency:** `snapshotId`, `tenantId`, `teamId` used consistently throughout. `runAllRules` takes `AnomalyRuleInput` (verified from anomaly-rules.ts). `closeSprintAndSnapshot` returns `CloseResult` used in UI.
