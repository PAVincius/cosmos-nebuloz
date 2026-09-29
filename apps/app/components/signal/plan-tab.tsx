"use client";

// Aba Plano da iniciativa — SG-DEV-04.
//
// Tabela Métrica · Papel · Fonte · Baseline · Agora · Meta · Estado, com filtros,
// e três cards laterais (modelo aplicado, armadilhas, origem do baseline no
// Scaffold). Baseline e caso de negócio são do Scaffold: o Signal lê, mede
// contra eles e decide. A tela não permite editar o que não é dela.
//
// Layout: a lateral desce abaixo de 1280px e, abaixo de 1024px, a tabela fica
// com Métrica, Agora, Meta e Estado (classes em signal.css). O nome da métrica
// não passa de 160px.

import { Button, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import { generatePlan } from "@/app/(signal)/actions/plan";
import {
  getInitiativePlan,
  type InitiativePlan,
  type PlanMetricRow,
} from "@/app/(signal)/actions/plan-read";
import {
  filterPlan,
  formatMetricValue,
  PLAN_ROLE_META,
  PLAN_ROLE_ORDER,
  PLAN_STATE_META,
} from "@/lib/signal/plan";
import {
  type ChipOption,
  Eyebrow,
  FilterChips,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useModal,
  useSignalData,
} from "./base";
import { MetricModal, ProposeMetricForm } from "./plan-modals";

const ROLE_FILTERS: ChipOption[] = PLAN_ROLE_ORDER.map((r) => ({
  id: r,
  label: PLAN_ROLE_META[r].label,
}));

const STATE_FILTERS: ChipOption[] = (
  Object.keys(PLAN_STATE_META) as (keyof typeof PLAN_STATE_META)[]
).map((s) => ({
  id: s,
  label: PLAN_STATE_META[s].label,
  tone: PLAN_STATE_META[s].tone,
}));

const HEAD: [string, string][] = [
  ["Métrica", ""],
  ["Papel", "sg-col-role"],
  ["Fonte", "sg-col-source"],
  ["Baseline", "sg-col-baseline"],
  ["Agora", ""],
  ["Meta", ""],
  ["Estado", ""],
];

function StateChip({ row }: { row: PlanMetricRow }) {
  return (
    <span
      className="mono"
      style={{
        justifySelf: "start",
        fontSize: 10.5,
        fontWeight: 700,
        padding: "2px 9px",
        borderRadius: 99,
        background: `var(--${row.stateTone}-soft)`,
        color: `var(--${row.stateTone}-text)`,
      }}
    >
      {row.stateLabel}
    </span>
  );
}

function PlanRow({ row, onOpen }: { row: PlanMetricRow; onOpen: () => void }) {
  const num = {
    fontSize: 12.5,
    fontVariantNumeric: "tabular-nums",
    color: "var(--ink)",
  } as const;
  return (
    <button
      className="sg-plan-row btn"
      onClick={onOpen}
      style={{
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--hairline)",
        cursor: "pointer",
        opacity: row.inVerdict ? 1 : 0.78,
      }}
      type="button"
    >
      <span className="sg-plan-name">
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          {row.name}
        </span>
        <span
          className="sg-plan-role-inline mono"
          style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
        >
          {row.roleLabel}
        </span>
        {row.inVerdict ? null : (
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: "var(--amber-text)",
            }}
          >
            Fora do veredito até aprovar
          </span>
        )}
      </span>
      <span
        className="sg-col-role"
        style={{ fontSize: 12, color: "var(--ink-muted)" }}
      >
        {row.roleLabel}
      </span>
      <span
        className="sg-col-source"
        style={{
          fontSize: 11.5,
          color:
            row.source?.healthy === false
              ? "var(--amber-text)"
              : "var(--ink-muted)",
        }}
      >
        {row.source?.label ?? "—"}
      </span>
      <span className="sg-col-baseline" style={num}>
        {formatMetricValue(row.baseline)}
      </span>
      <span style={num}>{formatMetricValue(row.current)}</span>
      <span style={num}>{formatMetricValue(row.target)}</span>
      <StateChip row={row} />
    </button>
  );
}

function PlanTable({
  rows,
  onOpen,
}: {
  rows: PlanMetricRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="sg-plan-scroll">
      <div className="sg-plan-table">
        <div
          className="sg-plan-row"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          {HEAD.map(([label, cls]) => (
            <span className={cls} key={label}>
              <Eyebrow>{label}</Eyebrow>
            </span>
          ))}
        </div>
        {rows.map((r) => (
          <PlanRow key={r.id} onOpen={() => onOpen(r.id)} row={r} />
        ))}
      </div>
    </div>
  );
}

