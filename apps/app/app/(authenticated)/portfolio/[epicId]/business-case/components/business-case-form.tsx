"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  autosaveBusinessCase,
  type BusinessCaseData,
  type LbcItem,
  type VersionSnapshot,
} from "@/app/actions/epics/business-case";
import { draftHypothesisAction } from "@/app/actions/epics/draft-hypothesis";
import { HypothesisResolutionModal } from "./hypothesis-resolution-modal";
import { VersionHistoryPanel } from "./version-history-panel";

type Props = {
  data: BusinessCaseData;
  isReadOnly: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const SIZE_ESTIMATES = ["XS", "S", "M", "L", "XL"] as const;
const MAX_OUTCOMES = 5;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: form component with many fields — extraction would fragment the autosave logic
export function BusinessCaseForm({ data, isReadOnly }: Props) {
  const [hypothesis, setHypothesis] = useState(data.hypothesis ?? "");
  const [outcomes, setOutcomes] = useState<LbcItem[]>(data.businessOutcomes);
  const [indicators, setIndicators] = useState<LbcItem[]>(
    data.leadingIndicators
  );
  const [nfrs, setNfrs] = useState(data.nfrs ?? "");
  const [mvp, setMvp] = useState(data.mvp ?? "");
  const [sizeEstimate, setSizeEstimate] = useState(data.sizeEstimate ?? "");
  const [versions, setVersions] = useState<VersionSnapshot[]>(
    data.descriptionVersions
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showHistory, setShowHistory] = useState(false);
  const [isDraftingHypothesis, setIsDraftingHypothesis] = useState(false);
  const [draftedHypothesis, setDraftedHypothesis] = useState<string | null>(
    null
  );
  const [showResolutionModal, setShowResolutionModal] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHypothesisRef = useRef(data.hypothesis ?? "");

  const scheduleAutosave = useCallback(
    (patch: Parameters<typeof autosaveBusinessCase>[0]) => {
      if (isReadOnly) {
        return;
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      setSaveState("saving");
      saveTimerRef.current = setTimeout(async () => {
        const result = await autosaveBusinessCase(patch);
        if (result.ok) {
          setSaveState("saved");
          setTimeout(() => setSaveState("idle"), 2000);
        } else {
          setSaveState("error");
          toast.error(`Erro ao salvar: ${result.error}`);
        }
      }, 800);
    },
    [isReadOnly]
  );

  // Cleanup timer on unmount
  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    },
    []
  );

  function handleHypothesisChange(val: string) {
    setHypothesis(val);
    scheduleAutosave({ epicId: data.epicId, hypothesis: val });
  }

  function addOutcome() {
    if (outcomes.length >= MAX_OUTCOMES) {
      return;
    }
    const next = [
      ...outcomes,
      { id: crypto.randomUUID().slice(0, 8), text: "" },
    ];
    setOutcomes(next);
    scheduleAutosave({ epicId: data.epicId, businessOutcomes: next });
  }

  function updateOutcome(id: string, text: string) {
    const next = outcomes.map((o) => (o.id === id ? { ...o, text } : o));
    setOutcomes(next);
    scheduleAutosave({ epicId: data.epicId, businessOutcomes: next });
  }

  function deleteOutcome(id: string) {
    const next = outcomes.filter((o) => o.id !== id);
    setOutcomes(next);
    scheduleAutosave({ epicId: data.epicId, businessOutcomes: next });
  }

  function addIndicator() {
    if (indicators.length >= MAX_OUTCOMES) {
      return;
    }
    const next = [
      ...indicators,
      { id: crypto.randomUUID().slice(0, 8), text: "" },
    ];
    setIndicators(next);
    scheduleAutosave({ epicId: data.epicId, leadingIndicators: next });
  }

  function updateIndicator(id: string, text: string) {
    const next = indicators.map((o) => (o.id === id ? { ...o, text } : o));
    setIndicators(next);
    scheduleAutosave({ epicId: data.epicId, leadingIndicators: next });
  }

  function deleteIndicator(id: string) {
    const next = indicators.filter((o) => o.id !== id);
    setIndicators(next);
    scheduleAutosave({ epicId: data.epicId, leadingIndicators: next });
  }

  async function handleDraftHypothesis() {
    setIsDraftingHypothesis(true);
    setDraftedHypothesis(null);
    const result = await draftHypothesisAction({ epicId: data.epicId });
    setIsDraftingHypothesis(false);
    if (result.ok) {
      setDraftedHypothesis(result.data.text);
    } else if (result.error === "DESCRIPTION_TOO_SHORT") {
      toast.error(
        "Adicione mais descrição ao épico para gerar uma hipótese (mín. 100 chars)."
      );
    } else if (result.error === "TERMINAL_STATE") {
      toast.error("Épico em estado final — ações de IA desabilitadas.");
    } else {
      toast.error(`Erro ao gerar hipótese: ${result.error}`);
    }
  }

  function handleAcceptDraft() {
    if (!draftedHypothesis) {
      return;
    }
    const prev = hypothesis;
    const snap: Omit<VersionSnapshot, "savedAt"> = {
      field: "hypothesis",
      prev,
      next: draftedHypothesis,
      savedBy: "COPILOT",
    };
    setHypothesis(draftedHypothesis);
    prevHypothesisRef.current = draftedHypothesis;
    scheduleAutosave({
      epicId: data.epicId,
      hypothesis: draftedHypothesis,
      versionSnapshot: snap,
    });
    const newVersionEntry: VersionSnapshot = {
      ...snap,
      savedAt: new Date().toISOString(),
    };
    setVersions((v) => {
      const updated = [...v, newVersionEntry];
      return updated.length > 50 ? updated.slice(updated.length - 50) : updated;
    });
    setDraftedHypothesis(null);
    toast.success("Hipótese aplicada.");
  }

  const hypothesisWeak =
    hypothesis.trim().length > 0 && hypothesis.trim().length < 50;
  const canDraft = (data.descriptionMd?.length ?? 0) >= 100;

  return (
    <div className="space-y-8">
      {/* Save indicator */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {saveState === "saving" && "Salvando…"}
          {saveState === "saved" && "✓ Salvo"}
          {saveState === "error" && "Erro ao salvar"}
        </p>
        <button
          className="text-muted-foreground text-xs hover:underline"
          onClick={() => setShowHistory(!showHistory)}
          type="button"
        >
          Histórico de versões ({versions.length})
        </button>
      </div>

      {!!showHistory && <VersionHistoryPanel versions={versions} />}

      {/* Progress panel */}
      <section className="rounded-lg border bg-muted/30 p-4">
        <h2 className="mb-3 font-semibold text-sm">Progresso</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Features concluídas</p>
            <p className="font-medium">
              {data.doneFeatureCount}/{data.featureCount}
              {data.featureCount > 0 && (
                <span className="ml-1 text-muted-foreground text-xs">
                  (
                  {Math.round(
                    (data.doneFeatureCount / data.featureCount) * 100
                  )}
                  %)
                </span>
              )}
            </p>
          </div>
          {data.leanBudgetAllocation !== null && (
            <div>
              <p className="text-muted-foreground text-xs">Orçamento alocado</p>
              <p className="font-medium">
                {data.leanBudgetAllocation.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Hypothesis */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-medium text-sm" htmlFor="hypothesis">
            Hipótese
          </label>
          {!isReadOnly && (
            <Button
              disabled={isDraftingHypothesis || !canDraft}
              onClick={handleDraftHypothesis}
              size="sm"
              title={
                canDraft
                  ? undefined
                  : "Adicione mais descrição ao épico para gerar uma hipótese"
              }
              variant="outline"
            >
              {isDraftingHypothesis ? "Gerando…" : "✦ Rascunhar para mim"}
            </Button>
          )}
        </div>
        <Textarea
          disabled={isReadOnly}
          id="hypothesis"
          onChange={(e) => handleHypothesisChange(e.target.value)}
          placeholder="Acreditamos que [capacidade] irá [resultado] para [segmento], medido por [indicador]…"
          rows={4}
          value={hypothesis}
        />
        {!!hypothesisWeak && (
          <p className="text-amber-500 text-xs">
            Uma boa hipótese deve descrever o que você acredita que vai
            acontecer e como será medido (mín. 50 caracteres).
          </p>
        )}

        {/* Copilot draft panel */}
        {draftedHypothesis !== null && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
            <p className="mb-2 font-medium text-indigo-700 text-xs dark:text-indigo-300">
              Sugestão do Copilot:
            </p>
            <p className="mb-3 text-sm">{draftedHypothesis}</p>
            <div className="flex gap-2">
              <Button onClick={handleAcceptDraft} size="sm">
                Aceitar
              </Button>
              <Button
                onClick={() => {
                  if (!draftedHypothesis) {
                    return;
                  }
                  handleHypothesisChange(draftedHypothesis);
                  setDraftedHypothesis(null);
                }}
                size="sm"
                variant="outline"
              >
                Editar
              </Button>
              <Button
                onClick={() => setDraftedHypothesis(null)}
                size="sm"
                variant="ghost"
              >
                Descartar
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Business Outcomes */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm">
            Resultados de negócio ({outcomes.length}/{MAX_OUTCOMES})
          </h2>
          {isReadOnly ? null : (
            <Button
              disabled={outcomes.length >= MAX_OUTCOMES}
              onClick={addOutcome}
              size="sm"
              title={
                outcomes.length >= MAX_OUTCOMES
                  ? "Máximo 5 resultados de negócio por épico"
                  : "Adicionar resultado de negócio"
              }
              variant="outline"
            >
              + Adicionar
            </Button>
          )}
        </div>
        {outcomes.map((o) => (
          <div className="flex gap-2" key={o.id}>
            <Input
              className="flex-1"
              disabled={isReadOnly}
              onChange={(e) => updateOutcome(o.id, e.target.value)}
              placeholder="Descreva um resultado de negócio esperado…"
              value={o.text}
            />
            {isReadOnly ? null : (
              <Button
                onClick={() => deleteOutcome(o.id)}
                size="sm"
                variant="ghost"
              >
                ×
              </Button>
            )}
          </div>
        ))}
        {outcomes.length === 0 && (
          <p className="text-muted-foreground text-xs">
            Nenhum resultado adicionado.
          </p>
        )}
      </section>

      {/* Leading Indicators */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm">
            Indicadores antecipados ({indicators.length}/{MAX_OUTCOMES})
          </h2>
          {isReadOnly ? null : (
            <Button
              disabled={indicators.length >= MAX_OUTCOMES}
              onClick={addIndicator}
              size="sm"
              title={
                indicators.length >= MAX_OUTCOMES
                  ? "Máximo 5 indicadores por épico"
                  : "Adicionar indicador"
              }
              variant="outline"
            >
              + Adicionar
            </Button>
          )}
        </div>
        {indicators.map((o) => (
          <div className="flex gap-2" key={o.id}>
            <Input
              className="flex-1"
              disabled={isReadOnly}
              onChange={(e) => updateIndicator(o.id, e.target.value)}
              placeholder="Descreva um indicador antecipado…"
              value={o.text}
            />
            {isReadOnly ? null : (
              <Button
                onClick={() => deleteIndicator(o.id)}
                size="sm"
                variant="ghost"
              >
                ×
              </Button>
            )}
          </div>
        ))}
        {indicators.length === 0 && (
          <p className="text-muted-foreground text-xs">
            Nenhum indicador adicionado.
          </p>
        )}
      </section>

      {/* MVP */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-medium text-sm" htmlFor="mvp">
            MVP
          </label>
          <Select
            disabled={isReadOnly}
            onValueChange={(v) => {
              setSizeEstimate(v);
              scheduleAutosave({
                epicId: data.epicId,
                sizeEstimate: v as "XS" | "S" | "M" | "L" | "XL",
              });
            }}
            value={sizeEstimate}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              {SIZE_ESTIMATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          disabled={isReadOnly}
          id="mvp"
          onChange={(e) => {
            setMvp(e.target.value);
            scheduleAutosave({ epicId: data.epicId, mvp: e.target.value });
          }}
          placeholder="Descreva o escopo mínimo viável…"
          rows={3}
          value={mvp}
        />
      </section>

      {/* NFRs */}
      <section className="space-y-2">
        <label className="font-medium text-sm" htmlFor="nfrs">
          Requisitos não funcionais (NFRs)
        </label>
        <Textarea
          disabled={isReadOnly}
          id="nfrs"
          onChange={(e) => {
            setNfrs(e.target.value);
            scheduleAutosave({ epicId: data.epicId, nfrs: e.target.value });
          }}
          placeholder="Performance, disponibilidade, conformidade, segurança…"
          rows={3}
          value={nfrs}
        />
      </section>

      {/* Hypothesis Resolution (only shown for DONE epics) */}
      {data.lifecycleStatus === "DONE" && (
        <section className="space-y-2">
          {/* biome-ignore lint/a11y/noLabelWithoutControl: display-only label — not associated with an interactive input */}
          <label className="font-medium text-sm">Resolução da hipótese</label>
          {data.hypothesisResolution ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-green-800 text-xs dark:bg-green-900/30 dark:text-green-300">
              {data.hypothesisResolution.replace(/_/g, " ")}
            </span>
          ) : (
            <div>
              <p className="mb-2 text-amber-500 text-xs">
                Épico DONE sem resolução de hipótese definida.
              </p>
              <Button
                onClick={() => setShowResolutionModal(true)}
                size="sm"
                variant="outline"
              >
                Definir resolução
              </Button>
            </div>
          )}
        </section>
      )}

      {!!showResolutionModal && (
        <HypothesisResolutionModal
          epicId={data.epicId}
          onClose={() => setShowResolutionModal(false)}
          onSaved={(resolution) => {
            setShowResolutionModal(false);
            scheduleAutosave({
              epicId: data.epicId,
              hypothesisResolution: resolution as
                | "VALIDATED"
                | "PARTIALLY_VALIDATED"
                | "INVALIDATED",
            });
          }}
        />
      )}
    </div>
  );
}
