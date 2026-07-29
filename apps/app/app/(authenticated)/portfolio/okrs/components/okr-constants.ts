import type { OKRStatus } from "@/app/actions/okrs";

export type OKRTone = "green" | "red" | "amber" | "blue" | "purple" | "accent";

export const STATUS_CONFIG: Record<
  OKRStatus,
  { label: string; tone: OKRTone }
> = {
  ON_TRACK: { label: "On track", tone: "green" },
  AT_RISK: { label: "Em risco", tone: "amber" },
  BEHIND: { label: "Atrasado", tone: "red" },
  ACHIEVED: { label: "Alcançado", tone: "blue" },
};

export const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  portfolio_theme: { label: "Tema", icon: "🎯" },
  portfolio_epic: { label: "Épico", icon: "🏔" },
  pi_art: { label: "PI / ART", icon: "🔄" },
  team_pi: { label: "Time / PI", icon: "👥" },
  improvement: { label: "Melhoria", icon: "⬆" },
};

/**
 * Mirrors cosmos.html's krStatus(v): v>=70 on track, v>=40 em risco, else atrasado.
 * This is the design contract's threshold (screen-okrs.jsx) and takes precedence
 * over the prior local >=70/>=50 split.
 */
export function toneForProgress(pct: number): OKRTone {
  if (pct >= 70) {
    return "green";
  }
  if (pct >= 40) {
    return "amber";
  }
  return "red";
}

export function labelForProgress(pct: number): string {
  if (pct >= 70) {
    return "On track";
  }
  if (pct >= 40) {
    return "Em risco";
  }
  return "Atrasado";
}

// Single-path (multi-subpath `d`) SVG icon strings for KpiCard's decorative watermark icon
// (KpiCard renders exactly one <path d={iconPath}/>, so subpaths are combined via
// multiple M/m moveto commands — valid SVG, avoids needing a shared icon registry).
export const ICON_GAUGE = "m12 14 4-4 M3.34 19a10 10 0 1 1 17.32 0";
export const ICON_CHECK =
  "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9 12l2 2 4-4";
export const ICON_ALERT =
  "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3 M12 9v4 M12 17h.01";
export const ICON_TARGET =
  "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z";
