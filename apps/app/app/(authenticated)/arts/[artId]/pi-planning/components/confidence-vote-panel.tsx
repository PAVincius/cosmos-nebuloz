"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
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

const STATE_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  OPEN: "bg-primary/10 text-primary border-primary/30",
  TALLYING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  REWORK: "bg-destructive/10 text-destructive border-destructive/30",
  APPROVED: "bg-green-500/10 text-green-500 border-green-500/30",
};

const VOTE_SCORES = [1, 2, 3, 4, 5];

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
    icon: <PlayIcon className="h-4 w-4" />,
    variant: "default",
  },
  {
    event: { type: "CLOSE_VOTING" },
    label: "Encerrar Votação",
    icon: <XIcon className="h-4 w-4" />,
    variant: "outline",
  },
  {
    event: { type: "APPROVE_PI" },
    label: "Aprovar PI",
    icon: <CheckCheckIcon className="h-4 w-4" />,
    variant: "default",
  },
  {
    event: { type: "REQUIRE_REWORK" },
    label: "Requerer Retrabalho",
    icon: <RotateCcwIcon className="h-4 w-4" />,
    variant: "destructive",
  },
  {
    event: { type: "RESET_VOTING" },
    label: "Reiniciar Votação",
    icon: <RotateCcwIcon className="h-4 w-4" />,
    variant: "outline",
  },
];

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
      ? (votes.reduce((a, b) => a + b, 0) / votes.length).toFixed(1)
      : null;

  const colorClass = STATE_COLORS[xStateStatus] ?? STATE_COLORS.NOT_STARTED;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Confidence Vote — Rodada {roundNumber}
          </CardTitle>
          <span
            className={`rounded-full border px-3 py-1 font-medium text-xs ${colorClass}`}
          >
            {STATE_LABELS[xStateStatus] ?? xStateStatus}
          </span>
        </div>
        <CardDescription>
          Transições validadas por XState antes de persistir no banco.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Vote Score Input — only when OPEN */}
        {xStateStatus === "OPEN" && (
          <div>
            <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Submeter Voto (1–5)
            </p>
            <div className="flex gap-2">
              {VOTE_SCORES.map((score) => (
                <Button
                  className="h-10 w-10 font-semibold"
                  disabled={isPending}
                  key={score}
                  onClick={() =>
                    handleEvent({ type: "SUBMIT_VOTE", vote: score })
                  }
                  size="sm"
                  variant="outline"
                >
                  {score}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Vote Stats */}
        {votes.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <ThumbsUpIcon className="h-4 w-4 text-primary" />
                <span className="font-medium">{votes.length} voto(s)</span>
              </div>
              {avgScore && (
                <span className="text-muted-foreground">
                  Média:{" "}
                  <span className="font-semibold text-foreground">
                    {avgScore}
                  </span>
                  /5
                </span>
              )}
              <div className="flex flex-wrap gap-1">
                {votes.map((v, i) => (
                  <Badge
                    className="font-mono text-xs"
                    key={`${i}-${v}`}
                    variant="outline"
                  >
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Transition Buttons — disabled if not in available events */}
        <div>
          <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
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

        {xStateStatus === "APPROVED" && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-green-500 text-sm">
            PI Aprovado — confiança média de {avgScore}/5
          </div>
        )}
      </CardContent>
    </Card>
  );
}
