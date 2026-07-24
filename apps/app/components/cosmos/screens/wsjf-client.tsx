"use client";

// wsjf-client.tsx — client-only pieces of the WSJF Rankings screen: rows with
// hover/toggle state (useState) and navigation/modal hooks (useNav,
// useModal). Split out so wsjf.tsx can be a real async server component.
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import type {
  WsjfRankItem,
  WsjfRebalanceMove,
  WsjfSettingsView,
} from "@/app/(cosmos)/actions/wsjf";
import {
  applyWsjfRebalance,
  getFeatureWsjfComponents,
  getWsjfRebalancePreview,
  getWsjfSettings,
  upsertWsjfSettings,
} from "@/app/(cosmos)/actions/wsjf";
import { ARTS } from "@/lib/cosmos-data";
import {
  closestWsjfFibonacciIndex,
  computeWeightedWsjfScore,
  WSJF_FIBONACCI_VALUES,
} from "@/lib/wsjf-math";
import { EmptyState } from "../empty-state";
import { EntityLinkField } from "../entity-link-field";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  CopyId,
  GlossaryTip,
  IconButton,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useNav,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const WCOLS = "44px minmax(180px,1fr) 48px 104px 40px";

// Column labels match kanban.tsx's BOARD_COLUMNS literally (that board
// displays them in English) — reused here instead of inventing new
// Portuguese translations for the same lifecycle statuses.
const LIFECYCLE_COLUMN_LABEL: Record<string, string> = {
  FUNNEL: "Funnel",
  ANALYZING: "Analyzing",
  PORTFOLIO_BACKLOG: "Portfolio Backlog",
  IMPLEMENTING: "Implementing",
  DONE: "Done",
};

function HeadCell({
  children,
  center,
  hint,
}: {
  children: ReactNode;
  center?: boolean;
  hint?: string;
}) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".05em",
        textTransform: "uppercase",
        color: "var(--ink-faint)",
        textAlign: center ? "center" : "left",
      }}
    >
      {hint ? <GlossaryTip term={hint}>{children}</GlossaryTip> : children}
    </div>
  );
}

function NumCell({ children }: { children: ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: "var(--ink-muted)",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function WsjfRow({ item }: { item: WsjfRankItem }) {
  const modal = useModal();
  const art = item.art ? ARTS[item.art] : undefined;
  const tone = item.wsjf >= 18 ? "green" : item.wsjf >= 14 ? "accent" : "amber";

  return (
    <div
      className="lift"
      style={{
        display: "grid",
        gridTemplateColumns: WCOLS,
        alignItems: "center",
        gap: 10,
        padding: "13px 16px",
        borderRadius: 12,
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      {/* rank + movement */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          className="mono"
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: item.rank <= 3 ? "var(--accent-text)" : "var(--ink-muted)",
          }}
        >
          {item.rank}
        </span>
      </div>

      {/* item */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <CopyId value={item.id}>
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: art ? `var(--${art.tone}-text)` : "var(--ink-muted)",
                background: art
                  ? `rgba(var(--${art.tone}-rgb),.14)`
                  : "var(--surface-3)",
                border: art
                  ? `1px solid rgba(var(--${art.tone}-rgb),.28)`
                  : "1px solid var(--hairline)",
                borderRadius: 5,
                padding: "1px 6px",
              }}
            >
              {item.id}
            </span>
          </CopyId>
          <Badge tone={item.type === "Epic" ? "accent" : "neutral"}>
            {item.type}
          </Badge>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.name}
        </div>
      </div>

      <NumCell>{item.size}</NumCell>

      {/* wsjf */}
      <div>
        <div
          className="mono"
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: `var(--${tone}-text)`,
            textAlign: "center",
          }}
        >
          {item.wsjf.toFixed(1)}
        </div>
        <div style={{ marginTop: 4 }}>
          <Progress
            height={4}
            tone={tone}
            value={Math.min(100, (item.wsjf / 25) * 100)}
          />
        </div>
      </div>

      {/* scenario simulator — Feature only: Epic has no bv/tc/rr/js components */}
      <div style={{ textAlign: "center" }}>
        {item.type === "Feature" && (
          <IconButton
            name="flask"
            onClick={() =>
              modal.open(
                <ScenarioSimulatorModal
                  featureId={item.id}
                  featureName={item.name}
                />
              )
            }
            size={28}
            title="Simular cenário WSJF"
          />
        )}
      </div>
    </div>
  );
}

