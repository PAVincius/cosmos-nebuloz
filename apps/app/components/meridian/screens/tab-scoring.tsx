"use client";

// Aba Scoring & Revisão — US3. Port de `meridian-screens-2.jsx`.
//
// Duas coisas que a tela precisa deixar óbvias e o protótipo já deixava:
// o computado continua visível depois do override, e a divergência aparece
// lado a lado antes da decisão. Números sem procedência não sobrevivem à
// primeira pergunta do patrocinador.

import type { MeridianAxis } from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Badge,
  Button,
  Progress,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect, useState } from "react";
import type {
  AssessmentDetail,
  AxisScoreView,
} from "@/app/(meridian)/actions/assessments";
import { registerOverride } from "@/app/(meridian)/actions/overrides";
import {
  type DivergenceRow,
  getDivergence,
} from "@/app/(meridian)/actions/scoring";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { confTone, finalOf } from "@/lib/meridian/composite";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  Eyebrow,
  Field,
  MetaCell,
  ModalShell,
  SmartEmptyState,
  Textarea,
  useModal,
} from "../base";
import { ScoreRing } from "../charts";

const RATIONALE_MIN = 20;

const STATUS_META: Record<string, [Tone, string]> = {
  COMPUTED: ["accent", "Computado"],
  CONTESTED: ["amber", "Contestado"],
  OVERRIDDEN: ["purple", "Override"],
};

/** Divergência lado a lado. Carrega sob demanda: só o eixo contestado precisa
 *  dela, e cada leitura é acesso a conteúdo de evidência. */
