"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  useAction,
  useThemeName,
} from "@repo/design-system/cosmos/kit";
// dependencies.tsx — Dependências, wired to listDependencies(). Lists real
// DependencyLink rows (blocking → blocked feature) with status + critical-path
// flag, now with team attribution (Feature.assignedTeamId → Team, resolved
// tenant-scoped by the action), a portfolio KPI row, and a "Por time" filter.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createDependency,
  type DependencyView,
  listDependencies,
  updateDependencyBoardStatus,
} from "@/app/(cosmos)/actions/dependencies";
import {
  DEPENDENCY_BOARD_STATUS_LABEL,
  DEPENDENCY_BOARD_STATUS_TONE,
  DEPENDENCY_NEXT_STATUS_LABEL,
  type DependencyBoardStatus,
  nextBoardStatus,
} from "@/app/(cosmos)/actions/dependencies.constants";
import { searchEntities } from "@/app/(cosmos)/actions/entity-search";
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
  TextArea,
} from "../modal-form";
import { useActionToast } from "../use-action-toast";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  "not-started": "neutral",
  "on-track": "green",
  "at-risk": "amber",
  blocked: "red",
  completed: "green",
};

// Bloqueio é o assunto da tela inteira — o vermelho do cabeçalho e do preview
// é o mesmo sinal que o card usa para caminho crítico.
const DEPENDENCY_TONE = "red";

// Toda dependência nasce IDENTIFIED (default do schema): o preview mostra o
// estado real de criação, não o estado final desejado.
const INITIAL_BOARD_STATUS: DependencyBoardStatus = "IDENTIFIED";

function FeatureBox({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      style={{
        background: "var(--surface-3)",
        borderRadius: "var(--r-md)",
        flex: 1,
        fontSize: "var(--fs-base)",
        minWidth: 0,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontWeight: 700 }}>{label}</div>
      <div style={{ color: "var(--ink-faint)", fontSize: "var(--fs-nota)" }}>
        {hint}
      </div>
    </div>
  );
}

function NewDependencyModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [blockedId, setBlockedId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const { data: featureOptions } = useAction(
    () => searchEntities("feature", ""),
    []
  );
  const features = featureOptions ?? [];
  const blocking = features.find((f) => f.id === blockingId);
  const blocked = features.find((f) => f.id === blockedId);
  // A carga inicial só alimenta o rótulo do chip: searchEntities corta em 10,
  // e filtrar essa fatia localmente faria o campo negar feature que existe.
  // A exclusão do outro lado continua aqui — uma feature não bloqueia a si
  // mesma, e o servidor não sabe o que o outro campo já escolheu. Cada busca
  // é memoizada porque o efeito do campo tem onSearch nas dependências; a
  // identidade só muda quando o id excluído muda, e aí rebuscar é o correto.
  const buscarBloqueadoras = useCallback(
    async (q: string) => {
      const r = await searchEntities("feature", q);
      return r.ok ? r.data.filter((f) => f.id !== blockedId) : [];
    },
    [blockedId]
  );
  const buscarBloqueadas = useCallback(
    async (q: string) => {
      const r = await searchEntities("feature", q);
      return r.ok ? r.data.filter((f) => f.id !== blockingId) : [];
    },
    [blockingId]
  );

  const create = async () => {
    if (!(blockingId && blockedId) || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createDependency({
          blockingFeatureId: blockingId,
          blockedFeatureId: blockedId,
          description: description.trim() || undefined,
        }),
      {
        loading: "Registrando dependência...",
        success: "Dependência registrada.",
        error: (err: string) =>
          `Não foi possível registrar a dependência: ${err}`,
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
              <span
                style={{
                  color: "var(--ink-subtle)",
                  fontSize: "var(--fs-base)",
                }}
              >
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
              <ModalShortcutHint salvar="registrar" />
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
                  {saving ? "Registrando..." : "Registrar dependência"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="gitBranch" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Vínculo bloqueante entre duas features — a bloqueadora precisa sair primeiro"
        title="Nova dependência"
        tone={DEPENDENCY_TONE}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${DEPENDENCY_TONE}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: "var(--fs-base)",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  marginBottom: 14,
                }}
              >
                {description ||
                  (blocking && blocked
                    ? `${blocking.label} → ${blocked.label}`
                    : "Descrição da dependência")}
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <FeatureBox
                  hint="bloqueadora"
                  label={blocking?.label ?? "Feature bloqueadora"}
                />
                <Icon
                  name="arrowRight"
                  size={16}
                  strokeWidth={2}
                  style={{ color: "var(--ink-faint)", flexShrink: 0 }}
                />
                <FeatureBox
                  hint="bloqueada"
                  label={blocked?.label ?? "Feature bloqueada"}
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Badge
                  tone={DEPENDENCY_BOARD_STATUS_TONE[INITIAL_BOARD_STATUS]}
                >
                  {DEPENDENCY_BOARD_STATUS_LABEL[INITIAL_BOARD_STATUS]}
                </Badge>
              </div>
            </div>
          }
        >
          <EntityLinkField
            hint="Precisa sair primeiro — é ela que trava a outra"
            items={features.filter((f) => f.id !== blockedId)}
            label="Feature bloqueadora"
            onChange={(v) => setBlockingId(v as string | null)}
            onSearch={buscarBloqueadoras}
            placeholder="Buscar a feature bloqueadora..."
            tone={DEPENDENCY_TONE}
            value={blockingId}
          />

          <EntityLinkField
            hint="Fica parada até a bloqueadora ser entregue"
            items={features.filter((f) => f.id !== blockingId)}
            label="Feature bloqueada"
            onChange={(v) => setBlockedId(v as string | null)}
            onSearch={buscarBloqueadas}
            placeholder="Buscar a feature bloqueada..."
            tone={DEPENDENCY_TONE}
            value={blockedId}
          />

          <FormField
            hint="Sem descrição a lista mostra apenas 'bloqueadora → bloqueada'"
            label="Descrição"
          >
            <TextArea
              onChange={setDescription}
              placeholder="ex: Pix agendado depende do tenant isolation layer"
              rows={3}
              value={description}
            />
          </FormField>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}

function TeamPill({ name, color }: { name: string; color: string | null }) {
  return (
    <span
      style={{
        alignItems: "center",
        background: "var(--chip-bg)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-sm)",
        display: "inline-flex",
        gap: 6,
        padding: "5px 10px",
      }}
    >
      <span
        style={{
          background: color ?? "var(--ink-faint)",
          borderRadius: 99,
          flexShrink: 0,
          height: 7,
          width: 7,
        }}
      />
      <span
        style={{
          color: "var(--ink)",
          fontSize: "var(--fs-nota)",
          fontWeight: 700,
        }}
      >
        {name}
      </span>
    </span>
  );
}

function DepCard({
  d,
  onAdvanced,
}: {
  d: DependencyView;
  onAdvanced: () => void;
}) {
  const tone = STATUS_TONE[d.status] ?? "neutral";
  const board = d.boardStatus as DependencyBoardStatus;
  const next = nextBoardStatus(d.boardStatus);
  const [saving, setSaving] = useState(false);

  const advance = async () => {
    if (!next || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => updateDependencyBoardStatus({ id: d.id, boardStatus: next }),
      {
        loading: "Atualizando dependência...",
        success: "Dependência atualizada.",
        error: (err: string) =>
          `Não foi possível atualizar a dependência: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      onAdvanced();
    }
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--card-shadow)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "14px 16px",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
        {/* story-020 AC-006 — o estado do bloqueio, que a tela recebia e não
            mostrava. `status` é o campo textual legado e segue ao lado. */}
        <Badge tone={DEPENDENCY_BOARD_STATUS_TONE[board] ?? "neutral"}>
          {DEPENDENCY_BOARD_STATUS_LABEL[board] ?? d.boardStatus}
        </Badge>
        <Badge tone={tone}>{d.status}</Badge>
        {d.criticalPath && <Badge tone="red">Caminho crítico</Badge>}
        {next && (
          <span style={{ marginLeft: "auto" }}>
            <Button onClick={advance} size="sm" variant="secondary">
              {DEPENDENCY_NEXT_STATUS_LABEL[board]}
            </Button>
          </span>
        )}
      </div>
      <div
        style={{
          color: "var(--ink)",
          fontSize: "var(--fs-base)",
          fontWeight: 600,
        }}
      >
        {d.title}
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
        <TeamPill color={d.fromTeamColor} name={d.fromTeamName ?? "Sem time"} />
        <Icon
          name="arrowRight"
          size={14}
          strokeWidth={2.4}
          style={{ color: "var(--ink-faint)", flexShrink: 0 }}
        />
        <TeamPill color={d.toTeamColor} name={d.toTeamName ?? "Sem time"} />
      </div>
      <div
        style={{
          borderTop: "1px solid var(--hairline)",
          color: "var(--ink-faint)",
          fontSize: "var(--fs-nota)",
          paddingTop: 8,
        }}
      >
        {d.blockingTitle} → {d.blockedTitle}
      </div>
    </div>
  );
}

const chipStyle = (on: boolean) => ({
  background: on ? "var(--accent-soft)" : "var(--surface)",
  border: `1px solid ${on ? "rgba(var(--accent-rgb),.4)" : "var(--hairline-strong)"}`,
  borderRadius: 99,
  color: on ? "var(--accent-text)" : "var(--ink-muted)",
  cursor: "pointer",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  padding: "5px 10px",
});

function TeamFilterPopover({
  options,
  selected,
  onChange,
  btnRect,
}: {
  options: { id: string; name: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  btnRect: DOMRect;
}) {
  const themeName = useThemeName();
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };
  return createPortal(
    <div
      data-dependency-team-filter
      data-theme={themeName}
      style={{
        background: "var(--surface-3)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: "var(--r-md)",
        boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)",
        left: Math.max(8, btnRect.right - 240),
        padding: 14,
        position: "fixed",
        top: btnRect.bottom + 8,
        width: 240,
        zIndex: 400,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            color: "var(--ink)",
            fontSize: "var(--fs-base)",
            fontWeight: 700,
          }}
        >
          Filtrar por time
        </span>
        {selected.size > 0 && (
          <button
            onClick={() => onChange(new Set())}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: "var(--fs-nota)",
              fontWeight: 700,
            }}
            type="button"
          >
            Limpar
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => toggle(o.id)}
            style={chipStyle(selected.has(o.id))}
            type="button"
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

function DependenciesBody() {
  const modal = useModal();
  const [deps, setDeps] = useState<DependencyView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<Set<string>>(() => new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const btnRef = useRef<HTMLSpanElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    listDependencies().then((r) => {
      if (r.ok) {
        setDeps(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!filterOpen) {
      return;
    }
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        !(
          t.closest("[data-dependency-team-filter]") ||
          t.closest("[data-dependency-filter-trigger]")
        )
      ) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filterOpen]);

  // "Acordadas" (agreed-with-a-date) isn't a real dependency status — the
  // schema only tracks not-started/on-track/at-risk/blocked/completed with
  // no agreed-date concept — so that KPI from the handoff is honestly
  // omitted rather than approximated.
  const emRisco = deps.filter(
    (d) => d.status === "at-risk" || d.criticalPath
  ).length;
  const timesEnvolvidos = new Set(
    deps.flatMap((d) => [d.fromTeamId, d.toTeamId].filter((id) => id !== null))
  ).size;

  const teamOptions = Array.from(
    new Map(
      deps
        .flatMap((d) => [
          d.fromTeamId
            ? { id: d.fromTeamId, name: d.fromTeamName as string }
            : null,
          d.toTeamId ? { id: d.toTeamId, name: d.toTeamName as string } : null,
        ])
        .filter((t): t is { id: string; name: string } => t !== null)
        .map((t) => [t.id, t])
    ).values()
  );
  const visibleDeps = deps.filter(
    (d) =>
      teamFilter.size === 0 ||
      (d.fromTeamId && teamFilter.has(d.fromTeamId)) ||
      (d.toTeamId && teamFilter.has(d.toTeamId))
  );

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="ART Board"
        meta={
          <>
            <Badge tone="accent">{deps.length} dependências</Badge>
            {teamFilter.size > 0 && (
              <Badge dot tone="amber">
                {visibleDeps.length} visíveis
              </Badge>
            )}
          </>
        }
        subtitle="Vínculos entre features de times diferentes, com status e caminho crítico."
        title="Dependências"
      >
        {teamOptions.length > 0 && (
          <span
            data-dependency-filter-trigger
            ref={btnRef}
            style={{ display: "inline-flex" }}
          >
            <Button
              icon="filter"
              onClick={() => setFilterOpen((o) => !o)}
              size="md"
              variant={teamFilter.size > 0 ? "primary" : "secondary"}
            >
              Por time{teamFilter.size > 0 ? ` (${teamFilter.size})` : ""}
            </Button>
          </span>
        )}
        <Button
          icon="plus"
          onClick={() => modal.open(<NewDependencyModal onCreated={load} />)}
          size="md"
          variant="primary"
        >
          Nova dependência
        </Button>
      </PageHeader>

      {filterOpen && btnRef.current && (
        <TeamFilterPopover
          btnRect={btnRef.current.getBoundingClientRect()}
          onChange={setTeamFilter}
          options={teamOptions}
          selected={teamFilter}
        />
      )}

      {error && <ErrorState />}

      {!(error || loading) && deps.length > 0 && (
        <div
          style={{
            display: "grid",
            gap: "var(--gap)",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            marginBottom: "var(--gap)",
          }}
        >
          <KpiCard
            icon="gitBranch"
            label="Dependências mapeadas"
            tone="accent"
            value={deps.length}
          />
          <KpiCard
            icon="alert"
            label="Em risco de bloqueio"
            tone={emRisco > 0 ? "red" : "green"}
            value={emRisco}
          />
          <KpiCard
            icon="users"
            label="Times envolvidos"
            tone="purple"
            value={timesEnvolvidos}
          />
        </div>
      )}

      {!(loading || error) && deps.length === 0 && (
        <EmptyState
          description="Registre a primeira dependência entre features de times diferentes."
          icon="gitBranch"
          title="Nenhuma dependência registrada"
        />
      )}
      {!(loading || error) && deps.length > 0 && visibleDeps.length === 0 && (
        <EmptyState
          description="Ajuste o filtro por time para ver as dependências mapeadas."
          icon="filter"
          title="Nenhuma dependência corresponde ao filtro"
        />
      )}
      {!(loading || error) && visibleDeps.length > 0 && (
        <div
          style={{
            display: "grid",
            gap: "var(--gap)",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
          }}
        >
          {visibleDeps.map((d) => (
            <DepCard d={d} key={d.id} onAdvanced={load} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DependenciesScreen() {
  return (
    <ModalProvider>
      <DependenciesBody />
    </ModalProvider>
  );
}
