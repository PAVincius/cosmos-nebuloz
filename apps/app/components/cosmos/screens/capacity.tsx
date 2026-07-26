"use client";

// capacity.tsx — Capacity Planning, wired to listTeamCapacity(). Real Team
// rows joined to their most recent TeamCapacitySnapshot (SP expected vs.
// delivered, utilization %); "—" where no snapshot exists yet. Also renders
// the "Ajustes de capacidade" panel backed by CapacityAdjustmentNote —
// free-text annotations (training, holiday, onboarding) explaining a
// sprint's capacity variance, mirroring the cosmos.html screen-capacity
// handoff (design_handoff_cosmos_full/screen-bundle-1.jsx CapacityScreen).
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  type CapacityAdjustmentNoteView,
  type CapacityGridView,
  type CapacityView,
  createCapacityAdjustmentNote,
  listCapacityAdjustmentNotes,
  listTeamCapacity,
  listTeamCapacityAcrossPI,
  listTeamSprints,
  type TeamSprintOption,
} from "@/app/(cosmos)/actions/capacity";
import {
  CAPACITY_NOTE_TONES,
  type CapacityNoteTone,
} from "@/app/(cosmos)/actions/capacity.constants";
import { EmptyState } from "../empty-state";
import {
  Badge,
  Button,
  ErrorState,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useAction,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const NOTE_TONE: Record<CapacityNoteTone, Tone> = {
  green: "green",
  amber: "amber",
  red: "red",
  neutral: "neutral",
};

function utilTone(pct: number | null): "green" | "amber" | "red" | "neutral" {
  if (pct === null) {
    return "neutral";
  }
  if (pct >= 100) {
    return "red";
  }
  if (pct >= 85) {
    return "amber";
  }
  return "green";
}

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
};

const selectStyle: CSSProperties = inputStyle;

const NOTE_TONE_LABEL: Record<CapacityNoteTone, string> = {
  green: "Positivo",
  amber: "Atenção",
  red: "Crítico",
  neutral: "Neutro",
};

