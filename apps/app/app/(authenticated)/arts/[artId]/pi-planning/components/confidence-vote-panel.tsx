"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { type ConfidenceVoteEvent, getNextVoteEvents } from "@repo/safe-engine";
import {
  CheckCheckIcon,
  PlayIcon,
  RotateCcwIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react";
import { useTransition } from "react";
import { sendVoteEvent } from "../../../../../actions/arts/confidence-vote";
import { PiBadge, TONE_TEXT_VAR, TONE_VAR, type Tone } from "./pi-tone";

type ConfidenceVotePanelProps = {
  sessionId: string;
  xStateStatus: string;
  votes: number[];
  roundNumber?: number;
};

const STATE_LABELS: Record<string, string> = {
  NOT_STARTED: "Não Iniciado",
  OPEN: "Votação Aberta",
  TALLYING: "Apuração",
  REWORK: "Retrabalho",
  APPROVED: "Aprovado",
};

const STATE_TONE: Record<string, Tone> = {
  NOT_STARTED: "neutral",
  OPEN: "accent",
  TALLYING: "amber",
  REWORK: "red",
  APPROVED: "green",
};

const VOTE_SCORES = [1, 2, 3, 4, 5];

function scoreTone(score: number): Tone {
  if (score >= 4) {
    return "green";
  }
  return score === 3 ? "amber" : "red";
}

/** Fist-of-five dot row — mirrors cosmos.html FistOfFive. */
function FistOfFive({ value, size = 9 }: { value: number; size?: number }) {
  const tone = scoreTone(value);
  return (
    <span className="inline-flex gap-[3px]">
      {VOTE_SCORES.map((n) => (
        <span
          className="rounded-full"
          key={n}
          style={{
            width: size,
            height: size,
            background:
              n <= value ? `var(--${tone})` : "var(--surface-3)",
            border: n <= value ? "none" : "1px solid var(--hairline-strong)",
          }}
        />
      ))}
    </span>
  );
}

type EventConfig = {
  event: ConfidenceVoteEvent;
  label: string;
  icon: React.ReactNode;
  variant: "default" | "outline" | "destructive";
};

const EVENT_CONFIGS: EventConfig[] = [
  {
    event: { type: "START_VOTING" },
    label: "Iniciar Votação",
    icon: <PlayIcon className="h-3.5 w-3.5" />,
    variant: "default",
  },
  {
    event: { type: "CLOSE_VOTING" },
    label: "Encerrar Votação",
    icon: <CheckCheckIcon className="h-3.5 w-3.5" />,
    variant: "outline",
  },
  {
    event: { type: "APPROVE_PI" },
    label: "Aprovar PI",
    icon: <ThumbsUpIcon className="h-3.5 w-3.5" />,
    variant: "default",
  },
  {
    event: { type: "REQUIRE_REWORK" },
    label: "Requerer Retrabalho",
    icon: <XIcon className="h-3.5 w-3.5" />,
    variant: "destructive",
  },
  {
    event: { type: "RESET_VOTING" },
    label: "Reiniciar Votação",
    icon: <RotateCcwIcon className="h-3.5 w-3.5" />,
    variant: "outline",
  },
];

/** Confidence Vote round detail — dot-scale visual matches cosmos.html FistOfFive. */
export function ConfidenceVotePanel({
  sessionId,
  xStateStatus,
  votes,
  roundNumber = 1,
}: ConfidenceVotePanelProps) {
  const [isPending, startTransition] = useTransition();

  const availableEventTypes = getNextVoteEvents({ xStateStatus, votes });

  const handleEvent = (event: ConfidenceVoteEvent) => {
    startTransition(async () => {
      await sendVoteEvent(sessionId, event);
    });
  };

  const avgScore =
    votes.length > 0
      ? votes.reduce((a, b) => a + b, 0) / votes.length
      : null;

  return (
    <div
      className="flex flex-col gap-4 rounded-lg p-4"
      style={{
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="font-semibold text-[13px]"
          style={{ color: "var(--ink)" }}
        >
          Rodada {roundNumber}
        </span>
        <PiBadge dot tone={STATE_TONE[xStateStatus] ?? "neutral"}>
          {STATE_LABELS[xStateStatus] ?? xStateStatus}
        </PiBadge>
      </div>

      {xStateStatus === "OPEN" && (
        <div className="flex flex-col gap-2">
          <p
            className="font-medium text-[11px] uppercase tracking-wide"
            style={{ color: "var(--ink-subtle)" }}
          >
            Submeter Voto (1–5)
          </p>
          <div className="flex gap-2">
            {VOTE_SCORES.map((score) => {
              const tone = scoreTone(score);
              return (
                <button
                  className="h-9 w-9 rounded-full font-bold text-[13px] transition-opacity hover:opacity-80 disabled:opacity-40"
                  disabled={isPending}
                  key={score}
                  onClick={() =>
                    handleEvent({ type: "SUBMIT_VOTE", vote: score })
                  }
                  style={{
                    border: `1px solid var(--${tone})`,
                    color: TONE_TEXT_VAR[tone],
                    background: "var(--surface)",
                  }}
                  type="button"
                >
                  {score}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {votes.length > 0 && avgScore !== null && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2.5"
          style={{
            border: "1px solid var(--hairline)",
            background: "var(--surface)",
          }}
        >
          <div className="flex items-center gap-2">
            <FistOfFive value={Math.round(avgScore)} />
            <span
              className="mono font-extrabold text-[17px]"
              style={{ color: TONE_TEXT_VAR[scoreTone(avgScore)] }}
            >
              {avgScore.toFixed(1)}
            </span>
            <span
              className="text-[11px]"
              style={{ color: "var(--ink-subtle)" }}
            >
              média · {votes.length} voto(s)
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {votes.map((v, i) => (
              <PiBadge key={`${i}-${v}`} tone={scoreTone(v)}>
                {v}
              </PiBadge>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p
          className="font-medium text-[11px] uppercase tracking-wide"
          style={{ color: "var(--ink-subtle)" }}
        >
          Ações disponíveis
        </p>
        <div className="flex flex-wrap gap-2">
          {EVENT_CONFIGS.map(({ event, label, icon, variant }) => {
            const canDo = availableEventTypes.includes(event.type);
            return (
              <Button
                className="gap-2"
                disabled={!canDo || isPending}
                key={event.type}
                onClick={() => handleEvent(event)}
                size="sm"
                variant={canDo ? variant : "ghost"}
              >
                {icon}
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {xStateStatus === "APPROVED" && avgScore !== null && (
        <div
          className="rounded-md p-3 text-[13px]"
          style={{
            border: `1px solid ${TONE_VAR.green}55`,
            background: "var(--green-soft)",
            color: "var(--green-text)",
          }}
        >
          PI Aprovado — confiança média de {avgScore.toFixed(1)}/5
        </div>
      )}
    </div>
  );
}
