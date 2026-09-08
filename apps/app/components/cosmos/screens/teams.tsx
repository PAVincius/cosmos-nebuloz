"use client";

// teams.tsx — Times (diretório de squads do portfólio), wired to listTeams().
// Portfolio KPI row, ART filter popover, and per-team capacity/predictability
// (both from the same TeamCapacitySnapshot the team-detail screen reads).

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useAction,
  useNav,
  useThemeName,
} from "@repo/design-system/cosmos/kit";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type EntityOption,
  searchEntities,
} from "@/app/(cosmos)/actions/entity-search";
import {
  assignTeamToArt,
  createTeam,
  listTeams,
  type TeamListView,
} from "@/app/(cosmos)/actions/teams";
import { EntityLinkField as EntitySearchField } from "../entity-link-field";
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
  TextInput,
} from "../modal-form";
import { useActionToast } from "../use-action-toast";

// Squad nasce sem cor e sem tone próprio — `createTeam` só aceita nome e ART.
// O realce do modal é o do portfólio.
const TEAM_TONE = "accent";

function NewTeamModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [name, setName] = useState("");
  const [artId, setArtId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  // ARTs vinculáveis, carregados uma vez ao abrir. Esta primeira leva só
  // alimenta o rótulo do chip escolhido: searchEntities corta em 10, e um
  // portfólio com mais ARTs faria o campo negar ART que existe.
  const { data: arts } = useAction<EntityOption[]>(
    () => searchEntities("art", ""),
    []
  );
  const art = (arts ?? []).find((a) => a.id === artId);
  // Estável por useCallback — o efeito de busca do campo tem onSearch nas
  // dependências e uma função nova a cada render viraria busca em loop.
  const buscarArts = useCallback(async (q: string) => {
    const r = await searchEntities("art", q);
    return r.ok ? r.data : [];
  }, []);

  const create = async () => {
    if (!name.trim() || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createTeam({
          name: name.trim(),
          artId: artId ?? undefined,
        }),
      {
        loading: "Criando time...",
        success: "Time criado.",
        error: (err: string) => `Não foi possível criar o time: ${err}`,
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
                  {saving ? "Criando..." : "Criar time"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="users" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Squad do portfólio, alocado a um Agile Release Train"
        title="Novo time"
        tone={TEAM_TONE}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${TEAM_TONE}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <Avatar name={name || "Novo time"} size={36} tone="accent" />
                <div style={{ minWidth: 0 }}>
                  <div
                    className="display"
                    style={{ fontSize: 14.5, fontWeight: 700 }}
                  >
                    {name || "Nome do time"}
                  </div>
                  <div style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>
                    {art?.label ?? "Sem ART"}
                  </div>
                </div>
              </div>
              {/* O mesmo alerta que a tela dá para os times já criados sem ART:
                  vale mais antes de criar do que depois. */}
              {art ? (
                <Badge icon="grid" tone="accent">
                  {art.label}
                </Badge>
              ) : (
                <div
                  style={{
                    background: "var(--amber-soft)",
                    border: "1px solid rgba(var(--amber-rgb),.3)",
                    borderRadius: "var(--r-md)",
                    color: "var(--amber-text)",
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    padding: "9px 11px",
                  }}
                >
                  Sem ART, o time não entra em PI Planning: não recebe sprint
                  nem aparece no Program Board.
                </div>
              )}
              <div
                style={{
                  borderTop: "1px solid var(--hairline)",
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  lineHeight: 1.6,
                  marginTop: 14,
                  paddingTop: 12,
                }}
              >
                Membros, capacidade e velocity aparecem depois das primeiras
                sprints — o time nasce vazio.
              </div>
            </div>
          }
        >
          <FormField label="Nome do time" required>
            <TextInput
              onChange={setName}
              placeholder="ex: Squad Pagamentos"
              required
              value={name}
            />
          </FormField>

          <EntityLinkField
            hint="Um Agile Team pertence a um, e somente um, ART — pode ser vinculado depois"
            items={arts ?? []}
            label="ART"
            onChange={(v) => setArtId(v as string | null)}
            onSearch={buscarArts}
            placeholder="Buscar um ART..."
            tone={TEAM_TONE}
            value={artId}
          />
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}

// story-056 AC-002 — o único caminho para corrigir um squad que nasceu fora de
// um ART. `createTeam` aceita artId na criação e, até aqui, nada mais.
function LinkArtModal({
  team,
  onLinked,
}: {
  team: TeamListView;
  onLinked?: () => void;
}) {
  const { close } = useModal();
  const [art, setArt] = useState<EntityOption | null>(null);
  const [saving, setSaving] = useState(false);

  const link = async () => {
    if (!art || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => assignTeamToArt({ teamId: team.id, artId: art.id }),
      {
        loading: "Vinculando time ao ART...",
        success: "Time vinculado ao ART.",
        error: (err: string) => `Não foi possível vincular o time: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onLinked?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="users" size={16} strokeWidth={2.4} />}
      subtitle="Um Agile Team pertence a um, e somente um, ART"
      title={`Vincular ${team.name} a um ART`}
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <EntitySearchField
          kind="art"
          label="ART"
          onChange={setArt}
          value={art}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={link} size="sm" variant="primary">
            Vincular ao ART
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

// story-056 AC-001 — sem esta seção, a tela mostra o badge do ART quando ele
// existe e silencia quando não existe: o buraco fica invisível exatamente para
// quem precisa vê-lo antes de abrir o PI Planning.
function UnassignedTeamsSection({
  teams,
  onLinked,
}: {
  teams: TeamListView[];
  onLinked: () => void;
}) {
  const modal = useModal();
  return (
    <div style={{ marginBottom: "var(--gap)" }}>
      <SectionCard
        icon="alert"
        subtitle="Um time sem ART não entra em PI Planning: não recebe sprint nem aparece no Program Board."
        title="Times sem ART"
        tone="amber"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {teams.map((tm) => (
            <div
              key={tm.id}
              style={{
                alignItems: "center",
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
                borderRadius: "var(--r-md)",
                display: "flex",
                gap: 12,
                padding: "11px 13px",
              }}
            >
              <span
                style={{
                  color: "var(--ink)",
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {tm.name}
              </span>
              <Button
                onClick={() =>
                  modal.open(<LinkArtModal onLinked={onLinked} team={tm} />)
                }
                size="sm"
                variant="secondary"
              >
                Vincular {tm.name} a um ART
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function TeamCard({ tm }: { tm: TeamListView }) {
  const { navigate } = useNav();
  const over =
    tm.capacity !== null && tm.capacity.actualSp > tm.capacity.expectedSp;
  const capacityPct =
    tm.capacity && tm.capacity.expectedSp > 0
      ? Math.round((tm.capacity.actualSp / tm.capacity.expectedSp) * 100)
      : null;
  return (
    <button
      className="lift"
      onClick={() => navigate("team", tm.id)}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--card-shadow)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        color: "inherit",
      }}
      type="button"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "var(--r-pill)",
            flexShrink: 0,
            background: tm.color ?? "var(--accent)",
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="display"
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-.01em",
              color: "var(--ink)",
              lineHeight: 1.2,
              textWrap: "balance",
            }}
          >
            {tm.name}
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 12.5,
              color: "var(--ink-subtle)",
            }}
          >
            {tm.focusArea ?? "—"}
          </div>
        </div>
        {tm.artName && <Badge tone="neutral">{tm.artName}</Badge>}
      </div>

      {tm.capacity && capacityPct !== null && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontWeight: 700,
                letterSpacing: ".04em",
                textTransform: "uppercase",
                color: "var(--ink-faint)",
                fontSize: 10.5,
              }}
            >
              Capacidade
            </span>
            <span
              className="mono"
              style={{
                fontWeight: 700,
                color: over ? "var(--red-text)" : "var(--ink-muted)",
              }}
            >
              {tm.capacity.actualSp}/{tm.capacity.expectedSp} SP · {capacityPct}
              %
            </span>
          </div>
          <Progress
            height={7}
            tone={over ? "red" : capacityPct >= 90 ? "green" : "amber"}
            value={Math.min(100, capacityPct)}
          />
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 10,
          paddingTop: 14,
          borderTop: "1px solid var(--hairline)",
        }}
      >
        {(
          [
            { k: "Membros", v: tm.memberCount },
            { k: "WIP", v: tm.wip },
            { k: "Velocity", v: tm.velocity ?? "—" },
            {
              k: "Predict.",
              v:
                tm.predictabilityPct !== null
                  ? `${tm.predictabilityPct}%`
                  : "—",
            },
          ] as { k: string; v: number | string }[]
        ).map((s) => (
          <div key={s.k} style={{ textAlign: "center" }}>
            <div
              className="mono"
              style={{
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: "-.02em",
                color: "var(--ink)",
              }}
            >
              {s.v}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--ink-subtle)",
                fontWeight: 600,
                letterSpacing: ".03em",
                marginTop: 1,
              }}
            >
              {s.k}
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}

const chipStyle = (on: boolean): CSSProperties => ({
  fontSize: 11.5,
  fontWeight: 600,
  padding: "5px 10px",
  borderRadius: 99,
  cursor: "pointer",
  border: `1px solid ${on ? "rgba(var(--accent-rgb),.4)" : "var(--hairline-strong)"}`,
  background: on ? "var(--accent-soft)" : "var(--surface)",
  color: on ? "var(--accent-text)" : "var(--ink-muted)",
});

function ArtFilterPopover({
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
      data-team-art-filter
      data-theme={themeName}
      style={{
        position: "fixed",
        top: btnRect.bottom + 8,
        left: Math.max(8, btnRect.right - 240),
        zIndex: 400,
        width: 240,
        background: "var(--surface-3)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: "var(--r-md)",
        boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)",
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
          Filtrar por ART
        </span>
        {selected.size > 0 && (
          <button
            onClick={() => onChange(new Set())}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--accent)",
              background: "none",
              border: "none",
              cursor: "pointer",
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

function TeamsBody() {
  const modal = useModal();
  const [teams, setTeams] = useState<TeamListView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [artFilter, setArtFilter] = useState<Set<string>>(() => new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const btnRef = useRef<HTMLSpanElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    listTeams().then((r) => {
      if (r.ok) {
        setTeams(r.data);
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
          t.closest("[data-team-art-filter]") ||
          t.closest("[data-team-filter-trigger]")
        )
      ) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filterOpen]);

  const totalMembers = teams.reduce((s, t) => s + t.memberCount, 0);
  const totalVelocity = teams.reduce((s, t) => s + (t.velocity ?? 0), 0);
  const predictabilities = teams
    .map((t) => t.predictabilityPct)
    .filter((p): p is number => p !== null);
  const avgPredictability = predictabilities.length
    ? Math.round(
        predictabilities.reduce((a, b) => a + b, 0) / predictabilities.length
      )
    : null;
  const overCapacityCount = teams.filter(
    (t) => t.capacity !== null && t.capacity.actualSp > t.capacity.expectedSp
  ).length;

  const artOptions = Array.from(
    new Map(
      teams
        .filter((t): t is TeamListView & { artId: string; artName: string } =>
          Boolean(t.artId && t.artName)
        )
        .map((t) => [t.artId, { id: t.artId, name: t.artName }])
    ).values()
  );
  const visibleTeams = teams.filter(
    (t) => artFilter.size === 0 || (t.artId && artFilter.has(t.artId))
  );
  const unassignedTeams = teams.filter((t) => t.artId === null);

  return (
    <div className="fade-in">
      <PageHeader
        meta={
          <>
            <Badge icon="users" tone="accent">
              {teams.length} squads · {totalMembers} pessoas
            </Badge>
            {artFilter.size > 0 && (
              <Badge dot tone="amber">
                {visibleTeams.length} visíveis
              </Badge>
            )}
          </>
        }
        subtitle="Squads do portfólio COSMOS. Membros, WIP, velocity, capacidade e predictability consolidados por time."
        title="Times"
      >
        {artOptions.length > 0 && (
          <span
            data-team-filter-trigger
            ref={btnRef}
            style={{ display: "inline-flex" }}
          >
            <Button
              icon="filter"
              onClick={() => setFilterOpen((o) => !o)}
              size="md"
              variant={artFilter.size > 0 ? "primary" : "secondary"}
            >
              Por ART{artFilter.size > 0 ? ` (${artFilter.size})` : ""}
            </Button>
          </span>
        )}
        <Button
          icon="plus"
          onClick={() => modal.open(<NewTeamModal onCreated={load} />)}
          size="md"
          variant="primary"
        >
          Novo time
        </Button>
      </PageHeader>

      {filterOpen && btnRef.current && (
        <ArtFilterPopover
          btnRect={btnRef.current.getBoundingClientRect()}
          onChange={setArtFilter}
          options={artOptions}
          selected={artFilter}
        />
      )}

      {error && <ErrorState />}
      {!(error || loading) && unassignedTeams.length > 0 && (
        <UnassignedTeamsSection onLinked={load} teams={unassignedTeams} />
      )}
      {!(error || loading) && teams.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0,1fr))",
            gap: "var(--gap)",
            marginBottom: "var(--gap)",
          }}
        >
          <KpiCard
            icon="users"
            label="Pessoas no portfólio"
            tone="accent"
            value={totalMembers}
          />
          <KpiCard
            icon="activity"
            label="Velocity somada"
            tone="blue"
            unit="SP"
            value={totalVelocity}
          />
          <KpiCard
            icon="gauge"
            label="Predictability média"
            tone="green"
            unit={avgPredictability !== null ? "%" : undefined}
            value={avgPredictability ?? "—"}
          />
          <KpiCard
            icon="alert"
            label="Times acima da capacidade"
            tone={overCapacityCount > 0 ? "red" : "green"}
            value={overCapacityCount}
          />
        </div>
      )}
      {!(error || loading) && teams.length === 0 && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Nenhum time encontrado.
        </div>
      )}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && teams.length > 0 && visibleTeams.length === 0 && (
        <div
          style={{
            padding: "40px 20px",
            textAlign: "center",
            color: "var(--ink-faint)",
            fontSize: 13,
          }}
        >
          Nenhum time corresponde ao filtro selecionado.
        </div>
      )}
      {!(error || loading) && visibleTeams.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: "var(--gap)",
          }}
        >
          {visibleTeams.map((tm) => (
            <TeamCard key={tm.id} tm={tm} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamsScreen() {
  return (
    <ModalProvider>
      <TeamsBody />
    </ModalProvider>
  );
}
