import { Badge } from "@repo/design-system/components/cosmos/badge";
import { cn } from "@repo/design-system/lib/utils";
import {
  AlertTriangleIcon,
  CheckIcon,
  type LucideIcon,
  ZapIcon,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────

export type StandupAvatarTone = "amber" | "blue" | "green" | "purple" | "accent";

type StandupEntryCardProps = {
  name: string;
  tone: StandupAvatarTone;
  isMe?: boolean;
  yesterday?: string | null;
  today?: string | null;
  blockers?: string | null;
  /** Smaller, dimmed variant used in the history list. */
  compact?: boolean;
};

// ─── Avatar ─────────────────────────────────────────────────────────────

const TONE_STYLE: Record<StandupAvatarTone, { bg: string; text: string; border: string }> = {
  amber: { bg: "var(--amber-soft)", text: "var(--amber-text)", border: "rgba(var(--amber-rgb),.3)" },
  blue: { bg: "var(--blue-soft)", text: "var(--blue-text)", border: "rgba(var(--blue-rgb),.3)" },
  green: { bg: "var(--green-soft)", text: "var(--green-text)", border: "rgba(var(--green-rgb),.3)" },
  purple: { bg: "var(--purple-soft)", text: "var(--purple-text)", border: "rgba(var(--purple-rgb),.3)" },
  accent: { bg: "var(--accent-soft)", text: "var(--accent-text)", border: "rgba(var(--accent-rgb),.3)" },
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ name, tone, size }: { name: string; tone: StandupAvatarTone; size: number }) {
  const style = TONE_STYLE[tone];
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-mono font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.33,
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      {initials(name)}
    </span>
  );
}

// ─── Slot ───────────────────────────────────────────────────────────────

function Slot({
  icon: Icon,
  label,
  value,
  emptyLabel = "—",
  blocked,
  last,
}: {
  icon: LucideIcon;
  label: string;
  value?: string | null;
  emptyLabel?: string;
  blocked?: boolean;
  last?: boolean;
}) {
  const trimmed = value?.trim();
  return (
    <div className={cn("py-2.5", !last && "border-hairline border-b")}>
      <div className="mb-1 flex items-center gap-1.5 font-mono text-[9px] text-ink-muted uppercase tracking-[0.08em]">
        <Icon aria-hidden size={10} />
        {label}
      </div>
      <p
        className={cn(
          "whitespace-pre-wrap text-[12.5px] leading-relaxed",
          blocked && trimmed ? "text-red-text" : "text-ink-subtle"
        )}
      >
        {trimmed || <span className="text-ink-muted italic">{emptyLabel}</span>}
      </p>
    </div>
  );
}

// ─── StandupEntryCard ───────────────────────────────────────────────────

/** One member's daily standup row: Ontem / Hoje / Bloqueios slots. Mirrors prototype `.standup-card`. */
export function StandupEntryCard({
  name,
  tone,
  isMe,
  yesterday,
  today,
  blockers,
  compact,
}: StandupEntryCardProps) {
  const hasBlockers = !!blockers?.trim();
  const avatarSize = compact ? 24 : 30;

  return (
    <div
      className="overflow-hidden rounded-lg bg-surface"
      style={{
        border: `1px solid ${hasBlockers ? "rgba(var(--red-rgb),.4)" : "var(--hairline)"}`,
        opacity: compact ? 0.85 : 1,
      }}
    >
      <div className="flex items-center gap-2.5 border-hairline border-b bg-surface-2 px-4 py-3">
        <Avatar name={name} size={avatarSize} tone={isMe ? "accent" : tone} />
        <div className="min-w-0 flex-1 truncate font-bold text-[13.5px] text-ink">{name}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!!isMe && <Badge tone="neutral">você</Badge>}
          {hasBlockers && (
            <Badge tone="red">
              <span className="flex items-center gap-1">
                <AlertTriangleIcon aria-hidden size={10} />
                Bloqueio
              </span>
            </Badge>
          )}
        </div>
      </div>
      <div className="px-4 py-1">
        <Slot icon={CheckIcon} label="Ontem" value={yesterday} />
        <Slot icon={ZapIcon} label="Hoje" value={today} />
        <Slot
          blocked={hasBlockers}
          emptyLabel="Nenhum"
          icon={AlertTriangleIcon}
          label="Bloqueios"
          last
          value={blockers}
        />
      </div>
    </div>
  );
}
