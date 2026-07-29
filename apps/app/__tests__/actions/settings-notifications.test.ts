import { beforeEach, describe, expect, it, vi } from "vitest";

const matureMocks = vi.hoisted(() => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));
vi.mock("../../app/actions/users/profile", () => ({
  getNotificationPreferences: matureMocks.getNotificationPreferences,
  updateNotificationPreferences: matureMocks.updateNotificationPreferences,
}));

import {
  getNotificationsTab,
  updateNotificationsAction,
} from "../../app/(cosmos)/actions/settings-notifications";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getNotificationsTab", () => {
  it("returns the real, self-scoped preferences as a Result<T>", async () => {
    matureMocks.getNotificationPreferences.mockResolvedValue({
      pi_planning: true,
      risk_alerts: false,
    });

    const r = await getNotificationsTab();

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.pi_planning).toBe(true);
      expect(r.data.risk_alerts).toBe(false);
    }
  });

  it("returns a Result error instead of throwing on failure", async () => {
    matureMocks.getNotificationPreferences.mockRejectedValue(new Error("boom"));

    const r = await getNotificationsTab();

    expect(r.ok).toBe(false);
  });
});

describe("updateNotificationsAction", () => {
  it("delegates the partial update and returns ok", async () => {
    matureMocks.updateNotificationPreferences.mockResolvedValue(undefined);

    const r = await updateNotificationsAction({ risk_alerts: true });

    expect(matureMocks.updateNotificationPreferences).toHaveBeenCalledWith({
      risk_alerts: true,
    });
    expect(r.ok).toBe(true);
  });
});
