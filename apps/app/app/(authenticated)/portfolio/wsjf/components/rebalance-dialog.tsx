"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  SparklesIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  LoaderIcon,
} from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/design-system/components/ui/dialog";
import { rebalanceWSJFWithAI } from "@/app/actions/wsjf/rebalance";
import { updateFeatureWSJF } from "@/app/actions/features/update-wsjf";
import type { RebalancingResult, FeatureSuggestion, AIAccessStatus } from "@/app/actions/wsjf/rebalance";
import type { EpicWithFeatures } from "@/app/actions/wsjf";
import type { ExplainabilitySuggestion } from "./explainability-panel";

type Phase = "idle" | "running" | "result" | "confirming" | "done" | "error";

const STEPS = [
  { id: 1, label: "Coletando estado do portfólio...", icon: "🔍", durationMs: 1400 },
  { id: 2, label: "Analisando times e capacidade...", icon: "👥", durationMs: 1600 },
  { id: 3, label: "Calculando novas prioridades WSJF...", icon: "🧠", durationMs: 0 },
  { id: 4, label: "Preparando relatório de mudanças...", icon: "📋", durationMs: 800 },
];

const AI_LOADING_MESSAGES = [
  "Alinhando os value streams com o universo...",
  "Colocando macacos infinitos para calcular o PI 42...",
  "Sinergizando os Agile Release Trains com o karma...",
  "Consultando o oráculo de Fibonacci...",
  "Movendo o needle holístico de forma cross-funcional...",
  "Destravando o throughput com pensamento sistêmico...",
  "Perguntando pro GPT o que o Scrum Master diria...",
  "Calculando o WSJF via teoria quântica do backlog...",
  "Reorganizando o PI enquanto o RTE toma café...",
  "Aplicando lean thinking nos epicentros do portfólio...",
  "Fazendo o velocity dar match com a capacidade real...",
  "Garantindo o Definition of Done do rebalanceamento...",
  "Iterando sobre os story points do universo expandido...",
  "Priorizando o que o cliente nem sabe que quer ainda...",
  "Respondendo ao Slack do PO enquanto calcula o ROAM...",
  "Consultando Sun Tzu sobre priorização de features...",
  "Synergizando stakeholders em modo assíncrono...",
  "Pedindo pro macaco de Shakespeare revisar os épicos...",
  "Triangulando com o Jeff Bezos imaginário da sala...",
  "Destilando a essência do backlog em pó de WSJF...",
  "Desbloqueando a Jornada do Herói Ágil™...",
  "Democratizando o acesso ao story point do futuro...",
  "Fazendo o MVP do rebalanceamento de forma iterativa...",
  "Aguardando aprovação do Comitê de Comitês...",
  "Rodando retrospectiva dos dados antes de entregar...",
  "Alinhando com os OKRs que ninguém lembra quais são...",
  "Perguntando pro Copilot se ele concorda com o Claude...",
  "Estimando com Planning Poker digital não-determinístico...",
  "Orquestrando os agentes de IA em coreografia SAFe...",
  "Calculando o ROI de calcular o ROI...",
];

const IMPACT_LABELS: Record<string, string> = {
  team_capacity: "Capacidade",
  dependency: "Dependência",
  deadline: "Prazo",
  member_availability: "Disponibilidade",
  velocity_trend: "Velocidade",
  priority_drift: "Deriva",
};

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0)
    return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <MinusIcon className="h-3 w-3" /> 0
      </span>
    );
  if (delta > 0)
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <TrendingUpIcon className="h-3 w-3" /> +{delta.toFixed(1)}
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-xs font-medium text-red-500 dark:text-red-400">
      <TrendingDownIcon className="h-3 w-3" /> {delta.toFixed(1)}
    </span>
  );
}

