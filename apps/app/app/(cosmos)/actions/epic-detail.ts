"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type LbcItem = { id: string; text: string };

// The epic's single investScore aggregate is always present when scored.
// A per-letter decomposition is only available when investBreakdown was
// written by the INVEST AI analysis (analyzeInvest / the analyze-invest
// route) — two different writers persist two different JSON shapes into
// that column (see parseInvestBreakdown below), and older/never-analyzed
// epics have neither. Never fabricated: null means "show the aggregate only."
export type InvestBreakdown = {
  I: number;
  N: number;
  V: number;
  E: number;
  S: number;
  T: number;
};

export type EpicDetailFull = {
  id: string;
  title: string;
  lifecycleStatus: string;
  wsjf: number | null;
  sizePoints: number | null;
  investScore: number | null;
  investBreakdown: InvestBreakdown | null;
  hypothesis: string | null;
  hypothesisResolution: string | null;
  businessOutcomes: LbcItem[];
  leadingIndicators: LbcItem[];
  nfrs: string | null;
  mvp: string | null;
  sizeEstimate: string | null;
  leanBudgetAllocation: number | null;
  npv: number | null;
  // Portfolio context — ART/theme resolved tenant-scoped, owner is the
  // denormalized name already stored on Epic (same field kanban cards read).
  art: { id: string; name: string } | null;
  theme: { id: string; title: string; color: string } | null;
  owner: string | null;
  features: {
    id: string;
    title: string;
    statusId: string;
    wsjfScore: number;
    progressPct: number;
    storyPoints: number;
  }[];
  piObjectives: {
    id: string;
    title: string;
    status: string;
    businessValue: number;
    achievedValue: number;
  }[];
  governance: {
    governedEpicId: string | null;
    governanceStatus: string | null;
    currentApprovalRequestId: string | null;
  };
};

const INVEST_KEYS = ["I", "N", "V", "E", "S", "T"] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readBreakdownShape(
  breakdown: Record<string, unknown>
): InvestBreakdown | null {
  const ok = INVEST_KEYS.every((k) => typeof breakdown[k] === "number");
  if (!ok) {
    return null;
  }
  return {
    I: breakdown.I as number,
    N: breakdown.N as number,
    V: breakdown.V as number,
    E: breakdown.E as number,
    S: breakdown.S as number,
    T: breakdown.T as number,
  };
}

function readPerKeyScoreShape(
  raw: Record<string, unknown>
): InvestBreakdown | null {
  const scores: Partial<InvestBreakdown> = {};
  for (const k of INVEST_KEYS) {
    const entry = raw[k];
    if (!isRecord(entry) || typeof entry.score !== "number") {
      return null;
    }
    scores[k] = entry.score;
  }
  return scores as InvestBreakdown;
}

// Parses whichever of the two known persisted investBreakdown shapes is
// present: analyzeInvest's `{ breakdown: {I..T: number}, rationale, ... }`
// or the analyze-invest API route's `{ I: {score, ...}, N: {...}, ... }`.
// Returns null (never a guessed/partial decomposition) for anything else —
// including the empty/legacy shape some epics still carry.
function parseInvestBreakdown(raw: unknown): InvestBreakdown | null {
  if (!isRecord(raw)) {
    return null;
  }
  if (isRecord(raw.breakdown)) {
    const shapeA = readBreakdownShape(raw.breakdown);
    if (shapeA) {
      return shapeA;
    }
  }
  return readPerKeyScoreShape(raw);
}

