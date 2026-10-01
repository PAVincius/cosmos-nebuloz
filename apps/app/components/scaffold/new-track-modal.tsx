"use client";

// Criar trilha — S-01 (a partir de lacuna promovida) e trilha sem lacuna.
//
// Um form só, três portas de entrada: a promoção pendente do portfólio, um gap
// real do Meridian escolhido aqui (PDF p.3, X-03) e nenhuma lacuna. As duas
// primeiras terminam em `createTrackFromGap`. `createTrackFromGap` e `createTrack`
// tinham zero chamadores fora de testes: o Meridian dizia "Promovido para o
// SCAFFOLD" e nenhuma trilha nascia. Este modal é o que faltava entre a
// promessa e o trabalho.

import { Button } from "@repo/design-system/cosmos/kit";
import { useEffect, useRef, useState } from "react";
import { listScaffoldAssessments } from "@/app/(scaffold)/actions/assessments";
import { listScaffoldGaps } from "@/app/(scaffold)/actions/gaps";
import { listTemplates } from "@/app/(scaffold)/actions/templates";
import {
  createTrack,
  createTrackFromGap,
  type PendingPromotion,
  type ScaffoldMember,
} from "@/app/(scaffold)/actions/tracks";
import type { RankedGap } from "@/lib/meridian/gap-ranking";
import {
  type AssessmentOption,
  assessmentOptionLabel,
} from "@/lib/scaffold/assessment-options";
import { workFormLabel } from "@/lib/scaffold/forms";
import { gapEligibility, gapLabels } from "@/lib/scaffold/gap-labels";
import { Field, Input, ModalShell, Select } from "./base";

type TemplateOption = { id: string; name: string; archetype: string | null };

/** De onde a trilha nasce: a promoção que o Meridian já registrou. */
type GapSource = {
  promotionId: string;
  gapId: string;
  gapCode: string;
  statement: string;
};

type GapList =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: RankedGap[] };

type AssessmentList =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: AssessmentOption[] };

/** Nome do processo sugerido pelo enunciado: até os dois-pontos. */
const processNameOf = (statement: string) =>
  (statement.split(":")[0] ?? "").trim();

