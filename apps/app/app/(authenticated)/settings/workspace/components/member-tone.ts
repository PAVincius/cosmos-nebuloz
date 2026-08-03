export type MemberTone =
  | "accent"
  | "purple"
  | "blue"
  | "amber"
  | "green"
  | "neutral";

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  STE: "STE",
  RTE: "RTE",
  SM: "SM",
  PO: "PO",
  DEV: "Dev",
  MEMBER: "Membro",
};

const ROLE_TONE: Record<string, MemberTone> = {
  ADMIN: "accent",
  RTE: "purple",
  STE: "purple",
  SM: "blue",
  PO: "amber",
  DEV: "green",
  MEMBER: "neutral",
};

export function toneForRole(role: string): MemberTone {
  return ROLE_TONE[role] ?? "neutral";
}

// Mirrors the tone → CSS var mapping in
// @repo/design-system/components/cosmos/badge.tsx, applied to the member
// avatar background instead of a pill.
const TONE_VARS: Record<MemberTone, { bg: string; text: string }> = {
  accent: { bg: "var(--accent)", text: "#fff" },
  purple: { bg: "var(--purple-soft)", text: "var(--purple-text)" },
  blue: { bg: "var(--blue-soft)", text: "var(--blue-text)" },
  amber: { bg: "var(--amber-soft)", text: "var(--amber-text)" },
  green: { bg: "var(--green-soft)", text: "var(--green-text)" },
  neutral: { bg: "var(--surface-3)", text: "var(--ink-muted)" },
};

export function avatarStyleForRole(role: string) {
  return TONE_VARS[toneForRole(role)];
}
