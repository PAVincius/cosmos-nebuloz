import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NotificationsCell } from "@/app/(authenticated)/dashboard/components/notifications-cell";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: Date;
  metadata: unknown;
};

function makeNotif(overrides?: Partial<Notification>): Notification {
  return {
    id: "n1",
    type: "mention",
    title: "You were mentioned",
    body: null,
    read: false,
    createdAt: new Date(Date.now() - 5 * 60_000),
    metadata: null,
    ...overrides,
  };
}

describe("NotificationsCell", () => {
  it("renders notification titles", () => {
    render(
      <NotificationsCell notifications={[makeNotif({ title: "Test notif" })]} />
    );
    expect(screen.getByText("Test notif")).toBeDefined();
  });

  it("shows at most 4 notifications even when more provided", () => {
    const notifs = Array.from({ length: 6 }, (_, i) =>
      makeNotif({ id: `n${i}`, title: `Notif ${i + 1}` })
    );
    render(<NotificationsCell notifications={notifs} />);

    expect(screen.getByText("Notif 1")).toBeDefined();
    expect(screen.getByText("Notif 2")).toBeDefined();
    expect(screen.getByText("Notif 3")).toBeDefined();
    expect(screen.getByText("Notif 4")).toBeDefined();
    expect(screen.queryByText("Notif 5")).toBeNull();
    expect(screen.queryByText("Notif 6")).toBeNull();
  });

  it("renders relative time in minutes for recent notifications", () => {
    const notif = makeNotif({ createdAt: new Date(Date.now() - 30 * 60_000) });
    render(<NotificationsCell notifications={[notif]} />);
    expect(screen.getByText("30m")).toBeDefined();
  });

  it("renders relative time in hours for older notifications", () => {
    const notif = makeNotif({
      createdAt: new Date(Date.now() - 3 * 60 * 60_000),
    });
    render(<NotificationsCell notifications={[notif]} />);
    expect(screen.getByText("3h")).toBeDefined();
  });

  it("renders relative time in days for very old notifications", () => {
    const notif = makeNotif({
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60_000),
    });
    render(<NotificationsCell notifications={[notif]} />);
    expect(screen.getByText("2d")).toBeDefined();
  });

  it("renders correct pip color for each type", () => {
    const { container } = render(
      <NotificationsCell notifications={[makeNotif({ type: "mention" })]} />
    );
    const row = container.querySelector("div > div");
    const pip = row?.querySelector("span") as HTMLSpanElement | null;
    // jsdom normalizes hex to rgb
    expect(pip?.style.backgroundColor).toBe("rgb(94, 106, 210)");
  });

  it("renders empty without error for empty array", () => {
    const { container } = render(<NotificationsCell notifications={[]} />);
    expect(container).toBeDefined();
    expect(container.querySelector("div")).toBeDefined();
  });
});

afterEach(() => cleanup());
