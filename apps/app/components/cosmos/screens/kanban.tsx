"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  CopilotInsightBar,
  ErrorState,
  PageHeader,
  Progress,
  Skel,
  useAction,
  useNav,
  useThemeName,
} from "@repo/design-system/cosmos/kit";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
// kanban.tsx — Kanban de Épicos. Renders from the real Epic read-model via the
// listEpics server action, so the board shows live tenant data once
// authenticated. Filter popover, drag affordance, NewEpic modal + Copilot bar
// are self-contained.
import { createPortal } from "react-dom";
import { searchEntities } from "@/app/(cosmos)/actions/entity-search";
import {
  createEpic,
  type KanbanEpic,
  listEpics,
  moveEpic,
} from "@/app/(cosmos)/actions/kanban";
import { createTheme } from "@/app/(cosmos)/actions/themes";
import {
  getPortfolioKanbanConfig,
  getViewerRole,
  resetKanbanColumns,
  updateWipLimitAction,
} from "@/app/actions/portfolio-kanban";
import type { KanbanColumnConfig } from "@/app/actions/portfolio-kanban/schema";
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
  TextArea,
  TextInput,
} from "../modal-form";
import { useActionToast } from "../use-action-toast";

// ── board columns (real SAFe lifecycle → 5 columns) ──
type BoardColumnDef = {
  id: KanbanEpic["column"];
  label: string;
  tone: string;
  hex: string;
};
const BOARD_COLUMNS: BoardColumnDef[] = [
  { id: "funnel", label: "Funnel", tone: "neutral", hex: "100,116,139" },
  { id: "analyzing", label: "Analyzing", tone: "accent", hex: "94,106,210" },
  {
    id: "backlog",
    label: "Portfolio Backlog",
    tone: "accent",
    hex: "94,106,210",
  },
  {
    id: "implementing",
    label: "Implementing",
    tone: "accent",
    hex: "94,106,210",
  },
  { id: "done", label: "Done", tone: "green", hex: "22,163,74" },
];

/**
 * A config de WIP é indexada pelo id de ciclo de vida (`PORTFOLIO_BACKLOG`); o
 * board usa o id curto (`backlog`). Sem esta ponte o limite seria lido para uma
 * coluna que não existe no quadro e sumiria em silêncio.
 * REJECTED não tem coluna no board do Cosmos — fica de fora de propósito.
 */
const LIFECYCLE_TO_BOARD_COLUMN: Record<string, string> = {
  FUNNEL: "funnel",
  ANALYZING: "analyzing",
  PORTFOLIO_BACKLOG: "backlog",
  IMPLEMENTING: "implementing",
  DONE: "done",
};

// ── helpers ──
type Priority = "high" | "med" | "low";
const epicPriority = (wsjf: number): Priority =>
  wsjf >= 18 ? "high" : wsjf >= 13 ? "med" : "low";
const PRIORITY_LABEL: Record<Priority, string> = {
  high: "Alta",
  med: "Média",
  low: "Baixa",
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const SPRINT_DATE: Record<string, string> = {
  funnel: "Não planejado",
  analyzing: "PI-26 · S1",
  backlog: "PI-26 · S2",
  implementing: "PI-26 · S3",
  done: "Concluído",
};

// Same formula + rounding as computeEpicWsjf in
// app/(cosmos)/actions/kanban.ts, so the live preview always matches what
// gets persisted. Unweighted — see that file for the Task 16 divergence note.
function computeLiveWsjf(
  bv: number,
  tc: number,
  rr: number,
  js: number
): number {
  return Math.round(((bv + tc + rr) / js) * 100) / 100;
}

const fieldLabelStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
};
const fieldInputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: 10,
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
};

/** Papéis que updateWipLimitAction aceita. Espelha o guard da ação. */
const WIP_CONFIG_ROLES = new Set(["ADMIN", "STE", "RTE"]);

