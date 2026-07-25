import { Ratelimit, type RatelimitConfig } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { keys } from "./keys";

export { buildRateLimitHeaders, type RateLimitResult } from "./headers";

export const redis = new Redis({
  url: keys().UPSTASH_REDIS_REST_URL,
  token: keys().UPSTASH_REDIS_REST_TOKEN,
});

export const createRateLimiter = (props: Omit<RatelimitConfig, "redis">) =>
  new Ratelimit({
    redis,
    limiter: props.limiter ?? Ratelimit.slidingWindow(10, "10 s"),
    prefix: props.prefix ?? "next-forge",
  });

export const { slidingWindow } = Ratelimit;

// ─── Multi-tier rate limit instances (Story-035) ─────────────────────────────

export const rateLimits = {
  user: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "rl:user",
  }),
  userAI: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:user:ai",
  }),
  userExport: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:user:export",
  }),
  org: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, "1 m"),
    prefix: "rl:org",
  }),
  ip: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:ip:unauth",
  }),
  ipAuth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "rl:ip:auth",
  }),
};
