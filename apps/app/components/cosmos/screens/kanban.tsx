"use client";

import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
// kanban.tsx — Kanban de Épicos. Renders from the real Epic read-model via the
// listEpics server action, so the board shows live tenant data once
// authenticated. Filter popover, drag affordance, NewEpic modal + Copilot bar
// are self-contained.
import { createPortal } from "react-dom";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import {
  createEpic,
  type KanbanEpic,
  listEpics,
  moveEpic,
} from "@/app/(cosmos)/actions/kanban";
import { EntityLinkField } from "../entity-link-field";
import { Icon } from "../icons";
import {
  Button,
  PageHeader,
  Progress,
  Skel,
  useNav,
  useThemeName,
} from "../kit";
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

// static fallback (no session + no seed) so the board never renders empty in dev
const MOCK: KanbanEpic[] = [
  {
    id: "EP-097",
    title: "Antifraude em tempo real (ML)",
    column: "analyzing",
    theme: "Confiança & Risco",
    art: "data",
    artTone: "amber",
    owner: "Letícia Rocha",
    wsjf: 19.6,
    size: 55,
    progress: 6,
    hot: true,
  },
  {
    id: "EP-076",
    title: "Migração core para multi-tenant",
    column: "backlog",
    theme: "Modernização da Plataforma",
    art: "plat",
    artTone: "purple",
    owner: "Helena Souza",
    wsjf: 22.4,
    size: 89,
    progress: 0,
    hot: true,
  },
  {
    id: "EP-061",
    title: "SSO & SCIM Enterprise",
    column: "implementing",
    theme: "Enterprise Ready",
    art: "plat",
    artTone: "purple",
    owner: "Rafael Teixeira",
    wsjf: 18.2,
    size: 34,
    progress: 64,
    hot: false,
  },
  {
    id: "EP-042",
    title: "FinOps guardrails por ART",
    column: "done",
    theme: "Eficiência de Custo",
    art: "data",
    artTone: "amber",
    owner: "Letícia Rocha",
    wsjf: 9.8,
    size: 26,
    progress: 100,
    hot: false,
  },
];

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

// ── local modal ──
const ModalCtx = createContext<{
  open: (n: ReactNode) => void;
  close: () => void;
}>({ open: () => {}, close: () => {} });
const useModal = () => useContext(ModalCtx);

function ModalHost({
  node,
  onClose,
}: {
  node: ReactNode;
  onClose: () => void;
}) {
  if (!node) {
    return null;
  }
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(4,6,14,.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 90,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{node}</div>
    </div>,
    document.body
  );
}

