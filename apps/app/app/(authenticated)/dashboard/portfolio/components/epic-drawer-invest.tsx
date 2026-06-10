"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { cn } from "@repo/design-system/lib/utils";
import { useState, useTransition } from "react";
import { analyzeInvest } from "@/app/actions/epics/analyze-invest";
import type {
  AggregatedPortfolioEpic,
  InvestBreakdown,
} from "@/lib/portfolio-aggregate";

type Props = { epic: AggregatedPortfolioEpic };

function getScoreLabel(score: number): string {
  if (score >= 50) {
    return "⚠ Pode melhorar";
  }
  return "✗ Precisa revisão";
}

function confidenceLabel(score: number): { label: string; color: string } {
  if (score >= 70) {
    return {
      label: "Alta confiança",
      color: "text-green-600 dark:text-green-400",
    };
  }
  if (score >= 50) {
    return {
      label: "Confiança média",
      color: "text-amber-600 dark:text-amber-400",
    };
  }
  return { label: "Baixa confiança", color: "text-red-600 dark:text-red-400" };
}

const INVEST_LABELS: Record<keyof InvestBreakdown, string> = {
  I: "Independent",
  N: "Negotiable",
  V: "Valuable",
  E: "Estimable",
  S: "Small",
  T: "Testable",
};

function ScoreBar({
  letter,
  score,
  rationale,
}: {
  letter: keyof InvestBreakdown;
  score: number;
  rationale?: string;
}) {
  let color = "bg-red-500";
  if (score >= 70) {
    color = "bg-green-500";
  } else if (score >= 50) {
    color = "bg-yellow-500";
  }
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold">
          {letter} — {INVEST_LABELS[letter]}
        </span>
        <span className="font-mono">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={cn("h-1.5 rounded-full transition-all", color)}
          style={{ width: `${Math.min(score, 93)}%` }}
        />
      </div>
      {!!rationale && (
        <p className="text-[10px] text-muted-foreground">{rationale}</p>
      )}
    </div>
  );
}

export function EpicDrawerInvest({ epic }: Props) {
  const [breakdown, setBreakdown] = useState<InvestBreakdown | null>(
    epic.investBreakdown
  );
  const [score, setScore] = useState<number | null>(epic.investScore);
  const [rationale, setRationale] = useState<Record<string, string> | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const handleAnalyze = () => {
    startTransition(async () => {
      const result = await analyzeInvest({ epicId: epic.id });
      if (result.ok && result.data) {
        setBreakdown(result.data.breakdown);
        setScore(result.data.compositeScore);
        setRationale(result.data.rationale);
      }
    });
  };

  const isSmallWarning = breakdown !== null && breakdown.S < 50;
  const letters = ["I", "N", "V", "E", "S", "T"] as const;

  return (
    <div className="flex h-full flex-col">
      <Tabs className="flex-1" defaultValue="invest">
        <TabsList className="!bg-transparent h-auto w-full justify-start gap-1 rounded-none border-b px-6 py-0">
          {(
            [
              { value: "invest", label: "INVEST" },
              { value: "star", label: "STAR" },
              { value: "granularidade", label: "Granularidade" },
            ] as const
          ).map(({ value, label }) => (
            <TabsTrigger
              className="!rounded-none !border-x-0 !border-t-0 !border-b-transparent !text-muted-foreground !shadow-none hover:!text-foreground data-[state=active]:!border-b-primary data-[state=active]:!bg-transparent data-[state=active]:!text-foreground data-[state=active]:!shadow-none border-b-2 px-3 py-3 font-medium text-sm transition-colors"
              key={value}
              value={value}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent className="space-y-4 p-6" value="invest">
          {score !== null && (
            <div className="mb-4 flex items-start gap-3">
              <span className="font-bold text-4xl tabular-nums">
                {Math.round(score)}
              </span>
              <div className="flex-1">
                <p className="text-muted-foreground text-xs">INVEST Score</p>
                <p className="text-xs">
                  {score >= 70 ? "✓ Bem definido" : getScoreLabel(score)}
                </p>
                <p
                  className={cn(
                    "mt-0.5 font-medium text-[10px]",
                    confidenceLabel(score).color
                  )}
                >
                  {confidenceLabel(score).label}
                </p>
              </div>
              {!!breakdown && (
                <p
                  className="mt-0.5 text-right text-[10px]"
                  style={{ color: "var(--cosmos-ai-fg)" }}
                >
                  ✦ Cosmos AI
                </p>
              )}
            </div>
          )}

          {breakdown ? (
            <div className="space-y-4">
              {letters.map((l) => (
                <ScoreBar
                  key={l}
                  letter={l}
                  rationale={rationale?.[l]}
                  score={breakdown[l]}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-center text-muted-foreground text-sm">
                Nenhum score INVEST calculado ainda.
              </p>
              <Button
                disabled={isPending}
                onClick={handleAnalyze}
                size="sm"
                variant="glow"
              >
                {isPending ? "Analisando…" : "Analisar com IA"}
              </Button>
            </div>
          )}

          {!!breakdown && (
            <Button
              className="w-full"
              disabled={isPending}
              onClick={handleAnalyze}
              size="sm"
              variant="outline"
            >
              {isPending ? "Reanalisando…" : "Reanalisar"}
            </Button>
          )}
        </TabsContent>

        <TabsContent className="p-6" value="star">
          <p className="text-muted-foreground text-sm">
            Análise STAR (Situation / Task / Action / Result) — em breve.
          </p>
        </TabsContent>

        <TabsContent className="p-6" value="granularidade">
          <p className="text-muted-foreground text-sm">
            Análise de granularidade — em breve.
          </p>
        </TabsContent>
      </Tabs>

      {/* Sticky footer warning */}
      {isSmallWarning ? (
        <div className="shrink-0 border-t bg-yellow-50 px-6 py-3 dark:bg-yellow-950">
          <p className="font-semibold text-xs text-yellow-700 dark:text-yellow-400">
            ⚠ Task grande — considere quebrar em épicos menores (S ={" "}
            {Math.round(breakdown?.S ?? 0)})
          </p>
        </div>
      ) : null}
    </div>
  );
}
