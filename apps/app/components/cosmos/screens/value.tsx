"use client";

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
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
  useAction,
  useNav,
} from "@repo/design-system/cosmos/kit";
// value.tsx — Value Realization (design handoff screen-bundle-1.jsx:1283,
// ValueRealizationScreen), wired to the new value-realization.ts actions.
// Table linking each tracked epic to a business-value metric: planned vs.
// actual realization and status. "Registrar valor" creates a new metric
// for an epic (EntityLinkField, same picker used by Decision Log); the
// per-row gauge icon records/updates the realized actual value later.
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { searchEntities } from "@/app/(cosmos)/actions/entity-search";
import {
  createValueMetric,
  listValueRealizations,
  recordActualValue,
  type ValueRealizationView,
} from "@/app/(cosmos)/actions/value-realization";
import {
  requiresHypothesisRationale,
  type ValueMetricStatus,
} from "@/app/(cosmos)/actions/value-realization.constants";
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
  Select,
  TextArea,
  TextInput,
} from "../modal-form";
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

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

const CREATE_TONE = "green";

function CreateValueMetricModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [epicId, setEpicId] = useState<string | null>(null);
  const [metricLabel, setMetricLabel] = useState("");
  const [unit, setUnit] = useState("");
  const [plannedValue, setPlannedValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  // A carga inicial só alimenta o rótulo do chip e do preview: searchEntities
  // corta em 10, então filtrar essa fatia localmente faria o campo negar épico
  // que existe. Estável por useCallback — o efeito de busca tem onSearch nas
  // dependências e recriá-la a cada render dispararia busca em loop.
  const { data: epicOptions } = useAction(() => searchEntities("epic", ""), []);
  const epics = epicOptions ?? [];
  const buscarEpicos = useCallback(async (q: string) => {
    const r = await searchEntities("epic", q);
    return r.ok ? r.data : [];
  }, []);
  const epic = epics.find((e) => e.id === epicId);

  const plannedNum = Number(plannedValue);
  const valid =
    !!epicId &&
    metricLabel.trim() !== "" &&
    plannedValue.trim() !== "" &&
    Number.isFinite(plannedNum);

  const create = async () => {
    if (!(valid && !saving && epicId)) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createValueMetric({
          epicId,
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
                  {saving ? "Registrando..." : "Registrar"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="trend" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Liga um épico a um indicador de negócio com a meta planejada"
        title="Registrar valor"
        tone={CREATE_TONE}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${CREATE_TONE}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div style={previewLabelStyle}>Épico</div>
              <div
                style={{
                  color: epic ? "var(--ink)" : "var(--ink-faint)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                {epic?.label ?? "Nenhum épico vinculado ainda"}
              </div>

              <div style={previewLabelStyle}>Indicador de negócio</div>
              <div
                className="display"
                style={{
                  color: "var(--ink)",
                  fontSize: 14.5,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  marginBottom: 14,
                }}
              >
                {metricLabel || "Redução de churn, NPS, MRR incremental..."}
              </div>

              <div style={previewLabelStyle}>Meta planejada</div>
              <div
                className="mono"
                style={{
                  color: "var(--ink)",
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: "-.02em",
                  marginBottom: 6,
                }}
              >
                {plannedValue.trim() === "" ? "—" : plannedValue}
                <span
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: 12,
                    fontWeight: 600,
                    marginLeft: 4,
                  }}
                >
                  {unit || "un."}
                </span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <Badge icon="clock" tone="neutral">
                  Aguardando dados
                </Badge>
              </div>

              {/* O indicador nasce sem realizado: quem registra a meta aqui
                  precisa saber que a medição volta depois da entrega, pelo
                  botão de resultado da linha. */}
              <div
                style={{
                  borderTop: "1px solid var(--hairline)",
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  lineHeight: 1.5,
                  paddingTop: 10,
                }}
              >
                O resultado realizado é registrado depois da entrega, pela
                própria linha do indicador.
              </div>
            </div>
          }
        >
          <EntityLinkField
            hint="Épico entregue cuja hipótese de valor será medida"
            items={epics}
            label="Épico"
            onChange={(v) => setEpicId(v as string | null)}
            onSearch={buscarEpicos}
            placeholder="Buscar um épico..."
            tone={CREATE_TONE}
            value={epicId}
          />
          <FormField label="Indicador de negócio" required>
            <TextInput
              onChange={setMetricLabel}
              placeholder="ex: Redução de churn"
              required
              value={metricLabel}
            />
          </FormField>
          <div
            style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}
          >
            <FormField label="Meta planejada" required>
              <TextInput
                onChange={setPlannedValue}
                required
                type="number"
                value={plannedValue}
              />
            </FormField>
            <FormField hint="%, USD, pts..." label="Unidade">
              <TextInput onChange={setUnit} value={unit} />
            </FormField>
          </div>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
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
  const [rationale, setRationale] = useState("");
  const [rationaleMissing, setRationaleMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const actualNum = Number(actualValue);
  const valid = actualValue.trim() !== "" && Number.isFinite(actualNum);
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  // Mesma conta da linha da tabela: o preview não pode mostrar uma realização
  // diferente da que a lista vai exibir depois de salvar.
  const pct =
    valid && metric.plannedValue !== 0
      ? Math.round((actualNum / metric.plannedValue) * 100)
      : null;
  const unitSuffix = metric.unit ?? "un.";
  // Encerrar a hipótese — confirmá-la ou declará-la abaixo da meta — é uma
  // decisão, e decisão sem motivo registrado é o que torna benefit tracking
  // indefensável numa revisão de portfólio (UC-09 passos 5–6).
  const rationaleRequired = requiresHypothesisRationale(status);

  const submit = async () => {
    if (!(valid && !saving)) {
      return;
    }
    if (rationaleRequired && rationale.trim() === "") {
      setRationaleMissing(true);
      return;
    }
    setRationaleMissing(false);
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        recordActualValue({
          id: metric.id,
          actualValue: actualNum,
          status,
          rationale: rationale.trim() || undefined,
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

  useModalSubmitShortcut(submit, !saving);

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
              <ModalShortcutHint />
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
                  onClick={submit}
                  size="sm"
                  variant="primary"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="gauge" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle={metric.metricLabel}
        title="Registrar resultado realizado"
        tone={meta.tone}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${meta.tone}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div style={previewLabelStyle}>Épico</div>
              <div
                style={{
                  color: "var(--ink)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                {metric.epicTitle}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "1fr 1fr",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={previewLabelStyle}>Planejado</div>
                  <div
                    className="mono"
                    style={{ fontSize: 18, fontWeight: 700 }}
                  >
                    {metric.plannedValue}
                    <span
                      style={{
                        color: "var(--ink-faint)",
                        fontSize: 11,
                        marginLeft: 3,
                      }}
                    >
                      {unitSuffix}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={previewLabelStyle}>Realizado</div>
                  <div
                    className="mono"
                    style={{
                      color: valid ? `var(--${meta.tone}-text)` : "var(--ink)",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {valid ? actualNum : "—"}
                    <span
                      style={{
                        color: "var(--ink-faint)",
                        fontSize: 11,
                        marginLeft: 3,
                      }}
                    >
                      {unitSuffix}
                    </span>
                  </div>
                </div>
              </div>

              {pct === null ? (
                <div
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: 11.5,
                    marginBottom: 12,
                  }}
                >
                  Sem realização calculável ainda
                </div>
              ) : (
                <div style={{ marginBottom: 12 }}>
                  <Progress
                    height={7}
                    tone={meta.tone}
                    value={Math.min(100, Math.max(0, pct))}
                  />
                  <div
                    className="mono"
                    style={{
                      color: "var(--ink-faint)",
                      fontSize: 10.5,
                      marginTop: 4,
                    }}
                  >
                    {`${pct}% do alvo`}
                  </div>
                </div>
              )}

              <Badge icon={meta.icon} tone={meta.tone}>
                {meta.label}
              </Badge>

              {rationaleRequired && (
                // Encerrar a hipótese é decisão de portfólio: o preview avisa
                // antes do clique, não depois do erro.
                <div
                  style={{
                    borderTop: "1px solid var(--hairline)",
                    color: "var(--ink-faint)",
                    fontSize: 11,
                    lineHeight: 1.5,
                    marginTop: 12,
                    paddingTop: 10,
                  }}
                >
                  Este status encerra a hipótese — a justificativa vai para o
                  log de auditoria.
                </div>
              )}
            </div>
          }
        >
          <FormField
            hint={`Planejado: ${metric.plannedValue}${unitSuffix}`}
            label={`Valor realizado (${unitSuffix})`}
            required
          >
            <TextInput
              onChange={setActualValue}
              required
              type="number"
              value={actualValue}
            />
          </FormField>
          <FormField label="Status">
            <Select
              onChange={(v) => setStatus(v as ValueMetricStatus)}
              options={[...STATUS_OPTIONS]}
              value={status}
            />
          </FormField>
          {/* O aviso fica fora do FormField: dentro do <label> ele entraria no
              nome acessível do próprio campo. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FormField
              label={
                rationaleRequired
                  ? "Justificativa da decisão (obrigatória)"
                  : "Justificativa (opcional)"
              }
            >
              <TextArea
                maxLength={2000}
                onChange={(v) => {
                  setRationale(v);
                  setRationaleMissing(false);
                }}
                placeholder="Que evidência sustenta essa leitura da hipótese?"
                rows={3}
                value={rationale}
              />
            </FormField>
            {rationaleMissing && (
              <span
                role="alert"
                style={{
                  color: "var(--red-text)",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Encerrar a hipótese exige uma justificativa registrada.
              </span>
            )}
          </div>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
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
