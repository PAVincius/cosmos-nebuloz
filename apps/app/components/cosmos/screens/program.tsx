"use client";

// program.tsx — SAFe Program Board (teams × committed features), wired to
// getActiveProgramBoard(). Read-only board + NewFeatureModal to commit a
// Feature to the program (title, epic/team links, WSJF sliders).
import { useCallback, useEffect, useState } from "react";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import {
  createFeature,
  getActiveProgramBoard,
  type ProgramBoardView,
} from "@/app/(cosmos)/actions/program";
import { EntityLinkField } from "../entity-link-field";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  type Tone,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

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

// ── WSJF 0-10 slider field ──
function ScoreSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 6,
        }}
      >
        <span>{label}</span>
        <span className="mono" style={{ color: "var(--accent-text)" }}>
          {value}
        </span>
      </div>
      <input
        max={10}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
        type="range"
        value={value}
      />
    </div>
  );
}

function NewFeatureModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [epic, setEpic] = useState<EntityOption | null>(null);
  const [team, setTeam] = useState<EntityOption | null>(null);
  const [bv, setBv] = useState(0);
  const [tc, setTc] = useState(0);
  const [rr, setRr] = useState(0);
  const [js, setJs] = useState(1);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim() || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createFeature({
          title: title.trim(),
          epicId: epic?.id,
          assignedTeamId: team?.id,
          bv,
          tc,
          rr,
          js,
        }),
      {
        loading: "Criando feature...",
        success: "Feature criada.",
        error: (err: string) => `Não foi possível criar a feature: ${err}`,
      }
    );
    setSaving(false);
    close();
    if (res.ok) {
      onCreated?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="plus" size={16} strokeWidth={2.4} />}
      subtitle="Comitar uma feature ao Program Increment"
      title="Nova Feature"
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: ".04em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              marginBottom: 6,
            }}
          >
            Título da feature
          </label>
          <input
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                create();
              }
            }}
            placeholder="Ex: Checkout via PIX…"
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--hairline-strong)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontFamily: "inherit",
              outline: "none",
            }}
            value={title}
          />
        </div>

        <EntityLinkField
          kind="epic"
          label="Épico"
          onChange={setEpic}
          value={epic}
        />
        <EntityLinkField
          kind="team"
          label="Time"
          onChange={setTeam}
          value={team}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <ScoreSlider label="Business Value" onChange={setBv} value={bv} />
          <ScoreSlider label="Time Criticality" onChange={setTc} value={tc} />
          <ScoreSlider label="Risk Reduction" onChange={setRr} value={rr} />
          <ScoreSlider label="Job Size" onChange={setJs} value={js} />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar feature
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function ProgramBody() {
  const [board, setBoard] = useState<ProgramBoardView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const modal = useModal();

  const load = useCallback(() => {
    getActiveProgramBoard().then((r) => {
      if (r.ok) {
        setBoard(r.data);
      } else {
        setError(r.error);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Programa · Execução"
        meta={board && <Badge tone="accent">{board.teams.length} times</Badge>}
        subtitle="Times e features comprometidas no Program Increment ativo."
        title={board ? `Program Board · ${board.piPlanName}` : "Program Board"}
      >
        <Button
          icon="plus"
          onClick={() => modal.open(<NewFeatureModal onCreated={load} />)}
          variant="primary"
        >
          Adicionar Feature
        </Button>
      </PageHeader>

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

export default function ProgramScreen() {
  return (
    <ModalProvider>
      <ProgramBody />
    </ModalProvider>
  );
}
