"use client";

// Editor do caso de negócio — S-06. Só existe em rascunho: a versão enviada
// para assinatura está congelada, e editar depois é versão nova (SB-07).
//
// O que a pessoa digita passa por `toSaveDraftInput` antes de sair: número com
// vírgula, reais, chave da métrica e o lado da meta são resolvidos ali, e a
// recusa diz qual campo. O servidor continua sendo quem decide (`saveDraft`
// revalida tudo); a tela só poupa a ida e volta.

import { Button, SectionCard } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import {
  type BusinessCaseDetail,
  saveDraft,
} from "@/app/(scaffold)/actions/business-case";
import {
  blankMetric,
  type CaseForm,
  fromDetail,
  type MetricForm,
  toSaveDraftInput,
} from "@/lib/scaffold/business-case-form";
import { Field, Input, Select, Textarea } from "./base";

const DIRECTION = [
  { value: "DOWN", label: "Cair (menos é melhor)" },
  { value: "UP", label: "Subir (mais é melhor)" },
] as const;

const CONFIDENCE = [
  { value: "MEASURED", label: "Medida" },
  { value: "ESTIMATED", label: "Estimada" },
  { value: "DECLARED", label: "Declarada" },
] as const;

const CADENCE = [
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
] as const;

const BENEFIT = [
  { value: "COST_AVOIDED", label: "Custo evitado" },
  { value: "REVENUE_PROTECTED", label: "Receita protegida" },
  { value: "REVENUE_NEW", label: "Receita nova" },
] as const;

