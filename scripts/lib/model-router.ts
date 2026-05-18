export const HAIKU = "claude-haiku-4-5-20251001" as const;
export const SONNET = "claude-sonnet-4-6" as const;

export type ModelId = typeof HAIKU | typeof SONNET;

const CRITICAL_PATHS = [
  "prisma/schema",
  "packages/auth/",
  "middleware",
  "rls",
  "tenant",
  "security/",
  "packages/database/",
];

export function selectModel(diff: string): ModelId {
  const usesSonnet = CRITICAL_PATHS.some((p) => diff.includes(p));
  return usesSonnet ? SONNET : HAIKU;
}
