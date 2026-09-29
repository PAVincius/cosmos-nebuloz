"use client";

// Entregáveis da fase — SC-DEV-03/05. Cada linha mostra o estado por extenso
// (cor nunca é o único sinal) e só as ações que o ator pode fazer AGORA; a que
// ele não pode fica desabilitada com o motivo escrito, em vez de escondida:
// quem não pode agir precisa saber a quem pedir.

import type { IconName } from "@repo/design-system/cosmos/icons";
import { Badge, Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import {
  approveDeliverable,
  attachDeliverableVersion,
  type listDeliverables,
  readDeliverableFile,
  reopenDeliverable,
  requestDeliverableAdjustment,
  startDeliverable,
  submitDeliverable,
} from "@/app/(scaffold)/actions/deliverables";
import {
  type DeliverableStatus,
  type DeliverableTransition,
  MIN_COMMENT_LENGTH,
} from "@/lib/scaffold/deliverable-machine";
import { Field, ModalShell, Textarea } from "./base";

export type DeliverableItem = Extract<
  Awaited<ReturnType<typeof listDeliverables>>,
  { ok: true }
>["data"][number];

const STATUS: Record<
  DeliverableStatus,
  { label: string; tone: "neutral" | "accent" | "amber" | "red" | "green" }
> = {
  NOT_STARTED: { label: "Não iniciado", tone: "neutral" },
  IN_PROGRESS: { label: "Em elaboração", tone: "accent" },
  IN_REVIEW: { label: "Em revisão", tone: "amber" },
  ADJUSTMENT_REQUESTED: { label: "Ajuste pedido", tone: "red" },
  APPROVED: { label: "Aprovado", tone: "green" },
  REOPENED: { label: "Reaberto", tone: "amber" },
};

/** Ações que fazem sentido em cada estado, na ordem em que aparecem. */
const RELEVANT: Record<DeliverableStatus, DeliverableTransition[]> = {
  NOT_STARTED: ["START"],
  IN_PROGRESS: ["SUBMIT"],
  ADJUSTMENT_REQUESTED: ["SUBMIT"],
  REOPENED: ["SUBMIT"],
  IN_REVIEW: ["APPROVE", "REQUEST_ADJUSTMENT"],
  APPROVED: ["REOPEN"],
};

const ACTION: Record<
  DeliverableTransition,
  {
    label: string;
    icon: IconName;
    /** Pede comentário num diálogo antes de enviar. */
    needsComment: boolean;
    variant?: "secondary";
  }
> = {
  START: { label: "Iniciar", icon: "activity", needsComment: false },
  SUBMIT: { label: "Enviar para revisão", icon: "check", needsComment: false },
  APPROVE: { label: "Aprovar", icon: "check", needsComment: false },
  REQUEST_ADJUSTMENT: {
    label: "Pedir ajuste",
    icon: "refresh",
    needsComment: true,
    variant: "secondary",
  },
  REOPEN: {
    label: "Reabrir",
    icon: "refresh",
    needsComment: true,
    variant: "secondary",
  },
};

/** Estados em que se anexa arquivo (espelha `decideAttach`; quem decide é o
 *  servidor, e `d.attach` diz se este ator pode). */
const ATTACHABLE: DeliverableStatus[] = [
  "IN_PROGRESS",
  "ADJUSTMENT_REQUESTED",
  "REOPENED",
];

const RUN = {
  START: startDeliverable,
  SUBMIT: submitDeliverable,
  APPROVE: approveDeliverable,
  REQUEST_ADJUSTMENT: requestDeliverableAdjustment,
  REOPEN: reopenDeliverable,
} as const;

function requirement(d: DeliverableItem): {
  label: string;
  tone: "accent" | "neutral";
} {
  if (d.dispensedReason) {
    return { label: "Dispensado", tone: "neutral" };
  }
  return d.required
    ? { label: "Obrigatório", tone: "accent" }
    : { label: "Opcional", tone: "neutral" };
}

export function DeliverableList({
  items,
  onChanged,
}: {
  items: DeliverableItem[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    item: DeliverableItem;
    transition: DeliverableTransition;
  } | null>(null);
  const [comment, setComment] = useState("");

  const run = async (
    item: DeliverableItem,
    transition: DeliverableTransition,
    text?: string
  ) => {
    setBusy(true);
    setError(null);
    const res = await RUN[transition]({
      deliverableId: item.id,
      comment: text,
    });
    setBusy(false);
    if (res.ok) {
      setPending(null);
      setComment("");
      onChanged();
    } else {
      setError(res.error);
    }
  };

  // A URL é assinada para PUT direto no storage: o byte não passa pelo
  // servidor da aplicação.
  const attach = async (item: DeliverableItem, file: File) => {
    setBusy(true);
    setError(null);
    const res = await attachDeliverableVersion({
      deliverableId: item.id,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    const put = await fetch(res.data.uploadUrl, {
      method: "PUT",
      body: file,
      // O tipo é o que o servidor validou pela extensão, não o do navegador.
      headers: { "Content-Type": res.data.contentType },
    });
    setBusy(false);
    if (!put.ok) {
      setError(
        `Upload falhou (${put.status}). Tente anexar de novo: enviar para revisão só vale com o arquivo no storage.`
      );
      return;
    }
    onChanged();
  };

  const download = async (item: DeliverableItem) => {
    const res = await readDeliverableFile({ deliverableId: item.id });
    if (res.ok) {
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } else {
      setError(res.error);
    }
  };

  if (items.length === 0) {
    return (
      <div
        style={{ fontSize: 12.5, color: "var(--ink-faint)", lineHeight: 1.6 }}
      >
        Esta fase não tem entregável cadastrado. Trilhas criadas antes do modelo
        de entregáveis seguem só os passos.
      </div>
    );
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 10,
            padding: "8px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--red-soft)",
            color: "var(--red-text)",
            fontSize: 12.5,
          }}
        >
          {error}
        </div>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((d, i) => {
          const s = STATUS[d.status as DeliverableStatus];
          const req = requirement(d);
          const actions = RELEVANT[d.status as DeliverableStatus].map((t) => ({
            t,
            av: d.actions[t],
          }));
          const blocked = actions.find((a) => !a.av.allowed);
          return (
            <li
              key={d.id}
              style={{
                padding: "11px 0",
                borderBottom:
                  i === items.length - 1 ? "none" : "1px solid var(--hairline)",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "var(--accent-text)",
                    flexShrink: 0,
                  }}
                >
                  {d.code}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--ink)",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {d.title}
                </span>
                <Badge tone={req.tone}>{req.label}</Badge>
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>
              {d.lastReview?.comment ? (
                <div
                  style={{
                    marginTop: 6,
                    padding: "8px 12px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--amber-soft)",
                    border: "1px solid rgba(var(--amber-rgb),.28)",
                    fontSize: 12.5,
                    lineHeight: 1.55,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--ink-muted)",
                      marginBottom: 2,
                    }}
                  >
                    {d.lastReview.action === "REOPEN"
                      ? "Reaberto por"
                      : "Ajuste pedido por"}{" "}
                    {d.lastReview.byName} ·{" "}
                    {d.lastReview.at.toLocaleDateString("pt-BR")}
                  </div>
                  {d.lastReview.comment}
                </div>
              ) : null}
              {d.hasFile && d.fileName ? (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--ink-muted)" }}
                  >
                    v{d.version} · {d.fileName}
                  </span>
                  <Button
                    disabled={busy}
                    icon="download"
                    onClick={() => download(d)}
                    size="sm"
                    variant="secondary"
                  >
                    Baixar <span className="sr-only">{d.fileName}</span>
                  </Button>
                </div>
              ) : null}
              {d.dispensedReason ? (
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--ink-faint)",
                    marginTop: 4,
                  }}
                >
                  {d.dispensedReason}
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {actions.map(({ t, av }) => (
                  <Button
                    disabled={busy || !av.allowed}
                    icon={ACTION[t].icon}
                    key={t}
                    onClick={() =>
                      ACTION[t].needsComment
                        ? setPending({ item: d, transition: t })
                        : run(d, t)
                    }
                    size="sm"
                    variant={ACTION[t].variant}
                  >
                    {ACTION[t].label}
                  </Button>
                ))}
                {ATTACHABLE.includes(d.status as DeliverableStatus) ? (
                  <>
                    <label
                      style={{
                        cursor:
                          busy || !d.attach.allowed ? "not-allowed" : "pointer",
                        opacity: busy || !d.attach.allowed ? 0.5 : 1,
                        fontSize: 13,
                        fontWeight: 600,
                        padding: "7px 12px",
                        borderRadius: "var(--r-md)",
                        border: "1px solid var(--hairline-strong)",
                        background: "var(--surface)",
                      }}
                    >
                      <input
                        aria-label={`Anexar arquivo: ${d.code}`}
                        disabled={busy || !d.attach.allowed}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            attach(d, f);
                          }
                          e.target.value = "";
                        }}
                        style={{ display: "none" }}
                        type="file"
                      />
                      {d.hasFile ? "Nova versão do arquivo" : "Anexar arquivo"}
                    </label>
                    {d.attach.allowed ? null : (
                      <span
                        style={{ fontSize: 11.5, color: "var(--ink-muted)" }}
                      >
                        {d.attach.reason}
                      </span>
                    )}
                  </>
                ) : null}
                {blocked?.av.reason ? (
                  <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
                    {blocked.av.reason}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {pending && (
        <ModalShell
          actions={
            <>
              <Button
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  setComment("");
                }}
                variant="secondary"
              >
                Voltar
              </Button>
              <Button
                disabled={busy || comment.trim().length < MIN_COMMENT_LENGTH}
                icon={ACTION[pending.transition].icon}
                onClick={() => run(pending.item, pending.transition, comment)}
              >
                {ACTION[pending.transition].label}
              </Button>
            </>
          }
          icon={ACTION[pending.transition].icon}
          onClose={() => setPending(null)}
          subtitle="O comentário fica no histórico do entregável, com seu nome."
          title={`${ACTION[pending.transition].label} — ${pending.item.code}`}
          tone={pending.transition === "REOPEN" ? "red" : "amber"}
          width={520}
        >
          <Field
            hint={`Ao menos ${MIN_COMMENT_LENGTH} caracteres: uma frase que diga o que mudar.`}
            htmlFor="deliverable-comment"
            label={
              pending.transition === "REOPEN"
                ? "Por que reabrir"
                : "O que precisa ser ajustado"
            }
            required
          >
            <Textarea
              id="deliverable-comment"
              onChange={(e) => setComment(e.target.value)}
              value={comment}
            />
          </Field>
        </ModalShell>
      )}
    </>
  );
}