function NewCapacityNoteModal({
  teams,
  onCreated,
}: {
  teams: CapacityView[];
  onCreated?: () => void;
}) {
  const { close } = useModal();
  const [teamId, setTeamId] = useState(teams[0]?.teamId ?? "");
  const [sprintId, setSprintId] = useState("");
  const [sprints, setSprints] = useState<TeamSprintOption[]>([]);
  const [text, setText] = useState("");
  const [tone, setTone] = useState<CapacityNoteTone>("neutral");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSprintId("");
    if (!teamId) {
      setSprints([]);
      return;
    }
    let active = true;
    listTeamSprints(teamId).then((r) => {
      if (active && r.ok) {
        setSprints(r.data);
      }
    });
    return () => {
      active = false;
    };
  }, [teamId]);

  const canSave = teamId.trim() && text.trim() && !saving;

  const create = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createCapacityAdjustmentNote({
          teamId,
          sprintId: sprintId || undefined,
          text: text.trim(),
          tone,
        }),
      {
        loading: "Adicionando ajuste...",
        success: "Ajuste de capacidade adicionado.",
        error: (err: string) => `Não foi possível adicionar o ajuste: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onCreated?.();
    }
  };

  return (
    <ModalCard
      subtitle="Explique férias, treinamento, onboarding ou outros fatores considerados na capacidade"
      title="Novo ajuste de capacidade"
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="capnote-team" style={fieldLabelStyle}>
            Time
          </label>
          <select
            id="capnote-team"
            onChange={(e) => setTeamId(e.target.value)}
            style={selectStyle}
            value={teamId}
          >
            {teams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.teamName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="capnote-sprint" style={fieldLabelStyle}>
            Sprint (opcional)
          </label>
          <select
            id="capnote-sprint"
            onChange={(e) => setSprintId(e.target.value)}
            style={selectStyle}
            value={sprintId}
          >
            <option value="">Sem sprint específico</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="capnote-text" style={fieldLabelStyle}>
            Explicação
          </label>
          <textarea
            id="capnote-text"
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder="ex: −4 pts: 1 dev em treinamento de segurança"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            value={text}
          />
        </div>

        <div>
          <label htmlFor="capnote-tone" style={fieldLabelStyle}>
            Impacto
          </label>
          <select
            id="capnote-tone"
            onChange={(e) => setTone(e.target.value as CapacityNoteTone)}
            style={selectStyle}
            value={tone}
          >
            {CAPACITY_NOTE_TONES.map((t) => (
              <option key={t} value={t}>
                {NOTE_TONE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button
            onClick={create}
            size="sm"
            style={canSave ? undefined : { opacity: 0.5, cursor: "default" }}
            variant="primary"
          >
            Adicionar ajuste
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function CapacityNotesPanel({ rows }: { rows: CapacityView[] }) {
  const modal = useModal();
  const [notes, setNotes] = useState<CapacityAdjustmentNoteView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listCapacityAdjustmentNotes().then((r) => {
      if (r.ok) {
        setNotes(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () =>
    modal.open(<NewCapacityNoteModal onCreated={load} teams={rows} />);

  return (
    <SectionCard
      action={
        rows.length > 0 && (
          <Button icon="plus" onClick={openModal} size="sm" variant="secondary">
            Novo ajuste
          </Button>
        )
      }
      bodyStyle={{ padding: 12 }}
      icon="sliders"
      subtitle="Férias, onboarding e outros fatores considerados"
      title="Ajustes de capacidade"
      tone="amber"
    >
      {error && <ErrorState />}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && notes.length === 0 && (
        <EmptyState
          action={
            rows.length > 0
              ? { label: "Novo ajuste", onClick: openModal }
              : undefined
          }
          description="Registre férias, treinamentos ou onboarding que expliquem a variação de capacidade de um time."
          icon="sliders"
          title="Nenhum ajuste registrado"
        />
      )}
      {!(error || loading) && notes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 13px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "var(--surface-2)",
              }}
            >
              <Badge
                dot
                tone={NOTE_TONE[n.tone as CapacityNoteTone] ?? "neutral"}
              >
                {n.teamName}
              </Badge>
              <span style={{ fontSize: 12.5, color: "var(--ink)", flex: 1 }}>
                {n.text}
              </span>
              {n.sprintName && <Badge tone="neutral">{n.sprintName}</Badge>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── Per-sprint capacity grid across the active PI ──

function CapacityGridSection() {
  const { data, loading, error } = useAction<CapacityGridView | null>(
    listTeamCapacityAcrossPI
  );
  const rows = data?.rows ?? [];
  const sprintCount = data?.sprintCount ?? 0;

  return (
    <SectionCard
      icon="grid"
      subtitle="Times × sprints do PI ativo — SP esperado vs. entregue"
      title="Capacidade por sprint"
      tone="purple"
    >
      {error && <ErrorState />}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && rows.length === 0 && (
        <EmptyState
          description="A grade aparece assim que houver um PI em planejamento/execução com sprints e snapshots de capacidade."
          icon="grid"
          title="Sem PI ativo ou sem sprints ainda"
        />
      )}
      {!(error || loading) && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  textAlign: "left",
                  fontSize: 12,
                  color: "var(--ink-muted)",
                }}
              >
                <th style={{ padding: "8px 12px" }}>Time</th>
                {Array.from({ length: sprintCount }, (_, i) => (
                  <th key={i} style={{ padding: "8px 12px" }}>
                    Sprint {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.teamId}
                  style={{ borderTop: "1px solid var(--hairline)" }}
                >
                  <td
                    style={{
                      padding: "10px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.teamName}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={i} style={{ padding: "10px 12px", minWidth: 120 }}>
                      {cell ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <span className="mono" style={{ fontSize: 12.5 }}>
                            {cell.actualSp ?? "—"} / {cell.expectedSp ?? "—"} SP
                          </span>
                          {cell.utilizationPct !== null && (
                            <Progress
                              tone={utilTone(cell.utilizationPct)}
                              value={cell.utilizationPct}
                            />
                          )}
                        </div>
                      ) : (
                        <span
                          style={{ fontSize: 13, color: "var(--ink-muted)" }}
                        >
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export default function CapacityScreen() {
  const [rows, setRows] = useState<CapacityView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTeamCapacity().then((r) => {
      if (r.ok) {
        setRows(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  return (
    <ModalProvider>
      <div className="fade-in">
        <PageHeader
          eyebrow="ART Board"
          meta={<Badge tone="accent">{rows.length} times</Badge>}
          subtitle="Capacidade por time — SP esperados vs. entregues no último snapshot."
          title="Capacity Planning"
        />
        {error && <ErrorState />}
        {!error && (
          <SectionCard subtitle="Ordenado por nome do time" title="Times">
            {loading ? (
              <div
                style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}
              >
                Carregando...
              </div>
            ) : rows.length === 0 ? (
              <div
                style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}
              >
                Nenhum time encontrado.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        color: "var(--ink-muted)",
                      }}
                    >
                      <th style={{ padding: "8px 12px" }}>Time</th>
                      <th style={{ padding: "8px 12px" }}>Velocity</th>
                      <th style={{ padding: "8px 12px" }}>SP esperado</th>
                      <th style={{ padding: "8px 12px" }}>SP entregue</th>
                      <th style={{ padding: "8px 12px" }}>Utilização</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.teamId}
                        style={{ borderTop: "1px solid var(--hairline)" }}
                      >
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                          {row.teamName}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                          {row.velocity ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                          {row.expectedSp ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>
                          {row.actualSp ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px", minWidth: 160 }}>
                          {row.utilizationPct === null ? (
                            <span
                              style={{
                                fontSize: 13,
                                color: "var(--ink-muted)",
                              }}
                            >
                              —
                            </span>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <Progress
                                  tone={utilTone(row.utilizationPct)}
                                  value={row.utilizationPct}
                                />
                              </div>
                              <Badge soft tone={utilTone(row.utilizationPct)}>
                                {row.utilizationPct}%
                              </Badge>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}
        <div style={{ marginTop: 14 }}>
          <CapacityGridSection />
        </div>
        <div style={{ marginTop: 14 }}>
          <CapacityNotesPanel rows={rows} />
        </div>
      </div>
    </ModalProvider>
  );
}
