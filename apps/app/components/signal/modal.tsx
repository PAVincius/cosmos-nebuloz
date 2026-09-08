"use client";

// modal.tsx — formulários de iniciativa e baseline.
//
// Duas escolhas de produto que o formulário carrega, e que não são detalhe de
// UI:
//
//  1. A hipótese tem mínimo de 20 caracteres e o campo diz por quê. "Vai
//     melhorar" não é hipótese — não dá para checar depois se aconteceu. O
//     servidor recusa igual; o formulário explica antes, para a pessoa não
//     descobrir a regra por rejeição.
//  2. O baseline pede fonte POR DIMENSÃO, e as cinco são obrigatórias para
//     assinar. Assinar é o ato que congela a régua: depois disso o número não
//     muda mais, e é contra ele que todo ganho será medido.

import { Button } from "@repo/design-system/cosmos/kit";
import { useCallback, useId, useState } from "react";
import { draftBaseline, signBaseline } from "@/app/(signal)/actions/baseline";
import { recordObservation } from "@/app/(signal)/actions/evidence";
import {
  createInitiative,
  updateInitiative,
} from "@/app/(signal)/actions/initiatives";
import {
  BASELINE_KEY_LABEL,
  CATEGORY_LABEL,
  REQUIRED_BASELINE_KEYS,
} from "@/lib/signal/lifecycle";
import { Field, Input, ModalShell, Select, Textarea, useModal } from "./base";

const HYPOTHESIS_MIN = 20;

type Category = keyof typeof CATEGORY_LABEL;

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as Category[]).map(
  (value) => ({ value, label: CATEGORY_LABEL[value] })
);