// story-061 — sem esta tela valiam apenas os DEFAULT_PORTFOLIO_COLUMNS:
// updateWipLimitAction e resetKanbanColumns existiam sem chamador, então o
// limite era o mesmo para todo tenant e não havia como afrouxá-lo nem apertá-lo.
function WipConfigModal({
  colunas,
  onSaved,
}: {
  colunas: KanbanColumnConfig[];
  onSaved: () => void;
}) {
  const { close } = useModal();
  // Guarda o texto, não o número: campo vazio precisa ser distinguível de zero.
  const [rascunho, setRascunho] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      colunas.map((c) => [c.id, c.wipLimit ? String(c.wipLimit) : ""])
    )
  );
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    // Só as colunas que mudaram: mandar as cinco a cada save gravaria quatro
    // vezes a mesma config e daria quatro toasts.
    const alteradas = colunas.filter((c) => {
      const atual = c.wipLimit ? String(c.wipLimit) : "";
      return (rascunho[c.id] ?? "") !== atual;
    });

    for (const c of alteradas) {
      const texto = (rascunho[c.id] ?? "").trim();
      const valor = Number(texto);
      // Vazio é "sem limite" (null). Zero seria coluna que não aceita nada —
      // por isso o schema recusa e o campo vazio nunca vira 0.
      const wipLimit = texto === "" || !(valor > 0) ? null : Math.trunc(valor);
      // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
      const res = await useActionToast(
        () => updateWipLimitAction({ columnId: c.id, wipLimit }),
        {
          loading: `Salvando limite de ${c.label}...`,
          success: `Limite de ${c.label} atualizado.`,
          error: (err: string) => `Não foi possível salvar: ${err}`,
        }
      );
      if (!res.ok) {
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    close();
    onSaved();
  };

  const restaurar = async () => {
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => resetKanbanColumns(), {
      loading: "Restaurando limites padrão...",
      success: "Limites restaurados.",
      error: (err: string) => `Não foi possível restaurar: ${err}`,
    });
    if (res.ok) {
      close();
      onSaved();
    }
  };

  return (
    <div
      style={{
        width: 420,
        maxWidth: "92vw",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 18,
        boxShadow: "0 48px 96px -24px rgba(0,0,0,.7)",
        overflow: "hidden",
        padding: 18,
      }}
    >
      <div
        className="display"
        style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}
      >
        Limites de WIP
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 4 }}>
        Coluna no limite para de aceitar épico. Deixe vazio para não limitar.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 14,
        }}
      >
        {colunas.map((c) => (
          <div
            key={c.id}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <label
              htmlFor={`wip-${c.id}`}
              style={{ ...fieldLabelStyle, flex: 1, textTransform: "none" }}
            >
              {c.label}
            </label>
            <input
              aria-label={`Limite de ${c.label}`}
              id={`wip-${c.id}`}
              min={1}
              onChange={(e) =>
                setRascunho((prev) => ({ ...prev, [c.id]: e.target.value }))
              }
              placeholder="sem limite"
              style={{ ...fieldInputStyle, width: 110 }}
              type="number"
              value={rascunho[c.id] ?? ""}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 16,
        }}
      >
        <Button onClick={restaurar} size="sm" variant="secondary">
          Restaurar padrão
        </Button>
        <Button onClick={salvar} size="sm" variant="primary">
          Salvar limites
        </Button>
      </div>
    </div>
  );
}

// Epic não tem coluna de cor no schema — o accent é o realce do cabeçalho e do
// preview, não um atributo que vai ser gravado.
const EPIC_TONE = "accent";

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

