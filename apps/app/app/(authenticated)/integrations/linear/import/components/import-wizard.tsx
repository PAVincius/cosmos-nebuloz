"use client";

import { useState } from "react";
import {
  linearDryRun,
  linearExecuteImport,
  type PreviewItem,
  type DryRunResult,
  type ExecuteResult,
} from "@/app/actions/integrations/linear-import";
import { linearDiscoverTeams, type LinearTeam } from "@/app/actions/integrations/connectors/linear";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "connect" | "select" | "map" | "dry-run" | "execute" | "complete";

const STEPS: Step[] = ["connect", "select", "map", "dry-run", "execute", "complete"];

const STEP_LABELS: Record<Step, string> = {
  connect: "1. Connect",
  select: "2. Select Teams",
  map: "3. Review Mapping",
  "dry-run": "4. Preview",
  execute: "5. Import",
  complete: "6. Done",
};

// ─── Styles (inline, no new deps) ────────────────────────────────────────────

const s = {
  container: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "32px 24px",
    fontFamily: "inherit",
  } as React.CSSProperties,
  heading: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
    color: "var(--foreground, #0f172a)",
  } as React.CSSProperties,
  subheading: {
    fontSize: 14,
    color: "var(--muted-foreground, #64748b)",
    marginBottom: 28,
  } as React.CSSProperties,
  stepBar: {
    display: "flex",
    gap: 4,
    marginBottom: 32,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,
  stepPill: (active: boolean, done: boolean) =>
    ({
      padding: "4px 12px",
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 500,
      background: active
        ? "var(--primary, #6366f1)"
        : done
          ? "var(--primary, #6366f1)22"
          : "var(--muted, #f1f5f9)",
      color: active
        ? "#fff"
        : done
          ? "var(--primary, #6366f1)"
          : "var(--muted-foreground, #64748b)",
    }) as React.CSSProperties,
  card: {
    background: "var(--card, #fff)",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: 12,
    padding: 24,
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "var(--foreground, #0f172a)",
  } as React.CSSProperties,
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--border, #e2e8f0)",
    fontSize: 14,
    background: "var(--background, #fff)",
    color: "var(--foreground, #0f172a)",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,
  btn: (variant: "primary" | "secondary" | "danger" = "primary") =>
    ({
      padding: "8px 20px",
      borderRadius: 8,
      border: "none",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background:
        variant === "primary"
          ? "var(--primary, #6366f1)"
          : variant === "danger"
            ? "#ef4444"
            : "var(--muted, #f1f5f9)",
      color: variant === "secondary" ? "var(--foreground, #0f172a)" : "#fff",
    }) as React.CSSProperties,
  row: {
    display: "flex",
    gap: 12,
    marginTop: 20,
    justifyContent: "flex-end",
  } as React.CSSProperties,
  error: {
    color: "#ef4444",
    fontSize: 13,
    marginTop: 8,
  } as React.CSSProperties,
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  } as React.CSSProperties,
  th: {
    textAlign: "left" as const,
    padding: "8px 12px",
    background: "var(--muted, #f1f5f9)",
    fontWeight: 600,
    borderBottom: "1px solid var(--border, #e2e8f0)",
  } as React.CSSProperties,
  td: {
    padding: "7px 12px",
    borderBottom: "1px solid var(--border, #e2e8f0)",
    verticalAlign: "middle" as const,
  } as React.CSSProperties,
  badge: (color: string) =>
    ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 9999,
      fontSize: 11,
      fontWeight: 600,
      background: `${color}22`,
      color,
    }) as React.CSSProperties,
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--border, #e2e8f0)",
    cursor: "pointer",
    fontSize: 14,
    marginBottom: 8,
  } as React.CSSProperties,
  statBox: {
    display: "flex",
    gap: 16,
    marginTop: 16,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,
  stat: {
    flex: 1,
    minWidth: 120,
    padding: 16,
    borderRadius: 10,
    background: "var(--muted, #f1f5f9)",
    textAlign: "center" as const,
  } as React.CSSProperties,
  statNum: {
    fontSize: 28,
    fontWeight: 700,
    color: "var(--primary, #6366f1)",
  } as React.CSSProperties,
  statLabel: {
    fontSize: 12,
    color: "var(--muted-foreground, #64748b)",
    marginTop: 4,
  } as React.CSSProperties,
};

// ─── Component ────────────────────────────────────────────────────────────────

interface ImportWizardProps {
  tenantId: string;
}

