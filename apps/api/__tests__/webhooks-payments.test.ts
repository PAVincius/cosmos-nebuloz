import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let secret = "whsec_test";
  return {
    getSecret: () => secret,
    setSecret: (v: string) => {
      secret = v;
    },
    constructEvent: vi.fn(),
    analyticsCapture: vi.fn(),
    analyticsShutdown: vi.fn().mockResolvedValue(undefined),
    logWarn: vi.fn(),
    logError: vi.fn(),
    parseError: vi.fn((e: unknown) =>
      e instanceof Error ? e.message : "error"
    ),
    headers: vi.fn(),
  };
});

vi.mock("@/env", () => ({
  env: {
    get STRIPE_WEBHOOK_SECRET() {
      return mocks.getSecret();
    },
  },
}));

vi.mock("@repo/payments", () => ({
  stripe: { webhooks: { constructEvent: mocks.constructEvent } },
}));

vi.mock("@repo/analytics/server", () => ({
  analytics: {
    capture: mocks.analyticsCapture,
    shutdown: mocks.analyticsShutdown,
  },
}));

vi.mock("@repo/observability/log", () => ({
  log: { warn: mocks.logWarn, error: mocks.logError },
}));

vi.mock("@repo/observability/error", () => ({
  parseError: mocks.parseError,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

import { POST } from "../app/webhooks/payments/route";

function makeRequest(body = "{}", _sig = "sig_valid") {
  return new Request("http://localhost/webhooks/payments", {
    method: "POST",
    body,
  });
}

describe("POST /webhooks/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setSecret("whsec_test");
    mocks.analyticsShutdown.mockResolvedValue(undefined);
    mocks.headers.mockResolvedValue(
      new Headers({ "stripe-signature": "sig_valid" })
    );
  });

  it("returns 503 when STRIPE_WEBHOOK_SECRET is missing", async () => {
    mocks.setSecret("");
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
  });

  it("returns 500 when stripe-signature header is absent", async () => {
    mocks.headers.mockResolvedValue(new Headers());
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect(mocks.logError).toHaveBeenCalled();
  });

  it("handles checkout.session.completed with string customer", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { customer: "cus_abc" } },
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mocks.analyticsCapture).toHaveBeenCalledWith({
      event: "User Subscribed",
      distinctId: "cus_abc",
    });
  });

  it("handles checkout.session.completed with object customer", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { customer: { id: "cus_obj" } } },
    });
    await POST(makeRequest());
    expect(mocks.analyticsCapture).toHaveBeenCalledWith(
      expect.objectContaining({ distinctId: "cus_obj" })
    );
  });

  it("skips capture when checkout customer is null", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { customer: null } },
    });
    await POST(makeRequest());
    expect(mocks.analyticsCapture).not.toHaveBeenCalled();
  });

  it("handles subscription_schedule.canceled", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "subscription_schedule.canceled",
      data: { object: { customer: "cus_cancel" } },
    });
    await POST(makeRequest());
    expect(mocks.analyticsCapture).toHaveBeenCalledWith({
      event: "User Unsubscribed",
      distinctId: "cus_cancel",
    });
  });

  it("logs warning for unhandled event types", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: { object: {} },
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining("payment_intent.created")
    );
  });

  it("returns 500 when constructEvent throws", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect(mocks.logError).toHaveBeenCalled();
  });

  it("calls analytics.shutdown after successful event", async () => {
    mocks.constructEvent.mockReturnValue({
      type: "payment_intent.created",
      data: { object: {} },
    });
    await POST(makeRequest());
    expect(mocks.analyticsShutdown).toHaveBeenCalled();
  });
});
