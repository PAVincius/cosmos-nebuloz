"use client";

// value.tsx — Value Realization (design handoff screen-bundle-1.jsx:1283,
// ValueRealizationScreen), wired to the new value-realization.ts actions.
// Table linking each tracked epic to a business-value metric: planned vs.
// actual realization and status. "Registrar valor" creates a new metric
// for an epic (EntityLinkField, same picker used by Decision Log); the
// per-row gauge icon records/updates the realized actual value later.
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import {
  createValueMetric,
  listValueRealizations,
  recordActualValue,
  type ValueMetricStatus,
  type ValueRealizationView,
} from "@/app/(cosmos)/actions/value-realization";
import { EmptyState } from "../empty-state";
import { EntityLinkField } from "../entity-link-field";
import { Icon, type IconName } from "../icons";
import {
  Badge,
  Button,
  ErrorState,
  IconButton,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  type Tone,
  useNav,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const STATUS_META: Record<
  string,
  { label: string; tone: Tone; icon: IconName }
> = {
  done: { label: "Validado", tone: "green", icon: "check" },
  tracking: { label: "Em medição", tone: "blue", icon: "activity" },
  "at-risk": { label: "Abaixo da meta", tone: "amber", icon: "alert" },
  pending: { label: "Aguardando dados", tone: "neutral", icon: "clock" },
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Aguardando dados" },
  { value: "tracking", label: "Em medição" },
  { value: "at-risk", label: "Abaixo da meta" },
  { value: "done", label: "Validado" },
] as const;

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

function CreateValueMetricModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [epic, setEpic] = useState<EntityOption | null>(null);
  const [metricLabel, setMetricLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [plannedValue, setPlannedValue] = useState("");
  const [saving, setSaving] = useState(false);

  const plannedNum = Number(plannedValue);
  const valid =
    !!epic &&
    metricLabel.trim() !== "" &&
    plannedValue.trim() !== "" &&
    Number.isFinite(plannedNum);

  const create = async () => {
    if (!(valid && !saving && epic)) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createValueMetric({
          epicId: epic.id,
          metricLabel: metricLabel.trim(),
          unit: unit.trim() || undefined,
          plannedValue: plannedNum,
        }),
      {
        loading: "Registrando indicador...",
        success: "Indicador de valor registrado.",
        error: (err: string) => `Não foi possível registrar: ${err}`,
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
      icon={<Icon name="trend" size={16} strokeWidth={2.4} />}
      subtitle="Liga um épico a um indicador de negócio com a meta planejada"
      title="Registrar valor"
      width={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <EntityLinkField
          kind="epic"
          label="Épico"
          onChange={setEpic}
          value={epic}
        />
        <div>
          <label htmlFor="value-metric-label" style={fieldLabelStyle}>
            Indicador de negócio
          </label>
          <input
            id="value-metric-label"
            onChange={(e) => setMetricLabel(e.target.value)}
            placeholder="Ex.: Redução de churn, NPS, MRR incremental…"
            style={inputStyle}
            value={metricLabel}
          />
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <div>
            <label htmlFor="value-metric-planned" style={fieldLabelStyle}>
              Meta planejada
            </label>
            <input
              id="value-metric-planned"
              onChange={(e) => setPlannedValue(e.target.value)}
              style={inputStyle}
              type="number"
              value={plannedValue}
            />
          </div>
          <div>
            <label htmlFor="value-metric-unit" style={fieldLabelStyle}>
              Unidade (opcional)
            </label>
            <input
              id="value-metric-unit"
              onChange={(e) => setUnit(e.target.value)}
              placeholder="%, USD, pts…"
              style={inputStyle}
              value={unit}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Registrar
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function RecordActualValueModal({
  metric,
  onUpdated,
}: {
  metric: ValueRealizationView;
  onUpdated?: () => void;
}) {
  const { close } = useModal();
  const [actualValue, setActualValue] = useState(
    metric.actualValue !== null ? String(metric.actualValue) : ""
  );
  const [status, setStatus] = useState<ValueMetricStatus>(
    (STATUS_OPTIONS.find((o) => o.value === metric.status)?.value as
      | ValueMetricStatus
      | undefined) ?? "tracking"
  );
  const [saving, setSaving] = useState(false);

  const actualNum = Number(actualValue);
  const valid = actualValue.trim() !== "" && Number.isFinite(actualNum);

  const submit = async () => {
    if (!(valid && !saving)) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        recordActualValue({
          id: metric.id,
          actualValue: actualNum,
          status,
        }),
      {
        loading: "Registrando resultado...",
        success: "Resultado atualizado.",
        error: (err: string) => `Não foi possível atualizar: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onUpdated?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="gauge" size={16} strokeWidth={2.4} />}
      subtitle={metric.metricLabel}
      title="Registrar resultado realizado"
      width={420}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="value-metric-actual" style={fieldLabelStyle}>
            Valor realizado ({metric.unit ?? "un."}) — planejado{" "}
            {metric.plannedValue}
          </label>
          <input
            id="value-metric-actual"
            onChange={(e) => setActualValue(e.target.value)}
            style={inputStyle}
            type="number"
            value={actualValue}
          />
        </div>
        <div>
          <label htmlFor="value-metric-status" style={fieldLabelStyle}>
            Status
          </label>
          <select
            id="value-metric-status"
            onChange={(e) => setStatus(e.target.value as ValueMetricStatus)}
            style={inputStyle}
            value={status}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={submit} size="sm" variant="primary">
            Salvar
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

const gridCols = "minmax(0,1.6fr) minmax(0,1.4fr) 110px 110px 130px 140px 40px";

function ValueRow({
  metric,
  onUpdated,
}: {
  metric: ValueRealizationView;
  onUpdated: () => void;
}) {
  const { navigate } = useNav();
  const modal = useModal();
  const meta = STATUS_META[metric.status] ?? STATUS_META.pending;
  const pct =
    metric.actualValue !== null && metric.plannedValue !== 0
      ? Math.round((metric.actualValue / metric.plannedValue) * 100)
      : null;
  const unitSuffix = metric.unit
    ? metric.unit.startsWith("%")
      ? "%"
      : ` ${metric.unit}`
    : "";

  return (
    <div
      className="lift"
      style={{
        display: "grid",
        gridTemplateColumns: gridCols,
        gap: 12,
        alignItems: "center",
        padding: "13px 18px",
        borderBottom: "1px solid var(--hairline)",
        fontSize: 13,
      }}
    >
      <button
        onClick={() => navigate("epic", metric.epicId)}
        style={{
          minWidth: 0,
          textAlign: "left",
          background: "none",
          border: "none",
          padding: 0,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
        type="button"
      >
        <span
          className="mono"
          style={{ fontSize: 10.5, color: "var(--ink-faint)", fontWeight: 600 }}
        >
          {metric.epicId}
        </span>
        <div
          style={{
            fontWeight: 600,
            color: "var(--ink)",
            marginTop: 2,
            lineHeight: 1.3,
          }}
        >
          {metric.epicTitle}
        </div>
      </button>
      <div
        style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.4 }}
      >
        {metric.metricLabel}
      </div>
      <span
        className="mono"
        style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-muted)" }}
      >
        {metric.plannedValue}
        {unitSuffix}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color:
            metric.actualValue === null ? "var(--ink-faint)" : "var(--ink)",
        }}
      >
        {metric.actualValue === null
          ? "—"
          : `${metric.actualValue}${unitSuffix}`}
      </span>
      <div>
        {pct !== null ? (
          <>
            <Progress height={7} tone={meta.tone} value={Math.min(100, pct)} />
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--ink-faint)",
                marginTop: 3,
              }}
            >
              {pct}% do alvo
            </div>
          </>
        ) : (
          <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
            sem dados
          </span>
        )}
      </div>
      <Badge icon={meta.icon} tone={meta.tone}>
        {meta.label}
      </Badge>
      <IconButton
        name="gauge"
        onClick={() =>
          modal.open(
            <RecordActualValueModal metric={metric} onUpdated={onUpdated} />
          )
        }
        size={26}
        title="Registrar resultado realizado"
      />
    </div>
  );
}

function ValueBody() {
  const modal = useModal();
  const [rows, setRows] = useState<ValueRealizationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listValueRealizations().then((r) => {
      if (r.ok) {
        setRows(r.data);
        setError(false);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tracked = rows.length;
  const measured = rows.filter((r) => r.actualValue !== null).length;
  const atRisk = rows.filter((r) => r.status === "at-risk").length;
  const withData = rows.filter(
    (r) => r.actualValue !== null && r.plannedValue !== 0
  );
  const avgRealization = withData.length
    ? Math.round(
        withData.reduce(
          (s, r) =>
            s +
            Math.min(
              150,
              Math.round(((r.actualValue ?? 0) / r.plannedValue) * 100)
            ),
          0
        ) / withData.length
      )
    : null;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Benefit Tracking"
        meta={
          <>
            <Badge icon="trend" tone="accent">
              {tracked} épicos rastreados
            </Badge>
            <Badge dot tone={atRisk ? "amber" : "green"}>
              {atRisk ? `${atRisk} abaixo da meta` : "Nenhum em risco"}
            </Badge>
          </>
        }
        subtitle="Liga cada épico entregue a um indicador de negócio real — planejado vs. realizado, para defender o valor do investimento."
        title="Value Realization"
        tone="green"
      >
        <Button
          icon="plus"
          onClick={() =>
            modal.open(<CreateValueMetricModal onCreated={load} />)
          }
          size="md"
          variant="primary"
        >
          Registrar valor
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        <KpiCard
          hint="épicos com indicador registrado"
          icon="trend"
          label="Épicos com valor rastreado"
          tone="accent"
          value={tracked}
        />
        <KpiCard
          hint={`de ${tracked} rastreados`}
          icon="check"
          label="Com resultado medido"
          tone="green"
          value={measured}
        />
        <KpiCard
          hint="planejado vs. realizado"
          icon="gauge"
          label="Realização média"
          tone={
            avgRealization === null
              ? "neutral"
              : avgRealization >= 90
                ? "green"
                : avgRealization >= 60
                  ? "amber"
                  : "red"
          }
          unit={avgRealization === null ? undefined : "%"}
          value={avgRealization ?? "—"}
        />
        <KpiCard
          hint="requer atenção do LPM"
          icon="alert"
          label="Abaixo da meta"
          tone={atRisk ? "amber" : "green"}
          value={atRisk}
        />
      </div>

      {error && (
        <ErrorState message="Não foi possível carregar os indicadores de valor." />
      )}

      {!(error || loading) && rows.length === 0 && (
        <EmptyState
          action={{
            label: "Registrar valor",
            onClick: () =>
              modal.open(<CreateValueMetricModal onCreated={load} />),
          }}
          description="Nenhum épico tem um indicador de negócio rastreado ainda."
          icon="trend"
          title="Nenhum valor rastreado"
        />
      )}

      {!error && rows.length > 0 && (
        <SectionCard
          bodyStyle={{ padding: 0, overflow: "visible" }}
          icon="trend"
          subtitle="Business value hypothesis validada com dados reais pós-entrega"
          title="Épico → Indicador de negócio → Resultado"
          tone="green"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridCols,
              gap: 12,
              padding: "10px 18px",
              borderBottom: "1px solid var(--hairline)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            <span>Épico</span>
            <span>Indicador de negócio</span>
            <span>Planejado</span>
            <span>Realizado</span>
            <span>Realização</span>
            <span>Status</span>
            <span />
          </div>
          {rows.map((r) => (
            <ValueRow key={r.id} metric={r} onUpdated={load} />
          ))}
        </SectionCard>
      )}
    </div>
  );
}

export default function ValueScreen() {
  return (
    <ModalProvider>
      <ValueBody />
    </ModalProvider>
  );
}