export function ImportWizard({ tenantId }: ImportWizardProps) {
  const [step, setStep] = useState<Step>("connect");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");

  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  const [piPlanId, setPiPlanId] = useState("");

  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunError, setDryRunError] = useState("");

  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeError, setExecuteError] = useState("");

  const currentStepIdx = STEPS.indexOf(step);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function goTo(s: Step) {
    setStep(s);
  }

  function toggleTeam(id: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  // ── Step handlers ────────────────────────────────────────────────────────

  async function handleConnect() {
    setApiKeyError("");
    if (!apiKey.startsWith("lin_api_")) {
      setApiKeyError('API key must start with "lin_api_"');
      return;
    }
    setTeamsLoading(true);
    setTeamsError("");
    try {
      const fetched = await linearDiscoverTeams(apiKey);
      setTeams(fetched);
      goTo("select");
    } catch (err) {
      setTeamsError(err instanceof Error ? err.message : "Failed to fetch teams");
    } finally {
      setTeamsLoading(false);
    }
  }

  async function handleDryRun() {
    setDryRunLoading(true);
    setDryRunError("");
    setDryRunResult(null);
    try {
      const result = await linearDryRun({
        tenantId,
        apiKey,
        selectedTeamIds,
        piPlanId: piPlanId || undefined,
      });
      setDryRunResult(result);
      goTo("dry-run");
    } catch (err) {
      setDryRunError(err instanceof Error ? err.message : "Dry-run failed");
    } finally {
      setDryRunLoading(false);
    }
  }

  async function handleExecute() {
    if (!dryRunResult) return;
    setExecuteLoading(true);
    setExecuteError("");
    setExecuteResult(null);
    try {
      const newItems = dryRunResult.preview.filter((p) => !p.alreadySynced);
      const result = await linearExecuteImport({
        tenantId,
        apiKey,
        selectedTeamIds,
        piPlanId: piPlanId || undefined,
        previewItems: newItems,
      });
      setExecuteResult(result);
      goTo("complete");
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setExecuteLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={s.container}>
      <h1 style={s.heading}>Import from Linear</h1>
      <p style={s.subheading}>
        Bring your Linear issues into COSMOS as Features in a few steps.
      </p>

      {/* Step bar */}
      <div style={s.stepBar}>
        {STEPS.map((st, idx) => (
          <span key={st} style={s.stepPill(st === step, idx < currentStepIdx)}>
            {STEP_LABELS[st]}
          </span>
        ))}
      </div>

      <div style={s.card}>
        {/* ── Step 1: Connect ── */}
        {step === "connect" && (
          <StepConnect
            apiKey={apiKey}
            setApiKey={setApiKey}
            apiKeyError={apiKeyError}
            teamsError={teamsError}
            loading={teamsLoading}
            onNext={handleConnect}
          />
        )}

        {/* ── Step 2: Select teams ── */}
        {step === "select" && (
          <StepSelect
            teams={teams}
            selectedTeamIds={selectedTeamIds}
            toggleTeam={toggleTeam}
            onBack={() => goTo("connect")}
            onNext={() => goTo("map")}
          />
        )}

        {/* ── Step 3: Map ── */}
        {step === "map" && (
          <StepMap
            teams={teams.filter((t) => selectedTeamIds.includes(t.id))}
            piPlanId={piPlanId}
            setPiPlanId={setPiPlanId}
            loading={dryRunLoading}
            error={dryRunError}
            onBack={() => goTo("select")}
            onNext={handleDryRun}
          />
        )}

        {/* ── Step 4: Dry-run preview ── */}
        {step === "dry-run" && dryRunResult && (
          <StepDryRun
            result={dryRunResult}
            onBack={() => goTo("map")}
            onNext={() => goTo("execute")}
          />
        )}

        {/* ── Step 5: Execute ── */}
        {step === "execute" && dryRunResult && (
          <StepExecute
            preview={dryRunResult.preview}
            loading={executeLoading}
            error={executeError}
            onBack={() => goTo("dry-run")}
            onExecute={handleExecute}
          />
        )}

        {/* ── Step 6: Complete ── */}
        {step === "complete" && executeResult && (
          <StepComplete result={executeResult} />
        )}
      </div>
    </div>
  );
}

// ─── Step sub-components ──────────────────────────────────────────────────────

function StepConnect({
  apiKey,
  setApiKey,
  apiKeyError,
  teamsError,
  loading,
  onNext,
}: {
  apiKey: string;
  setApiKey: (v: string) => void;
  apiKeyError: string;
  teamsError: string;
  loading: boolean;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
        Connect your Linear workspace
      </h2>
      <label style={s.label} htmlFor="apiKey">
        Linear API Key
      </label>
      <input
        id="apiKey"
        style={s.input}
        type="password"
        placeholder="lin_api_xxxxxxxxxxxxxxxxxxxx"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        autoComplete="off"
      />
      <p style={{ fontSize: 12, color: "var(--muted-foreground, #64748b)", marginTop: 6 }}>
        Generate a Personal API key at{" "}
        <a href="https://linear.app/settings/api" target="_blank" rel="noreferrer">
          linear.app/settings/api
        </a>
        .
      </p>
      {apiKeyError && <p style={s.error}>{apiKeyError}</p>}
      {teamsError && <p style={s.error}>{teamsError}</p>}
      <div style={s.row}>
        <button style={s.btn()} disabled={loading} onClick={onNext}>
          {loading ? "Connecting…" : "Connect & fetch teams →"}
        </button>
      </div>
    </div>
  );
}

function StepSelect({
  teams,
  selectedTeamIds,
  toggleTeam,
  onBack,
  onNext,
}: {
  teams: LinearTeam[];
  selectedTeamIds: string[];
  toggleTeam: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Select teams to import
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted-foreground, #64748b)", marginBottom: 16 }}>
        All non-cancelled issues from selected teams will be imported as Features.
      </p>
      {teams.map((team) => (
        <label key={team.id} style={s.checkLabel}>
          <input
            type="checkbox"
            checked={selectedTeamIds.includes(team.id)}
            onChange={() => toggleTeam(team.id)}
          />
          <span>
            <strong>{team.name}</strong>{" "}
            <span style={{ color: "var(--muted-foreground, #64748b)", fontSize: 12 }}>
              ({team.key})
            </span>
          </span>
        </label>
      ))}
      {teams.length === 0 && (
        <p style={{ color: "var(--muted-foreground, #64748b)", fontSize: 13 }}>
          No teams found in this workspace.
        </p>
      )}
      <div style={s.row}>
        <button style={s.btn("secondary")} onClick={onBack}>
          ← Back
        </button>
        <button
          style={s.btn()}
          disabled={selectedTeamIds.length === 0}
          onClick={onNext}
        >
          Next: Review mapping →
        </button>
      </div>
    </div>
  );
}

function StepMap({
  teams,
  piPlanId,
  setPiPlanId,
  loading,
  error,
  onBack,
  onNext,
}: {
  teams: LinearTeam[];
  piPlanId: string;
  setPiPlanId: (v: string) => void;
  loading: boolean;
  error: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Review mapping
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted-foreground, #64748b)", marginBottom: 20 }}>
        Linear issues will be mapped to COSMOS entities as shown below.
      </p>

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Linear</th>
            <th style={s.th}>→</th>
            <th style={s.th}>COSMOS</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <td style={s.td}>
                Team: <strong>{t.name}</strong>
              </td>
              <td style={{ ...s.td, textAlign: "center" }}>→</td>
              <td style={s.td}>Issues imported as Features</td>
            </tr>
          ))}
          <tr>
            <td style={s.td}>Issue (no parent)</td>
            <td style={{ ...s.td, textAlign: "center" }}>→</td>
            <td style={s.td}>
              <span style={s.badge("#6366f1")}>Feature</span>
            </td>
          </tr>
          <tr>
            <td style={s.td}>Issue (has parent)</td>
            <td style={{ ...s.td, textAlign: "center" }}>→</td>
            <td style={s.td}>
              <span style={s.badge("#6366f1")}>Feature</span>{" "}
              <span style={{ fontSize: 12, color: "var(--muted-foreground, #64748b)" }}>
                (child issues imported as Features too)
              </span>
            </td>
          </tr>
          <tr>
            <td style={s.td}>State: backlog / unstarted</td>
            <td style={{ ...s.td, textAlign: "center" }}>→</td>
            <td style={s.td}>
              <span style={s.badge("#94a3b8")}>BACKLOG / TODO</span>
            </td>
          </tr>
          <tr>
            <td style={s.td}>State: started</td>
            <td style={{ ...s.td, textAlign: "center" }}>→</td>
            <td style={s.td}>
              <span style={s.badge("#3b82f6")}>IN_PROGRESS</span>
            </td>
          </tr>
          <tr>
            <td style={s.td}>State: completed</td>
            <td style={{ ...s.td, textAlign: "center" }}>→</td>
            <td style={s.td}>
              <span style={s.badge("#22c55e")}>DONE</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 20 }}>
        <label style={s.label} htmlFor="piPlanId">
          PI Plan ID{" "}
          <span style={{ fontWeight: 400, color: "var(--muted-foreground, #64748b)" }}>
            (optional — attach imported features to a PI)
          </span>
        </label>
        <input
          id="piPlanId"
          style={s.input}
          type="text"
          placeholder="e.g. cm1abc123..."
          value={piPlanId}
          onChange={(e) => setPiPlanId(e.target.value)}
        />
      </div>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.row}>
        <button style={s.btn("secondary")} onClick={onBack}>
          ← Back
        </button>
        <button style={s.btn()} disabled={loading} onClick={onNext}>
          {loading ? "Running preview…" : "Preview import →"}
        </button>
      </div>
    </div>
  );
}

