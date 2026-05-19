import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	flowMetricSnapshotFindMany: vi.fn(),
	improvementActionFindMany: vi.fn(),
	competencyAssessmentFindMany: vi.fn(),
	strategicThemeFindMany: vi.fn(),
	epicFindMany: vi.fn(),
	oKRFindMany: vi.fn(),
	leanBudgetFindMany: vi.fn(),
	artFindMany: vi.fn(),
	artFindFirst: vi.fn(),
	pIPlanFindFirst: vi.fn(),
	teamFindMany: vi.fn(),
	featureFindMany: vi.fn(),
	storyFindMany: vi.fn(),
	riskFindMany: vi.fn(),
	dependencyFindMany: vi.fn(),
	governedEpicFindMany: vi.fn(),
}));

vi.mock("@repo/database", () => ({
	database: {
		flowMetricSnapshot: { findMany: mocks.flowMetricSnapshotFindMany },
		improvementAction: { findMany: mocks.improvementActionFindMany },
		competencyAssessment: { findMany: mocks.competencyAssessmentFindMany },
		strategicTheme: { findMany: mocks.strategicThemeFindMany },
		epic: { findMany: mocks.epicFindMany },
		oKR: { findMany: mocks.oKRFindMany },
		leanBudget: { findMany: mocks.leanBudgetFindMany },
		governedEpic: { findMany: mocks.governedEpicFindMany },
		aRT: { findMany: mocks.artFindMany, findFirst: mocks.artFindFirst },
		pIPlan: { findFirst: mocks.pIPlanFindFirst },
		team: { findMany: mocks.teamFindMany },
		feature: { findMany: mocks.featureFindMany },
		story: { findMany: mocks.storyFindMany },
		risk: { findMany: mocks.riskFindMany },
		dependency: { findMany: mocks.dependencyFindMany },
	},
}));

import { buildFlowMetricsContext } from "../../app/actions/safe-copilot/context/flow-metrics";
import { buildLeanBudgetContext } from "../../app/actions/safe-copilot/context/lean-budget";
import { buildPIWorkspaceContext } from "../../app/actions/safe-copilot/context/pi-workspace";
import { buildPortfolioContext } from "../../app/actions/safe-copilot/context/portfolio";

const TID = "tenant-1";
const NOW = new Date("2026-01-01");

beforeEach(() => {
	vi.clearAllMocks();
	mocks.flowMetricSnapshotFindMany.mockResolvedValue([]);
	mocks.improvementActionFindMany.mockResolvedValue([]);
	mocks.competencyAssessmentFindMany.mockResolvedValue([]);
	mocks.strategicThemeFindMany.mockResolvedValue([]);
	mocks.epicFindMany.mockResolvedValue([]);
	mocks.oKRFindMany.mockResolvedValue([]);
	mocks.leanBudgetFindMany.mockResolvedValue([]);
	mocks.artFindMany.mockResolvedValue([]);
	mocks.artFindFirst.mockResolvedValue(null);
	mocks.pIPlanFindFirst.mockResolvedValue(null);
	mocks.teamFindMany.mockResolvedValue([]);
	mocks.featureFindMany.mockResolvedValue([]);
	mocks.storyFindMany.mockResolvedValue([]);
	mocks.riskFindMany.mockResolvedValue([]);
	mocks.dependencyFindMany.mockResolvedValue([]);
	mocks.governedEpicFindMany.mockResolvedValue([]);
});

// ─── buildFlowMetricsContext ──────────────────────────────────────────────────

describe("buildFlowMetricsContext", () => {
	it("returns empty arrays when no data", async () => {
		const result = await buildFlowMetricsContext(TID, {});
		expect(result.snapshots).toHaveLength(0);
		expect(result.openImprovementActions).toHaveLength(0);
		expect(result.competencyScores).toHaveLength(0);
	});

	it("maps snapshot fields correctly", async () => {
		mocks.flowMetricSnapshotFindMany.mockResolvedValue([
			{
				scope: "ART",
				scopeId: "art-1",
				period: "PI-1",
				periodRef: "2026-Q1",
				flowVelocityTotal: 42,
				flowTimeAvgHours: 8.5,
				flowLoadCurrent: 0.8,
				flowEfficiency: 0.75,
				flowPredictability: 0.9,
				plannedItems: 20,
				deliveredItems: 18,
				flowDistribution: { feature: 10, bug: 5 },
			},
		]);
		const result = await buildFlowMetricsContext(TID, { scope: "ART", scopeId: "art-1" });
		expect(result.snapshots[0]).toMatchObject({
			flowVelocityTotal: 42,
			scope: "ART",
		});
	});

	it("maps improvement actions with dueDate as ISO string", async () => {
		mocks.improvementActionFindMany.mockResolvedValue([
			{
				id: "ia-1",
				title: "Improve CI",
				scope: "TEAM",
				relatedMetric: "velocity",
				status: "OPEN",
				dueDate: NOW,
			},
		]);
		const result = await buildFlowMetricsContext(TID, {});
		expect(result.openImprovementActions[0].dueDate).toBe("2026-01-01");
	});

	it("returns null dueDate when action has no dueDate", async () => {
		mocks.improvementActionFindMany.mockResolvedValue([
			{ id: "ia-1", title: "T", scope: "TEAM", relatedMetric: null, status: "OPEN", dueDate: null },
		]);
		const result = await buildFlowMetricsContext(TID, {});
		expect(result.openImprovementActions[0].dueDate).toBeNull();
	});

	it("maps competency scores with assessedAt as ISO string", async () => {
		mocks.competencyAssessmentFindMany.mockResolvedValue([
			{ competency: "DevOps", score: 3.5, assessedAt: NOW },
		]);
		const result = await buildFlowMetricsContext(TID, {});
		expect(result.competencyScores[0]).toMatchObject({
			competency: "DevOps",
			score: 3.5,
			assessedAt: "2026-01-01",
		});
	});
});

