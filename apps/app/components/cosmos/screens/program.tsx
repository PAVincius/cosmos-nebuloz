"use client";

// program.tsx — SAFe Program Board (grade time × sprint do PI ativo), wired to
// getActiveProgramBoard(). A célula é PIPlanFeatureAssignment, o modelo que já
// tinha a forma exata do quadro (piPlanId/featureId/teamId/sprintId) e que
// nenhuma tela do Cosmos escrevia. Somente leitura quando o PI está COMMITTED
// ou CLOSED (story-020 AC-004); carga acima da capacidade avisa e não bloqueia
// (AC-002).
import { useCallback, useEffect, useState } from "react";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import {
  assignFeatureToCell,
  createFeature,
  getActiveProgramBoard,
  type ProgramBoardView,
  type ProgramFeatureView,
} from "@/app/(cosmos)/actions/program";
import { EmptyState } from "../empty-state";
import { EntityLinkField } from "../entity-link-field";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
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

function FeatureChip({ feature }: { feature: ProgramFeatureView }) {
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
      {feature.milestone && (
        <Icon
          name="flag"
          size={13}
          strokeWidth={2.2}
          style={{ color: "var(--amber)", flexShrink: 0 }}
        />
      )}
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
      {feature.hasDependency && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 700,
            color: "var(--amber-text)",
            background: "var(--amber-soft)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
          title="Possui dependência"
        >
          <Icon name="plug" size={10} strokeWidth={2.2} />
        </span>
      )}
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

type BoardCell = ProgramBoardView["teams"][number]["cells"][number];

// story-020 AC-002 — a carga da célula contra a capacidade da sprint. Acima de
// 100% avisa; nada é bloqueado. Sem snapshot de capacidade não há percentual:
// mostra só os pontos alocados, nunca uma barra inventada.
function CellBody({ cell }: { cell: BoardCell }) {
  if (!cell) {
    return <span style={{ color: "var(--ink-faint)", fontSize: 12.5 }}>—</span>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <span
          className="mono"
          style={{ color: "var(--ink-muted)", fontSize: 11.5, fontWeight: 700 }}
        >
          {cell.assignedSp} / {cell.capacitySp ?? "—"} SP
        </span>
        {cell.utilizationPct !== null && (
          <Badge soft tone={cell.overCapacity ? "amber" : "neutral"}>
            {cell.utilizationPct}% da capacidade
          </Badge>
        )}
      </div>
      {cell.utilizationPct !== null && (
        <Progress
          height={6}
          tone={cell.overCapacity ? "amber" : "green"}
          value={Math.min(100, cell.utilizationPct)}
        />
      )}
      {cell.features.length === 0 ? (
        <span style={{ color: "var(--ink-subtle)", fontSize: 12 }}>
          Nenhuma feature nesta célula.
        </span>
      ) : (
        cell.features.map((f) => <FeatureChip feature={f} key={f.id} />)
      )}
    </div>
  );
}

