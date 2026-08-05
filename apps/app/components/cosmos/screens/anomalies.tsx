"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  PageHeader,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
// anomalies.tsx — Cost Anomalies, wired to app/(cosmos)/actions/anomalies.ts.
// Lists real CostAnomaly rows (detected from BillingEntry via median/MAD
// modified z-score — see lib/cost/detect-cost-anomalies.ts), with a
// per-anomaly AI narrative (generated on demand, degrades honestly to raw
// metrics when no AI provider is configured), an acknowledge action, and a
// sensitivity modal for the AnomalyRuleConfig threshold. This is COST
// anomaly detection — a different model from the flow-anomaly pipeline
// elsewhere in this app.
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  type AnomalySensitivity,
  acknowledgeCostAnomaly,
  type CostAnomalyView,
  detectCostAnomaliesNow,
  generateCostAnomalyNarrativeAction,
  getAnomalySensitivity,
  listCostAnomalies,
  resetAnomalySensitivity,
  setAnomalySensitivity,
} from "@/app/(cosmos)/actions/anomalies";
import { EmptyState } from "../empty-state";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const SEVERITY_META: Record<string, { label: string; tone: Tone }> = {
  LOW: { label: "Baixa", tone: "blue" },
  MEDIUM: { label: "Média", tone: "amber" },
  HIGH: { label: "Alta", tone: "red" },
  CRITICAL: { label: "Crítica", tone: "red" },
};

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Aberta", tone: "amber" },
  ACKNOWLEDGED: { label: "Reconhecida", tone: "blue" },
  RESOLVED: { label: "Resolvida", tone: "green" },
  FALSE_POSITIVE: { label: "Falso positivo", tone: "neutral" },
};

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

