/**
 * Shared tone tokens + Badge for the PI Planning screen (DESIGN.md §3 "Badges").
 * Local to this route — mirrors the Cosmos tone vars (--green/--red/--amber/--blue/--purple/--accent).
 */

export type Tone = "accent" | "green" | "red" | "amber" | "blue" | "purple" | "neutral";

export const TONE_VAR: Record<Tone, string> = {
  accent: "var(--accent)",
  green: "var(--green)",
  red: "var(--red)",
  amber: "var(--amber)",
  blue: "var(--blue)",
  purple: "var(--purple)",
  neutral: "var(--ink-muted)",
};

export const TONE_TEXT_VAR: Record<Tone, string> = {
  accent: "var(--accent-text)",
  green: "var(--green-text)",
  red: "var(--red-text)",
  amber: "var(--amber-text)",
  blue: "var(--blue-text)",
  purple: "var(--purple-text)",
  neutral: "var(--ink-muted)",
};

export const TONE_SOFT_VAR: Record<Tone, string> = {
  accent: "var(--accent-soft)",
  green: "var(--green-soft)",
  red: "var(--red-soft)",
  amber: "var(--amber-soft)",
  blue: "var(--blue-soft)",
  purple: "var(--purple-soft)",
  neutral: "var(--surface-3)",
};

type BadgeProps = {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
};

/** Small rounded-pill label — DESIGN.md `badge(text, tone, dot?)`. */
export function PiBadge({ children, tone = "neutral", dot }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium text-[11px]"
      style={{
        color: TONE_TEXT_VAR[tone],
        borderColor: `${TONE_VAR[tone]}55`,
        background: TONE_SOFT_VAR[tone],
      }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: TONE_VAR[tone] }}
        />
      )}
      {children}
    </span>
  );
}
