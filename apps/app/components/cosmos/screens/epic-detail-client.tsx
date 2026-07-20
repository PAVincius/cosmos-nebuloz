"use client";

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
import {
  Badge,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  Tabs,
} from "../kit";

const TABS = [
  { id: "overview", label: "Visão Geral" },
  { id: "features", label: "Features" },
  { id: "hypothesis", label: "Hipótese" },
  { id: "lifecycle", label: "Lifecycle" },
];

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

  return (
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
        title={data.title}
      />
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

      {tab === "features" && (
        <>
          <SectionCard
            bodyStyle={{ padding: "12px 16px" }}
            icon="grid"
            subtitle={`${data.features.length} itens`}
            title="Features"
            tone="accent"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.features.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 80px 120px",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {f.title}
                  </span>
                  <Badge tone="neutral">{f.statusId}</Badge>
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--ink-muted)" }}
                  >
                    WSJF {f.wsjfScore}
                  </span>
                  <Progress tone="accent" value={f.progressPct} />
                </div>
              ))}
              {data.features.length === 0 && (
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  Nenhuma feature vinculada.
                </span>
              )}
            </div>
          </SectionCard>
          <div style={{ marginTop: 18 }}>
            <SectionCard
              bodyStyle={{ padding: "12px 16px" }}
              icon="flag"
              subtitle={`${data.piObjectives.length} objetivos`}
              title="PI Objectives"
              tone="purple"
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
  );
}