export async function getEpicDetailFull(
  epicId: string
): Promise<Result<EpicDetailFull | null>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const epic = await database.epic.findFirst({
      where: { id: epicId, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        lifecycleStatus: true,
        wsjf: true,
        sizePoints: true,
        investScore: true,
        investBreakdown: true,
        hypothesis: true,
        hypothesisResolution: true,
        businessOutcomes: true,
        leadingIndicators: true,
        nfrs: true,
        mvp: true,
        sizeEstimate: true,
        // Scope cut (explicit, not a placeholder): the PRD's FinOps "cost
        // burn widget" (actual spend vs. leanBudgetAllocation) is out of
        // scope — no actualSpend/spentAmount field exists anywhere in the
        // schema. Only the allocation itself is returned below, no burn
        // calculation.
        leanBudgetAllocation: true,
        npv: true,
        // Portfolio context (header + Overview SectionCard). artId has no
        // FK relation on Epic (see kanban.ts's toKanbanEpic for the same
        // pattern) — resolved via a separate tenant-scoped ART lookup
        // below. ownerName is already denormalized on Epic, no join needed.
        artId: true,
        ownerName: true,
        strategicTheme: { select: { id: true, title: true, color: true } },
        features: {
          select: {
            id: true,
            title: true,
            statusId: true,
            wsjfScore: true,
            progressPct: true,
            storyPoints: true,
            piPlanId: true,
          },
          orderBy: { wsjfScore: "desc" },
        },
      },
    });
    if (!epic) {
      return null;
    }

    // Schema has no direct Epic↔PIObjective relation: PIObjective links to
    // piPlanId+teamId only. We treat "PI Objectives linked to this epic" as
    // objectives sharing a piPlanId with one of the epic's own features —
    // the piPlanId values are already tenant-scoped via the epic query above.
    const piPlanIds = [
      ...new Set(
        epic.features.map((f) => f.piPlanId).filter((id): id is string => !!id)
      ),
    ];
    const piObjectives = piPlanIds.length
      ? await database.pIObjective.findMany({
          where: { tenantId: ctx.tenantId, piPlanId: { in: piPlanIds } },
          select: {
            id: true,
            title: true,
            status: true,
            businessValue: true,
            achievedValue: true,
          },
        })
      : [];

    const governedEpic = await database.governedEpic.findFirst({
      where: { epicId: epic.id, tenantId: ctx.tenantId },
      select: {
        id: true,
        governanceStatus: true,
        currentApprovalRequestId: true,
      },
    });

    // No FK relation from Epic to ART (artId is a plain denormalized string
    // — see kanban.ts's toKanbanEpic for the same pattern), so it's resolved
    // as its own tenant-scoped lookup rather than a Prisma include.
    const art = epic.artId
      ? await database.aRT.findFirst({
          where: { id: epic.artId, tenantId: ctx.tenantId },
          select: { id: true, name: true },
        })
      : null;

    return {
      id: epic.id,
      title: epic.title,
      lifecycleStatus: epic.lifecycleStatus,
      wsjf: epic.wsjf,
      sizePoints: epic.sizePoints,
      investScore: epic.investScore,
      investBreakdown: parseInvestBreakdown(epic.investBreakdown),
      hypothesis: epic.hypothesis,
      hypothesisResolution: epic.hypothesisResolution,
      art: art ? { id: art.id, name: art.name } : null,
      theme: epic.strategicTheme
        ? {
            id: epic.strategicTheme.id,
            title: epic.strategicTheme.title,
            color: epic.strategicTheme.color,
          }
        : null,
      owner: epic.ownerName || null,
      businessOutcomes: Array.isArray(epic.businessOutcomes)
        ? (epic.businessOutcomes as LbcItem[])
        : [],
      leadingIndicators: Array.isArray(epic.leadingIndicators)
        ? (epic.leadingIndicators as LbcItem[])
        : [],
      nfrs: epic.nfrs,
      mvp: epic.mvp,
      sizeEstimate: epic.sizeEstimate,
      leanBudgetAllocation: epic.leanBudgetAllocation,
      // Decimal → number, null-preserving (never defaulted to 0 — see
      // apps/app/app/(cosmos)/actions/budgets.ts:24-26): an absent NPV and a
      // NPV of zero are different claims, the second says the project breaks even.
      npv: epic.npv !== null ? Number(epic.npv) : null,
      features: epic.features.map(({ piPlanId, ...f }) => f),
      piObjectives,
      governance: {
        governedEpicId: governedEpic?.id ?? null,
        governanceStatus: governedEpic?.governanceStatus ?? null,
        currentApprovalRequestId:
          governedEpic?.currentApprovalRequestId ?? null,
      },
    };
  });
}