function DivergencePanel({
  assessmentId,
  axis,
}: {
  assessmentId: string;
  axis: MeridianAxis;
}) {
  const [rows, setRows] = useState<DivergenceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getDivergence({ assessmentId, axis }).then((res) => {
      if (!alive) {
        return;
      }
      if (res.ok) {
        setRows(res.data);
      } else {
        setError(res.error);
      }
    });
    return () => {
      alive = false;
    };
  }, [assessmentId, axis]);

  if (error) {
    return (
      <span style={{ fontSize: 11.5, color: "var(--red-text)" }}>{error}</span>
    );
  }
  if (!rows) {
    return (
      <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
        Carregando divergências…
      </span>
    );
  }
  if (rows.length === 0) {
    return (
      <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
        Nenhuma pergunta com respostas divergentes neste eixo.
      </span>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 13px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <Eyebrow tone="amber">Respostas divergentes · lado a lado</Eyebrow>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.questionCode}
          style={{
            padding: "10px 13px",
            borderBottom:
              i < rows.length - 1 ? "1px solid var(--hairline)" : "none",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "var(--ink-muted)",
                flex: 1,
              }}
            >
              {r.questionCode} · {r.questionText}
            </span>
            {r.evidenceCount > 0 && (
              <span
                className="mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: "var(--purple-text)",
                }}
              >
                <Icon name="paperclip" size={10} />
                {r.evidenceCount}
              </span>
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 8,
            }}
          >
            {r.answers.map((ans) => (
              <div
                key={`${r.questionCode}-${ans.respondentName}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderRadius: 8,
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                }}
              >
                <Avatar name={ans.respondentName} size={22} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ans.respondentName.split(" ")[0]} · {ans.respondentRole}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: `var(--${ans.normalized >= 0.5 ? "green" : "red"}-text)`,
                    }}
                  >
                    {ans.displayValue}
                  </span>
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 9.5, color: "var(--ink-faint)" }}
                >
                  {ans.normalized.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OverrideModal({
  a,
  score,
  onClose,
  onDone,
}: {
  a: AssessmentDetail;
  score: AxisScoreView;
  onClose: () => void;
  onDone: () => void;
}) {
  const current = finalOf(score);
  const [to, setTo] = useState(current);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = rationale.trim().length >= RATIONALE_MIN && to !== current;

  const submit = async () => {
    setBusy(true);
    const res = await runWithToast(
      () =>
        registerOverride({
          assessmentId: a.id,
          axis: score.axis,
          toScore: to,
          rationale,
        }),
      {
        loading: "Registrando override…",
        success: `${AXES[score.axis].label}: ${current} → ${to} · rationale e revisor na trilha de auditoria.`,
      }
    );
    setBusy(false);
    if (res.ok) {
      onDone();
      onClose();
    }
  };

  return (
    <ModalShell
      footer={
        <>
          <Button onClick={onClose} variant="ghost">
            Cancelar
          </Button>
          <Button disabled={!valid || busy} icon="check" onClick={submit}>
            Registrar override
          </Button>
        </>
      }
      icon="gavel"
      onClose={onClose}
      subtitle={`${a.orgName} · o score computado permanece no histórico`}
      title={`Override — ${AXES[score.axis].label}`}
      tone="amber"
      width={620}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
          }}
        >
          <MetaCell label="Computado" mono value={String(score.computed)} />
          <MetaCell
            label="Confiança"
            mono
            tone={confTone(score.confidence)}
            value={`${Math.round(score.confidence * 100)}%`}
          />
          <MetaCell
            label="Novo score"
            mono
            tone={to !== current ? "amber" : undefined}
            value={String(to)}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Eyebrow>Score final</Eyebrow>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              aria-label="Novo score"
              max="100"
              min="0"
              onChange={(e) => setTo(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--amber)" }}
              type="range"
              value={to}
            />
            <span
              className="mono"
              style={{
                width: 40,
                textAlign: "right",
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {to}
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              fontWeight: 500,
            }}
          >
            O computado nunca é apagado — o override cria linha própria com
            origem, destino, revisor e horário.
          </span>
        </div>

        <Field
          hint="É isto que o patrocinador lê quando pergunta por que o número mudou."
          label={`Justificativa (obrigatória, ≥ ${RATIONALE_MIN} caracteres)`}
        >
          <Textarea
            onChange={(e) => setRationale(e.target.value)}
            placeholder="O que a evidência mostra que o score computado não captura?"
            rows={3}
            value={rationale}
          />
        </Field>

        {score.note && (
          <blockquote
            style={{
              margin: 0,
              padding: "9px 12px",
              borderLeft: "3px solid var(--amber)",
              background: "var(--amber-soft)",
              borderRadius: "0 8px 8px 0",
              fontSize: 11.5,
              color: "var(--amber-text)",
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            {score.note}
          </blockquote>
        )}

        <DivergencePanel assessmentId={a.id} axis={score.axis} />
      </div>
    </ModalShell>
  );
}

export default function ScoringTab({
  a,
  onChanged,
}: {
  a: AssessmentDetail;
  onChanged: () => void;
}) {
  const modal = useModal();
  const scores = a.scores;

  const openOverride = useCallback(
    (score: AxisScoreView) =>
      modal.open(
        <OverrideModal
          a={a}
          onClose={modal.close}
          onDone={onChanged}
          score={score}
        />
      ),
    [a, modal, onChanged]
  );

  if (!scores) {
    return (
      <SmartEmptyState
        icon="gauge"
        subtitle="Feche a coleta para computar scores por eixo — determinístico para o mesmo template e as mesmas respostas."
        title="Scoring ainda não rodou"
        tone="accent"
      />
    );
  }

  const byAxis = new Map(scores.map((s) => [s.axis, s]));
  const contested = scores.filter((s) => s.status === "CONTESTED");
  const lowConfidence = scores.filter(
    (s) => s.confidence < 0.5 && s.status !== "CONTESTED"
  );

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(215px,1fr))",
          gap: "var(--gap)",
        }}
      >
        {AXIS_IDS.filter((x) => byAxis.has(x)).map((x) => {
          const s = byAxis.get(x) as AxisScoreView;
          const v = finalOf(s);
          const [tone, label] = STATUS_META[s.status] ?? ["accent", s.status];
          return (
            <div
              className="lift"
              key={x}
              style={{
                padding: "16px 16px 14px",
                borderRadius: "var(--r-lg)",
                background: "var(--surface)",
                border: `1px solid ${s.status === "CONTESTED" ? "rgba(var(--amber-rgb),.45)" : "var(--hairline)"}`,
                boxShadow: "var(--card-shadow)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: `var(--${tone})`,
                  boxShadow: `0 0 9px 1px rgba(var(--${tone}-rgb),.5)`,
                }}
              />
              {/* O nome do eixo é a identidade do card e nunca pode virar
                  "Infrastru…". Quando nome e selo não cabem na mesma linha,
                  o selo desce — `flexWrap` — em vez de o nome ser cortado. */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "4px 8px",
                  minHeight: 22,
                }}
              >
                <Icon
                  name={AXES[x].icon}
                  size={15}
                  style={{ color: "var(--ink-muted)", flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    flex: "1 0 auto",
                  }}
                >
                  {AXES[x].label}
                </span>
                <Badge dot={s.status === "CONTESTED"} tone={tone}>
                  {label}
                </Badge>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ScoreRing label={AXES[x].label} size={56} value={v} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    <Eyebrow>Conf</Eyebrow>
                    <span
                      className="mono"
                      style={{
                        color: `var(--${confTone(s.confidence)}-text)`,
                      }}
                    >
                      {Math.round(s.confidence * 100)}%
                    </span>
                  </div>
                  <Progress
                    height={4}
                    tone={confTone(s.confidence)}
                    value={Math.round(s.confidence * 100)}
                  />
                  <span
                    className="mono"
                    style={{
                      display: "block",
                      fontSize: 9.5,
                      color: "var(--ink-faint)",
                      marginTop: 5,
                      lineHeight: 1.5,
                    }}
                  >
                    {s.respondentCount} resp. · spread {s.spread}
                    {s.status === "OVERRIDDEN" && (
                      <>
                        <br />
                        computado: {s.computed}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "var(--gap)",
          alignItems: "start",
        }}
      >
        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 10 }}
          icon="gavel"
          subtitle="Eixos contestados e outliers — julgamento humano com rastro"
          title="Fila de revisão"
          tone="amber"
        >
          {contested.length === 0 && lowConfidence.length === 0 && (
            <SmartEmptyState
              icon="check"
              subtitle="Nenhum eixo acima do limiar de discordância."
              title="Nada contestado"
              tone="green"
            />
          )}

          {contested.map((s) => (
            <div
              key={s.axis}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "13px 15px",
                borderRadius: "var(--r-md)",
                background: "var(--amber-soft)",
                border: "1px solid rgba(var(--amber-rgb),.35)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Icon
                  name={AXES[s.axis].icon}
                  size={15}
                  style={{ color: "var(--amber-text)" }}
                />
                <span style={{ fontSize: 13, fontWeight: 800, flex: 1 }}>
                  {AXES[s.axis].label} — discordância acima do limiar
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--amber-text)",
                  }}
                >
                  spread {s.spread} pts
                </span>
              </div>
              {s.note && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                >
                  {s.note}
                </p>
              )}
              <DivergencePanel assessmentId={a.id} axis={s.axis} />
              <div style={{ display: "flex", gap: 8 }}>
                <Button icon="gavel" onClick={() => openOverride(s)} size="sm">
                  Revisar e decidir
                </Button>
              </div>
            </div>
          ))}

          {lowConfidence.map((s) => (
            <div
              key={s.axis}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                padding: "10px 13px",
                borderRadius: 9,
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
              }}
            >
              <Icon
                name="alert"
                size={14}
                style={{ color: "var(--red-text)", flexShrink: 0 }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  fontWeight: 600,
                }}
              >
                <strong style={{ color: "var(--ink)" }}>
                  {AXES[s.axis].label}
                </strong>{" "}
                com confiança {Math.round(s.confidence * 100)}% —{" "}
                {s.note ?? "poucos respondentes."}
              </span>
              <Button
                icon="gavel"
                onClick={() => openOverride(s)}
                size="sm"
                variant="ghost"
              >
                Decidir
              </Button>
            </div>
          ))}
        </SectionCard>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <SectionCard
            bodyStyle={{ display: "flex", flexDirection: "column", gap: 9 }}
            icon="history"
            subtitle="Append-only — nada é apagado"
            title="Histórico de overrides"
          >
            {a.overrides.length === 0 ? (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-subtle)",
                  fontWeight: 500,
                }}
              >
                Nenhum override neste run.
              </span>
            ) : (
              a.overrides.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "11px 13px",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--ink-faint)",
                      }}
                    >
                      {o.code}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, flex: 1 }}>
                      {AXES[o.axis].label}
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 12, fontWeight: 700 }}
                    >
                      <span
                        style={{
                          color: "var(--red-text)",
                          textDecoration: "line-through",
                        }}
                      >
                        {o.fromScore}
                      </span>{" "}
                      →{" "}
                      <span style={{ color: "var(--green-text)" }}>
                        {o.toScore}
                      </span>
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11.5,
                      color: "var(--ink-muted)",
                      fontWeight: 500,
                      lineHeight: 1.55,
                    }}
                  >
                    {o.rationale}
                  </p>
                  <span
                    className="mono"
                    style={{ fontSize: 9.5, color: "var(--ink-faint)" }}
                  >
                    {new Date(o.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))
            )}
          </SectionCard>

          <SectionCard
            bodyStyle={{ display: "flex", flexDirection: "column", gap: 8 }}
            icon="shield"
            title="Determinismo"
            tone="accent"
          >
            {[
              `Template ${a.templateVersion} é imutável após o primeiro uso — o assessment guarda a versão.`,
              "Mesmas respostas + mesma versão = mesmos scores, sempre.",
              "Cada score de eixo registra se é computado ou override, por quem e quando.",
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
    </div>
  );
}
