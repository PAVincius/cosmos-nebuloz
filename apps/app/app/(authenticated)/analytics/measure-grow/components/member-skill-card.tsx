const SKILL_COLOR = [
  "",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
] as const;
const COMPETENCY_KEYS = [
  "TEAM_TECHNICAL_AGILITY",
  "AGILE_PRODUCT_DELIVERY",
  "ENTERPRISE_SOLUTION_DELIVERY",
  "LEAN_PORTFOLIO_MANAGEMENT",
  "ORGANIZATIONAL_AGILITY",
  "CONTINUOUS_LEARNING_CULTURE",
  "LEAN_AGILE_LEADERSHIP",
];
const SHORT: Record<string, string> = {
  TEAM_TECHNICAL_AGILITY: "TTA",
  AGILE_PRODUCT_DELIVERY: "APD",
  ENTERPRISE_SOLUTION_DELIVERY: "ESD",
  LEAN_PORTFOLIO_MANAGEMENT: "LPM",
  ORGANIZATIONAL_AGILITY: "OA",
  CONTINUOUS_LEARNING_CULTURE: "CLC",
  LEAN_AGILE_LEADERSHIP: "LAL",
};

type Profile = {
  userId: string;
  competency: string;
  skillLevel: number;
  isDraft: boolean;
  isVerified: boolean;
};

type Props = {
  userId: string;
  profiles: Profile[];
};

export function MemberSkillCard({ userId, profiles }: Props) {
  const byComp: Record<string, Profile | undefined> = {};
  for (const p of profiles) {
    byComp[p.competency] = p;
  }

  const avgLevel =
    profiles.length > 0
      ? profiles.reduce((s, p) => s + p.skillLevel, 0) / profiles.length
      : 0;

  const hasPendingVerification = profiles.some(
    (p) => p.isDraft && !p.isVerified
  );

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="truncate font-semibold text-sm">{userId}</p>
        <span className="text-muted-foreground text-xs">
          {avgLevel > 0 ? `${avgLevel.toFixed(1)}/5` : "Sem dados"}
        </span>
      </div>

      <div className="flex items-end gap-1.5">
        {COMPETENCY_KEYS.map((key) => {
          const level = byComp[key]?.skillLevel ?? 0;
          return (
            <div className="flex flex-col items-center gap-0.5" key={key}>
              <div
                className="w-5 rounded-sm transition-all"
                style={{
                  height: `${level * 6 + 4}px`,
                  background:
                    level > 0 ? SKILL_COLOR[level] : "hsl(var(--muted))",
                }}
                title={`${key.replace(/_/g, " ")}: ${level}/5`}
              />
              <span className="text-[9px] text-muted-foreground">
                {SHORT[key]}
              </span>
            </div>
          );
        })}
      </div>

      {hasPendingVerification ? (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          ⚠ Auto-avaliação pendente de verificação
        </p>
      ) : null}
    </div>
  );
}
