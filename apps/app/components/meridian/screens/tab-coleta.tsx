"use client";

// Aba Coleta — US2. Port de `meridian-screens-1.jsx`.

import type { MeridianAxis } from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Button,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import type { AssessmentDetail } from "@/app/(meridian)/actions/assessments";
import {
  closeCollection,
  sendReminder,
} from "@/app/(meridian)/actions/collection";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { Eyebrow, SmartEmptyState, StatusDot } from "../base";
import { ScoreRing } from "../charts";

const R_STATUS: Record<string, [Tone, string]> = {
  INVITED: ["accent", "Convidado"],
  PENDING: ["accent", "Pendente"],
  DONE: ["green", "Concluído"],
  OVERDUE: ["red", "Atrasado"],
  REVOKED: ["neutral", "Revogado"],
};

export default function ColetaTab({
  a,
  onChanged,
}: {
  a: AssessmentDetail;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const byAxis = AXIS_IDS.map((axis) => ({
    axis,
    list: a.respondents.filter(
      (r) => r.axis === axis && r.status !== "REVOKED"
    ),
  }));
  const uncovered = byAxis.filter((b) => b.list.length === 0);
  const progress = a.responses.total
    ? Math.round((a.responses.done / a.responses.total) * 100)
    : 0;

  const remind = async (id: string, name: string) => {
    setBusy(true);
    await runWithToast(() => sendReminder({ respondentId: id }), {
      loading: "Enviando lembrete…",
      success: `${name} recebeu novo lembrete — cessa na conclusão.`,
    });
    setBusy(false);
    onChanged();
  };

  const close = async () => {
    setBusy(true);
    const res = await runWithToast(
      () => closeCollection({ assessmentId: a.id }),
      {
        loading: "Fechando coleta…",
        success: (d) =>
          d.pendingResponses > 0
            ? `Coleta fechada com ${d.pendingResponses} resposta(s) pendente(s) — a confidence dos eixos afetados caiu.`
            : "Coleta fechada · scoring executado.",
      }
    );
    setBusy(false);
    if (res.ok) {
      onChanged();
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.5fr 1fr",
        gap: "var(--gap)",
        alignItems: "start",
      }}
    >
      <SectionCard
        bodyStyle={{ display: "flex", flexDirection: "column", gap: 12 }}
        icon="users"
        subtitle="Cada um recebe link seguro e só enxerga a sua parte da bateria"
        title="Respondentes por eixo"
      >
        {a.respondents.length === 0 ? (
          <SmartEmptyState
            icon="users"
            subtitle="Atribua pelo menos um respondente por eixo para abrir a coleta."
            title="Nenhum respondente atribuído"
            tone="accent"
          />
        ) : (
          byAxis.map(({ axis, list }) => (
            <div key={axis}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 7,
                }}
              >
                <Icon
                  name={AXES[axis as MeridianAxis].icon}
                  size={13}
                  style={{ color: "var(--ink-faint)" }}
                />
                <Eyebrow>{AXES[axis as MeridianAxis].label}</Eyebrow>
                {list.length === 0 && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--red-text)",
                    }}
                  >
                    sem dono
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {list.map((r) => {
                  const [tone, label] = R_STATUS[r.status] ?? [
                    "accent" as Tone,
                    r.status,
                  ];
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 11px",
                        borderRadius: 9,
                        background: "var(--surface-2)",
                        border: `1px solid ${r.status === "OVERDUE" ? "rgba(var(--red-rgb),.35)" : "var(--hairline)"}`,
                      }}
                    >
                      <Avatar name={r.name} size={26} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {r.name}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 10.5,
                            color: "var(--ink-faint)",
                            fontWeight: 600,
                          }}
                        >
                          {r.role}
                        </span>
                      </span>
                      <StatusDot label={label} tone={tone} />
                      {r.status !== "DONE" && (
                        <Button
                          disabled={busy}
                          icon="mail"
                          onClick={() => remind(r.id, r.name)}
                          size="sm"
                          variant="ghost"
                        >
                          Lembrar
                        </Button>
                      )}
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "var(--red-text)",
                      fontWeight: 600,
                      padding: "4px 2px",
                    }}
                  >
                    Eixo sem respondente — o assessment não fecha coleta assim.
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </SectionCard>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 12 }}
          icon="activity"
          title="Progresso da coleta"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ScoreRing
              label="Progresso"
              size={62}
              tone="accent"
              value={progress}
            />
            <div>
              <div
                className="display"
                style={{ fontSize: 18, fontWeight: 700 }}
              >
                {a.responses.done}{" "}
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink-faint)",
                    fontWeight: 600,
                  }}
                >
                  de {a.responses.total} respostas
                </span>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-subtle)",
                  fontWeight: 500,
                }}
              >
                {a.evidence} evidência(s) anexada(s)
              </div>
            </div>
          </div>

          {uncovered.length > 0 && a.respondents.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 9,
                alignItems: "center",
                padding: "9px 12px",
                borderRadius: 9,
                border: "1px solid rgba(var(--red-rgb),.32)",
                background: "var(--red-soft)",
              }}
            >
              <Icon
                name="alert"
                size={14}
                style={{ color: "var(--red-text)", flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--red-text)",
                  fontWeight: 600,
                }}
              >
                {uncovered
                  .map((u) => AXES[u.axis as MeridianAxis].label)
                  .join(", ")}{" "}
                sem dono — atribua antes de fechar a coleta.
              </span>
            </div>
          )}

          <Button
            disabled={busy || a.status === "FINALISED"}
            icon="check"
            onClick={close}
            size="sm"
            variant="secondary"
          >
            Fechar coleta e rodar scoring
          </Button>
        </SectionCard>

        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 8 }}
          icon="shield"
          title="Como a coleta funciona"
          tone="accent"
        >
          {[
            "Link seguro por respondente — cada um vê só o seu eixo.",
            "Lembretes automáticos param na conclusão.",
            "Evidência anexada vai para armazenamento segregado por organização — nunca no banco relacional.",
            "Todo download de evidência entra na trilha de auditoria.",
          ].map((x) => (
            <span
              key={x}
              style={{
                fontSize: 11.5,
                color: "var(--ink-muted)",
                fontWeight: 500,
                lineHeight: 1.55,
              }}
            >
              · {x}
            </span>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