function SideCards({ plan }: { plan: InitiativePlan }) {
  const { model, baselineOrigin } = plan;
  const p = { margin: "0 0 6px", fontSize: 12.5, lineHeight: 1.55 } as const;
  return (
    <aside aria-label="Contexto do plano" className="sg-plan-side">
      <SectionCard
        subtitle={
          model !== null
            ? `${model.versionLabel} · janela mínima de ${model.sampleWindowWeeks} semanas`
            : ""
        }
        title="Modelo aplicado"
      >
        {model ? (
          <>
            <p style={{ ...p, fontWeight: 700 }}>{model.name}</p>
            <Eyebrow>Contrafactual</Eyebrow>
            <p style={{ ...p, color: "var(--ink-muted)" }}>
              {model.counterfactual}
            </p>
          </>
        ) : (
          <p style={{ ...p, color: "var(--ink-faint)" }}>
            Nenhum modelo aplicado a esta iniciativa.
          </p>
        )}
      </SectionCard>

      {model !== null && model.traps.length > 0 ? (
        <SectionCard title="Onde o número costuma mentir">
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 12.5,
              lineHeight: 1.6,
            }}
          >
            {model.traps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title="Baseline no Scaffold">
        <p style={{ ...p, color: "var(--ink-muted)" }}>
          {baselineOrigin.scaffoldTrackId
            ? "A baseline e a meta vêm do gate da trilha no Scaffold."
            : "Iniciativa sem trilha no Scaffold."}
        </p>
        <p
          className="mono"
          style={{ margin: 0, fontSize: 11, color: "var(--ink-faint)" }}
        >
          {baselineOrigin.baselineVersion
            ? `Baseline v${baselineOrigin.baselineVersion} assinada`
            : "Baseline ainda não assinada"}
        </p>
      </SectionCard>
    </aside>
  );
}

function EmptyPlan({
  code,
  denial,
  onGenerated,
}: {
  code: string;
  denial: string | null;
  onGenerated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Sem permissão o rótulo some e o botão junto (SmartEmptyState só desenha a
  // ação com rótulo).
  const idle = busy ? "Gerando…" : "Gerar plano do modelo";
  const label = denial === null ? idle : "";
  const generate = async () => {
    setBusy(true);
    setError(null);
    const res = await generatePlan({ initiativeCode: code });
    setBusy(false);
    if (res.ok) {
      onGenerated();
      return;
    }
    setError(res.error);
  };
  return (
    <>
      <SmartEmptyState
        icon="ruler"
        onPrimary={generate}
        primaryLabel={label}
        subtitle={
          denial ??
          "O plano nasce do modelo da forma de trabalho: uma primária que decide o veredito e as métricas que a guardam. Sem plano, não há como dizer qual número decide."
        }
        title="Esta iniciativa ainda não tem plano de medição"
        tone="accent"
      />
      {error ? (
        <p role="alert" style={{ color: "var(--red-text)", fontSize: 12.5 }}>
          {error}
        </p>
      ) : null}
    </>
  );
}

export function PlanTab({ code }: { code: string }) {
  const modal = useModal();
  const [role, setRole] = useState("all");
  const [state, setState] = useState("all");
  const fetcher = useCallback(() => getInitiativePlan({ code }), [code]);
  const { data, loading, error, reload } =
    useSignalData<InitiativePlan>(fetcher);

  const rows = useMemo(
    () =>
      filterPlan(data?.metrics ?? [], {
        role: role === "all" ? undefined : role,
        state: state === "all" ? undefined : state,
      }),
    [data, role, state]
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  // Skeleton no lugar do plano, nunca tela em branco (SG-DEV-06).
  if (loading || !data) {
    return <SkeletonRows cols="1fr" rows={5} />;
  }
  if (data.metrics.length === 0) {
    return (
      <EmptyPlan
        code={code}
        denial={data.decisionDenial}
        onGenerated={reload}
      />
    );
  }

  const open = (id: string) =>
    modal.open(
      <MetricModal
        canMapSource={data.canMapSource}
        denial={data.decisionDenial}
        mappings={data.mappings}
        metricId={id}
        onChanged={reload}
        owners={data.owners}
      />
    );
  const propose = () =>
    modal.open(<ProposeMetricForm initiativeCode={code} onSaved={reload} />);

  return (
    <div className="sg-plan">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--gap)",
          minWidth: 0,
        }}
      >
        <FilterChips
          allLabel="Todos os papéis"
          ariaLabel="Filtrar métricas por papel"
          onChange={setRole}
          options={ROLE_FILTERS}
          value={role}
        />
        <FilterChips
          allLabel="Todos os estados"
          ariaLabel="Filtrar métricas por estado"
          onChange={setState}
          options={STATE_FILTERS}
          value={state}
        />
        <SectionCard
          action={
            <Button
              disabled={data.decisionDenial !== null}
              icon="plus"
              onClick={propose}
              size="sm"
              title={data.decisionDenial ?? undefined}
              variant="ghost"
            >
              Propor métrica
            </Button>
          }
          title={`${rows.length} de ${data.metrics.length} métricas`}
        >
          {rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-faint)" }}>
              Nenhuma métrica neste filtro.
            </p>
          ) : (
            <PlanTable onOpen={open} rows={rows} />
          )}
        </SectionCard>
      </div>
      <SideCards plan={data} />
    </div>
  );
}
