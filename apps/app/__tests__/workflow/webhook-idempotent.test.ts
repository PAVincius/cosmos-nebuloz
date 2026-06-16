import { describe, expect, it, vi } from "vitest";

// Tests the idempotency contract: same prId + storyId should only transition once.
// Uses a simple in-memory "redis" mock to simulate SETNX behaviour.

function createMockRedis() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(
      async (
        key: string,
        value: string,
        opts?: { nx?: boolean; ex?: number }
      ) => {
        if (opts?.nx) {
          if (store.has(key)) return null; // SETNX: already exists → null
          store.set(key, value);
          return "OK";
        }
        store.set(key, value);
        return "OK";
      }
    ),
    clear: () => store.clear(),
  };
}

async function simulateReleaseLock(
  redis: ReturnType<typeof createMockRedis>,
  storyId: string,
  prId: string
): Promise<boolean> {
  const result = await redis.set(
    `workflow:wait-release:${storyId}:${prId}`,
    "1",
    { nx: true, ex: 86_400 }
  );
  return result !== null; // null = already processed
}

describe("Wait-state idempotency (AC-007)", () => {
  it("first call acquires lock and returns true", async () => {
    const redis = createMockRedis();
    const acquired = await simulateReleaseLock(redis, "story-1", "pr-42");
    expect(acquired).toBe(true);
  });

  it("second call with same storyId+prId returns false (already processed)", async () => {
    const redis = createMockRedis();
    await simulateReleaseLock(redis, "story-1", "pr-42");
    const second = await simulateReleaseLock(redis, "story-1", "pr-42");
    expect(second).toBe(false);
  });

  it("different prId on same story acquires new lock", async () => {
    const redis = createMockRedis();
    await simulateReleaseLock(redis, "story-1", "pr-42");
    const different = await simulateReleaseLock(redis, "story-1", "pr-99");
    expect(different).toBe(true);
  });

  it("same prId on different stories are independent", async () => {
    const redis = createMockRedis();
    await simulateReleaseLock(redis, "story-1", "pr-42");
    const different = await simulateReleaseLock(redis, "story-2", "pr-42");
    expect(different).toBe(true);
  });

  it("redis.set called with nx:true option", async () => {
    const redis = createMockRedis();
    await simulateReleaseLock(redis, "story-1", "pr-42");
    expect(redis.set).toHaveBeenCalledWith(
      "workflow:wait-release:story-1:pr-42",
      "1",
      { nx: true, ex: 86_400 }
    );
  });
});