function BoardGrid({ board }: { board: ProgramBoardView }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr
            style={{
              color: "var(--ink-muted)",
              fontSize: 12,
              textAlign: "left",
            }}
          >
            <th style={{ padding: "8px 12px" }}>Time</th>
            {Array.from({ length: board.sprintCount }, (_, i) => (
              <th key={i} style={{ padding: "8px 12px" }}>
                Sprint {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {board.teams.map((team) => (
            <tr
              key={team.id}
              style={{ borderTop: "1px solid var(--hairline)" }}
            >
              <td
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "10px 12px",
                  verticalAlign: "top",
                  whiteSpace: "nowrap",
                }}
              >
                {team.name}
              </td>
              {team.cells.map((cell, i) => (
                <td
                  key={cell?.sprintId ?? i}
                  style={{
                    minWidth: 220,
                    padding: "10px 12px",
                    verticalAlign: "top",
                  }}
                >
                  {cell && (
                    <div
                      style={{
                        color: "var(--ink-faint)",
                        fontSize: 11,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      {cell.sprintName}
                    </div>
                  )}
                  <CellBody cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A célula é escolhida entre as que existem no quadro — nenhum id é digitado à
// mão, e a action reconfere que a sprint é daquele time naquele PI.
function AssignCellModal({
  board,
  feature,
  onAssigned,
}: {
  board: ProgramBoardView;
  feature: ProgramFeatureView;
  onAssigned: () => void;
}) {
  const { close } = useModal();
  const [saving, setSaving] = useState(false);

  const assign = async (teamId: string, sprintId: string) => {
    if (saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => assignFeatureToCell({ featureId: feature.id, teamId, sprintId }),
      {
        loading: "Alocando feature...",
        success: "Feature alocada.",
        error: (err: string) => `Não foi possível alocar a feature: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onAssigned();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="target" size={16} strokeWidth={2.4} />}
      subtitle="Escolha o time e a sprint deste PI"
      title={`Alocar ${feature.title}`}
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {board.teams.flatMap((team) =>
          team.cells
            .filter((cell) => cell !== null)
            .map((cell) => (
              <Button
                key={`${team.id}:${cell.sprintId}`}
                onClick={() => assign(team.id, cell.sprintId)}
                size="sm"
                variant="secondary"
              >
                {team.name} · {cell.sprintName}
              </Button>
            ))
        )}
      </div>
    </ModalCard>
  );
}

// story-020 — feature comprometida no PI mas sem célula. Antes ela simplesmente
// não aparecia: a tela listava só o que tinha assignedTeamId.
function UnassignedSection({
  board,
  onAssigned,
}: {
  board: ProgramBoardView;
  onAssigned: () => void;
}) {
  const modal = useModal();
  return (
    <SectionCard
      icon="alert"
      subtitle="Comprometidas no PI e ainda sem time × sprint no quadro"
      title="Features sem célula"
      tone="amber"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {board.unassigned.map((f) => (
          <div
            key={f.id}
            style={{
              alignItems: "center",
              display: "flex",
              gap: 12,
              padding: "4px 0",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <FeatureChip feature={f} />
            </span>
            {!board.readOnly && (
              <Button
                onClick={() =>
                  modal.open(
                    <AssignCellModal
                      board={board}
                      feature={f}
                      onAssigned={onAssigned}
                    />
                  )
                }
                size="sm"
                variant="secondary"
              >
                Alocar {f.title}
              </Button>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
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
    if (res.ok) {
      close();
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
        meta={
          board && (
            <>
              <Badge tone="accent">{board.teams.length} times</Badge>
              {board.readOnly && <Badge tone="neutral">Somente leitura</Badge>}
            </>
          )
        }
        subtitle="Features comprometidas no Program Increment ativo, por time e sprint."
        title={board ? `Program Board · ${board.piPlanName}` : "Program Board"}
      >
        {/* story-020 AC-004 — depois do commitment o quadro não recebe escrita. */}
        {board && !board.readOnly && (
          <Button
            icon="plus"
            onClick={() => modal.open(<NewFeatureModal onCreated={load} />)}
            variant="primary"
          >
            Adicionar Feature
          </Button>
        )}
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

      {board?.readOnly && (
        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--r-md)",
            color: "var(--ink-muted)",
            fontSize: 13,
            marginBottom: "var(--gap)",
            padding: "11px 14px",
          }}
        >
          Este PI está {board.piPlanStatus} — o Program Board é somente leitura.
        </div>
      )}

      {board && board.unassigned.length > 0 && (
        <div style={{ marginBottom: "var(--gap)" }}>
          <UnassignedSection board={board} onAssigned={load} />
        </div>
      )}

      {board &&
        (board.teams.length === 0 ? (
          <EmptyState
            description="A grade aparece assim que o PI tiver times com sprints."
            icon="grid"
            title="Nenhum time com sprint neste PI"
          />
        ) : (
          <BoardGrid board={board} />
        ))}
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
