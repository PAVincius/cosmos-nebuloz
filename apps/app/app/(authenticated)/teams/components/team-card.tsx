import { TargetIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import type { getTeams } from "../actions";
import { mockFlowEfficiency, toneForArt } from "./team-tone";

type Team = Awaited<ReturnType<typeof getTeams>>[number];

type Props = { team: Team; index: number };

/** Re-skin of `.team-card` (screens-team.js:4, batch1.css:52-61). */
export function TeamCard({ team, index }: Props) {
  const tone = team.art ? toneForArt(team.art.name, index) : null;
  const activeSprint = team.sprints[0] ?? null;
  // team.wip is a stored counter (Team.wip in schema.prisma), always a number.
  const wip = team.wip;
  const flowEff = mockFlowEfficiency(team.name);
  const blocked = team.openImpediments;

  return (
    <div className="overflow-hidden rounded-cosmos-lg border border-hairline bg-surface transition-all duration-[180ms] hover:-translate-y-[3px] hover:border-hairline-strong hover:shadow-[0_16px_30px_-18px_rgba(0,0,0,.8)]">
      <Link href={`/teams/${team.id}/standup`}>
        <div
          className="flex items-center gap-2.5 border-hairline border-b px-4 py-3.5"
          style={{
            background:
              "linear-gradient(180deg, var(--surface-3), var(--surface-2))",
          }}
        >
          <div
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-cosmos-sm border"
            style={
              tone
                ? {
                    color: `var(--${tone}-text)`,
                    background: `linear-gradient(180deg, var(--surface-3), var(--surface-2))`,
                    borderColor: `var(--${tone}-soft)`,
                  }
                : {
                    color: "var(--ink-faint)",
                    background:
                      "linear-gradient(180deg, var(--surface-3), var(--surface-2))",
                    borderColor: "var(--hairline-strong)",
                  }
            }
          >
            <UsersIcon className="h-[15px] w-[15px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display font-semibold text-[14px] tracking-[-0.01em]">
              {team.name}
            </div>
            <div className="mt-0.5">
              {team.art ? (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 font-medium text-[11px] leading-none"
                  style={{
                    background: `var(--${tone}-soft)`,
                    color: `var(--${tone}-text)`,
                  }}
                >
                  {team.art.name}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-hairline px-2 py-0.5 font-medium text-[11px] text-ink-muted leading-none">
                  Independente
                </span>
              )}
            </div>
          </div>
          {blocked > 0 ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[11px] leading-none"
              style={{ background: "var(--red-soft)", color: "var(--red-text)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {blocked} bloqueio{blocked > 1 ? "s" : ""}
            </span>
          ) : (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[11px] leading-none"
              style={{ background: "var(--green-soft)", color: "var(--green-text)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              fluindo
            </span>
          )}
        </div>

        <div className="px-4 py-3.5">
          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-cosmos-sm border border-hairline bg-surface-2 px-1 py-2 text-center">
              <div
                className="font-mono font-semibold text-[16px]"
                style={{ color: "var(--green-text)" }}
              >
                {team.velocity ?? "—"}
              </div>
              <div className="mt-0.5 font-mono text-[8.5px] text-ink-muted uppercase tracking-[0.06em]">
                Velocity
              </div>
            </div>
            <div className="rounded-cosmos-sm border border-hairline bg-surface-2 px-1 py-2 text-center">
              <div
                className="font-mono font-semibold text-[16px]"
                style={{ color: wip > 6 ? "var(--red-text)" : "var(--ink)" }}
              >
                {wip}
              </div>
              <div className="mt-0.5 font-mono text-[8.5px] text-ink-muted uppercase tracking-[0.06em]">
                WIP
              </div>
            </div>
            <div className="rounded-cosmos-sm border border-hairline bg-surface-2 px-1 py-2 text-center">
              <div
                className="font-mono font-semibold text-[16px]"
                style={{
                  color:
                    flowEff >= 70
                      ? "var(--green-text)"
                      : flowEff >= 55
                        ? "var(--amber-text)"
                        : "var(--red-text)",
                }}
              >
                {flowEff}%
              </div>
              <div className="mt-0.5 font-mono text-[8.5px] text-ink-muted uppercase tracking-[0.06em]">
                Flow eff
              </div>
            </div>
          </div>
          <div className="flex items-start gap-1.5 border-hairline border-t pt-2.5 text-[12px] text-ink-muted leading-[1.4]">
            <TargetIcon className="mt-0.5 h-[11px] w-[11px] shrink-0" />
            <span>
              <b className="text-ink">Sprint goal:</b>{" "}
              {activeSprint
                ? (activeSprint.goal ?? "Meta não definida para a sprint atual")
                : "Sem sprint ativa no momento"}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