// Parses a WSJF slider's raw text value into a finite number, or undefined
// when the field is untouched/blank — an untouched field must never be
// coerced into 0 and sent to the server.
function parseWsjfField(raw: string): number | undefined {
  if (raw.trim() === "") {
    return;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

// Same formula + rounding as computeEpicWsjf in
// app/(cosmos)/actions/kanban.ts, so the live preview always matches what
// gets persisted. Unweighted — see that file for the Task 16 divergence note.
function computeLiveWsjf(
  bv?: number,
  tc?: number,
  rr?: number,
  js?: number
): number | null {
  if (
    bv === undefined ||
    tc === undefined ||
    rr === undefined ||
    js === undefined ||
    js <= 0
  ) {
    return null;
  }
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
  const [bv, setBv] = useState("");
  const [tc, setTc] = useState("");
  const [rr, setRr] = useState("");
  const [js, setJs] = useState("");
  const [theme, setTheme] = useState<EntityOption | null>(null);
  const [saving, setSaving] = useState(false);
  const colDef = BOARD_COLUMNS.find((c) => c.id === col);
  const liveWsjf = computeLiveWsjf(
    parseWsjfField(bv),
    parseWsjfField(tc),
    parseWsjfField(rr),
    parseWsjfField(js)
  );
  const create = async () => {
    if (!title.trim() || saving) {
      return;
    }
    setSaving(true);
    const payload: Parameters<typeof createEpic>[0] = {
      title: title.trim(),
      column: col ?? "funnel",
      ...(hypothesis.trim() ? { hypothesis: hypothesis.trim() } : {}),
      ...(theme ? { strategicThemeId: theme.id } : {}),
      ...(parseWsjfField(bv) !== undefined ? { bv: parseWsjfField(bv) } : {}),
      ...(parseWsjfField(tc) !== undefined ? { tc: parseWsjfField(tc) } : {}),
      ...(parseWsjfField(rr) !== undefined ? { rr: parseWsjfField(rr) } : {}),
      ...(parseWsjfField(js) !== undefined ? { js: parseWsjfField(js) } : {}),
    };
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => createEpic(payload), {
      loading: "Criando épico...",
      success: "Épico criado.",
      error: (err: string) => `Não foi possível criar o épico: ${err}`,
    });
    setSaving(false);
    close();
    if (res.ok) {
      onCreated?.();
    }
  };
  return (
    <div
      style={{
        width: 460,
        maxWidth: "92vw",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 18,
        boxShadow: "0 48px 96px -24px rgba(0,0,0,.7)",
        overflow: "hidden",
        animation: "cosmos-fadeIn .18s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 18px",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "rgba(var(--accent-rgb),.14)",
            border: "1px solid rgba(var(--accent-rgb),.25)",
            color: "var(--accent-text)",
          }}
        >
          <Icon name="plus" size={16} strokeWidth={2.4} />
        </span>
        <div style={{ flex: 1 }}>
          <div
            className="display"
            style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}
          >
            Novo Épico
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
            {colDef ? `Coluna: ${colDef.label}` : "Portfolio Backlog"}
          </div>
        </div>
        <button
          className="btn navitem"
          onClick={close}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "var(--ink-faint)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <div
        style={{
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <label
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: ".04em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          Título do épico
        </label>
        <input
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              create();
            }
          }}
          placeholder="Ex: Antifraude em tempo real…"
          style={{
            padding: "10px 12px",
            fontSize: 14,
            borderRadius: 10,
            border: "1px solid var(--hairline-strong)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontFamily: "inherit",
            outline: "none",
          }}
          value={title}
        />

        <label htmlFor="new-epic-hypothesis" style={fieldLabelStyle}>
          Hipótese de negócio
        </label>
        <textarea
          id="new-epic-hypothesis"
          maxLength={2000}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder="Acreditamos que… resultará em… medido por…"
          rows={3}
          style={{
            ...fieldInputStyle,
            resize: "vertical",
            fontFamily: "inherit",
          }}
          value={hypothesis}
        />

        <EntityLinkField
          kind="theme"
          label="Tema estratégico"
          onChange={setTheme}
          value={theme}
        />

        <div>
          <span style={fieldLabelStyle}>WSJF (opcional)</span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: 8,
              marginTop: 6,
            }}
          >
            <div>
              <label htmlFor="new-epic-bv" style={fieldLabelStyle}>
                BV
              </label>
              <input
                id="new-epic-bv"
                max={10}
                min={0}
                onChange={(e) => setBv(e.target.value)}
                style={{ ...fieldInputStyle, marginTop: 4 }}
                type="number"
                value={bv}
              />
            </div>
            <div>
              <label htmlFor="new-epic-tc" style={fieldLabelStyle}>
                TC
              </label>
              <input
                id="new-epic-tc"
                max={10}
                min={0}
                onChange={(e) => setTc(e.target.value)}
                style={{ ...fieldInputStyle, marginTop: 4 }}
                type="number"
                value={tc}
              />
            </div>
            <div>
              <label htmlFor="new-epic-rr" style={fieldLabelStyle}>
                RR
              </label>
              <input
                id="new-epic-rr"
                max={10}
                min={0}
                onChange={(e) => setRr(e.target.value)}
                style={{ ...fieldInputStyle, marginTop: 4 }}
                type="number"
                value={rr}
              />
            </div>
            <div>
              <label htmlFor="new-epic-js" style={fieldLabelStyle}>
                JS
              </label>
              <input
                id="new-epic-js"
                max={10}
                min={1}
                onChange={(e) => setJs(e.target.value)}
                style={{ ...fieldInputStyle, marginTop: 4 }}
                type="number"
                value={js}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 10,
              background: "var(--accent-soft)",
              border: "1px solid rgba(var(--accent-rgb),.25)",
            }}
          >
            <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
              Score WSJF
            </span>
            <span
              className="mono"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--accent-text)",
              }}
            >
              {liveWsjf === null ? "—" : liveWsjf.toFixed(2)}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        >
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button icon="check" onClick={create} size="sm" variant="primary">
            {saving ? "Criando…" : "Criar épico"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CopilotInsightBar() {
  return (
    <div
      className="ai-shimmer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 16px",
        marginBottom: 18,
        borderRadius: "var(--r-lg)",
        border: "1px solid rgba(var(--accent-rgb),.25)",
        background: "var(--accent-soft)",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "rgba(var(--accent-rgb),.16)",
          border: "1px solid rgba(var(--accent-rgb),.28)",
          color: "var(--accent-text)",
          flexShrink: 0,
        }}
      >
        <Icon name="sparkles" size={16} />
      </span>
      <span
        style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.45 }}
      >
        <strong style={{ color: "var(--accent-text)", fontWeight: 700 }}>
          ORBIT
        </strong>{" "}
        detectou épicos quentes com WSJF alto ainda em Funnel/Analyzing —
        priorize <strong style={{ color: "var(--ink)" }}>EP-097</strong> e{" "}
        <strong style={{ color: "var(--ink)" }}>EP-076</strong> no próximo
        refinamento.
      </span>
      <Button
        iconRight="arrowRight"
        size="sm"
        style={{ marginLeft: "auto", color: "var(--accent-text)" }}
        variant="ghost"
      >
        Revisar
      </Button>
    </div>
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
      onClick={() => {
        // MOCK fallback ids (e.g. "EP-097") aren't real epic ids — never
        // link to a detail route that can't resolve.
        if (!epic.id.startsWith("EP-")) {
          navigate("epic", epic.id);
        }
      }}
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
  onDragStart,
  onDropEpic,
  onCreated,
}: {
  col: BoardColumnDef;
  items: KanbanEpic[];
  onDragStart: (id: string) => void;
  onDropEpic: (col: KanbanEpic["column"]) => void;
  onCreated: () => void;
}) {
  const modal = useModal();
  const [over, setOver] = useState(false);
  const colTone = col.tone === "neutral" ? "accent" : col.tone;
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
        >
          {items.length}
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
export default function KanbanScreen() {
  const [epics, setEpics] = useState<KanbanEpic[]>(MOCK);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "mock">("mock");
  const { filters, setFilters, activeCount, matches } = useKanbanFilters();
  const [filterOpen, setFilterOpen] = useState(false);
  const [modalNode, setModalNode] = useState<ReactNode>(null);
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
      setSource("live");
    } else {
      setSource("mock");
    }
    setLoading(false);
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
  const modal = { open: setModalNode, close: () => setModalNode(null) };

  return (
    <ModalCtx.Provider value={modal}>
      <div
        className="fade-in"
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <PageHeader
          eyebrow="Portfolio · Lifecycle SAFe"
          meta={
            <span style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>
              <strong style={{ color: "var(--ink)" }}>{visible.length}</strong>{" "}
              de {epics.length} épicos{activeCount > 0 ? " (filtrado)" : ""} ·
              fonte:{" "}
              <span
                className="mono"
                style={{
                  color:
                    source === "live"
                      ? "var(--green-text)"
                      : "var(--amber-text)",
                }}
              >
                {source}
              </span>
            </span>
          }
          subtitle="Arraste épicos pelo funil de portfólio — do Funnel ao Done — com priorização WSJF e gates de governança."
          title="Kanban de Épicos"
        >
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

        <CopilotInsightBar />

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
                />
              ))}
        </div>
      </div>
      <ModalHost node={modalNode} onClose={modal.close} />
    </ModalCtx.Provider>
  );
}
