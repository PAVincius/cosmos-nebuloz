"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  ErrorState,
  KpiCard,
  PageHeader,
  SectionCard,
  Switch,
} from "@repo/design-system/cosmos/kit";
// workflows.tsx — Workflows (no-code automation list), wired to listWorkflows()/
// toggleWorkflowActive() over the existing BpmnDefinition model. Mirrors the
// cosmos.html handoff (design_handoff_cosmos_full/screen-bundle-5.jsx
// WorkflowsScreen): trigger → actions, run counts, on/off toggle.
//
// No "Criar workflow" affordance: the no-code builder is a BPMN canvas
// (bpmn-js, apps/app/lib/bpmn/compiler.ts) that has no reachable route in
// this app yet — apps/app/e2e/bpmn-canvas.spec.ts targets
// /workflows/[teamId]/bpmn, but that page does not exist. Nothing to link
// to, so the create affordance is intentionally left out rather than
// building a second drag/drop builder.
import { useCallback, useEffect, useState } from "react";
import {
  listWorkflows,
  toggleWorkflowActive,
  type WorkflowView,
} from "@/app/(cosmos)/actions/workflows";
import { EmptyState } from "../empty-state";
import { useActionToast } from "../use-action-toast";

// FR-030: "one active per owner+entityType". O escopo de exclusividade é o
// trio (entityType, ownerType, ownerId) — duas ativas em escopos diferentes é
// o caso normal, duas no mesmo escopo é o defeito que toggleWorkflowActive
// impede. A tela precisa mostrar o escopo, senão "ativo" não informa nada.
function scopeKey(w: WorkflowView): string {
  return `${w.entityType}|${w.ownerType}|${w.ownerId}`;
}

function WorkflowRow({
  workflow,
  replaces,
  onToggled,
}: {
  workflow: WorkflowView;
  /** Automação ativa do mesmo escopo que esta ativação vai desligar. */
  replaces: WorkflowView | null;
  onToggled: () => void;
}) {
  const [toggling, setToggling] = useState(false);

  const toggle = async () => {
    if (toggling) {
      return;
    }
    setToggling(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => toggleWorkflowActive({ id: workflow.id, active: !workflow.active }),
      {
        loading: workflow.active
          ? "Desativando workflow..."
          : "Ativando workflow...",
        success: workflow.active ? "Workflow desativado." : "Workflow ativado.",
        error: (err: string) => `Não foi possível atualizar o workflow: ${err}`,
      }
    );
    setToggling(false);
    if (res.ok) {
      onToggled();
    }
  };

  const toggleLabel = (() => {
    if (workflow.active) {
      return `Desativar ${workflow.name}`;
    }
    return replaces
      ? `Ativar ${workflow.name} (substitui ${replaces.name})`
      : `Ativar ${workflow.name}`;
  })();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(0,1.3fr) 132px minmax(0,1fr) 110px 90px 46px",
        alignItems: "center",
        gap: 16,
        padding: "14px 18px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: workflow.active ? "var(--surface)" : "var(--surface-2)",
        opacity: workflow.active ? 1 : 0.72,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 34,
            height: 34,
            borderRadius: "var(--r-md)",
            flexShrink: 0,
            color: "var(--accent)",
            background: "var(--accent-soft)",
            border: "1px solid rgba(var(--accent-rgb),.22)",
          }}
        >
          <Icon name="flow" size={17} strokeWidth={2} />
        </span>
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {workflow.name}
        </span>
      </div>
      <div>
        <span
          className="mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".04em",
            color: "var(--ink-muted)",
            background: "var(--chip-bg)",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            padding: "3px 8px",
            whiteSpace: "nowrap",
          }}
          title="Escopo de exclusividade: só uma automação fica ativa por tipo de entidade e dono"
        >
          {workflow.entityType} · {workflow.ownerType}
        </span>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}
      >
        <Icon
          name="zap"
          size={13}
          style={{ color: "var(--amber)", flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: 12,
            color: "var(--ink-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {workflow.triggerLabel ?? "sem gatilho definido"}
        </span>
      </div>
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-muted)",
            background: "var(--chip-bg)",
            border: "1px solid var(--hairline)",
            borderRadius: 99,
            padding: "3px 10px",
          }}
        >
          {workflow.actionCount} ação{workflow.actionCount === 1 ? "" : "ões"}
        </span>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          className="mono"
          style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}
        >
          {workflow.runCount}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--ink-subtle)",
            fontWeight: 600,
            letterSpacing: ".03em",
          }}
        >
          EXECUÇÕES
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {/* O Switch do kit não recebe rótulo; envolvê-lo num button nativo dá
            nome acessível (e teclado) sem tocar no kit compartilhado. O rótulo
            é onde a substituição do AC-004 é anunciada antes do clique. */}
        <button
          aria-label={toggleLabel}
          onClick={toggle}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            display: "flex",
            cursor: "pointer",
          }}
          title={toggleLabel}
          type="button"
        >
          <Switch on={workflow.active} />
        </button>
      </div>
    </div>
  );
}

function WorkflowsBody() {
  const [workflows, setWorkflows] = useState<WorkflowView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listWorkflows().then((r) => {
      if (r.ok) {
        setWorkflows(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = workflows.filter((w) => w.active).length;
  const runs = workflows.reduce((sum, w) => sum + w.runCount, 0);
  const actions = workflows.reduce((sum, w) => sum + w.actionCount, 0);
  // Qual automação está ativa em cada escopo — é ela que a ativação de uma
  // irmã vai desligar (AC-001/AC-004). Derivado da lista, nunca persistido.
  const activeByScope = new Map(
    workflows.filter((w) => w.active).map((w) => [scopeKey(w), w])
  );

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Automação"
        meta={
          <>
            <Badge icon="flow" tone="accent">
              {workflows.length} workflows
            </Badge>
            <Badge dot tone="green">
              {active} ativos
            </Badge>
          </>
        }
        subtitle="Automações no-code do portfólio. Cada workflow dispara ações a partir de eventos — promover gates, notificar, sincronizar ferramentas."
        title="Workflows"
      />

      {error && (
        <ErrorState message="Não foi possível carregar os workflows." />
      )}

      {!error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: "var(--gap)",
            marginBottom: "var(--gap)",
          }}
        >
          <KpiCard
            hint={`de ${workflows.length} criados`}
            icon="flow"
            label="Workflows ativos"
            tone="accent"
            value={active}
          />
          <KpiCard
            hint="ações automáticas"
            icon="zap"
            label="Execuções registradas"
            tone="purple"
            value={runs}
          />
          <KpiCard
            hint="somadas entre os workflows"
            icon="sliders"
            label="Ações configuradas"
            tone="blue"
            value={actions}
          />
        </div>
      )}

      <SectionCard
        bodyStyle={{ padding: 12 }}
        icon="flow"
        subtitle="Gatilho → ações · ordenados por atividade"
        title="Automações"
        tone="accent"
      >
        {!(error || loading) && workflows.length === 0 && (
          <EmptyState
            description="Nenhuma automação configurada para este tenant ainda."
            icon="flow"
            title="Nenhum workflow"
          />
        )}
        {!(error || loading) && workflows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {workflows.map((w) => (
              <WorkflowRow
                key={w.id}
                onToggled={load}
                replaces={
                  w.active ? null : (activeByScope.get(scopeKey(w)) ?? null)
                }
                workflow={w}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function WorkflowsScreen() {
  return <WorkflowsBody />;
}