/** Erro devolvido pela action, com a regra quando houver. */
function ErrorNote({
  error,
  blockers,
}: {
  error: string | null;
  blockers?: string[];
}) {
  if (!error) {
    return null;
  }
  const list = blockers ?? [];
  return (
    <div
      role="alert"
      style={{
        padding: "10px 12px",
        borderRadius: "var(--r-sm)",
        background: "var(--red-soft)",
        border: "1px solid rgba(var(--red-rgb),.3)",
        color: "var(--red-text)",
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      {error}
      {list.length > 0 ? (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {list.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function InitiativeForm({
  initial,
  onSaved,
}: {
  /** Presente = edição. Ausente = criação. */
  initial?: {
    code: string;
    name: string;
    businessUnit: string;
    category: Category;
    hypothesis: string;
  };
  onSaved: (code: string) => void;
}) {
  const { close } = useModal();
  const ids = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [businessUnit, setBusinessUnit] = useState(initial?.businessUnit ?? "");
  const [category, setCategory] = useState<Category>(
    initial?.category ?? "PRODUCTIVITY"
  );
  const [hypothesis, setHypothesis] = useState(initial?.hypothesis ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hypothesisShort =
    hypothesis.trim().length > 0 && hypothesis.trim().length < HYPOTHESIS_MIN;
  const hypothesisError = hypothesisShort
    ? `Faltam ${HYPOTHESIS_MIN - hypothesis.trim().length} caracteres.`
    : undefined;
  const savingLabel = initial ? "Salvar" : "Criar iniciativa";
  const saveLabel = saving ? "Salvando…" : savingLabel;
  const canSave =
    name.trim().length > 0 &&
    businessUnit.trim().length > 0 &&
    hypothesis.trim().length >= HYPOTHESIS_MIN;

  const submit = useCallback(async () => {
    setSaving(true);
    setError(null);
    const res = initial
      ? await updateInitiative({
          code: initial.code,
          name,
          businessUnit,
          category,
          hypothesis,
        })
      : await createInitiative({
          name,
          businessUnit,
          category,
          hypothesis,
        });
    setSaving(false);
    if (res.ok) {
      onSaved(res.data.code);
      close();
      return;
    }
    setError(res.error);
  }, [initial, name, businessUnit, category, hypothesis, onSaved, close]);

  return (
    <ModalShell
      actions={
        <>
          <Button onClick={close} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={!canSave || saving} onClick={submit}>
            {saveLabel}
          </Button>
        </>
      }
      icon="target"
      onClose={close}
      subtitle={
        initial
          ? `Editando ${initial.code}. Mudanças entram na trilha de auditoria.`
          : "A iniciativa nasce em rascunho. Para ativá-la você precisará assinar um baseline antes."
      }
      title={initial ? "Editar iniciativa" : "Nova iniciativa"}
      width={640}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ErrorNote error={error} />

        <Field htmlFor={`${ids}-name`} label="Nome" required>
          <Input
            id={`${ids}-name`}
            onChange={(e) => setName(e.target.value)}
            placeholder="Triagem assistida de autorizações"
            value={name}
          />
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field htmlFor={`${ids}-bu`} label="Área" required>
              <Input
                id={`${ids}-bu`}
                onChange={(e) => setBusinessUnit(e.target.value)}
                placeholder="Operações"
                value={businessUnit}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field htmlFor={`${ids}-cat`} label="Categoria" required>
              <Select
                id={`${ids}-cat`}
                onChange={setCategory}
                options={CATEGORY_OPTIONS}
                value={category}
              />
            </Field>
          </div>
        </div>

        <Field
          error={hypothesisError}
          hint="Escreva o que deveria melhorar e quanto. Uma hipótese que não dá para conferir depois não serve para medir — “vai melhorar” não é hipótese."
          htmlFor={`${ids}-hyp`}
          label="Hipótese de negócio"
          required
        >
          <Textarea
            id={`${ids}-hyp`}
            invalid={hypothesisShort}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder="Se a triagem priorizar por critério econômico em vez de ordem de chegada, o cycle time cai ≥ 20% sem aumentar negativa indevida."
            rows={4}
            value={hypothesis}
          />
        </Field>
      </div>
    </ModalShell>
  );
}

/**
 * Registrar observação de métrica à mão.
 *
 * O campo de transformação é obrigatório e o rótulo diz por quê: é ele que
 * transforma o número em evidência. O servidor recusa sem ele de qualquer
 * forma — aqui a pessoa descobre a regra antes de perder o que digitou.
 */
export function ObservationForm({
  initiativeCode,
  onSaved,
}: {
  initiativeCode: string;
  onSaved: () => void;
}) {
  const { close } = useModal();
  const ids = useId();
  const [metricLabel, setMetricLabel] = useState("");
  const [value, setValue] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [transform, setTransform] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSave =
    metricLabel.trim().length > 0 &&
    value.trim().length > 0 &&
    windowStart.length > 0 &&
    windowEnd.length > 0 &&
    transform.trim().length > 0;

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await recordObservation({
      initiativeCode,
      metricLabel,
      value,
      windowStart,
      windowEnd,
      transform,
      source: "MANUAL",
    });
    setBusy(false);
    if (res.ok) {
      onSaved();
      close();
      return;
    }
    setError(res.error);
  }, [
    initiativeCode,
    metricLabel,
    value,
    windowStart,
    windowEnd,
    transform,
    onSaved,
    close,
  ]);

  return (
    <ModalShell
      actions={
        <>
          <Button onClick={close} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={!canSave || busy} onClick={submit}>
            {busy ? "Registrando…" : "Registrar observação"}
          </Button>
        </>
      }
      icon="fileText"
      onClose={close}
      subtitle={`Observação de métrica para ${initiativeCode}. Não há edição depois: corrigir é lançar outra, porque a série congelada é o que permite dizer "nesta data o número era este".`}
      title="Registrar observação"
      width={680}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ErrorNote error={error} />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field htmlFor={`${ids}-metric`} label="Métrica" required>
              <Input
                id={`${ids}-metric`}
                onChange={(e) => setMetricLabel(e.target.value)}
                placeholder="Horas economizadas"
                value={metricLabel}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field htmlFor={`${ids}-value`} label="Valor" required>
              <Input
                id={`${ids}-value`}
                onChange={(e) => setValue(e.target.value)}
                placeholder="1.870 h"
                value={value}
              />
            </Field>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field
              htmlFor={`${ids}-obs-start`}
              label="Início da janela"
              required
            >
              <Input
                id={`${ids}-obs-start`}
                onChange={(e) => setWindowStart(e.target.value)}
                type="date"
                value={windowStart}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field htmlFor={`${ids}-obs-end`} label="Fim da janela" required>
              <Input
                id={`${ids}-obs-end`}
                onChange={(e) => setWindowEnd(e.target.value)}
                type="date"
                value={windowEnd}
              />
            </Field>
          </div>
        </div>

        <Field
          hint="Como este número foi obtido. É o que separa evidência de opinião — sem isso a observação não pode ser contestada nem defendida."
          htmlFor={`${ids}-transform`}
          label="Transformação"
          required
        >
          <Textarea
            id={`${ids}-transform`}
            onChange={(e) => setTransform(e.target.value)}
            placeholder="sum(time_in_status) ÷ 60, sobre as issues fechadas no período"
            rows={3}
            value={transform}
          />
        </Field>
      </div>
    </ModalShell>
  );
}

const CLOSURE_MIN = 20;

/**
 * Encerrar iniciativa.
 *
 * Formulário próprio, e não um `prompt()`: o motivo do encerramento é o texto
 * que o comitê lê na próxima rodada de orçamento e que fica na trilha para
 * sempre. Uma caixinha do navegador não tem contador, não tem rótulo, não é
 * estilizável e é ignorada por parte dos leitores de tela — pedir a justificativa
 * mais consequente do produto por ali seria dizer que ela não importa.
 */
export function CloseInitiativeForm({
  code,
  onClosed,
}: {
  code: string;
  onClosed: (reason: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { close } = useModal();
  const ids = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const short = reason.trim().length > 0 && reason.trim().length < CLOSURE_MIN;
  const reasonError = short
    ? `Faltam ${CLOSURE_MIN - reason.trim().length} caracteres.`
    : undefined;
  const canClose = reason.trim().length >= CLOSURE_MIN;

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await onClosed(reason);
    setBusy(false);
    if (res.ok) {
      close();
      return;
    }
    setError(res.error ?? "Não foi possível encerrar.");
  }, [reason, onClosed, close]);

  return (
    <ModalShell
      actions={
        <>
          <Button onClick={close} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={!canClose || busy} onClick={submit}>
            {busy ? "Encerrando…" : "Encerrar iniciativa"}
          </Button>
        </>
      }
      icon="ban"
      onClose={close}
      subtitle={`${code} passa a encerrada. Encerrada não reabre — se a hipótese voltar, ela volta como iniciativa nova, e o comitê vê as duas lado a lado.`}
      title="Encerrar iniciativa"
      tone="red"
      width={620}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ErrorNote error={error} />
        <Field
          error={reasonError}
          hint="O que aconteceu, e o que foi feito com o investimento. É o que responde “por que paramos com aquilo?” daqui a seis meses."
          htmlFor={`${ids}-reason`}
          label="Motivo do encerramento"
          required
        >
          <Textarea
            id={`${ids}-reason`}
            invalid={short}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Adoção nunca passou de 31% e caiu por 6 meses seguidos. Retorno de 0,3× com confiança 74% — o número era confiável, a hipótese estava errada. Licenças realocadas para IN-014."
            rows={5}
            value={reason}
          />
        </Field>
      </div>
    </ModalShell>
  );
}

type DimensionDraft = {
  key: string;
  label: string;
  value: string;
  sourceLabel: string;
};

const emptyDimensions = (): DimensionDraft[] =>
  REQUIRED_BASELINE_KEYS.map((key) => ({
    key,
    label: BASELINE_KEY_LABEL[key] ?? key,
    value: "",
    sourceLabel: "",
  }));

export function BaselineForm({
  initiativeCode,
  onSaved,
}: {
  initiativeCode: string;
  onSaved: () => void;
}) {
  const { close } = useModal();
  const ids = useId();
  const [windowLabel, setWindowLabel] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [dims, setDims] = useState<DimensionDraft[]>(emptyDimensions);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[] | undefined>();
  const [busy, setBusy] = useState(false);

  const setDim = (index: number, patch: Partial<DimensionDraft>) => {
    setDims((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d))
    );
  };

  const complete = dims.every(
    (d) => d.value.trim().length > 0 && d.sourceLabel.trim().length > 0
  );
  const canSubmit =
    windowLabel.trim().length > 0 &&
    windowStart.length > 0 &&
    windowEnd.length > 0 &&
    complete;

  /**
   * Rascunha e assina numa ação só.
   *
   * O modelo separa as duas etapas (e a action também), mas o formulário só
   * fecha quando a régua está congelada: um baseline em rascunho não destrava
   * nada e ficaria como pendência invisível.
   */
  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    setBlockers(undefined);

    const drafted = await draftBaseline({
      initiativeCode,
      windowLabel,
      windowStart,
      windowEnd,
      dimensions: dims,
    });
    if (!drafted.ok) {
      setBusy(false);
      setError(drafted.error);
      setBlockers(drafted.blockers);
      return;
    }

    const signed = await signBaseline({
      initiativeCode,
      version: drafted.data.version,
    });
    setBusy(false);
    if (!signed.ok) {
      setError(signed.error);
      setBlockers(signed.blockers);
      return;
    }
    onSaved();
    close();
  }, [
    initiativeCode,
    windowLabel,
    windowStart,
    windowEnd,
    dims,
    onSaved,
    close,
  ]);

  return (
    <ModalShell
      actions={
        <>
          <Button onClick={close} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={!canSubmit || busy} onClick={submit}>
            {busy ? "Assinando…" : "Assinar baseline"}
          </Button>
        </>
      }
      icon="ruler"
      onClose={close}
      subtitle={`Linha de base de ${initiativeCode}. Depois de assinada é imutável — mudar exige uma versão nova, e a anterior continua valendo para o que já foi reportado.`}
      title="Capturar baseline"
      width={760}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ErrorNote blockers={blockers} error={error} />

        <Field
          hint="Como a janela aparecerá nos relatórios."
          htmlFor={`${ids}-wl`}
          label="Janela de medição"
          required
        >
          <Input
            id={`${ids}-wl`}
            onChange={(e) => setWindowLabel(e.target.value)}
            placeholder="4 semanas · mai/2026"
            value={windowLabel}
          />
        </Field>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field htmlFor={`${ids}-ws`} label="Início" required>
              <Input
                id={`${ids}-ws`}
                onChange={(e) => setWindowStart(e.target.value)}
                type="date"
                value={windowStart}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field htmlFor={`${ids}-we`} label="Fim" required>
              <Input
                id={`${ids}-we`}
                onChange={(e) => setWindowEnd(e.target.value)}
                type="date"
                value={windowEnd}
              />
            </Field>
          </div>
        </div>

        <div>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--ink-subtle)",
            }}
          >
            As cinco dimensões são obrigatórias. Cada uma precisa da fonte de
            onde o número veio — sem origem declarada, o baseline não sustenta
            contestação e a assinatura é recusada.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dims.map((d, i) => (
              <div
                key={d.key}
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "140px 1fr 1fr",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--ink-muted)",
                  }}
                >
                  {d.label}
                </span>
                <Input
                  aria-label={`Valor de ${d.label}`}
                  onChange={(e) => setDim(i, { value: e.target.value })}
                  placeholder="46 min"
                  value={d.value}
                />
                <Input
                  aria-label={`Fonte de ${d.label}`}
                  onChange={(e) => setDim(i, { sourceLabel: e.target.value })}
                  placeholder="Jira · tempo em fila"
                  value={d.sourceLabel}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

const RESOLVE_MIN = 15;

/**
 * Resolver um alerta exige dizer o que foi feito — US5.
 *
 * A nota é a única coisa que responde, no próximo ciclo, se o problema foi
 * tratado ou só arquivado. Sem ela a fila esvazia e ninguém aprende nada.
 */
export function ResolveAlertForm({
  code,
  question,
  onResolved,
}: {
  code: string;
  question: string;
  onResolved: (note: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { close } = useModal();
  const ids = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmed = note.trim();
  const short = trimmed.length > 0 && trimmed.length < RESOLVE_MIN;
  const noteError = short
    ? `Faltam ${RESOLVE_MIN - trimmed.length} caracteres.`
    : undefined;
  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await onResolved(note);
    setBusy(false);
    if (res.ok) {
      close();
      return;
    }
    setError(res.error ?? "Não foi possível resolver.");
  }, [note, onResolved, close]);

  return (
    <ModalShell
      actions={
        <>
          <Button onClick={close} variant="ghost">
            Cancelar
          </Button>
          <Button
            disabled={trimmed.length < RESOLVE_MIN || busy}
            onClick={submit}
          >
            {busy ? "Resolvendo…" : "Resolver alerta"}
          </Button>
        </>
      }
      icon="check"
      onClose={close}
      subtitle={question}
      title={`Resolver ${code}`}
      tone="green"
      width={580}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ErrorNote error={error} />
        <Field
          error={noteError}
          hint="O que foi feito, não que foi visto. É o que o comitê lê quando perguntar se o problema voltou."
          htmlFor={`${ids}-note`}
          label="O que foi feito"
          required
        >
          <Textarea
            id={`${ids}-note`}
            invalid={short}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reautorizamos o Zendesk e o sync voltou na quinta. As três observações congeladas foram remedidas com a janela correta."
            rows={4}
            value={note}
          />
        </Field>
      </div>
    </ModalShell>
  );
}