function StepDryRun({
  result,
  onBack,
  onNext,
}: {
  result: DryRunResult;
  onBack: () => void;
  onNext: () => void;
}) {
  const newCount = result.totalIssues - result.alreadySyncedCount;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Import preview
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted-foreground, #64748b)", marginBottom: 16 }}>
        Review what will be imported. Already-synced issues are skipped automatically.
      </p>

      <div style={s.statBox}>
        <div style={s.stat}>
          <div style={s.statNum}>{result.totalIssues}</div>
          <div style={s.statLabel}>Total issues</div>
        </div>
        <div style={s.stat}>
          <div style={{ ...s.statNum, color: "#22c55e" }}>{newCount}</div>
          <div style={s.statLabel}>Will be imported</div>
        </div>
        <div style={s.stat}>
          <div style={{ ...s.statNum, color: "#94a3b8" }}>{result.alreadySyncedCount}</div>
          <div style={s.statLabel}>Already synced</div>
        </div>
      </div>

      <div style={{ maxHeight: 340, overflowY: "auto", marginTop: 20 }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Title</th>
              <th style={s.th}>Team</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.preview.map((item) => (
              <tr key={item.linearId}>
                <td style={s.td}>
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                    {item.title}
                  </a>
                  {item.isChild && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        color: "var(--muted-foreground, #64748b)",
                      }}
                    >
                      (sub-issue)
                    </span>
                  )}
                </td>
                <td style={s.td}>{item.teamName}</td>
                <td style={s.td}>
                  <StatusBadge statusId={item.statusId} />
                </td>
                <td style={s.td}>
                  {item.alreadySynced ? (
                    <span style={s.badge("#94a3b8")}>skip</span>
                  ) : (
                    <span style={s.badge("#22c55e")}>import</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s.row}>
        <button style={s.btn("secondary")} onClick={onBack}>
          ← Back
        </button>
        <button style={s.btn()} disabled={newCount === 0} onClick={onNext}>
          {newCount === 0 ? "Nothing new to import" : `Import ${newCount} issues →`}
        </button>
      </div>
    </div>
  );
}