function fmtUsd(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

function SensitivityModal({
  current,
  onSaved,
}: {
  current: AnomalySensitivity;
  onSaved?: () => void;
}) {
  const { close } = useModal();
  const [value, setValue] = useState(String(current.threshold));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const num = Number(value);
  const valid =
    Number.isFinite(num) &&
    num >= current.bounds.min &&
    num <= current.bounds.max;

  const save = async () => {
    if (!(valid && !saving)) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => setAnomalySensitivity({ threshold: num }),
      {
        loading: "Salvando sensibilidade...",
        success: "Sensibilidade atualizada.",
        error: (err: string) => `Não foi possível salvar: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onSaved?.();
    }
  };

  // Só aparece quando há override. Voltar ao padrão apaga a linha de
  // AnomalyRuleConfig — não regrava o padrão como escolha do tenant.
  const restoreDefault = async () => {
    if (resetting) {
      return;
    }
    setResetting(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => resetAnomalySensitivity(), {
      loading: "Restaurando o padrão da plataforma...",
      success: "Sensibilidade de volta ao padrão da plataforma.",
      error: (err: string) => `Não foi possível restaurar: ${err}`,
    });
    setResetting(false);
    if (res.ok) {
      close();
      onSaved?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="sliders" size={16} strokeWidth={2.4} />}
      subtitle="Limite do modified z-score (Iglewicz & Hoaglin) para sinalizar uma anomalia de custo"
      title="Sensibilidade de detecção"
      width={420}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="anomaly-sensitivity" style={fieldLabelStyle}>
            Limite (z-score) — entre {current.bounds.min} e {current.bounds.max}
            {current.isDefault ? " · padrão da plataforma" : ""}
          </label>
          <input
            id="anomaly-sensitivity"
            onChange={(e) => setValue(e.target.value)}
            step="0.1"
            style={inputStyle}
            type="number"
            value={value}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          {!current.isDefault && (
            <Button
              onClick={restoreDefault}
              size="sm"
              style={{ marginRight: "auto" }}
              variant="ghost"
            >
              Restaurar padrão
            </Button>
          )}
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={save} size="sm" variant="primary">
            Salvar
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function AnomalyNarrative({ anomaly }: { anomaly: CostAnomalyView }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
        status: "done";
        narrative: string | null;
        actions: string[];
        degraded: boolean;
      }
  >({ status: "idle" });

  if (state.status === "idle") {
    return (
      <Button
        icon="sparkles"
        onClick={async () => {
          setState({ status: "loading" });
          const res = await generateCostAnomalyNarrativeAction({
            id: anomaly.id,
          });
          if (res.ok) {
            setState({ status: "done", ...res.data });
          } else {
            setState({ status: "error", message: res.error });
          }
        }}
        size="sm"
        variant="soft"
      >
        Gerar narrativa IA
      </Button>
    );
  }

  if (state.status === "loading") {
    return (
      <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
        Gerando narrativa...
      </span>
    );
  }

  if (state.status === "error") {
    return (
      <span style={{ fontSize: 12, color: "var(--red-text)" }}>
        Não foi possível gerar a narrativa: {state.message}
      </span>
    );
  }

  if (state.degraded || state.narrative === null) {
    return (
      <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
        Narrativa IA indisponível (nenhum provedor configurado) — métricas reais
        acima já refletem o desvio detectado.
      </div>
    );
  }

  return (
    <div style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.5 }}>
      <div>{state.narrative}</div>
      {state.actions.length > 0 && (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {state.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AnomalyRow({
  anomaly,
  onUpdated,
}: {
  anomaly: CostAnomalyView;
  onUpdated: () => void;
}) {
  const severity = SEVERITY_META[anomaly.severity] ?? {
    label: anomaly.severity,
    tone: "neutral" as Tone,
  };
  const status = STATUS_META[anomaly.status] ?? {
    label: anomaly.status,
    tone: "neutral" as Tone,
  };
  const [acking, setAcking] = useState(false);

  const acknowledge = async () => {
    if (acking) {
      return;
    }
    setAcking(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => acknowledgeCostAnomaly({ id: anomaly.id }),
      {
        loading: "Reconhecendo anomalia...",
        success: "Anomalia reconhecida.",
        error: (err: string) => `Não foi possível reconhecer: ${err}`,
      }
    );
    setAcking(false);
    if (res.ok) {
      onUpdated();
    }
  };

  return (
    <div
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 13.5 }}>
            {anomaly.service ?? "Serviço desconhecido"}
            {anomaly.accountId ? ` · ${anomaly.accountId}` : ""}
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}
          >
            {fmtMonth(anomaly.period)}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12.5 }}>
          <span className="mono" style={{ color: "var(--ink)" }}>
            {fmtUsd(anomaly.actualAmount)}
          </span>
          <span style={{ color: "var(--ink-faint)" }}>
            {" "}
            vs. baseline {fmtUsd(anomaly.baselineMedian)}
          </span>
        </div>
        <span
          className="mono"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color:
              anomaly.deltaPct >= 0 ? "var(--red-text)" : "var(--green-text)",
          }}
        >
          {anomaly.deltaPct >= 0 ? "+" : ""}
          {anomaly.deltaPct.toFixed(0)}%
        </span>
        <span
          className="mono"
          style={{ fontSize: 11.5, color: "var(--ink-faint)" }}
        >
          z={anomaly.modifiedZScore.toFixed(2)}
        </span>
        <Badge tone={severity.tone}>{severity.label}</Badge>
        <Badge dot tone={status.tone}>
          {status.label}
        </Badge>
        {anomaly.status === "OPEN" && (
          <Button onClick={acknowledge} size="sm" variant="secondary">
            Reconhecer
          </Button>
        )}
      </div>
      <AnomalyNarrative anomaly={anomaly} />
    </div>
  );
}

function AnomaliesBody() {
  const modal = useModal();
  const [rows, setRows] = useState<CostAnomalyView[]>([]);
  const [hasBillingData, setHasBillingData] = useState(true);
  const [sensitivity, setSensitivity] = useState<AnomalySensitivity | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([listCostAnomalies(), getAnomalySensitivity()]).then(
      ([listRes, sensRes]) => {
        if (listRes.ok) {
          setRows(listRes.data.items);
          setHasBillingData(listRes.data.hasBillingData);
          setError(false);
        } else {
          setError(true);
        }
        if (sensRes.ok) {
          setSensitivity(sensRes.data);
        }
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCount = rows.filter((r) => r.status === "OPEN").length;
  const criticalCount = rows.filter(
    (r) => r.severity === "CRITICAL" || r.severity === "HIGH"
  ).length;
  const avgDeltaPct = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.deltaPct, 0) / rows.length)
    : null;

  const detectNow = async () => {
    if (detecting) {
      return;
    }
    setDetecting(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => detectCostAnomaliesNow(), {
      loading: "Detectando anomalias de custo...",
      success: (data) =>
        `Detecção concluída — ${data.evaluated} grupos avaliados, ${data.created} novas anomalias.`,
      error: (err: string) => `Não foi possível detectar: ${err}`,
    });
    setDetecting(false);
    if (res.ok) {
      load();
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · FinOps"
        meta={
          <>
            <Badge icon="alert" tone="accent">
              {rows.length} anomalias
            </Badge>
            <Badge dot tone={openCount > 0 ? "amber" : "green"}>
              {openCount > 0 ? `${openCount} abertas` : "Nenhuma aberta"}
            </Badge>
          </>
        }
        subtitle="Anomalias de custo detectadas em BillingEntry via mediana/MAD (modified z-score) — nunca um número inventado."
        title="Anomalias de Custo"
      >
        {sensitivity && (
          <Button
            icon="sliders"
            onClick={() =>
              modal.open(
                <SensitivityModal current={sensitivity} onSaved={load} />
              )
            }
            size="sm"
            variant="secondary"
          >
            Sensibilidade
          </Button>
        )}
        <Button icon="zap" onClick={detectNow} size="sm" variant="primary">
          Detectar agora
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
          hint="linhas CostAnomaly no tenant"
          icon="alert"
          label="Anomalias detectadas"
          tone="accent"
          value={rows.length}
        />
        <KpiCard
          hint="aguardando reconhecimento"
          icon="clock"
          label="Abertas"
          tone={openCount > 0 ? "amber" : "green"}
          value={openCount}
        />
        <KpiCard
          hint="severidade alta ou crítica"
          icon="zap"
          label="Alta / Crítica"
          tone={criticalCount > 0 ? "red" : "green"}
          value={criticalCount}
        />
        <KpiCard
          hint="desvio médio vs. baseline"
          icon="trend"
          label="Δ% médio"
          tone="blue"
          unit={avgDeltaPct === null ? undefined : "%"}
          value={avgDeltaPct ?? "—"}
        />
      </div>

      {error && (
        <ErrorState message="Não foi possível carregar as anomalias de custo." />
      )}

      {!(error || loading) && rows.length === 0 && (
        <EmptyState
          action={{
            label: "Detectar agora",
            onClick: detectNow,
          }}
          description={
            hasBillingData
              ? "Nenhuma anomalia foi detectada nos dados de custo atuais."
              : "Nenhum dado de custo (BillingEntry) foi sincronizado para este tenant ainda — conecte uma integração de billing primeiro."
          }
          icon="alert"
          title="Nenhuma anomalia de custo"
        />
      )}

      {!error && rows.length > 0 && (
        <SectionCard
          bodyStyle={{ padding: 0 }}
          icon="alert"
          subtitle="Mediana, MAD e modified z-score calculados a partir de BillingEntry real"
          title="Anomalias"
          tone="accent"
        >
          {rows.map((a) => (
            <AnomalyRow anomaly={a} key={a.id} onUpdated={load} />
          ))}
        </SectionCard>
      )}
    </div>
  );
}

export default function AnomaliesScreen() {
  return (
    <ModalProvider>
      <AnomaliesBody />
    </ModalProvider>
  );
}
