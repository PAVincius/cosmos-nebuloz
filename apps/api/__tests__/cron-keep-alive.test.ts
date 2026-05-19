import { beforeEach, describe, expect, it, vi } from "vitest";


const mocks = vi.hoisted(() => ({
	queryRaw: vi.fn(),
}));

vi.mock("@repo/database", () => ({
	database: { $queryRaw: mocks.queryRaw },
}));

import { GET } from "../app/cron/keep-alive/route";

describe("GET /cron/keep-alive", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
	});

	it("returns 200 OK", async () => {
		const res = await GET();
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	it("pings database with SELECT 1", async () => {
		await GET();
		expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
	});
});