function StepExecute({
  preview,
  loading,
  error,
  onBack,
  onExecute,
}: {
  preview: PreviewItem[];
  loading: boolean;
  error: string;
  onBack: () => void;
  onExecute: () => void;
}) {
  const newCount = preview.filter((p) => !p.alreadySynced).length;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Ready to import
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted-foreground, #64748b)", marginBottom: 20 }}>
        {newCount} issue{newCount !== 1 ? "s" : ""} will be created as Features in COSMOS. This
        action cannot be undone.
      </p>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#dc2626",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div style={s.row}>
        <button style={s.btn("secondary")} disabled={loading} onClick={onBack}>
          ← Back
        </button>
        <button style={s.btn()} disabled={loading || newCount === 0} onClick={onExecute}>
          {loading ? "Importing…" : `Confirm import (${newCount} issues)`}
        </button>
      </div>
    </div>
  );
}

function StepComplete({ result }: { result: ExecuteResult }) {
  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Import complete!</h2>
      <p style={{ fontSize: 14, color: "var(--muted-foreground, #64748b)", marginBottom: 24 }}>
        Your Linear issues have been imported into COSMOS.
      </p>

      <div style={s.statBox}>
        <div style={s.stat}>
          <div style={{ ...s.statNum, color: "#22c55e" }}>{result.imported}</div>
          <div style={s.statLabel}>Imported</div>
        </div>
        <div style={s.stat}>
          <div style={{ ...s.statNum, color: "#94a3b8" }}>{result.skipped}</div>
          <div style={s.statLabel}>Skipped (already synced)</div>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div style={{ marginTop: 20, textAlign: "left" }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: "#ef4444", marginBottom: 8 }}>
            {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}:
          </p>
          <ul style={{ fontSize: 12, color: "#ef4444", paddingLeft: 20 }}>
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <a href="/portfolio" style={{ ...s.btn(), textDecoration: "none", display: "inline-block" }}>
          Go to Portfolio →
        </a>
      </div>
    </div>
  );
}

function StatusBadge({ statusId }: { statusId: string }) {
  const colorMap: Record<string, string> = {
    BACKLOG: "#94a3b8",
    TODO: "#64748b",
    IN_PROGRESS: "#3b82f6",
    DONE: "#22c55e",
    CANCELLED: "#ef4444",
  };
  const color = colorMap[statusId] ?? "#94a3b8";
  return <span style={s.badge(color)}>{statusId}</span>;
}