// ── rebalance (Task 19: real WSJF-rank deltas, Epic-only, per-column) ──
// Reads a live preview of what applying the rebalance would change (sorted
// by WSJF desc, diffed against the stored `order`, independently per
// lifecycle column — see lib/wsjf-rebalance.ts for why). "Aplicar" persists
// exactly that: a real batch mutation, not a no-op. Epic-only: Feature has
// no `order` field, so it's never included and the UI says so plainly.
function RebalanceMoveRow({ move }: { move: WsjfRebalanceMove }) {
  const rose = move.toRank < move.fromRank;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "9px 12px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {move.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          {LIFECYCLE_COLUMN_LABEL[move.lifecycleStatus] ?? move.lifecycleStatus}
        </div>
      </div>
      <div
        className="mono"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          fontWeight: 700,
          color: rose ? "var(--green-text)" : "var(--amber-text)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: "var(--ink-faint)" }}>#{move.fromRank}</span>
        <Icon name="arrowRight" size={12} />
        <span>#{move.toRank}</span>
      </div>
    </div>
  );
}

function RebalanceModal() {
  const { close } = useModal();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moves, setMoves] = useState<WsjfRebalanceMove[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getWsjfRebalancePreview().then((res) => {
      if (cancelled) {
        return;
      }
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setMoves(res.data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const apply = async () => {
    if (applying || moves.length === 0) {
      return;
    }
    setApplying(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => applyWsjfRebalance(), {
      loading: "Aplicando rebalanceamento...",
      success: (data) => `${data.moved} épico(s) reordenado(s).`,
      error: (err) => `Não foi possível aplicar o rebalanceamento: ${err}`,
    });
    setApplying(false);
    if (res.ok) {
      close();
    }
  };

  return (
    <ModalCard
      subtitle="Reordena Epics pelo WSJF atual, dentro de cada coluna do kanban"
      title="Rebalanceamento WSJF"
      width={500}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
            Calculando ranking WSJF...
          </p>
        )}

        {!loading && error && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--red-text)",
              lineHeight: 1.5,
            }}
          >
            Não foi possível calcular o rebalanceamento: {error}
          </p>
        )}

        {!(loading || error) && moves.length === 0 && (
          <EmptyState
            description="A ordem dos Epics em cada coluna já corresponde ao ranking WSJF atual."
            icon="check"
            title="Nada para rebalancear"
          />
        )}

        {!(loading || error) && moves.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            {moves.map((move) => (
              <RebalanceMoveRow key={move.id} move={move} />
            ))}
          </div>
        )}

        <p
          style={{
            margin: 0,
            fontSize: 11.5,
            color: "var(--ink-faint)",
            lineHeight: 1.5,
          }}
        >
          Apenas Epics são reordenados — Features não têm um campo de ordem
          próprio no kanban e não são afetadas.
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            borderTop: "1px solid var(--hairline)",
            paddingTop: 12,
          }}
        >
          <Button onClick={close} size="sm" variant="secondary">
            Descartar
          </Button>
          <Button
            icon="check"
            onClick={apply}
            size="sm"
            style={
              moves.length === 0 || applying
                ? { opacity: 0.6, pointerEvents: "none" }
                : {}
            }
            variant="primary"
          >
            Aplicar rebalanceamento
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

// ── scenario simulator (Task 18: real, tenant-scoped Feature components) ──
// Strictly non-persistent: fetches the feature's real bv/tc/rr/js + tenant
// weights read-only, lets the user drag hypothetical values, and recomputes
// the score client-side via the shared computeWeightedWsjfScore. Nothing is
// ever written — closing discards every change.

// Index-based stepping over the Modified Fibonacci set — scoreWsjfAction
// (app/actions/wsjf/score.ts) rejects any bv/tc/rr/js outside
// {1,2,3,5,8,13,20}, so the slider must only ever be able to land on one of
// those values, never an arbitrary integer a real re-score could reject.
function ScenarioComponentSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const index = closestWsjfFibonacciIndex(value);
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11.5,
          color: "var(--ink-muted)",
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span className="mono" style={{ color: "var(--accent-text)" }}>
          {value}
        </span>
      </div>
      <input
        max={WSJF_FIBONACCI_VALUES.length - 1}
        min={0}
        onChange={(e) =>
          onChange(WSJF_FIBONACCI_VALUES[Number(e.target.value)])
        }
        style={{ width: "100%", accentColor: "var(--accent)" }}
        type="range"
        value={index}
      />
    </div>
  );
}