export function BusinessCaseEditor({
  bc,
  onSaved,
}: {
  bc: BusinessCaseDetail;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CaseForm>(() => fromDetail(bc));
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const setMetric = (i: number, patch: Partial<MetricForm>) =>
    setForm((f) => ({
      ...f,
      metrics: f.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));

  const save = async () => {
    const parsed = toSaveDraftInput(form);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors([]);
    setBusy(true);
    const res = await saveDraft({ businessCaseId: bc.id, ...parsed.input });
    setBusy(false);
    if (res.ok) {
      onSaved();
    } else {
      setErrors([res.error]);
    }
  };

  return (
    <SectionCard
      icon="edit"
      subtitle="Cada métrica é uma promessa que o Signal vai apurar. A linha de base precisa de série medida, não de opinião."
      title="Editar promessa"
      tone="accent"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {form.metrics.map((m, i) => (
          <fieldset
            // biome-ignore lint/suspicious/noArrayIndexKey: métrica sem id até salvar; a ordem é a identidade
            key={i}
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-md)",
              padding: 14,
              margin: 0,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 12,
            }}
          >
            <legend
              className="mono"
              style={{ fontSize: 11.5, fontWeight: 700, padding: "0 6px" }}
            >
              Métrica {i + 1}
            </legend>
            <Field htmlFor={`mt-${i}-label`} label="Rótulo" required>
              <Input
                disabled={busy}
                id={`mt-${i}-label`}
                onChange={(e) => setMetric(i, { label: e.target.value })}
                value={m.label}
              />
            </Field>
            <Field htmlFor={`mt-${i}-unit`} label="Unidade" required>
              <Input
                disabled={busy}
                id={`mt-${i}-unit`}
                onChange={(e) => setMetric(i, { unit: e.target.value })}
                placeholder="min, %, R$"
                value={m.unit}
              />
            </Field>
            <Field htmlFor={`mt-${i}-base`} label="Linha de base" required>
              <Input
                disabled={busy}
                id={`mt-${i}-base`}
                inputMode="decimal"
                onChange={(e) => setMetric(i, { baseValue: e.target.value })}
                value={m.baseValue}
              />
            </Field>
            <Field htmlFor={`mt-${i}-target`} label="Meta" required>
              <Input
                disabled={busy}
                id={`mt-${i}-target`}
                inputMode="decimal"
                onChange={(e) => setMetric(i, { targetValue: e.target.value })}
                value={m.targetValue}
              />
            </Field>
            <Field htmlFor={`mt-${i}-dir`} label="Direção">
              <Select
                id={`mt-${i}-dir`}
                onChange={(v) => setMetric(i, { direction: v })}
                options={[...DIRECTION]}
                value={m.direction}
              />
            </Field>
            <Field htmlFor={`mt-${i}-conf`} label="Confiança">
              <Select
                id={`mt-${i}-conf`}
                onChange={(v) => setMetric(i, { confidence: v })}
                options={[...CONFIDENCE]}
                value={m.confidence}
              />
            </Field>
            <Field htmlFor={`mt-${i}-source`} label="Fonte do número" required>
              <Input
                disabled={busy}
                id={`mt-${i}-source`}
                onChange={(e) => setMetric(i, { sourceLabel: e.target.value })}
                value={m.sourceLabel}
              />
            </Field>
            <Field htmlFor={`mt-${i}-sample`} label="Amostra" required>
              <Input
                disabled={busy}
                id={`mt-${i}-sample`}
                onChange={(e) => setMetric(i, { sampleLabel: e.target.value })}
                placeholder="4 semanas, 1.200 pedidos"
                value={m.sampleLabel}
              />
            </Field>
            <div style={{ display: "flex", alignItems: "end" }}>
              <Button
                disabled={busy || form.metrics.length === 1}
                icon="minus"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    metrics: f.metrics.filter((_, j) => j !== i),
                  }))
                }
                size="sm"
                variant="secondary"
              >
                Remover métrica
              </Button>
            </div>
          </fieldset>
        ))}

        <div>
          <Button
            disabled={busy}
            icon="plus"
            onClick={() =>
              setForm((f) => ({ ...f, metrics: [...f.metrics, blankMetric()] }))
            }
            size="sm"
            variant="secondary"
          >
            Adicionar métrica
          </Button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
          }}
        >
          <Field
            htmlFor="bc-window"
            label="Janela de apuração (meses)"
            required
          >
            <Input
              disabled={busy}
              id="bc-window"
              inputMode="numeric"
              onChange={(e) =>
                setForm((f) => ({ ...f, windowMonths: e.target.value }))
              }
              value={form.windowMonths}
            />
          </Field>
          <Field htmlFor="bc-cadence" label="Cadência">
            <Select
              id="bc-cadence"
              onChange={(v) => setForm((f) => ({ ...f, cadence: v }))}
              options={[...CADENCE]}
              value={form.cadence}
            />
          </Field>
          <Field htmlFor="bc-kind" label="Tipo de benefício">
            <Select
              id="bc-kind"
              onChange={(v) => setForm((f) => ({ ...f, benefitKind: v }))}
              options={[...BENEFIT]}
              value={form.benefitKind}
            />
          </Field>
          <Field htmlFor="bc-annual" label="Benefício anual (R$)">
            <Input
              disabled={busy}
              id="bc-annual"
              inputMode="decimal"
              onChange={(e) =>
                setForm((f) => ({ ...f, benefitAnnual: e.target.value }))
              }
              placeholder="1.234,56"
              value={form.benefitAnnual}
            />
          </Field>
        </div>

        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 12.5,
          }}
        >
          <input
            checked={form.benefitHard}
            disabled={busy}
            onChange={(e) =>
              setForm((f) => ({ ...f, benefitHard: e.target.checked }))
            }
            type="checkbox"
          />
          Benefício rígido: cai no razão contábil (o CFO reconhece)
        </label>

        <Field htmlFor="bc-basis" label="Base do benefício" required>
          <Textarea
            disabled={busy}
            id="bc-basis"
            onChange={(e) =>
              setForm((f) => ({ ...f, benefitBasis: e.target.value }))
            }
            placeholder="De onde vem o ganho e como ele é calculado."
            value={form.benefitBasis}
          />
        </Field>

        {errors.length > 0 && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--r-sm)",
              background: "var(--red-soft)",
              color: "var(--red-text)",
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button disabled={busy} icon="check" onClick={save}>
            Salvar rascunho
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
