"use client";

// Bateria do respondente — US2. Port de `meridian-screens-1.jsx`.
//
// É a única superfície do produto usada por quem não tem conta. Duas
// consequências no desenho: nada aqui depende de sessão, e o componente recebe
// o token do servidor em vez de descobri-lo — a página é que resolve o token e
// decide se existe algo a renderizar.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useRef, useState } from "react";
import type { Battery } from "@/app/(meridian)/actions/respondent";
import {
  attachEvidence,
  saveDraft,
  submitBattery,
} from "@/app/(meridian)/actions/respondent";
import { useActionToast as runWithToast } from "../cosmos/use-action-toast";

const LIKERT = [
  "Discordo forte",
  "Discordo",
  "Neutro",
  "Concordo",
  "Concordo forte",
];

export function RespondentForm({
  battery,
  token,
}: {
  battery: Battery;
  token: string;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>(
    Object.fromEntries(
      battery.questions
        .filter((q) => q.answer !== null)
        .map((q) => [q.id, q.answer as number])
    )
  );
  const [files, setFiles] = useState<Record<string, string[]>>(
    Object.fromEntries(
      battery.questions.map((q) => [q.id, q.evidence.map((e) => e.fileName)])
    )
  );
  const [busy, setBusy] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const answered = Object.keys(answers).length;
  const total = battery.questions.length;

  const set = (id: string, v: number) => setAnswers((s) => ({ ...s, [id]: v }));

  const optionsFor = (q: Battery["questions"][number]): string[] => {
    if (q.type === "LIKERT") {
      return LIKERT;
    }
    if (q.type === "YES_NO") {
      return ["Sim", "Não"];
    }
    return q.scaleLabels;
  };

  const persist = async () => {
    setBusy(true);
    const res = await runWithToast(
      () =>
        saveDraft({
          token,
          answers: Object.entries(answers).map(([questionId, rawValue]) => ({
            questionId,
            rawValue,
          })),
        }),
      {
        loading: "Salvando…",
        success:
          "Rascunho salvo — os lembretes continuam até você concluir a bateria.",
      }
    );
    setBusy(false);
    return res.ok;
  };

  const submit = async () => {
    if (!(await persist())) {
      return;
    }
    setBusy(true);
    await runWithToast(() => submitBattery(token), {
      loading: "Enviando respostas…",
      success: (d) =>
        d.missing > 0
          ? `${d.missing} pergunta(s) sem resposta — a bateria não foi concluída.`
          : "Bateria concluída. Obrigado — os lembretes param agora.",
    });
    setBusy(false);
  };

  const upload = async (questionId: string, file: File) => {
    setBusy(true);
    const res = await runWithToast(
      () => attachEvidence(token, questionId, file),
      {
        loading: "Anexando evidência…",
        success: (e) => `${e.fileName} anexado.`,
      }
    );
    setBusy(false);
    if (res.ok) {
      setFiles((s) => ({
        ...s,
        [questionId]: [...(s[questionId] ?? []), res.data.fileName],
      }));
    }
  };

  return (
    <div
      className="fade-in"
      style={{
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "var(--gap)",
      }}
    >
      <PageHeader
        eyebrow={`${battery.context.orgName} · ${battery.context.assessmentCode} · eixo ${battery.context.axisLabel}`}
        meta={
          <>
            <Badge dot tone="accent">
              {answered} de {total} · prazo{" "}
              {new Date(battery.context.deadline).toLocaleDateString("pt-BR")}
            </Badge>
            <Badge tone="neutral">só o seu eixo é visível</Badge>
          </>
        }
        subtitle="Você foi indicado por conhecer este eixo. Responda com a prática real, não com a intenção — e anexe evidência onde puder."
        title={`Bateria de prontidão — ${battery.context.axisLabel}`}
        tone="accent"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {battery.questions.map((q, qi) => {
          const options = optionsFor(q);
          const chosen = answers[q.id];
          return (
            <SectionCard
              bodyStyle={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
              icon={chosen !== undefined ? "check" : undefined}
              key={q.id}
              title={`${qi + 1}. ${q.text}`}
              tone={chosen !== undefined ? "green" : undefined}
            >
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {options.map((label, i) => (
                  <button
                    aria-pressed={chosen === i}
                    className="btn"
                    key={label}
                    onClick={() => set(q.id, i)}
                    style={{
                      flex: "1 1 110px",
                      padding: "9px 8px",
                      borderRadius: 9,
                      fontSize: 11.5,
                      fontWeight: 700,
                      background:
                        chosen === i
                          ? "var(--accent-soft)"
                          : "var(--surface-2)",
                      border: `1px solid ${chosen === i ? "rgba(var(--accent-rgb),.5)" : "var(--hairline)"}`,
                      color:
                        chosen === i
                          ? "var(--accent-text)"
                          : "var(--ink-muted)",
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {(files[q.id] ?? []).map((f) => (
                  <span
                    className="mono"
                    key={f}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 99,
                      background: "var(--purple-soft)",
                      color: "var(--purple-text)",
                      border: "1px solid rgba(var(--purple-rgb),.3)",
                    }}
                  >
                    <Icon name="paperclip" size={11} />
                    {f}
                  </span>
                ))}
                <input
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      upload(q.id, file);
                    }
                    e.target.value = "";
                  }}
                  ref={(el) => {
                    fileInputs.current[q.id] = el;
                  }}
                  type="file"
                />
                <Button
                  disabled={busy}
                  icon="paperclip"
                  onClick={() => fileInputs.current[q.id]?.click()}
                  size="sm"
                  variant="ghost"
                >
                  Anexar evidência
                </Button>
              </div>
            </SectionCard>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button disabled={busy} onClick={persist} variant="secondary">
          Salvar e continuar depois
        </Button>
        <Button disabled={busy} icon="check" onClick={submit}>
          Enviar respostas
        </Button>
      </div>
    </div>
  );
}