// featureId/featureName are pre-filled when opened from a WSJF row
// (WsjfRow) — the simulator loads straight into the sliders. Opened
// standalone (the header "Simulador" button), both are undefined and an
// EntityLinkField feature picker is shown first; once a feature is chosen
// it behaves exactly like the row-triggered flow, sharing every line of
// load/compute logic below. No duplicate modal.
function ScenarioSimulatorModal({
  featureId: initialFeatureId,
  featureName: initialFeatureName,
}: {
  featureId?: string;
  featureName?: string;
}) {
  const { close } = useModal();
  const [selected, setSelected] = useState<EntityOption | null>(
    initialFeatureId
      ? { id: initialFeatureId, label: initialFeatureName ?? initialFeatureId }
      : null
  );
  const featureId = selected?.id;
  const [loading, setLoading] = useState(Boolean(initialFeatureId));
  const [error, setError] = useState<string | null>(null);
  const [storedScore, setStoredScore] = useState<number | null>(null);
  const [weights, setWeights] = useState<{
    weightBv: number;
    weightTc: number;
    weightRr: number;
  } | null>(null);
  const [bv, setBv] = useState(1);
  const [tc, setTc] = useState(1);
  const [rr, setRr] = useState(1);
  const [js, setJs] = useState(1);

  useEffect(() => {
    if (!featureId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getFeatureWsjfComponents(featureId), getWsjfSettings()]).then(
      ([componentsRes, settingsRes]) => {
        if (cancelled) {
          return;
        }
        // Never fall back to defaults on a failed read — surface it instead
        // of showing an authoritative-looking number computed on 1.0s.
        if (!componentsRes.ok) {
          setError(componentsRes.error);
          setLoading(false);
          return;
        }
        if (!settingsRes.ok) {
          setError(settingsRes.error);
          setLoading(false);
          return;
        }
        setBv(componentsRes.data.bv);
        setTc(componentsRes.data.tc);
        setRr(componentsRes.data.rr);
        setJs(componentsRes.data.js);
        setStoredScore(componentsRes.data.wsjfScore);
        setWeights({
          weightBv: settingsRes.data.weightBv,
          weightTc: settingsRes.data.weightTc,
          weightRr: settingsRes.data.weightRr,
        });
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [featureId]);

  const liveScore = weights
    ? computeWeightedWsjfScore({ bv, tc, rr, js }, weights)
    : null;
  const delta =
    liveScore !== null && storedScore !== null
      ? Math.round((liveScore - storedScore) * 100) / 100
      : null;

  return (
    <ModalCard
      icon={<Icon name="flask" size={16} strokeWidth={2.4} />}
      subtitle={
        selected
          ? `${selected.label} — simulação não é salva`
          : "Selecione uma feature para simular WSJF"
      }
      title="Simulador de Cenários"
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!featureId && (
          <EntityLinkField
            kind="feature"
            label="Feature"
            onChange={setSelected}
            value={selected}
          />
        )}

        {featureId && loading && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
            Carregando componentes WSJF da feature...
          </p>
        )}

        {featureId && !loading && error && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--red-text)",
              lineHeight: 1.5,
            }}
          >
            Não foi possível carregar os dados para simulação: {error}
          </p>
        )}

        {!(loading || error) && weights && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
              }}
            >
              <ScenarioComponentSlider
                label="Business Value"
                onChange={setBv}
                value={bv}
              />
              <ScenarioComponentSlider
                label="Time Criticality"
                onChange={setTc}
                value={tc}
              />
              <ScenarioComponentSlider
                label="Risk Reduction"
                onChange={setRr}
                value={rr}
              />
              <ScenarioComponentSlider
                label="Job Size"
                onChange={setJs}
                value={js}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "var(--surface-2)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint)",
                  }}
                >
                  WSJF simulado
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "var(--accent-text)",
                  }}
                >
                  {liveScore?.toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    color: "var(--ink-faint)",
                  }}
                >
                  Score atual · Δ
                </div>
                <div style={{ fontSize: 13 }}>
                  <span className="mono" style={{ color: "var(--ink-muted)" }}>
                    {storedScore?.toFixed(2)}
                  </span>{" "}
                  <span
                    className="mono"
                    style={{
                      fontWeight: 700,
                      color:
                        delta !== null && delta > 0
                          ? "var(--green-text)"
                          : delta !== null && delta < 0
                            ? "var(--red-text)"
                            : "var(--ink-muted)",
                    }}
                  >
                    {delta !== null && delta > 0 ? "+" : ""}
                    {delta?.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: 11.5,
                color: "var(--ink-faint)",
                lineHeight: 1.5,
              }}
            >
              Simulação — nada é salvo. Pesos aplicados: BV ×
              {weights.weightBv.toFixed(1)}, TC ×{weights.weightTc.toFixed(1)},
              RR ×{weights.weightRr.toFixed(1)} (Configurações de WSJF do
              tenant). Fechar descarta as alterações.
            </p>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Fechar
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

