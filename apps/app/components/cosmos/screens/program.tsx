"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useAction,
} from "@repo/design-system/cosmos/kit";
// program.tsx — SAFe Program Board (grade time × sprint do PI ativo), wired to
// getActiveProgramBoard(). A célula é PIPlanFeatureAssignment, o modelo que já
// tinha a forma exata do quadro (piPlanId/featureId/teamId/sprintId) e que
// nenhuma tela do Cosmos escrevia. Somente leitura quando o PI está COMMITTED
// ou CLOSED (story-020 AC-004); carga acima da capacidade avisa e não bloqueia
// (AC-002).
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { searchEntities } from "@/app/(cosmos)/actions/entity-search";
import {
  assignFeatureToCell,
  createFeature,
  getActiveProgramBoard,
  type ProgramBoardView,
  type ProgramFeatureView,
} from "@/app/(cosmos)/actions/program";
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
  EntityLinkField,
  FormField,
  MiniSlider,
  TextInput,
} from "../modal-form";
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

// Feature não tem cor própria no modelo — o azul é o realce do Program Board,
// o mesmo tom que a tela usa para "em progresso".
const FEATURE_TONE = "blue";

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

function NewFeatureModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [epicId, setEpicId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [bv, setBv] = useState(0);
  const [tc, setTc] = useState(0);
  const [rr, setRr] = useState(0);
  const [js, setJs] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const { data: epicOptions } = useAction(() => searchEntities("epic", ""), []);
  const { data: teamOptions } = useAction(() => searchEntities("team", ""), []);
  const epics = epicOptions ?? [];
  const teams = teamOptions ?? [];
  // A carga inicial só alimenta o rótulo do chip: searchEntities corta em 10,
  // e filtrar essa fatia localmente faria o campo negar épico ou time que
  // existe. Estáveis por useCallback — o efeito de busca tem onSearch nas
  // dependências e recriá-las a cada render dispararia busca em loop.
  const buscarEpicos = useCallback(async (q: string) => {
    const r = await searchEntities("epic", q);
    return r.ok ? r.data : [];
  }, []);
  const buscarTimes = useCallback(async (q: string) => {
    const r = await searchEntities("team", q);
    return r.ok ? r.data : [];
  }, []);
  const epic = epics.find((e) => e.id === epicId);
  const team = teams.find((t) => t.id === teamId);
  // Mesma conta de calculateWSJF (packages/safe-engine), que é quem grava o
  // wsjfScore: o preview não pode mostrar uma prioridade diferente da gravada.
  const wsjf = Math.round(((bv + tc + rr) / js) * 100) / 100;

  // O slider não avisa o DirtyProvider sozinho; sem isto sair depois de
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
          epicId: epicId ?? undefined,
          assignedTeamId: teamId ?? undefined,
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
                  variant="primary"
                >
                  {saving ? "Criando..." : "Criar feature"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="kanban" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Item de entrega do Program Board, ligado a um épico e a um time"
        title="Nova Feature"
        tone={FEATURE_TONE}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${FEATURE_TONE}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    background: `var(--${FEATURE_TONE})`,
                    borderRadius: 99,
                    height: 8,
                    width: 8,
                  }}
                />
                <span
                  className="mono"
                  style={{ color: "var(--ink-faint)", fontSize: 10.5 }}
                >
                  Program Board
                </span>
              </div>
              <div
                className="display"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  marginBottom: 10,
                }}
              >
                {title || "Título da feature"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 14,
                }}
              >
                <Badge tone={team ? FEATURE_TONE : "neutral"}>
                  {team?.label ?? "Sem time"}
                </Badge>
                <Badge tone="neutral">Backlog</Badge>
              </div>

              {epic && (
                <div
                  style={{
                    alignItems: "center",
                    color: "var(--ink-muted)",
                    display: "flex",
                    fontSize: 12,
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <Icon
                    name="flag"
                    size={13}
                    style={{ color: `var(--${FEATURE_TONE}-text)` }}
                  />
                  {epic.label}
                </div>
              )}

              <div style={previewLabelStyle}>WSJF</div>
              <div
                className="mono"
                style={{
                  color: `var(--${FEATURE_TONE}-text)`,
                  fontSize: 30,
                  fontWeight: 700,
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {wsjf.toFixed(2)}
              </div>
              <div style={{ color: "var(--ink-faint)", fontSize: 11 }}>
                {`(${bv} + ${tc} + ${rr}) / ${js}`}
              </div>
            </div>
          }
        >
          <FormField label="Título da feature" required>
            <TextInput
              onChange={setTitle}
              placeholder="ex: Limites dinâmicos por risco"
              required
              value={title}
            />
          </FormField>

          <EntityLinkField
            hint="Toda feature deve decompor um épico do portfólio"
            items={epics}
            label="Épico pai"
            onChange={(v) => setEpicId(v as string | null)}
            onSearch={buscarEpicos}
            placeholder="Buscar o épico que esta feature entrega..."
            tone={FEATURE_TONE}
            value={epicId}
          />

          <EntityLinkField
            hint="Time que leva a feature no PI — a célula do quadro é escolhida depois"
            items={teams}
            label="Time"
            onChange={(v) => setTeamId(v as string | null)}
            onSearch={buscarTimes}
            placeholder="Buscar um time..."
            tone={FEATURE_TONE}
            value={teamId}
          />

          <div>
            <div
              style={{
                color: "var(--ink-subtle)",
                fontSize: 12.5,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              WSJF
            </div>
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <MiniSlider
                label="Business Value"
                max={10}
                min={0}
                onChange={setBv}
                value={bv}
              />
              <MiniSlider
                label="Time Criticality"
                max={10}
                min={0}
                onChange={setTc}
                value={tc}
              />
              <MiniSlider
                label="Risk Reduction"
                max={10}
                min={0}
                onChange={setRr}
                value={rr}
              />
              <MiniSlider
                label="Job Size"
                max={10}
                min={1}
                onChange={setJs}
                value={js}
              />
            </div>
          </div>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
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
