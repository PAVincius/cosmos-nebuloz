"use client";

import {
  Badge,
  ErrorState,
  KpiCard,
  NavButton,
  PageHeader,
  Progress,
  SectionCard,
  Tabs,
} from "@repo/design-system/cosmos/kit";
import { useEffect, useState } from "react";
import type { EpicDetailFull } from "@/app/(cosmos)/actions/epic-detail";
import { autosaveBusinessCase } from "@/app/actions/epics/business-case";
import { draftHypothesisAction } from "@/app/actions/epics/draft-hypothesis";
import {
  getApprovalRequest,
  reviewStep,
  submitEpicForApproval,
} from "@/app/actions/governance";
import type { ApprovalRequestWithSteps } from "@/app/actions/governance/schema";
import { ModalProvider } from "../modal";
import { FeatureTable } from "./epic-tree/feature-table";

const TABS = [
  { id: "overview", label: "Visão Geral" },
  { id: "features", label: "Features" },
  { id: "hypothesis", label: "Hipótese" },
  { id: "lifecycle", label: "Lifecycle" },
];

// INVEST dimension labels (I=Independent, N=Negotiable, V=Valuable,
// E=Estimable, S=Small, T=Testable) — same six letters analyzeInvest/the
// analyze-invest route always score, in this fixed display order.
const INVEST_LETTERS = ["I", "N", "V", "E", "S", "T"] as const;
const INVEST_LABEL: Record<(typeof INVEST_LETTERS)[number], string> = {
  I: "Independent",
  N: "Negotiable",
  V: "Valuable",
  E: "Estimable",
  S: "Small",
  T: "Testable",
};

// Real Feature.statusId values — see flow.ts's comment on
// updateFeatureStatus for the authoritative enum (no "Blocked" state exists
// on Feature; never fabricated here).
const FEATURE_STATE_ORDER = [
  "BACKLOG",
  "ANALYSIS",
  "REVIEW",
  "IMPLEMENTING",
  "DONE",
] as const;
const FEATURE_STATE_TONE: Record<string, "neutral" | "blue" | "green"> = {
  BACKLOG: "neutral",
  ANALYSIS: "blue",
  REVIEW: "blue",
  IMPLEMENTING: "blue",
  DONE: "green",
};

const RESOLUTIONS = [
  "VALIDATED",
  "PARTIALLY_VALIDATED",
  "INVALIDATED",
] as const;