// ── settings modal (Task 16) ──
const settingsFieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

const settingsSelectStyle: CSSProperties = {
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

const SCALE_OPTIONS = [
  { value: "fibonacci", label: "Fibonacci (1,2,3,5,8,13,21)" },
  { value: "linear", label: "Linear (1–10)" },
] as const;
const AUTO_RECALC_OPTIONS = [
  { value: "realtime", label: "Tempo real" },
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "manual", label: "Manual" },
] as const;
const APPROVER_OPTIONS = [
  { value: "rte", label: "RTE" },
  { value: "lpm", label: "LPM" },
  { value: "po", label: "Product Owner" },
  { value: "any", label: "Qualquer editor" },
] as const;

function WeightSlider({
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
          color: "var(--ink-muted)",
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span className="mono" style={{ color: "var(--accent-text)" }}>
          {value.toFixed(1)}×
        </span>
      </div>
      <input
        max={2}
        min={0.5}
        onChange={(e) => onChange(Number(e.target.value))}
        step={0.1}
        style={{ width: "100%", accentColor: "var(--accent)" }}
        type="range"
        value={value}
      />
    </div>
  );
}

function WsjfSettingsModal({
  settings,
  onSaved,
}: {
  settings: WsjfSettingsView;
  onSaved: (next: WsjfSettingsView) => void;
}) {
  const { close } = useModal();
  const [weightBv, setWeightBv] = useState(settings.weightBv);
  const [weightTc, setWeightTc] = useState(settings.weightTc);
  const [weightRr, setWeightRr] = useState(settings.weightRr);
  const [scale, setScale] = useState(settings.scale);
  const [autoRecalc, setAutoRecalc] = useState(settings.autoRecalc);
  const [rebalanceApprover, setRebalanceApprover] = useState(
    settings.rebalanceApprover
  );
  const [staleDays, setStaleDays] = useState(settings.staleDays);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        upsertWsjfSettings({
          weightBv,
          weightTc,
          weightRr,
          scale,
          autoRecalc,
          rebalanceApprover,
          staleDays,
        }),
      {
        loading: "Salvando configurações de WSJF...",
        success:
          "Configurações salvas — novo cálculo será aplicado no próximo recálculo.",
        error: (err) => `Não foi possível salvar as configurações: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      onSaved(res.data);
      close();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="sliders" size={16} strokeWidth={2.4} />}
      subtitle="Parâmetros de cálculo e governança para todo o portfólio — não afeta um item específico"
      title="Configurações de WSJF"
      width={520}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: 3,
            }}
          >
            Pesos dos componentes
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--ink-faint)",
              marginBottom: 12,
            }}
          >
            Multiplicador aplicado a cada componente antes de somar — 1.0 é o
            WSJF clássico do SAFe.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
            }}
          >
            <WeightSlider
              label="Business Value"
              onChange={setWeightBv}
              value={weightBv}
            />
            <WeightSlider
              label="Time Criticality"
              onChange={setWeightTc}
              value={weightTc}
            />
            <WeightSlider
              label="Risk Reduction"
              onChange={setWeightRr}
              value={weightRr}
            />
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
          <label htmlFor="wsjf-scale" style={settingsFieldLabelStyle}>
            Escala de estimativa
          </label>
          <select
            id="wsjf-scale"
            onChange={(e) =>
              setScale(e.target.value as WsjfSettingsView["scale"])
            }
            style={settingsSelectStyle}
            value={scale}
          >
            {SCALE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <div>
            <label htmlFor="wsjf-auto-recalc" style={settingsFieldLabelStyle}>
              Recálculo automático
            </label>
            <select
              id="wsjf-auto-recalc"
              onChange={(e) =>
                setAutoRecalc(e.target.value as WsjfSettingsView["autoRecalc"])
              }
              style={settingsSelectStyle}
              value={autoRecalc}
            >
              {AUTO_RECALC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wsjf-approver" style={settingsFieldLabelStyle}>
              Aprovador de rebalanceamento
            </label>
            <select
              id="wsjf-approver"
              onChange={(e) =>
                setRebalanceApprover(
                  e.target.value as WsjfSettingsView["rebalanceApprover"]
                )
              }
              style={settingsSelectStyle}
              value={rebalanceApprover}
            >
              {APPROVER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="wsjf-stale-days" style={settingsFieldLabelStyle}>
            Alerta de score desatualizado
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <input
              id="wsjf-stale-days"
              max={30}
              min={3}
              onChange={(e) => setStaleDays(Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--accent)" }}
              type="range"
              value={staleDays}
            />
            <span
              className="mono"
              style={{
                fontSize: 12.5,
                color: "var(--accent-text)",
                minWidth: 60,
              }}
            >
              {staleDays} dias
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            borderTop: "1px solid var(--hairline)",
            paddingTop: 14,
          }}
        >
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button
            icon="check"
            onClick={save}
            size="sm"
            style={saving ? { opacity: 0.6, pointerEvents: "none" } : {}}
            variant="primary"
          >
            Salvar configurações
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function WsjfBody({
  items,
  initialSettings,
}: {
  items: WsjfRankItem[];
  initialSettings: WsjfSettingsView;
}) {
  const { navigate } = useNav();
  const modal = useModal();
  const [settings, setSettings] = useState(initialSettings);
  const avg =
    items.length === 0
      ? "0.0"
      : (items.reduce((s, i) => s + i.wsjf, 0) / items.length).toFixed(1);
  const top = items[0];

  const headStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: WCOLS,
    alignItems: "center",
    gap: 10,
    padding: "0 16px 4px",
  };

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Priorização"
        meta={<Badge tone="accent">{items.length} itens</Badge>}
        subtitle={
          <>
            Backlog de portfólio ordenado por{" "}
            <GlossaryTip term="WSJF">WSJF</GlossaryTip> —{" "}
            <GlossaryTip term="CoD">Cost of Delay</GlossaryTip> dividido pelo
            Job Size. Maior valor entregue por unidade de tempo no topo.
          </>
        }
        title="WSJF Rankings"
      >
        <Button
          icon="flask"
          onClick={() => modal.open(<ScenarioSimulatorModal />)}
          variant="secondary"
        >
          Simulador
        </Button>
        <Button
          icon="sliders"
          onClick={() =>
            modal.open(
              <WsjfSettingsModal onSaved={setSettings} settings={settings} />
            )
          }
          variant="secondary"
        >
          Configurações
        </Button>
        <Button
          icon="wand"
          onClick={() => modal.open(<RebalanceModal />)}
          variant="primary"
        >
          Rebalancear IA
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard
          hint={`${items.length} itens`}
          icon="trendingUp"
          label="WSJF médio (backlog)"
          tone="accent"
          value={avg}
        />
        <KpiCard
          hint={top?.id ?? "—"}
          icon="target"
          label="Top épico"
          tone="green"
          value={top ? top.wsjf.toString() : "—"}
        />
      </div>

      <SectionCard
        action={
          <Button
            iconRight="arrowRight"
            onClick={() => navigate("themes")}
            size="sm"
            variant="ghost"
          >
            Ver Temas
          </Button>
        }
        bodyStyle={{ padding: "12px 0 8px" }}
        icon="barChart"
        subtitle="Recalculado a cada refinamento"
        title="Ranking WSJF do Portfólio"
        tone="accent"
      >
        <div style={headStyle}>
          <HeadCell>#</HeadCell>
          <HeadCell>Item</HeadCell>
          <HeadCell center>Size</HeadCell>
          <HeadCell center hint="WSJF">
            WSJF
          </HeadCell>
          <HeadCell center> </HeadCell>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "4px 16px",
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
              Nenhum item encontrado.
            </div>
          ) : (
            items.map((item) => <WsjfRow item={item} key={item.id} />)
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export function WsjfInner({
  items,
  settings,
}: {
  items: WsjfRankItem[];
  settings: WsjfSettingsView;
}) {
  return (
    <ModalProvider>
      <WsjfBody initialSettings={settings} items={items} />
    </ModalProvider>
  );
}
