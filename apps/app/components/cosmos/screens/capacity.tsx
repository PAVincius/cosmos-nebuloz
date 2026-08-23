"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useAction,
} from "@repo/design-system/cosmos/kit";
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
  CAPACITY_BAND_LABEL,
  CAPACITY_NOTE_TONES,
  type CapacityBand,
  type CapacityNoteTone,
} from "@/app/(cosmos)/actions/capacity.constants";
import { EmptyState } from "../empty-state";
import {
  ModalCard,
  ModalProvider,
  ModalShortcutHint,
  ModalSplit,
  useModal,
  useModalSubmitShortcut,
} from "../modal";
import {
  DirtyProvider,
  FormField,
  Segmented,
  Select,
  TextArea,
} from "../modal-form";
import { useActionToast } from "../use-action-toast";

const NOTE_TONE: Record<CapacityNoteTone, Tone> = {
  green: "green",
  amber: "amber",
  red: "red",
  neutral: "neutral",
};

// A faixa vem da action (story-057 AC-002). Aqui só se escolhe o tom neutro
// para o caso sem snapshot — nenhum limiar é redecidido na tela.
function bandTone(band: CapacityBand | null): Tone {
  return band ?? "neutral";
}

// story-032 AC-002 "Hover shows: planned/actual/capacity". Em story points: o
// snapshot não guarda hora nem dia-pessoa (lacuna registrada no nó), e SP não
// se converte em hora sem inventar um fator.
function utilTitle(
  expectedSp: number | null,
  actualSp: number | null,
  utilizationPct: number,
  band: CapacityBand
): string {
  return `Planejado ${expectedSp ?? "—"} SP · Entregue ${actualSp ?? "—"} SP · Utilização ${utilizationPct}% — ${CAPACITY_BAND_LABEL[band]}`;
}

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

const NOTE_TONE_LABEL: Record<CapacityNoteTone, string> = {
  green: "Positivo",
  amber: "Atenção",
  red: "Crítico",
  neutral: "Neutro",
};

// O tom da nota é o realce do modal, mas "neutral" não é cor no tema — cai no
// accent para o cabeçalho não ficar sem realce nenhum.
const NOTE_MODAL_TONE: Record<CapacityNoteTone, string> = {
  green: "green",
  amber: "amber",
  red: "red",
  neutral: "accent",
};

// O mesmo teto do CreateCapacityAdjustmentNoteSchema. Repetido aqui porque o
// contador precisa de um número; divergir só adiantaria a recusa do zod.
const TEXTO_MAX = 500;

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
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

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
  const modalTone = NOTE_MODAL_TONE[tone];
  const time = teams.find((t) => t.teamId === teamId);
  const sprint = sprints.find((s) => s.id === sprintId);

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

  useModalSubmitShortcut(create, !saving);

  return (
    <DirtyProvider value={{ markDirty: () => setDirty(true) }}>
      <ModalCard
        footer={
          confirmandoSaida ? (
            <>
              <span style={{ color: "var(--ink-subtle)", fontSize: 12.5 }}>
                Descartar o que você preencheu?
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => setConfirmandoSaida(false)}
                  size="sm"
                  variant="secondary"
                >
                  Continuar editando
                </Button>
                <Button onClick={close} size="sm" variant="secondary">
                  Descartar
                </Button>
              </div>
            </>
          ) : (
            <>
              <ModalShortcutHint salvar="criar" />
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => {
                    // Confirma só quando há o que perder.
                    if (dirty) {
                      setConfirmandoSaida(true);
                      return;
                    }
                    close();
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button
                  icon="check"
                  onClick={create}
                  size="sm"
                  style={
                    canSave ? undefined : { opacity: 0.5, cursor: "default" }
                  }
                  variant="primary"
                >
                  {saving ? "Adicionando..." : "Adicionar ajuste"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="sliders" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Explique férias, treinamento, onboarding ou outros fatores considerados na capacidade"
        title="Novo ajuste de capacidade"
        tone={modalTone}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${modalTone}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              {/* Mesma forma da linha no painel "Ajustes de capacidade": o
                  preview mostra onde a nota vai parar, não uma outra coisa. */}
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <Badge dot tone={NOTE_TONE[tone]}>
                  {time?.teamName ?? "Time"}
                </Badge>
                {sprint && <Badge tone="neutral">{sprint.name}</Badge>}
              </div>
              <div
                style={{
                  color: text ? "var(--ink)" : "var(--ink-faint)",
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  marginBottom: 14,
                }}
              >
                {text || "O que explica a variação de capacidade..."}
              </div>

              <div style={previewLabelStyle}>Capacidade do time hoje</div>
              {time && time.utilizationPct !== null ? (
                <>
                  <Progress
                    tone={bandTone(time.band)}
                    value={time.utilizationPct}
                  />
                  <div
                    style={{
                      color: "var(--ink-muted)",
                      fontSize: 11,
                      marginTop: 6,
                    }}
                  >
                    {`${time.actualSp ?? "—"} / ${time.expectedSp ?? "—"} SP · utilização ${time.utilizationPct}%`}
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--ink-faint)", fontSize: 12 }}>
                  Sem snapshot de capacidade para este time
                </div>
              )}
            </div>
          }
        >
          <FormField label="Time">
            <Select
              onChange={setTeamId}
              options={teams.map((t) => ({
                value: t.teamId,
                label: t.teamName,
              }))}
              value={teamId}
            />
          </FormField>

          <FormField
            hint="Sem sprint, o ajuste vale para o time como um todo"
            label="Sprint (opcional)"
          >
            <Select
              onChange={setSprintId}
              options={[
                { value: "", label: "Sem sprint específico" },
                ...sprints.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={sprintId}
            />
          </FormField>

          <FormField
            hint={`${text.length}/${TEXTO_MAX} caracteres`}
            label="Explicação"
            required
          >
            <TextArea
              onChange={(v) => setText(v.slice(0, TEXTO_MAX))}
              placeholder="ex: −4 pts: 1 dev em treinamento de segurança"
              required
              rows={3}
              value={text}
            />
          </FormField>

          <FormField label="Impacto">
            <Segmented
              onChange={(v) => {
                setDirty(true);
                setTone(v as CapacityNoteTone);
              }}
              options={CAPACITY_NOTE_TONES.map((t) => ({
                value: t,
                label: NOTE_TONE_LABEL[t],
              }))}
              tone={modalTone}
              value={tone}
            />
          </FormField>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
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
                          title={
                            cell.utilizationPct !== null && cell.band !== null
                              ? utilTitle(
                                  cell.expectedSp,
                                  cell.actualSp,
                                  cell.utilizationPct,
                                  cell.band
                                )
                              : undefined
                          }
                        >
                          <span className="mono" style={{ fontSize: 12.5 }}>
                            {cell.actualSp ?? "—"} / {cell.expectedSp ?? "—"} SP
                          </span>
                          {cell.utilizationPct !== null && (
                            <Progress
                              tone={bandTone(cell.band)}
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
                              title={
                                row.band
                                  ? utilTitle(
                                      row.expectedSp,
                                      row.actualSp,
                                      row.utilizationPct,
                                      row.band
                                    )
                                  : undefined
                              }
                            >
                              <div style={{ flex: 1 }}>
                                <Progress
                                  tone={bandTone(row.band)}
                                  value={row.utilizationPct}
                                />
                              </div>
                              <Badge soft tone={bandTone(row.band)}>
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
