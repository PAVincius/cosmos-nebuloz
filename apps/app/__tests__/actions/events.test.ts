import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	pushNotification: vi.fn(),
	logAudit: vi.fn(),
	webhooksSend: vi.fn().mockResolvedValue(undefined),
	findRecipientsByRole: vi.fn().mockResolvedValue(["user-sm"]),
}));

vi.mock("../../app/actions/notifications/index", () => ({
	pushNotification: mocks.pushNotification,
}));

vi.mock("../../app/actions/audit/index", () => ({
	logAudit: mocks.logAudit,
}));

vi.mock("@repo/webhooks", () => ({
	webhooks: { send: mocks.webhooksSend },
}));

vi.mock("../../app/actions/notify-recipients", () => ({
	findRecipientsByRole: mocks.findRecipientsByRole,
}));

import { dispatchEvent } from "../../app/actions/events";

async function flush() {
	await new Promise((r) => setTimeout(r, 0));
}

describe("dispatchEvent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findRecipientsByRole.mockResolvedValue(["user-sm"]);
		mocks.webhooksSend.mockResolvedValue(undefined);
	});

	it("returns void synchronously (fire-and-forget)", () => {
		const result = dispatchEvent({
			type: "story.assigned",
			storyId: "s1",
			storyTitle: "T",
			assigneeUserId: "user-1",
			tenantId: "t1",
			userId: "u1",
		});
		expect(result).toBeUndefined();
	});

	it("story.assigned — sends notification to assignee", async () => {
		dispatchEvent({
			type: "story.assigned",
			storyId: "s1",
			storyTitle: "Nova Story",
			assigneeUserId: "user-assignee",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).toHaveBeenCalledWith(
			"t1",
			expect.objectContaining({
				userId: "user-assignee",
				type: "assignment",
			}),
		);
	});

	it("story.status_changed to DONE — notifies PO and SM", async () => {
		mocks.findRecipientsByRole.mockResolvedValue(["po-1", "sm-1"]);
		dispatchEvent({
			type: "story.status_changed",
			storyId: "s1",
			storyTitle: "Story",
			from: "IN_PROGRESS",
			to: "DONE",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).toHaveBeenCalledTimes(2);
	});

	it("story.status_changed not DONE — no notification", async () => {
		dispatchEvent({
			type: "story.status_changed",
			storyId: "s1",
			storyTitle: "Story",
			from: "BACKLOG",
			to: "IN_PROGRESS",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).not.toHaveBeenCalled();
	});

	it("risk.created critical — notifies RTE and STE", async () => {
		mocks.findRecipientsByRole.mockResolvedValue(["rte-1"]);
		dispatchEvent({
			type: "risk.created",
			riskId: "r1",
			riskTitle: "Critical Risk",
			impact: "critical",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).toHaveBeenCalledWith(
			"t1",
			expect.objectContaining({ type: "risk" }),
		);
	});

	it("risk.created non-critical — no notification", async () => {
		dispatchEvent({
			type: "risk.created",
			riskId: "r1",
			riskTitle: "Low Risk",
			impact: "low",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).not.toHaveBeenCalled();
	});

	it("risk.status_changed with owner — notifies owner", async () => {
		dispatchEvent({
			type: "risk.status_changed",
			riskId: "r1",
			riskTitle: "Risk",
			from: "OPEN",
			to: "RESOLVED",
			ownerUserId: "owner-1",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).toHaveBeenCalledWith(
			"t1",
			expect.objectContaining({ userId: "owner-1" }),
		);
	});

	it("pi.confidence_vote_required — broadcasts to all roles", async () => {
		mocks.findRecipientsByRole.mockResolvedValue(["u1", "u2", "u3"]);
		dispatchEvent({
			type: "pi.confidence_vote_required",
			piSessionId: "ps1",
			piPlanId: "pp1",
			artId: "art1",
			tenantId: "t1",
		});
		await flush();
		expect(mocks.pushNotification).toHaveBeenCalledTimes(3);
	});

	it("sprint.activated — notifies SMs", async () => {
		dispatchEvent({
			type: "sprint.activated",
			sprintId: "sp1",
			sprintName: "Sprint 1",
			teamId: "team1",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).toHaveBeenCalledWith(
			"t1",
			expect.objectContaining({ title: expect.stringContaining("Sprint 1") }),
		);
	});

	it("sprint.completed — notifies RTE and SM", async () => {
		mocks.findRecipientsByRole.mockResolvedValue(["rte", "sm"]);
		dispatchEvent({
			type: "sprint.completed",
			sprintId: "sp1",
			sprintName: "Sprint 1",
			teamId: "team1",
			velocity: 42,
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).toHaveBeenCalledTimes(2);
		expect(mocks.pushNotification).toHaveBeenCalledWith(
			"t1",
			expect.objectContaining({
				title: expect.stringContaining("42 SP"),
			}),
		);
	});

	it("impediment.created — notifies SMs", async () => {
		dispatchEvent({
			type: "impediment.created",
			impedimentId: "imp1",
			impedimentTitle: "Blocker",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).toHaveBeenCalled();
	});

	it("defect.created critical — notifies SMs with risk type", async () => {
		dispatchEvent({
			type: "defect.created",
			defectId: "d1",
			defectTitle: "Crash",
			severity: "critical",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).toHaveBeenCalledWith(
			"t1",
			expect.objectContaining({ type: "risk" }),
		);
	});

	it("defect.created non-critical — no notification", async () => {
		dispatchEvent({
			type: "defect.created",
			defectId: "d1",
			defectTitle: "Minor",
			severity: "low",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.pushNotification).not.toHaveBeenCalled();
	});

	it("all events send webhook", async () => {
		dispatchEvent({
			type: "epic.created",
			epicId: "e1",
			epicTitle: "Big Epic",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.webhooksSend).toHaveBeenCalledWith("epic.created", expect.any(Object));
	});

	it("swallows notification errors without throwing", async () => {
		mocks.findRecipientsByRole.mockRejectedValue(new Error("DB down"));
		expect(() => {
			dispatchEvent({
				type: "sprint.activated",
				sprintId: "sp1",
				sprintName: "Sprint",
				teamId: "t",
				tenantId: "t1",
				userId: "u1",
			});
		}).not.toThrow();
		await flush();
	});

	it("feature.wsjf_updated — audit log entry created", async () => {
		dispatchEvent({
			type: "feature.wsjf_updated",
			featureId: "f1",
			featureTitle: "Feature",
			oldScore: 2,
			newScore: 5,
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.logAudit).toHaveBeenCalledWith(
			"t1",
			expect.objectContaining({
				action: "updated",
				entityType: "Feature",
				entityId: "f1",
			}),
		);
	});

	it("pi.created — audit log entry created", async () => {
		dispatchEvent({
			type: "pi.created",
			piPlanId: "pp1",
			artId: "art1",
			tenantId: "t1",
			userId: "u1",
		});
		await flush();
		expect(mocks.logAudit).toHaveBeenCalledWith(
			"t1",
			expect.objectContaining({ entityType: "PIPlan" }),
		);
	});
});
