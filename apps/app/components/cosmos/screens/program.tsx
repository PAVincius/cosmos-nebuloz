"use client";

// program.tsx — SAFe Program Board (teams × committed features), wired to
// getActiveProgramBoard(). Read-only pass: one row per team, feature chips
// showing title, story points and status.
import { useEffect, useState } from "react";
import {
  getActiveProgramBoard,
  type ProgramBoardView,
} from "@/app/(cosmos)/actions/program";
import { Badge, ErrorState, KpiCard, PageHeader, type Tone } from "../kit";

const STATUS_TONE: Record<string, { tone: Tone; label: string }> = {
  BACKLOG: { tone: "neutral", label: "Backlog" },
  ANALYZING: { tone: "amber", label: "Em análise" },
  IMPLEMENTING: { tone: "blue", label: "Em progresso" },
  IN_PROGRESS: { tone: "blue", label: "Em progresso" },
  DONE: { tone: "green", label: "Concluída" },
};

function statusInfo(statusId: string): { tone: Tone; label: string } {
  return STATUS_TONE[statusId] ?? { tone: "neutral", label: statusId };
}

function FeatureChip({
  feature,
}: {
  feature: ProgramBoardView["teams"][number]["features"][number];
}) {
  const st = statusInfo(feature.statusId);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink)",
        }}
      >
        {feature.title}
      </span>
      <span
        className="mono"
        style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)" }}
      >
        {feature.storyPoints} pts
      </span>
      <Badge tone={st.tone}>{st.label}</Badge>
    </div>
  );
}

function TeamRow({ team }: { team: ProgramBoardView["teams"][number] }) {
  return (
    <div
      style={{
        overflow: "hidden",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--card-shadow)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--surface-2)",
        }}
      >
        <span
          className="display"
          style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}
        >
          {team.name}
        </span>
        <Badge tone="neutral">{team.features.length} features</Badge>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 14,
        }}
      >
        {team.features.length === 0 ? (
          <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
            Nenhuma feature atribuída.
          </span>
        ) : (
          team.features.map((f) => <FeatureChip feature={f} key={f.id} />)
        )}
      </div>
    </div>
  );
}

export default function ProgramScreen() {
  const [board, setBoard] = useState<ProgramBoardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveProgramBoard().then((r) => {
      if (r.ok) {
        setBoard(r.data);
      } else {
        setError(r.error);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Programa · Execução"
        meta={board && <Badge tone="accent">{board.teams.length} times</Badge>}
        subtitle="Times e features comprometidas no Program Increment ativo."
        title={board ? `Program Board · ${board.piPlanName}` : "Program Board"}
      />

      {error && <ErrorState message={error} />}

      {!(error || loading) && board === null && (
        <KpiCard
          hint="Nenhum PI em Planning, Committed ou Executing"
          icon="target"
          label="Nenhum PI ativo"
          tone="accent"
          value="—"
        />
      )}

      {board && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {board.teams.map((team) => (
            <TeamRow key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
