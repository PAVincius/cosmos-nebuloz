// Story-035: IP abuse spike detection and ban mechanism
import { redis } from "./index";

const BAN_TTL_SECONDS = 300; // 5-minute ban
const SPIKE_WINDOW_SECONDS = 60;
const SPIKE_MULTIPLIER = 6; // 6× baseline
const BASELINE_RPS = 60; // baseline: 60 req/min
const SPIKE_THRESHOLD = BASELINE_RPS * SPIKE_MULTIPLIER; // 360 req/min

const BAN_KEY_PREFIX = "ratelimit:ip:ban:";
const COUNT_KEY_PREFIX = "ratelimit:ip:count:";

export async function checkIpBan(ip: string): Promise<boolean> {
  const banned = await redis.get(`${BAN_KEY_PREFIX}${ip}`);
  return banned !== null;
}

export async function banIp(ip: string): Promise<void> {
  await redis.set(`${BAN_KEY_PREFIX}${ip}`, "1", { ex: BAN_TTL_SECONDS });
}

export async function detectAndBanSpike(ip: string): Promise<boolean> {
  const countKey = `${COUNT_KEY_PREFIX}${ip}`;
  const count = await redis.incr(countKey);

  if (count === 1) {
    await redis.expire(countKey, SPIKE_WINDOW_SECONDS);
  }

  if (count > SPIKE_THRESHOLD) {
    await banIp(ip);
    return true;
  }

  return false;
}