export function RebalanceDialog({
  epics,
  access,
  onSuggestions,
}: {
  epics: EpicWithFeatures[];
  access: AIAccessStatus;
  onSuggestions?: (suggestions: ExplainabilitySuggestion[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<RebalancingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const aiCallStarted = useRef(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  useEffect(() => {
    if (currentStep !== 3) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % AI_LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [currentStep]);

  const changedSuggestions = result?.suggestions.filter((s) => s.delta !== 0) ?? [];

  function resetDialog() {
    setPhase("idle");
    setCurrentStep(0);
    setResult(null);
    setError(null);
    aiCallStarted.current = false;
  }

  function handleOpenChange(next: boolean) {
    if (!next && phase === "running") return; // block close while running
    setOpen(next);
    if (!next) setTimeout(resetDialog, 300);
  }

  // Step progression + AI call
  useEffect(() => {
    if (phase !== "running") return;

    let cancelled = false;

    async function run() {
      // Steps 1 & 2: UI-only delays
      for (let i = 0; i < 2; i++) {
        if (cancelled) return;
        setCurrentStep(i + 1);
        await new Promise((r) => setTimeout(r, STEPS[i].durationMs));
      }

      // Step 3: actual AI call
      if (cancelled || aiCallStarted.current) return;
      aiCallStarted.current = true;
      setCurrentStep(3);

      try {
        const res = await rebalanceWSJFWithAI();
        if (cancelled) return;

        // Step 4: formatting delay
        setCurrentStep(4);
        await new Promise((r) => setTimeout(r, STEPS[3].durationMs));
        if (cancelled) return;

        setResult(res);
        onSuggestions?.(
          res.suggestions.map((s: FeatureSuggestion): ExplainabilitySuggestion => ({
            featureId: s.featureId,
            featureTitle: s.featureTitle,
            epicTitle: s.epicTitle,
            currentWSJF: s.currentWSJF,
            suggestedWSJF: s.suggestedWSJF,
            delta: s.delta,
            impactFactor: s.impactFactor,
            confidence: s.confidence,
            justification: s.justification,
          }))
        );
        setPhase("result");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Erro inesperado ao contatar a IA.");
        setPhase("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  function handleStart() {
    setPhase("running");
    setCurrentStep(0);
    setError(null);
    aiCallStarted.current = false;
  }

  function handleConfirm() {
    if (!result) return;
    setPhase("confirming");
    startTransition(async () => {
      try {
        await Promise.all(
          changedSuggestions.map((s) =>
            updateFeatureWSJF({
              featureId: s.featureId,
              bv: s.suggestedBV,
              tc: s.suggestedTC,
              rr: s.suggestedRR,
              js: s.suggestedJS,
            })
          )
        );
        setPhase("done");
        setTimeout(() => {
          setOpen(false);
          router.refresh();
        }, 1200);
      } catch {
        setError("Falha ao aplicar mudanças. Tente novamente.");
        setPhase("error");
      }
    });
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Button
          onClick={handleStart}
          variant="outline"
          disabled={open || !access.allowed}
          title={!access.allowed ? access.reason : undefined}
        >
          <SparklesIcon className="mr-2 h-4 w-4 text-primary" />
          Rebalancear com IA
        </Button>
        {access.remainingUses !== -1 && (
          <p className={`text-[10px] ${access.remainingUses === 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {access.remainingUses === 0
              ? `Limite atingido · plano ${access.plan}`
              : `${access.remainingUses} uso${access.remainingUses !== 1 ? "s" : ""} restante${access.remainingUses !== 1 ? "s" : ""} · ${access.plan}`}
          </p>
        )}
      </div>

      <Dialog open={open || phase === "running" || ["result","confirming","done","error"].includes(phase)} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-center gap-3 border-b px-6 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <SparklesIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold leading-none">
                Rebalanceamento WSJF por IA
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Análise automática de prioridades com base no estado atual do portfólio
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="px-6 py-6 min-h-[360px] flex flex-col">
            {/* ── RUNNING ── */}
            {phase === "running" && (
              <div className="flex flex-col gap-4 flex-1 justify-center">
                <div className="flex flex-col gap-3">
                  {STEPS.map((step, idx) => {
                    const stepNum = idx + 1;
                    const isActive = currentStep === stepNum;
                    const isDone = currentStep > stepNum;
                    return (
                      <div
                        key={step.id}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-300 ${
                          isActive
                            ? "border-primary/40 bg-primary/5"
                            : isDone
                              ? "border-border bg-muted/20 opacity-70"
                              : "border-border bg-muted/10 opacity-40"
                        }`}
                      >
                        <span className="text-lg">{step.icon}</span>
                        <span className="text-sm flex-1">{step.label}</span>
                        {isDone && <CheckCircleIcon className="h-4 w-4 text-green-500 shrink-0" />}
                        {isActive && (
                          <LoaderIcon className="h-4 w-4 text-primary shrink-0 animate-spin" />
                        )}
                      </div>
                    );
                  })}
                </div>
                {currentStep === 3 && (
                  <div className="rounded-lg bg-muted/20 border border-dashed px-4 py-3 text-center">
                    <p className="text-xs text-primary font-medium animate-pulse">
                      {AI_LOADING_MESSAGES[loadingMsgIdx]}
                    </p>
                  </div>
                )}
                <p className="text-center text-xs text-muted-foreground mt-1">
                  {epics.length} épicos · {epics.reduce((s, e) => s + e.features.length, 0)} features analisadas
                </p>
              </div>
            )}

            {/* ── RESULT ── */}
            {phase === "result" && result && (
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-semibold">
                        {result.modifiedCount} feature{result.modifiedCount !== 1 ? "s" : ""} com sugestão de mudança
                        {result.unchangedCount > 0 && (
                          <span className="text-muted-foreground font-normal ml-1">
                            · {result.unchangedCount} sem alteração
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  {result.portfolioInsight}
                </div>

                {changedSuggestions.length > 0 ? (
                  <div className="flex-1 overflow-y-auto max-h-56 rounded-lg border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Feature</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">Atual</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">Sugerido</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">Δ</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Fator</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {changedSuggestions.map((s) => (
                          <tr key={s.featureId} className="hover:bg-muted/20">
                            <td className="px-3 py-2.5">
                              <p className="font-medium truncate max-w-[180px]">{s.featureTitle}</p>
                              <p className="text-muted-foreground truncate max-w-[180px]">{s.epicTitle}</p>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono">{s.currentWSJF.toFixed(1)}</td>
                            <td className="px-3 py-2.5 text-center font-mono font-medium">{s.suggestedWSJF.toFixed(1)}</td>
                            <td className="px-3 py-2.5 text-center">
                              <DeltaBadge delta={s.delta} />
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge variant="outline" className="text-[10px]">
                                {IMPACT_LABELS[s.impactFactor] ?? s.impactFactor}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    Nenhuma mudança sugerida — portfólio bem priorizado.
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                    Descartar
                  </Button>
                  {changedSuggestions.length > 0 && (
                    <Button size="sm" onClick={() => setPhase("confirming")}>
                      Visualizar e confirmar →
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* ── CONFIRMING ── */}
            {phase === "confirming" && result && (
              <div className="flex flex-col gap-4 flex-1">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
                  <AlertTriangleIcon className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Ação crítica — não reversível automaticamente</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Esta ação modificará os parâmetros WSJF de{" "}
                      <strong>{changedSuggestions.length} feature{changedSuggestions.length !== 1 ? "s" : ""}</strong>.
                      Os valores anteriores não serão restaurados automaticamente.
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto max-h-52 rounded-lg border divide-y">
                  {changedSuggestions.map((s) => (
                    <div key={s.featureId} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.featureTitle}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.epicTitle}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-xs font-mono">
                          <span className="text-muted-foreground">{s.currentWSJF.toFixed(1)}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-semibold">{s.suggestedWSJF.toFixed(1)}</span>
                          <DeltaBadge delta={s.delta} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{s.justification}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setPhase("result")} disabled={isPending}>
                    ← Voltar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="bg-primary text-primary-foreground"
                  >
                    {isPending ? (
                      <>
                        <LoaderIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="mr-1.5 h-3.5 w-3.5" />
                        Confirmar e aplicar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ── DONE ── */}
            {phase === "done" && (
              <div className="flex flex-col items-center justify-center flex-1 gap-3">
                <CheckCircleIcon className="h-10 w-10 text-green-500" />
                <p className="text-sm font-medium">WSJF atualizado com sucesso</p>
                <p className="text-xs text-muted-foreground">
                  {changedSuggestions.length} feature{changedSuggestions.length !== 1 ? "s" : ""} repriorizada{changedSuggestions.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {/* ── ERROR ── */}
            {phase === "error" && (
              <div className="flex flex-col items-center justify-center flex-1 gap-4">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4 text-center max-w-sm">
                  <AlertTriangleIcon className="h-5 w-5 text-destructive mx-auto mb-2" />
                  <p className="text-sm font-medium text-destructive">Erro no rebalanceamento</p>
                  <p className="text-xs text-muted-foreground mt-1">{error}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                    Fechar
                  </Button>
                  <Button size="sm" onClick={handleStart}>
                    Tentar novamente
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