// ─── buildPortfolioContext ────────────────────────────────────────────────────

describe("buildPortfolioContext", () => {
	it("returns empty collections when no data", async () => {
		const result = await buildPortfolioContext(TID);
		expect(result.themes).toHaveLength(0);
		expect(result.epics).toHaveLength(0);
		expect(result.activeOkrs).toHaveLength(0);
		expect(result.recentFlowSummary).toBeNull();
	});

	it("maps themes correctly", async () => {
		mocks.strategicThemeFindMany.mockResolvedValue([
			{ id: "t1", code: "TH-1", title: "Growth", status: "ACTIVE", horizon: "3Y", budgetTotal: 500000 },
		]);
		const result = await buildPortfolioContext(TID);
		expect(result.themes[0]).toMatchObject({ code: "TH-1", title: "Growth" });
	});

	it("maps epics with feature count from _count", async () => {
		mocks.epicFindMany.mockResolvedValue([
			{ id: "e1", title: "Epic A", statusId: "status-1", _count: { features: 7 } },
		]);
		const result = await buildPortfolioContext(TID);
		expect(result.epics[0].featuresCount).toBe(7);
	});

	it("computes recentFlowSummary averages from snapshots", async () => {
		mocks.flowMetricSnapshotFindMany.mockResolvedValue([
			{ flowVelocityTotal: 10, flowEfficiency: 0.8, flowPredictability: 0.9 },
			{ flowVelocityTotal: 20, flowEfficiency: 0.6, flowPredictability: 0.7 },
		]);
		const result = await buildPortfolioContext(TID);
		expect(result.recentFlowSummary?.avgVelocity).toBe(15);
		expect(result.recentFlowSummary?.avgEfficiency).toBe(0.7);
	});

	it("maps OKRs with keyResult count", async () => {
		mocks.oKRFindMany.mockResolvedValue([
			{ id: "okr1", title: "Grow ARR", type: "COMPANY", status: "ON_TRACK", _count: { keyResults: 3 } },
		]);
		const result = await buildPortfolioContext(TID);
		expect(result.activeOkrs[0].keyResultsCount).toBe(3);
	});
});

// ─── buildLeanBudgetContext ───────────────────────────────────────────────────

describe("buildLeanBudgetContext", () => {
	it("returns empty arrays when no data", async () => {
		const result = await buildLeanBudgetContext(TID, {});
		expect(result.themes).toHaveLength(0);
		expect(result.leanBudgets).toHaveLength(0);
		expect(result.governedEpics).toHaveLength(0);
	});

	it("maps lean budgets correctly", async () => {
		mocks.leanBudgetFindMany.mockResolvedValue([
			{ id: "lb1", name: "Plataforma", amount: 100000, spent: 30000, period: "2026-Q1", artId: "art-1" },
		]);
		const result = await buildLeanBudgetContext(TID, {});
		expect(result.leanBudgets[0]).toMatchObject({ name: "Plataforma", spent: 30000 });
	});

	it("maps themes with epics count from _count", async () => {
		mocks.strategicThemeFindMany.mockResolvedValue([
			{ id: "t1", code: "TH-1", title: "Growth", status: "ACTIVE", budgetTotal: 500000, _count: { epics: 4 } },
		]);
		const result = await buildLeanBudgetContext(TID, {});
		expect(result.themes[0].epicsCount).toBe(4);
	});
});

// ─── buildPIWorkspaceContext ──────────────────────────────────────────────────

describe("buildPIWorkspaceContext", () => {
	it("returns fallback values when no ART or PI found", async () => {
		mocks.artFindFirst.mockResolvedValue(null);
		const result = await buildPIWorkspaceContext(TID, {});
		expect(result.objectives).toHaveLength(0);
		expect(result.risks).toHaveLength(0);
		expect(result.objectives).toHaveLength(0);
	});

	it("uses artId to scope query when provided", async () => {
		mocks.artFindFirst.mockResolvedValue({ name: "SAFe ART" });
		mocks.pIPlanFindFirst.mockResolvedValue({
			name: "PI-1",
			startDate: new Date("2026-01-01"),
			endDate: new Date("2026-03-31"),
			piObjectives: [],
		});
		const result = await buildPIWorkspaceContext(TID, { artId: "art-1", piId: "pi-1" });
		expect(result.piName).toBe("PI-1");
		expect(result.piDates.start).toBe("2026-01-01");
	});
});