export function NewTrackModal({
  promotion,
  members,
  onClose,
  onCreated,
}: {
  /** Presente quando a trilha nasce de uma lacuna promovida (S-01). */
  promotion: PendingPromotion | null;
  members: ScaffoldMember[];
  onClose: () => void;
  onCreated: (trackId: string) => void;
}) {
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [source, setSource] = useState<GapSource | null>(
    promotion
      ? {
          promotionId: promotion.id,
          gapId: promotion.gapId,
          gapCode: promotion.gapCode,
          statement: promotion.statement,
        }
      : null
  );
  // Nome do processo vem da lacuna quando há uma; a pessoa ajusta se quiser.
  const [processName, setProcessName] = useState(
    promotion ? processNameOf(promotion.statement) : ""
  );
  // A lista de gaps só existe na "Nova trilha" avulsa: a promoção pendente do
  // portfólio já traz o gap escolhido.
  const [gaps, setGaps] = useState<GapList>({ status: "loading" });
  // Diagnóstico do Meridian de que a trilha de prontidão nasce (D-27). Só é lido
  // quando o template escolhido não tem forma de trabalho.
  const [assessments, setAssessments] = useState<AssessmentList>({
    status: "idle",
  });
  const [assessmentId, setAssessmentId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [consultantId, setConsultantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (promotion) {
      return;
    }
    let live = true;
    listScaffoldGaps().then((res) => {
      if (live) {
        setGaps(
          res.ok
            ? { status: "ok", data: res.data }
            : { status: "error", message: res.error }
        );
      }
    });
    return () => {
      live = false;
    };
  }, [promotion]);

  const pickGap = (g: RankedGap, promotionId: string) => {
    setSource({
      promotionId,
      gapId: g.id,
      gapCode: g.code,
      statement: g.statement,
    });
    setProcessName(processNameOf(g.statement));
  };

  const clearGap = () => {
    setSource(null);
    setProcessName("");
  };

  useEffect(() => {
    listTemplates().then((res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Só template com versão publicada vira trilha — ST-01. Os outros não
      // aparecem em vez de aparecerem desabilitados: não há o que escolher.
      const published = res.data
        .filter((t) => t.currentLabel)
        .map((t) => ({ id: t.id, name: t.name, archetype: t.archetype }));
      setTemplates(published);
      setTemplateId((cur) => cur || (published[0]?.id ?? ""));
    });
  }, []);

  // Trilha de prontidão: template publicado SEM forma de trabalho. Enquanto os
  // templates não carregam, não há como saber, e o campo não aparece.
  const isReadiness =
    templates?.find((t) => t.id === templateId)?.archetype === null;

  // Lê uma vez só, na primeira vez que um template de prontidão é escolhido. O
  // `ref` (e não o estado de carregamento nas dependências) é o que impede o
  // efeito de cancelar a si mesmo ao marcar "loading".
  const assessmentsRequested = useRef(false);
  useEffect(() => {
    if (!isReadiness) {
      // Trocou para uma forma de trabalho: o assessment escolhido não vale mais.
      setAssessmentId("");
      return;
    }
    if (assessmentsRequested.current) {
      return;
    }
    assessmentsRequested.current = true;
    setAssessments({ status: "loading" });
    listScaffoldAssessments().then((res) => {
      setAssessments(
        res.ok
          ? { status: "ok", data: res.data }
          : { status: "error", message: res.error }
      );
    });
  }, [isReadiness]);

  const canSubmit =
    Boolean(templateId) &&
    processName.trim().length > 0 &&
    Boolean(ownerId) &&
    (!isReadiness || Boolean(assessmentId));

  const submit = async () => {
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    setError(null);
    const base = {
      templateId,
      processName: processName.trim(),
      ownerId,
      consultantId: consultantId || undefined,
      // Só trilha de prontidão leva o vínculo; as outras nem mandam o campo.
      ...(isReadiness ? { sourceAssessmentId: assessmentId } : {}),
    };
    const res = source
      ? await createTrackFromGap({
          ...base,
          gapId: source.gapId,
          promotionId: source.promotionId,
        })
      : await createTrack(base);
    setBusy(false);
    if (res.ok) {
      onCreated(res.data.trackId);
    } else {
      setError(res.error);
    }
  };

  const consultants = members.filter((m) => m.role === "CONSULTANT");
  // Só quem tem papel de dono do processo: ele produz o que é do dono e assina o
  // caso de negócio. Sponsor, líder do time e consultoria não fazem nenhum dos dois.
  const owners = members.filter((m) => m.role === "PROCESS_OWNER");
  const ownerOptions = [
    {
      value: "",
      label: owners.length
        ? "Escolha o dono do processo"
        : "Ninguém com papel de dono do processo",
    },
    ...owners.map((m) => ({ value: m.id, label: m.name })),
  ];
  const consultantOptions = [
    { value: "", label: "Sem consultor Nebuloz" },
    ...consultants.map((m) => ({ value: m.id, label: m.name })),
  ];
  const templateOptions = (templates ?? []).map((t) => ({
    value: t.id,
    label: `${t.name} · ${workFormLabel(t.archetype) || "sem forma de trabalho"}`,
  }));

  return (
    <ModalShell
      actions={
        <>
          <Button disabled={busy} onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button
            disabled={busy || !canSubmit || !templates}
            icon="layers"
            onClick={submit}
          >
            Criar trilha
          </Button>
        </>
      }
      icon="layers"
      onClose={onClose}
      subtitle={
        source
          ? `S-01 · nasce do gap ${source.gapCode} do Meridian, que continua dono do diagnóstico`
          : "Trilha sem lacuna de origem — nem todo processo passou por diagnóstico"
      }
      title="Nova trilha de adoção"
      tone="accent"
      width={560}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {promotion ? null : (
          <GapPicker
            gaps={gaps}
            onClear={clearGap}
            onPick={pickGap}
            pickedId={source?.gapId ?? null}
          />
        )}

        {source ? (
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            {source.statement}
          </p>
        ) : null}

        <Field htmlFor="nt-name" label="Processo" required>
          <Input
            autoFocus
            disabled={busy}
            id="nt-name"
            onChange={(e) => setProcessName(e.target.value)}
            placeholder="Ex.: Triagem de autorizações prévias"
            value={processName}
          />
        </Field>

        <Field
          hint={
            templates && templates.length === 0
              ? "Nenhum template tem versão publicada. Publique um na biblioteca antes."
              : undefined
          }
          htmlFor="nt-template"
          label="Template"
          required
        >
          <Select
            id="nt-template"
            onChange={setTemplateId}
            options={
              templateOptions.length
                ? templateOptions
                : [{ value: "", label: templates ? "—" : "Carregando…" }]
            }
            value={templateId}
          />
        </Field>

        {isReadiness ? (
          <AssessmentField
            assessmentId={assessmentId}
            assessments={assessments}
            onChange={setAssessmentId}
          />
        ) : null}

        <Field
          hint={
            owners.length === 0
              ? "Atribua o papel de dono do processo a alguém em Papéis de adoção antes de criar a trilha."
              : undefined
          }
          htmlFor="nt-owner"
          label="Dono do processo"
          required
        >
          <Select
            id="nt-owner"
            onChange={setOwnerId}
            options={ownerOptions}
            value={ownerId}
          />
        </Field>

        <Field htmlFor="nt-consultant" label="Consultor Nebuloz">
          <Select
            id="nt-consultant"
            onChange={setConsultantId}
            options={consultantOptions}
            value={consultantId}
          />
        </Field>

        {error ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "var(--red-text)",
            }}
          >
            {error}
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}

