import { describe, expect, it } from "vitest";
import { POST } from "../app/webhooks/auth/route";

describe("POST /webhooks/auth", () => {
	it("returns 501 — Clerk webhook not configured", async () => {
		const res = await POST();
		expect(res.status).toBe(501);
	});

	it("response body has ok:false", async () => {
		const res = await POST();
		const body = await res.json();
		expect(body.ok).toBe(false);
		expect(typeof body.message).toBe("string");
	});
});