export default function EpicDetailClient({
  epicId,
  initial,
}: {
  epicId: string;
  initial: EpicDetailFull;
}) {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(initial);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [approval, setApproval] = useState<ApprovalRequestWithSteps | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => {
    const requestId = data.governance.currentApprovalRequestId;
    if (!requestId) {
      setApproval(null);
      return;
    }
    let active = true;
    getApprovalRequest(requestId).then((res) => {
      if (active && res.ok) {
        setApproval(res.data);
      }
    });
    return () => {
      active = false;
    };
  }, [data.governance.currentApprovalRequestId]);

  async function saveField(
    field: "hypothesis" | "nfrs" | "mvp",
    value: string
  ) {
    setSaveError(null);
    const res = await autosaveBusinessCase({ epicId, [field]: value });
    if (!res.ok) {
      setSaveError(res.error);
    }
  }

  async function saveResolution(resolution: string) {
    setSaveError(null);
    const res = await autosaveBusinessCase({
      epicId,
      hypothesisResolution: resolution,
    });
    if (res.ok) {
      setData((d) => ({ ...d, hypothesisResolution: resolution }));
    } else {
      setSaveError(res.error);
    }
  }

  async function draftHypothesis() {
    setDrafting(true);
    setSaveError(null);
    const res = await draftHypothesisAction({ epicId });
    setDrafting(false);
    if (res.ok) {
      setData((d) => ({ ...d, hypothesis: res.data.text }));
      const saveRes = await autosaveBusinessCase({
        epicId,
        hypothesis: res.data.text,
        versionSnapshot: {
          field: "hypothesis",
          prev: data.hypothesis ?? "",
          next: res.data.text,
          savedBy: "COPILOT",
        },
      });
      if (!saveRes.ok) {
        setSaveError(saveRes.error);
      }
    } else {
      setSaveError(res.error);
    }
  }

  async function submitForApproval() {
    setSubmitting(true);
    setSaveError(null);
    const res = await submitEpicForApproval({ epicId });
    setSubmitting(false);
    if (res.ok) {
      setData((d) => ({
        ...d,
        governance: {
          ...d.governance,
          currentApprovalRequestId: res.data.requestId,
          governanceStatus: "review",
        },
      }));
    } else {
      setSaveError(res.error);
    }
  }

  async function decide(stepId: string, decision: "approved" | "rejected") {
    setReviewing(stepId);
    setSaveError(null);
    const res = await reviewStep({ stepId, decision });
    setReviewing(null);
    if (res.ok && data.governance.currentApprovalRequestId) {
      const refreshed = await getApprovalRequest(
        data.governance.currentApprovalRequestId
      );
      if (refreshed.ok) {
        setApproval(refreshed.data);
        if (
          refreshed.data.estado === "approved" ||
          refreshed.data.estado === "rejected"
        ) {
          setData((d) => ({
            ...d,
            governance: {
              ...d.governance,
              governanceStatus: refreshed.data.estado,
            },
          }));
        }
      }
    } else if (!res.ok) {
      setSaveError(res.error);
    }
  }

  const isDone = data.lifecycleStatus === "DONE";
  const investBreakdown = data.investBreakdown;
  const featureStateCounts = data.features.reduce<Record<string, number>>(
    (acc, f) => {
      acc[f.statusId] = (acc[f.statusId] ?? 0) + 1;
      return acc;
    },
    {}
  );
  // Known statusId values first (in lifecycle order), then any other value
  // actually present — real data is never silently dropped from the rollup.
  const featureStates = [
    ...FEATURE_STATE_ORDER.filter((s) => featureStateCounts[s]),
    ...Object.keys(featureStateCounts).filter(
      (s) => !(FEATURE_STATE_ORDER as readonly string[]).includes(s)
    ),
  ];
  const overallProgress = data.features.length
    ? Math.round(
        data.features.reduce((sum, f) => sum + f.progressPct, 0) /
          data.features.length
      )
    : 0;
  const contextLine = [
    data.art ? `ART: ${data.art.name}` : null,
    data.theme ? `Tema: ${data.theme.title}` : null,
    data.owner ? `Owner: ${data.owner}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <ModalProvider>
      <div className="fade-in">
        <PageHeader
          eyebrow="Portfolio · Épico"
          meta={
            <>
              <Badge tone="accent">{data.lifecycleStatus}</Badge>
              {data.wsjf !== null && (
                <Badge dot tone="green">
                  WSJF {data.wsjf}
                </Badge>
              )}
            </>
          }
          subtitle={contextLine || undefined}
          title={data.title}
        >
          <NavButton icon="kanban" to="kanban" variant="secondary">
            Ver no Kanban
          </NavButton>
        </PageHeader>
        <Tabs active={tab} onChange={setTab} tabs={TABS} />
        {saveError && <ErrorState message={saveError} />}

        {tab === "overview" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 16,
            }}
          >
            <KpiCard
              icon="trendingUp"
              label="WSJF"
              tone="accent"
              value={data.wsjf ?? "—"}
            />
            <KpiCard
              icon="target"
              label="INVEST"
              tone="green"
              unit="/100"
              value={data.investScore ?? "—"}
            />
            <KpiCard
              icon="layers"
              label="Job Size"
              tone="purple"
              unit="SP"
              value={data.sizePoints ?? "—"}
            />
            <KpiCard
              icon="dollar"
              label="Budget alocado"
              tone="blue"
              unit="USD"
              value={data.leanBudgetAllocation ?? "—"}
            />
          </div>
        )}

        {tab === "overview" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
              gap: 16,
              marginTop: 16,
            }}
          >
            <SectionCard
              icon="gauge"
              subtitle="Qualidade do épico por dimensão"
              title="INVEST Score"
              tone="accent"
            >
              {investBreakdown ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {INVEST_LETTERS.map((letter) => {
                    const v = investBreakdown[letter];
                    const dimTone =
                      v >= 70 ? "green" : v >= 50 ? "amber" : "red";
                    return (
                      <div key={letter}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 4,
                            fontSize: 12,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              color: "var(--ink-muted)",
                            }}
                          >
                            {INVEST_LABEL[letter]}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontWeight: 700,
                              color: `var(--${dimTone}-text)`,
                            }}
                          >
                            {v}/100
                          </span>
                        </div>
                        <Progress height={5} tone={dimTone} value={v} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12.5,
                    color: "var(--ink-faint)",
                    lineHeight: 1.5,
                  }}
                >
                  {data.investScore === null
                    ? "Este épico ainda não recebeu uma análise INVEST."
                    : "Apenas o score consolidado está disponível — a decomposição por dimensão (I/N/V/E/S/T) não foi armazenada para este épico."}
                </p>
              )}
            </SectionCard>

            <SectionCard
              icon="layers"
              subtitle="ART responsável · tema · owner"
              title="Contexto de Portfolio"
              tone="blue"
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {(
                  [
                    {
                      label: "ART",
                      value: data.art?.name ?? null,
                      tone: "blue",
                    },
                    {
                      label: "Tema estratégico",
                      value: data.theme?.title ?? null,
                      tone: "purple",
                    },
                    { label: "Owner", value: data.owner, tone: "neutral" },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: "var(--surface-3)",
                      borderRadius: 9,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--ink-muted)",
                      }}
                    >
                      {row.label}
                    </span>
                    {row.value ? (
                      <Badge tone={row.tone}>{row.value}</Badge>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                        —
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              icon="check"
              subtitle="Progresso e features por estado"
              title="Entrega"
              tone="green"
            >
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12.5,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: "var(--ink-muted)" }}>
                    Progresso médio
                  </span>
                  <span
                    className="mono"
                    style={{ fontWeight: 700, color: "var(--green-text)" }}
                  >
                    {overallProgress}%
                  </span>
                </div>
                <Progress height={9} tone="green" value={overallProgress} />
              </div>
              {featureStates.map((s) => (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  <Badge dot tone={FEATURE_STATE_TONE[s] ?? "neutral"}>
                    {s}
                  </Badge>
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--ink-muted)",
                    }}
                  >
                    {featureStateCounts[s]}
                  </span>
                </div>
              ))}
              {data.features.length === 0 && (
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  Nenhuma feature vinculada.
                </span>
              )}
            </SectionCard>
          </div>
        )}

        {tab === "features" && (
          <>
            <SectionCard
              bodyStyle={{ padding: 0, overflow: "visible" }}
              icon="grid"
              subtitle={`${data.features.length} itens`}
              title="Features"
              tone="accent"
            >
              <FeatureTable features={data.features} />
            </SectionCard>
            <div style={{ marginTop: 18 }}>
              <SectionCard
                bodyStyle={{ padding: "12px 16px" }}
                icon="flag"
                subtitle={`${data.piObjectives.length} objetivos`}
                title="PI Objectives"
                tone="purple"
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {data.piObjectives.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 100px",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--ink)" }}>
                        {o.title}
                      </span>
                      <Badge tone="neutral">{o.status}</Badge>
                      <span
                        className="mono"
                        style={{ fontSize: 12, color: "var(--ink-muted)" }}
                      >
                        BV {o.businessValue} · {o.achievedValue}
                      </span>
                    </div>
                  ))}
                  {data.piObjectives.length === 0 && (
                    <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                      Nenhum PI Objective vinculado.
                    </span>
                  )}
                </div>
              </SectionCard>
            </div>
          </>
        )}

        {tab === "hypothesis" && (
          <SectionCard
            action={
              <button
                disabled={drafting}
                onClick={draftHypothesis}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--hairline)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  cursor: drafting ? "default" : "pointer",
                }}
                type="button"
              >
                {drafting ? "Gerando…" : "Draft com IA"}
              </button>
            }
            bodyStyle={{ padding: "12px 16px" }}
            icon="flask"
            title="Lean Business Case"
            tone="accent"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                  Hipótese
                </span>
                <textarea
                  defaultValue={data.hypothesis ?? ""}
                  key={data.hypothesis}
                  onBlur={(e) => saveField("hypothesis", e.target.value)}
                  rows={3}
                  style={{
                    fontSize: 13,
                    padding: 8,
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                  }}
                />
              </label>
              <label
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                  Non-Functional Requirements
                </span>
                <textarea
                  defaultValue={data.nfrs ?? ""}
                  key={data.nfrs}
                  onBlur={(e) => saveField("nfrs", e.target.value)}
                  rows={2}
                  style={{
                    fontSize: 13,
                    padding: 8,
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                  }}
                />
              </label>
              <label
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                  MVP
                </span>
                <textarea
                  defaultValue={data.mvp ?? ""}
                  key={data.mvp}
                  onBlur={(e) => saveField("mvp", e.target.value)}
                  rows={2}
                  style={{
                    fontSize: 13,
                    padding: 8,
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                  }}
                />
              </label>
              <div>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Business Outcomes
                </span>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  {data.businessOutcomes.map((o) => (
                    <Badge key={o.id} tone="green">
                      {o.text}
                    </Badge>
                  ))}
                  {data.businessOutcomes.length === 0 && (
                    <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      Nenhum outcome registrado.
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Leading Indicators
                </span>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  {data.leadingIndicators.map((i) => (
                    <Badge key={i.id} tone="blue">
                      {i.text}
                    </Badge>
                  ))}
                  {data.leadingIndicators.length === 0 && (
                    <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      Nenhum indicador registrado.
                    </span>
                  )}
                </div>
              </div>
              {isDone && (
                <label
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    Resolução da hipótese (obrigatório em DONE)
                  </span>
                  <select
                    onChange={(e) => saveResolution(e.target.value)}
                    style={{
                      fontSize: 13,
                      padding: 8,
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--hairline)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                    }}
                    value={data.hypothesisResolution ?? ""}
                  >
                    <option value="">— selecionar —</option>
                    {RESOLUTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </SectionCard>
        )}

        {tab === "lifecycle" && (
          <SectionCard
            bodyStyle={{ padding: "12px 16px" }}
            icon="shield"
            title="Governança"
            tone="purple"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {data.governance.governanceStatus ? (
                  <Badge icon="lock" tone="purple">
                    {data.governance.governanceStatus}
                  </Badge>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                    Épico não é governado.
                  </span>
                )}
              </div>

              {!data.governance.currentApprovalRequestId && (
                <button
                  disabled={submitting}
                  onClick={submitForApproval}
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    cursor: submitting ? "default" : "pointer",
                  }}
                  type="button"
                >
                  {submitting ? "Enviando…" : "Enviar para aprovação"}
                </button>
              )}

              {approval && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {approval.workflowNome} · {approval.estado}
                  </span>
                  {approval.steps.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 140px",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--ink)" }}>
                        {s.roleRequired}
                      </span>
                      <Badge
                        tone={
                          s.estado === "approved"
                            ? "green"
                            : s.estado === "rejected"
                              ? "red"
                              : "neutral"
                        }
                      >
                        {s.estado}
                      </Badge>
                      {s.estado === "pending" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            disabled={reviewing === s.id}
                            onClick={() => decide(s.id, "approved")}
                            style={{
                              fontSize: 12,
                              padding: "4px 8px",
                              borderRadius: "var(--r-sm)",
                              border: "1px solid var(--hairline)",
                              background: "var(--surface)",
                              color: "var(--ink)",
                              cursor: "pointer",
                            }}
                            type="button"
                          >
                            Aprovar
                          </button>
                          <button
                            disabled={reviewing === s.id}
                            onClick={() => decide(s.id, "rejected")}
                            style={{
                              fontSize: 12,
                              padding: "4px 8px",
                              borderRadius: "var(--r-sm)",
                              border: "1px solid var(--hairline)",
                              background: "var(--surface)",
                              color: "var(--ink)",
                              cursor: "pointer",
                            }}
                            type="button"
                          >
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        )}
      </div>
    </ModalProvider>
  );
}