/** Gaps reais do Meridian, na ordem do ranking (X-03). Só o promovido para o
 *  Scaffold e sem trilha pode ser usado; o resto diz por quê. */
function GapPicker({
  gaps,
  pickedId,
  onPick,
  onClear,
}: {
  gaps: GapList;
  pickedId: string | null;
  onPick: (g: RankedGap, promotionId: string) => void;
  onClear: () => void;
}) {
  const note = (text: string) => (
    <p
      style={{
        margin: 0,
        fontSize: 12.5,
        color: "var(--ink-muted)",
        lineHeight: 1.6,
      }}
    >
      {text}
    </p>
  );

  let body: React.ReactNode;
  if (gaps.status === "loading") {
    body = note("Carregando gaps do Meridian…");
  } else if (gaps.status === "error") {
    body = note(
      `Gaps do Meridian indisponíveis: ${gaps.message} Você pode criar a trilha sem lacuna.`
    );
  } else if (gaps.data.length === 0) {
    body = note("Nenhum gap finalizado no Meridian. Crie a trilha sem lacuna.");
  } else {
    body = (
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          maxHeight: 240,
          overflowY: "auto",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
        }}
      >
        {gaps.data.map((g) => {
          const e = gapEligibility(g);
          const l = gapLabels(g);
          const picked = pickedId === g.id;
          return (
            <li
              key={g.id}
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid var(--hairline)",
                background: picked ? "var(--accent-soft)" : undefined,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--ink-faint)" }}
                >
                  #{g.rank}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 11.5, fontWeight: 700 }}
                >
                  {g.code}
                </span>
                <span style={{ fontSize: 12.5, flex: 1, minWidth: 0 }}>
                  {g.statement}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 4,
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                }}
              >
                <span>{l.severity}</span>
                <span>{l.effort}</span>
                <span>{l.confidence}</span>
                <span className="mono">{l.costOfDelay}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                {e.eligible ? (
                  picked ? (
                    <Button onClick={onClear} size="sm" variant="secondary">
                      Tirar o gap
                    </Button>
                  ) : (
                    <Button
                      onClick={() => onPick(g, e.promotionId)}
                      size="sm"
                      variant="secondary"
                    >
                      Usar este gap
                    </Button>
                  )
                ) : (
                  <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
                    {e.reason}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section
      aria-label="Gaps reais do Meridian"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div
        style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-muted)" }}
      >
        Gaps reais do Meridian
      </div>
      {body}
    </section>
  );
}

/** Diagnóstico de origem da trilha de prontidão (D-27). Sem assessment pontuado,
 *  explica de onde a trilha nasce e o que fazer, em vez de oferecer um campo
 *  vazio: o botão de criar fica desabilitado e o motivo está escrito aqui. */
function AssessmentField({
  assessments,
  assessmentId,
  onChange,
}: {
  assessments: AssessmentList;
  assessmentId: string;
  onChange: (id: string) => void;
}) {
  const note = (children: React.ReactNode, role?: "alert" | "status") => (
    <p
      role={role}
      style={{
        margin: 0,
        fontSize: 12.5,
        lineHeight: 1.6,
        color: role === "alert" ? "var(--red-text)" : "var(--ink-muted)",
      }}
    >
      {children}
    </p>
  );

  if (assessments.status === "idle" || assessments.status === "loading") {
    return note("Carregando os assessments do Meridian…", "status");
  }
  if (assessments.status === "error") {
    return note(
      `Assessments do Meridian indisponíveis: ${assessments.message} A trilha de prontidão precisa de um diagnóstico e não pode ser criada agora.`,
      "alert"
    );
  }
  if (assessments.data.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "10px 12px",
          borderRadius: "var(--r-md)",
          background: "var(--surface-2)",
          border: "1px solid var(--hairline)",
        }}
      >
        <strong style={{ fontSize: 13, color: "var(--ink)" }}>
          Esta trilha nasce de um diagnóstico do Meridian.
        </strong>
        {note(
          "Nenhum assessment com pontuação nesta organização. Faça o diagnóstico no Meridian, ou peça à consultora da Nebuloz — ela opera o Meridian para você. Criar a trilha fica disponível quando houver um assessment pontuado."
        )}
      </div>
    );
  }
  return (
    <Field
      hint={
        assessmentId
          ? undefined
          : "Escolha o assessment do Meridian para criar esta trilha."
      }
      htmlFor="nt-assessment"
      label="Diagnóstico do Meridian"
      required
    >
      <Select
        id="nt-assessment"
        onChange={onChange}
        options={[
          { value: "", label: "Escolha o assessment" },
          ...assessments.data.map((a) => ({
            value: a.id,
            label: assessmentOptionLabel(a),
          })),
        ]}
        value={assessmentId}
      />
    </Field>
  );
}