function NewEpicModal({
  col,
  onCreated,
}: {
  col?: KanbanEpic["column"];
  onCreated?: () => void;
}) {
  const { close } = useModal();
  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [bv, setBv] = useState(5);
  const [tc, setTc] = useState(5);
  const [rr, setRr] = useState(5);
  const [js, setJs] = useState(5);
  // As quatro dimensões são opcionais na action, e o slider sempre tem um
  // valor: sem esta trava um épico que ninguém pontuou nasceria com o WSJF do
  // valor inicial, que é uma pontuação inventada.
  const [wsjfDefinido, setWsjfDefinido] = useState(false);
  /** Pontuar qualquer dimensão tira o WSJF do estado "ninguém mexeu". */
  const pontuar = (set: (v: number) => void) => (v: number) => {
    setWsjfDefinido(true);
    set(v);
  };
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const { data: temas } = useAction(() => searchEntities("theme", ""), []);
  const themeItems = temas ?? [];
  // A carga inicial só alimenta o rótulo do chip: searchEntities corta em 10,
  // e filtrar essa fatia localmente faria o campo negar tema que existe.
  // Estável por useCallback — o efeito de busca tem onSearch nas dependências.
  const buscarTemas = useCallback(async (q: string) => {
    const r = await searchEntities("theme", q);
    return r.ok ? r.data : [];
  }, []);
  // Criar o tema sem sair daqui: épico sem tema é épico órfão no portfólio, e
  // mandar a pessoa abrir a tela de temas custaria o formulário já preenchido.
  const criarTema = async (rascunho: Record<string, string>) => {
    const titulo = (rascunho.title ?? "").trim();
    if (!titulo) {
      return null;
    }
    const res = await createTheme({ title: titulo });
    // createTheme devolve só o id — o rótulo do chip vem do que foi digitado.
    return res.ok ? { id: res.data.id, label: titulo } : null;
  };

  const tema = themeItems.find((t) => t.id === themeId);
  const colDef = BOARD_COLUMNS.find((c) => c.id === col);
  const colLabel = colDef?.label ?? "Funnel";
  const wsjf = wsjfDefinido ? computeLiveWsjf(bv, tc, rr, js) : null;

  // Mexer num slider é o que declara "este épico é pontuado" — e também o que
  const create = async () => {
    if (!title.trim() || saving) {
      return;
    }
    setSaving(true);
    const payload: Parameters<typeof createEpic>[0] = {
      title: title.trim(),
      column: col ?? "funnel",
      ...(hypothesis.trim() ? { hypothesis: hypothesis.trim() } : {}),
      ...(themeId ? { strategicThemeId: themeId } : {}),
      ...(wsjfDefinido ? { bv, tc, rr, js } : {}),
    };
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => createEpic(payload), {
      loading: "Criando épico...",
      success: "Épico criado.",
      error: (err: string) => `Não foi possível criar o épico: ${err}`,
    });
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
                  {saving ? "Criando..." : "Criar épico"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="flag" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Épico de portfólio — hipótese de negócio, tema estratégico e WSJF"
        title="Novo Épico"
        tone={EPIC_TONE}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${EPIC_TONE}-rgb),.25)`,
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
                    background: `var(--${EPIC_TONE})`,
                    borderRadius: 99,
                    height: 8,
                    width: 8,
                  }}
                />
                <span
                  className="mono"
                  style={{ color: "var(--ink-faint)", fontSize: 10.5 }}
                >
                  {colLabel}
                </span>
              </div>
              <div
                className="display"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  marginBottom: 14,
                }}
              >
                {title || "Título do épico"}
              </div>

              <div style={previewLabelStyle}>WSJF</div>
              <div
                className="mono"
                style={{
                  color: `var(--${EPIC_TONE}-text)`,
                  fontSize: 30,
                  fontWeight: 700,
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {wsjf === null ? "—" : wsjf.toFixed(2)}
              </div>
              <div
                style={{
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  marginBottom: 14,
                }}
              >
                {wsjf === null
                  ? "Ajuste os sliders para pontuar este épico"
                  : `(${bv} + ${tc} + ${rr}) / ${js}`}
              </div>

              <div style={previewLabelStyle}>Hipótese</div>
              <div
                style={{
                  color: "var(--ink-muted)",
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  marginBottom: 14,
                }}
              >
                {hypothesis ||
                  "A hipótese de negócio aparece aqui conforme você escreve."}
              </div>

              {tema ? (
                <div
                  style={{
                    alignItems: "center",
                    borderTop: "1px solid var(--hairline)",
                    display: "flex",
                    gap: 8,
                    paddingTop: 12,
                  }}
                >
                  <Icon
                    name="target"
                    size={13}
                    style={{ color: `var(--${EPIC_TONE}-text)` }}
                  />
                  <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                    {tema.label}
                  </span>
                </div>
              ) : (
                <Badge tone="neutral">Sem tema estratégico</Badge>
              )}
            </div>
          }
        >
          <FormField label="Título do épico" required>
            <TextInput
              onChange={setTitle}
              placeholder="ex: Antifraude em tempo real"
              required
              value={title}
            />
          </FormField>

          <FormField
            hint="Sempre visível no preview — é o campo mais importante do épico"
            label="Hipótese de negócio"
          >
            <TextArea
              onChange={setHypothesis}
              placeholder="Se entregarmos [capacidade], então [resultado de negócio], medido por [indicador]."
              rows={3}
              value={hypothesis}
            />
          </FormField>

          <EntityLinkField
            hint="Vincula este épico a uma aposta de investimento do portfólio"
            items={themeItems}
            label="Tema estratégico"
            onChange={(v) => setThemeId(v as string | null)}
            onSearch={buscarTemas}
            placeholder="Buscar um tema existente..."
            quickCreate={{
              campos: [
                {
                  key: "title",
                  label: "Título do tema",
                  placeholder: "ex: Expansão LATAM",
                },
              ],
              inicial: { title: "" },
              label: "+ Criar novo tema",
              onCreate: criarTema,
            }}
            tone={EPIC_TONE}
            value={themeId}
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
              WSJF (opcional)
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
                onChange={pontuar(setBv)}
                value={bv}
              />
              <MiniSlider
                label="Time Criticality"
                max={10}
                min={0}
                onChange={pontuar(setTc)}
                value={tc}
              />
              <MiniSlider
                label="Risco/Oportunidade"
                max={10}
                min={0}
                onChange={pontuar(setRr)}
                value={rr}
              />
              <MiniSlider
                label="Job Size"
                max={10}
                min={1}
                onChange={pontuar(setJs)}
                value={js}
              />
            </div>
          </div>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}

// ── EpicCard ──
function EpicCard({
  epic,
  onDragStart,
  index = 0,
}: {
  epic: KanbanEpic;
  onDragStart: (id: string) => void;
  index?: number;
}) {
  const { navigate } = useNav();
  const tone = epic.artTone || "accent";
  const priority = epicPriority(epic.wsjf);
  const priTone =
    priority === "high" ? "red" : priority === "med" ? "amber" : "green";
  const priLabel = PRIORITY_LABEL[priority];
  const extraCount = Math.max(0, Math.round(epic.size / 18));
  const isActive = epic.column === "implementing";
  const gradientOverlay =
    isActive || epic.hot
      ? `linear-gradient(135deg, rgba(var(--${tone}-rgb),.09) 0%, rgba(var(--accent-rgb),.05) 100%)`
      : "none";

  return (
    <div
      className="lift card-in"
      draggable
      onClick={() => navigate("epic", epic.id)}
      onDragStart={() => onDragStart(epic.id)}
      style={{
        animationDelay: `${Math.min(index, 8) * 40}ms`,
        position: "relative",
        borderRadius: 14,
        padding: "14px 15px 13px",
        cursor: "grab",
        background: "var(--surface)",
        backgroundImage: gradientOverlay,
        border: `1px solid ${epic.hot ? `rgba(var(--${tone}-rgb),.38)` : "var(--hairline)"}`,
        boxShadow: epic.hot
          ? `0 4px 18px -8px rgba(var(--${tone}-rgb),.35), var(--card-shadow)`
          : "var(--card-shadow)",
        overflow: "hidden",
        transition: "transform .15s ease, box-shadow .15s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderRadius: "14px 14px 0 0",
          background: `linear-gradient(90deg, transparent, rgba(var(--${tone}-rgb),.55), transparent)`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 9,
          marginTop: 2,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11.5,
            color: "var(--ink-subtle)",
            fontWeight: 500,
          }}
        >
          <Icon
            name="calendar"
            size={12}
            style={{ color: "var(--ink-faint)" }}
          />
          {SPRINT_DATE[epic.column]}
        </span>
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11.5,
            fontWeight: 700,
            color: `var(--${priTone}-text)`,
            background: `var(--${priTone}-soft)`,
            border: `1px solid rgba(var(--${priTone}-rgb),.28)`,
            borderRadius: 99,
            padding: "2px 9px",
          }}
        >
          {priLabel}
        </span>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--ink)",
          lineHeight: 1.35,
          letterSpacing: "-.015em",
          marginBottom: 11,
          textWrap: "pretty",
          minHeight: 38,
        }}
      >
        {epic.title}
      </div>

      {epic.progress > 0 && epic.progress < 100 && (
        <div style={{ marginBottom: 11 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 5,
              fontSize: 10.5,
            }}
          >
            <span
              style={{
                color: "var(--ink-faint)",
                fontWeight: 600,
                letterSpacing: ".04em",
              }}
            >
              PROGRESSO
            </span>
            <span
              className="mono"
              style={{ color: "var(--ink-subtle)", fontWeight: 700 }}
            >
              {epic.progress}%
            </span>
          </div>
          <Progress height={5} tone={tone as never} value={epic.progress} />
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingTop: 10,
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {epic.owner && (
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 99,
                display: "grid",
                placeItems: "center",
                fontSize: 9.5,
                fontWeight: 800,
                background: `var(--${tone}-soft)`,
                color: `var(--${tone}-text)`,
                border: "2px solid var(--surface)",
                boxShadow: `0 0 0 1px rgba(var(--${tone}-rgb),.3)`,
              }}
              title={epic.owner}
            >
              {initials(epic.owner)}
            </span>
          )}
          {extraCount > 0 && (
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 99,
                display: "grid",
                placeItems: "center",
                fontSize: 9,
                fontWeight: 800,
                background: "var(--surface-3)",
                color: "var(--ink-muted)",
                border: "2px solid var(--surface)",
                marginLeft: -7,
              }}
            >
              +{extraCount}
            </span>
          )}
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          {epic.art && (
            <span
              style={{
                fontSize: 11.5,
                color: "var(--ink-subtle)",
                fontWeight: 600,
              }}
            >
              #{epic.art}
            </span>
          )}
          {epic.theme && (
            <span
              style={{
                fontSize: 11.5,
                color: "var(--ink-faint)",
                fontWeight: 500,
              }}
            >
              #{epic.theme.split(" ")[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AddEpicRow({ onAdd }: { onAdd: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      className="btn"
      onClick={onAdd}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "9px 12px",
        borderRadius: 10,
        border: `1px dashed ${hov ? "var(--accent)" : "var(--hairline-strong)"}`,
        background: hov ? "var(--accent-soft)" : "transparent",
        color: hov ? "var(--accent-text)" : "var(--ink-faint)",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all .15s ease",
      }}
    >
      <Icon name="plus" size={14} /> Adicionar épico
    </button>
  );
}

function KanbanColumn({
  col,
  items,
  wipLimit,
  onDragStart,
  onDropEpic,
  onCreated,
}: {
  col: BoardColumnDef;
  items: KanbanEpic[];
  /** null = coluna sem limite configurado. */
  wipLimit: number | null;
  onDragStart: (id: string) => void;
  onDropEpic: (col: KanbanEpic["column"]) => void;
  onCreated: () => void;
}) {
  const modal = useModal();
  const [over, setOver] = useState(false);
  // story-061 — no Portfolio Kanban do SAFe, coluna no limite é sinal de parar
  // de puxar. O servidor recusa a movimentação (enforceWipLimit); aqui o número
  // aparece antes de alguém tentar, para o limite ser um sinal e não um erro.
  const noLimite = wipLimit !== null && items.length >= wipLimit;
  const colTone = noLimite
    ? "red"
    : col.tone === "neutral"
      ? "accent"
      : col.tone;
  return (
    <div
      onDragLeave={() => setOver(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDropEpic(col.id);
      }}
      style={{
        flexShrink: 0,
        width: 290,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-2)",
        borderRadius: 16,
        border: `1px solid ${over ? `rgb(${col.hex})` : "var(--hairline)"}`,
        boxShadow: over ? `0 0 0 2px rgba(${col.hex},.25)` : "none",
        maxHeight: "100%",
        overflow: "hidden",
        transition: "border-color .12s, box-shadow .12s",
      }}
    >
      <div
        style={{
          padding: "14px 14px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 99,
            flexShrink: 0,
            background: `rgb(${col.hex})`,
            boxShadow: `0 0 8px rgba(${col.hex},.7)`,
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink)",
            letterSpacing: "-.01em",
          }}
        >
          {col.label}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: `var(--${colTone}-text)`,
            background: `var(--${colTone}-soft)`,
            borderRadius: 99,
            padding: "1px 8px",
            border: `1px solid rgba(var(--${colTone}-rgb),.25)`,
          }}
          title={
            wipLimit === null
              ? undefined
              : `Limite de WIP: ${items.length} de ${wipLimit}`
          }
        >
          {wipLimit === null ? items.length : `${items.length}/${wipLimit}`}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          <button
            className="btn navitem"
            onClick={() =>
              modal.open(<NewEpicModal col={col.id} onCreated={onCreated} />)
            }
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--ink-faint)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            title="Novo épico"
          >
            <Icon name="plus" size={15} />
          </button>
          <button
            className="btn navitem"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--ink-faint)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            title="Ordenar"
          >
            <Icon name="more" size={15} />
          </button>
        </div>
      </div>
      <div
        className="scroll"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 9,
          padding: "11px 11px 4px",
          overflowY: "auto",
          flex: 1,
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              fontSize: 12.5,
              color: "var(--ink-faint)",
            }}
          >
            Vazio
          </div>
        ) : (
          items.map((e, i) => (
            <EpicCard epic={e} index={i} key={e.id} onDragStart={onDragStart} />
          ))
        )}
      </div>
      <div style={{ padding: "8px 11px 12px" }}>
        <AddEpicRow
          onAdd={() =>
            modal.open(<NewEpicModal col={col.id} onCreated={onCreated} />)
          }
        />
      </div>
    </div>
  );
}

// ── filters ──
type Filters = {
  arts: Set<string>;
  themes: Set<string>;
  owners: Set<string>;
  hotOnly: boolean;
  minWsjf: number;
};
function useKanbanFilters() {
  const [filters, setFilters] = useState<Filters>({
    arts: new Set(),
    themes: new Set(),
    owners: new Set(),
    hotOnly: false,
    minWsjf: 0,
  });
  const activeCount =
    filters.arts.size +
    filters.themes.size +
    filters.owners.size +
    (filters.hotOnly ? 1 : 0) +
    (filters.minWsjf > 0 ? 1 : 0);
  const matches = (e: KanbanEpic) => {
    if (filters.arts.size && !(e.art && filters.arts.has(e.art))) {
      return false;
    }
    if (filters.themes.size && !(e.theme && filters.themes.has(e.theme))) {
      return false;
    }
    if (filters.owners.size && !filters.owners.has(e.owner)) {
      return false;
    }
    if (filters.hotOnly && !e.hot) {
      return false;
    }
    if (e.wsjf < filters.minWsjf) {
      return false;
    }
    return true;
  };
  return { filters, setFilters, activeCount, matches };
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

function KanbanFilterPopover({
  epics,
  filters,
  onChange,
  onClose,
  btnRect,
}: {
  epics: KanbanEpic[];
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
  btnRect: DOMRect;
}) {
  const themeName = useThemeName();
  const artOptions = [
    ...new Set(epics.map((e) => e.art).filter(Boolean) as string[]),
  ];
  const themeOptions = [
    ...new Set(epics.map((e) => e.theme).filter(Boolean) as string[]),
  ];
  const ownerOptions = [...new Set(epics.map((e) => e.owner).filter(Boolean))];
  const toggle = (key: "arts" | "themes" | "owners", val: string) => {
    const set = new Set(filters[key]);
    set.has(val) ? set.delete(val) : set.add(val);
    onChange({ ...filters, [key]: set });
  };

  return createPortal(
    <div
      data-kanban-filter
      data-theme={themeName}
      style={{
        position: "fixed",
        top: btnRect.bottom + 8,
        left: Math.max(8, btnRect.right - 320),
        zIndex: 400,
        width: 320,
        background: "var(--surface-3)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: "var(--r-md)",
        boxShadow: "0 16px 40px -12px rgba(0,0,0,.45)",
        padding: 16,
        maxHeight: 480,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          Filtros
        </span>
        <button
          onClick={() =>
            onChange({
              arts: new Set(),
              themes: new Set(),
              owners: new Set(),
              hotOnly: false,
              minWsjf: 0,
            })
          }
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Limpar tudo
        </button>
      </div>
      {(
        [
          ["ART", "arts", artOptions],
          ["Tema estratégico", "themes", themeOptions],
          ["Owner", "owners", ownerOptions],
        ] as const
      ).map(([label, key, opts]) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              marginBottom: 7,
            }}
          >
            {label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {opts.map((o) => (
              <button
                key={o}
                onClick={() => toggle(key, o)}
                style={chipStyle(filters[key].has(o))}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".05em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
            marginBottom: 7,
          }}
        >
          <span>WSJF mínimo</span>
          <span className="mono" style={{ color: "var(--accent-text)" }}>
            {filters.minWsjf}
          </span>
        </div>
        <input
          max={25}
          min={0}
          onChange={(e) =>
            onChange({ ...filters, minWsjf: Number(e.target.value) })
          }
          step={1}
          style={{
            width: "100%",
            accentColor: "var(--accent)",
            cursor: "pointer",
          }}
          type="range"
          value={filters.minWsjf}
        />
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          marginBottom: 14,
        }}
      >
        <input
          checked={filters.hotOnly}
          onChange={(e) => onChange({ ...filters, hotOnly: e.target.checked })}
          style={{ accentColor: "var(--accent)", cursor: "pointer" }}
          type="checkbox"
        />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
          Somente itens quentes 🔥
        </span>
      </label>
      <Button full onClick={onClose} size="sm" variant="secondary">
        Fechar
      </Button>
    </div>,
    document.body
  );
}

// ── Screen ──
function KanbanBody() {
  const { navigate } = useNav();
  const modal = useModal();
  const [epics, setEpics] = useState<KanbanEpic[]>([]);
  const [colunas, setColunas] = useState<KanbanColumnConfig[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const wipLimits: Record<string, number | null> = Object.fromEntries(
    colunas.flatMap((c) => {
      const board = LIFECYCLE_TO_BOARD_COLUMN[c.id];
      return board ? [[board, c.wipLimit ?? null]] : [];
    })
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { filters, setFilters, activeCount, matches } = useKanbanFilters();
  const [filterOpen, setFilterOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dragId = useRef<string | null>(null);

  const moveTo = async (column: KanbanEpic["column"]) => {
    const id = dragId.current;
    dragId.current = null;
    if (!id) {
      return;
    }
    const current = epics.find((e) => e.id === id);
    if (!current || current.column === column) {
      return;
    }
    const prevColumn = current.column;
    const order = epics.filter((e) => e.column === column).length;
    // optimistic
    setEpics((prev) => prev.map((e) => (e.id === id ? { ...e, column } : e)));
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => moveEpic({ id, column, order }), {
      loading: "Movendo épico...",
      success: "Épico movido.",
      error: (err: string) => `Não foi possível mover o épico: ${err}`,
    });
    if (!res.ok) {
      setEpics((prev) =>
        prev.map((e) => (e.id === id ? { ...e, column: prevColumn } : e))
      ); // revert
    }
  };

  const load = useCallback(async () => {
    const res = await listEpics();
    if (res.ok) {
      setEpics(res.data);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // story-061 — a config vive em Tenant.metadata e é a MESMA que o servidor lê
  // em enforceWipLimit. Ler aqui é o que evita a tela prometer um movimento que
  // a ação vai recusar. Falha na leitura ⇒ board sem limite exibido, nunca com
  // limite inventado: o servidor segue sendo a autoridade.
  const loadConfig = useCallback(async () => {
    const res = await getPortfolioKanbanConfig();
    if (res.ok) {
      setColunas(res.data.columns);
    }
  }, []);
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // O papel vem do servidor, não de palpite do cliente: updateWipLimitAction já
  // exige ADMIN/STE/RTE, e oferecer o controle a quem ela recusaria seria
  // prometer um FORBIDDEN.
  useEffect(() => {
    getViewerRole().then((res) => {
      if (res.ok) {
        setViewerRole(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (!filterOpen) {
      return;
    }
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        !(
          t.closest("[data-kanban-filter]") ||
          t.closest("[data-kanban-filter-trigger]")
        )
      ) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filterOpen]);

  const visible = epics.filter(matches);

  // real hot/high-WSJF epics still sitting in the earliest board columns —
  // the only thing the Copilot bar is allowed to claim it "detected".
  const hotHighWsjfEarly = epics
    .filter(
      (e) =>
        (e.column === "funnel" || e.column === "analyzing") &&
        epicPriority(e.wsjf) === "high"
    )
    .sort((a, b) => b.wsjf - a.wsjf);

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <PageHeader
        eyebrow="Portfolio · Lifecycle SAFe"
        meta={
          <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
            <strong style={{ color: "var(--ink)" }}>{visible.length}</strong> de{" "}
            {epics.length} épicos{activeCount > 0 ? " (filtrado)" : ""}
          </span>
        }
        subtitle="Arraste épicos pelo funil de portfólio — do Funnel ao Done — com priorização WSJF e gates de governança."
        title="Kanban de Épicos"
      >
        {viewerRole !== null &&
          WIP_CONFIG_ROLES.has(viewerRole) &&
          colunas.length > 0 && (
            <Button
              onClick={() =>
                modal.open(
                  <WipConfigModal colunas={colunas} onSaved={loadConfig} />
                )
              }
              size="sm"
              variant="secondary"
            >
              Configurar limites de WIP
            </Button>
          )}
        <button
          className="btn"
          data-kanban-filter-trigger
          onClick={() => setFilterOpen((o) => !o)}
          ref={btnRef}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 15px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline-strong)",
            background: "var(--surface)",
            color: "var(--ink)",
            cursor: "pointer",
          }}
        >
          <Icon name="filter" size={16} strokeWidth={2.1} /> Filtros
          {activeCount > 0 && (
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent-fg)",
                background: "var(--accent)",
                borderRadius: 99,
                padding: "1px 7px",
              }}
            >
              {activeCount}
            </span>
          )}
        </button>
        <Button
          icon="plus"
          onClick={() => modal.open(<NewEpicModal onCreated={load} />)}
          variant="primary"
        >
          Novo Épico
        </Button>
      </PageHeader>

      {filterOpen && btnRef.current && (
        <KanbanFilterPopover
          btnRect={btnRef.current.getBoundingClientRect()}
          epics={epics}
          filters={filters}
          onChange={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {!(loading || error) && hotHighWsjfEarly.length > 0 && (
        <CopilotInsightBar
          onAction={() => navigate("epic", hotHighWsjfEarly[0].id)}
        >
          <strong style={{ color: "var(--accent-text)", fontWeight: 700 }}>
            ORBIT
          </strong>{" "}
          detectou{" "}
          {hotHighWsjfEarly.length === 1
            ? "1 épico"
            : `${hotHighWsjfEarly.length} épicos`}{" "}
          com WSJF alto ainda em Funnel/Analyzing — priorize{" "}
          {hotHighWsjfEarly.slice(0, 2).map((e, i) => (
            <span key={e.id}>
              {i > 0 && " e "}
              <strong style={{ color: "var(--ink)" }}>{e.title}</strong>
            </span>
          ))}{" "}
          no próximo refinamento.
        </CopilotInsightBar>
      )}

      {error && (
        <ErrorState message="Não foi possível carregar os épicos do portfólio." />
      )}

      {!(loading || error) && epics.length === 0 && (
        <EmptyState
          action={{
            label: "Novo Épico",
            onClick: () => modal.open(<NewEpicModal onCreated={load} />),
          }}
          description="Nenhum épico foi registrado neste tenant ainda."
          icon="kanban"
          title="Nenhum épico no portfólio"
        />
      )}

      {!error && (loading || epics.length > 0) && (
        <div
          className="scroll"
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            overflowY: "hidden",
            flex: 1,
            paddingBottom: 8,
            minHeight: 420,
          }}
        >
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flexShrink: 0,
                    width: 290,
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                    background: "var(--surface-2)",
                    borderRadius: 16,
                    border: "1px solid var(--hairline)",
                    padding: 12,
                  }}
                >
                  <Skel h={16} w="60%" />
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skel h={90} key={j} r={14} />
                  ))}
                </div>
              ))
            : BOARD_COLUMNS.map((col) => (
                <KanbanColumn
                  col={col}
                  items={visible.filter((e) => e.column === col.id)}
                  key={col.id}
                  onCreated={load}
                  onDragStart={(id) => {
                    dragId.current = id;
                  }}
                  onDropEpic={moveTo}
                  wipLimit={wipLimits[col.id] ?? null}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export default function KanbanScreen() {
  return (
    <ModalProvider>
      <KanbanBody />
    </ModalProvider>
  );
}
