"use client";

// Aba Plano 12 meses — US4. Port de `meridian-screens-2.jsx`.

import { Icon } from "@repo/design-system/cosmos/icons";
import { Button, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import type { AssessmentDetail } from "@/app/(meridian)/actions/assessments";
import { type GapRow, listGapRegister } from "@/app/(meridian)/actions/gaps";
import {
  exportPlan,
  generatePlan,
  type PlanRow,
} from "@/app/(meridian)/actions/plan";
import { AXES } from "@/lib/meridian/axes";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  useMeridianData,
} from "../base";
import { SEVERITY } from "./gap-register";

const QUARTERS = [1, 2, 3, 4];

export default function PlanoTab({
  a,
  onChanged,
}: {
  a: AssessmentDetail;
  onChanged: () => void;
}) {
  const fetcher = useCallback(
    () => listGapRegister({ assessmentId: a.id }),
    [a.id]
  );
  const { data, loading, error, reload } = useMeridianData<GapRow[]>(fetcher);
  // O plano já gravado vem no detalhe do assessment. Sem isto a aba mostrava
  // "ainda não gerado" para um plano que existe no banco, e só aparecia depois
  // de clicar em gerar — regenerando à toa o que já estava sequenciado.
  const [plan, setPlan] = useState<PlanRow[] | null>(
    a.planItems.length > 0 ? a.planItems : null
  );
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    const res = await runWithToast(() => generatePlan({ assessmentId: a.id }), {
      loading: "Gerando plano…",
      success: (rows) =>
        `${rows.length} item(ns) sequenciado(s) por ordenação topológica.`,
    });
    setBusy(false);
    if (res.ok) {
      setPlan(res.data);
      onChanged();
      reload();
    }
  };

  const doExport = async () => {
    const res = await runWithToast(() => exportPlan({ assessmentId: a.id }), {
      loading: "Montando export…",
      success: "Export pronto — o JSON está no console do navegador.",
    });
    if (res.ok) {
      // O consumidor real é o Scaffold via API; aqui o export serve de
      // conferência do contrato, não de download.
      // biome-ignore lint/suspicious/noConsole: export de conferência, pedido explicitamente pelo usuário
      console.log(JSON.stringify(res.data, null, 2));
    }
  };

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading) {
    return <SkeletonCard />;
  }

  const gaps = data ?? [];
  const items = plan ?? [];

  if (gaps.length === 0) {
    return (
      <SmartEmptyState
        icon="calendar"
        subtitle="O plano nasce da ordenação topológica do DAG de gaps. Rode o scoring primeiro."
        title="Sem gaps para sequenciar"
        tone="accent"
      />
    );
  }

  if (items.length === 0) {
    return (
      <SmartEmptyState
        icon="calendar"
        onPrimary={generate}
        primaryIcon="zap"
        primaryLabel={busy ? "Gerando…" : "Gerar plano de 12 meses"}
        subtitle={`${gaps.length} gap(s) prontos para sequenciar. A ordenação respeita todas as dependências declaradas.`}
        title="Plano ainda não gerado"
        tone="accent"
      />
    );
  }

  const byCode = new Map(gaps.map((g) => [g.code, g]));

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <SectionCard
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              disabled={busy}
              icon="refresh"
              onClick={generate}
              size="sm"
              variant="ghost"
            >
              Regerar
            </Button>
            <Button
              icon="upload"
              onClick={doExport}
              size="sm"
              variant="secondary"
            >
              Exportar JSON
            </Button>
          </div>
        }
        bodyStyle={{ padding: 0, overflowX: "auto" }}
        icon="calendar"
        subtitle="Ordenação topológica do DAG — nenhum item antes de um pré-requisito"
        title="Plano sequenciado"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(210px,1fr))",
            minWidth: 760,
          }}
        >
          {QUARTERS.map((q) => {
            const list = items.filter((p) => p.quarter === q);
            return (
              <div
                key={q}
                style={{
                  borderRight: q < 4 ? "1px solid var(--hairline)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "var(--surface-2)",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  <span
                    className="display"
                    style={{ fontSize: 13, fontWeight: 700 }}
                  >
                    Q{q}
                  </span>
                  <span
                    className="mono"
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      color: "var(--ink-faint)",
                    }}
                  >
                    {list.length} item(ns)
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: 12,
                  }}
                >
                  {list.map((p) => {
                    const g = byCode.get(p.gapCode);
                    if (!g) {
                      return null;
                    }
                    return (
                      <div
                        className="lift"
                        key={p.gapCode}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                          padding: "10px 12px",
                          borderRadius: "var(--r-md)",
                          background: "var(--surface)",
                          border: "1px solid var(--hairline)",
                          boxShadow: "var(--card-shadow)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 3,
                            background: `var(--${SEVERITY[g.severity].tone})`,
                          }}
                        />
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <span
                            className="mono"
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "var(--ink-faint)",
                            }}
                          >
                            #{p.seq} · {g.code}
                          </span>
                          <Icon
                            name={AXES[g.axis].icon}
                            size={12}
                            style={{
                              color: "var(--ink-faint)",
                              marginLeft: "auto",
                            }}
                          />
                        </span>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 600,
                            lineHeight: 1.45,
                          }}
                        >
                          {g.statement.split(":")[0]}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            color: "var(--ink-faint)",
                          }}
                        >
                          {g.ownerLabel} · esforço {g.effort}
                          {g.dependsOn.length
                            ? ` · após ${g.dependsOn.join(", ")}`
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        bodyStyle={{ padding: 0 }}
        icon="upload"
        subtitle="Contrato estável — campo removido daqui é quebra para quem consome"
        title="Export para o Scaffold"
        tone="accent"
      >
        <pre
          className="mono scroll"
          style={{
            margin: 0,
            padding: "14px 18px",
            fontSize: 10.5,
            lineHeight: 1.7,
            color: "var(--ink-muted)",
            overflowX: "auto",
            background: "var(--surface-2)",
            borderRadius: "0 0 var(--r-lg) var(--r-lg)",
          }}
        >
          {`{
  "assessment": "${a.code}", "template_version": "${a.templateVersion}",
  "axes": [{ "axis": "governance", "score": 66, "status": "overridden", "confidence": 0.91 }, …],
  "gaps": [{ "id": "G-01", "axis": "data", "severity": "high", "cost_of_delay": 88,
             "depends_on": [], "target_quarter": "Q1" }, …],
  "plan": { "capacity_assumption": null, "items": ${items.length} }
}`}
        </pre>
      </SectionCard>
    </div>
  );
}
