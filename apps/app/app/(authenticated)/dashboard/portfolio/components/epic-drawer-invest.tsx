"use client";

import type { AggregatedPortfolioEpic, InvestBreakdown } from "@/lib/portfolio-aggregate";
import { analyzeInvest } from "@/app/actions/epics/analyze-invest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Button } from "@repo/design-system/components/ui/button";
import { useState, useTransition } from "react";
import { cn } from "@repo/design-system/lib/utils";

type Props = { epic: AggregatedPortfolioEpic };

const INVEST_LABELS: Record<keyof InvestBreakdown, string> = {
  I: "Independent", N: "Negotiable", V: "Valuable",
  E: "Estimable", S: "Small", T: "Testable",
};

function ScoreBar({ letter, score, rationale }: { letter: keyof InvestBreakdown; score: number; rationale?: string }) {
  const color = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold">{letter} — {INVEST_LABELS[letter]}</span>
        <span className="font-mono">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      {rationale && <p className="text-[10px] text-muted-foreground">{rationale}</p>}
    </div>
  );
}

export function EpicDrawerInvest({ epic }: Props) {
  const [breakdown, setBreakdown] = useState<InvestBreakdown | null>(epic.investBreakdown);
  const [score, setScore] = useState<number | null>(epic.investScore);
  const [rationale, setRationale] = useState<Record<string, string> | null>(null);
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
  const letters = (["I", "N", "V", "E", "S", "T"] as const);

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="invest" className="flex-1">
        <TabsList className="w-full justify-start px-6 border-b rounded-none bg-transparent h-auto py-0">
          <TabsTrigger value="invest" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">
            INVEST
          </TabsTrigger>
          <TabsTrigger value="star" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">
            STAR
          </TabsTrigger>
          <TabsTrigger value="granularidade" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-3">
            Granularidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invest" className="p-6 space-y-4">
          {score !== null && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl font-bold tabular-nums">{Math.round(score)}</span>
              <div>
                <p className="text-xs text-muted-foreground">INVEST Score</p>
                <p className="text-xs">{score >= 70 ? "✓ Bem definido" : score >= 50 ? "⚠ Pode melhorar" : "✗ Precisa revisão"}</p>
              </div>
            </div>
          )}

          {breakdown ? (
            <div className="space-y-4">
              {letters.map((l) => (
                <ScoreBar
                  key={l}
                  letter={l}
                  score={breakdown[l]}
                  rationale={rationale?.[l]}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground text-center">
                Nenhum score INVEST calculado ainda.
              </p>
              <Button onClick={handleAnalyze} disabled={isPending} size="sm">
                {isPending ? "Analisando…" : "Analisar com IA"}
              </Button>
            </div>
          )}

          {breakdown && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? "Reanalisando…" : "Reanalisar"}
            </Button>
          )}
        </TabsContent>

        <TabsContent value="star" className="p-6">
          <p className="text-sm text-muted-foreground">Análise STAR (Situation / Task / Action / Result) — em breve.</p>
        </TabsContent>

        <TabsContent value="granularidade" className="p-6">
          <p className="text-sm text-muted-foreground">Análise de granularidade — em breve.</p>
        </TabsContent>
      </Tabs>

      {/* Sticky footer warning */}
      {isSmallWarning && (
        <div className="shrink-0 border-t bg-yellow-50 dark:bg-yellow-950 px-6 py-3">
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
            ⚠ Task grande — considere quebrar em épicos menores (S = {Math.round(breakdown!.S)})
          </p>
        </div>
      )}
    </div>
  );
}
