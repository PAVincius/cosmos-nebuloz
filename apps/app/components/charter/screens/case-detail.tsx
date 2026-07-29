"use client";

// Caso — detalhe (FR-5) + Decisão (FR-6).

import { type ReactNode, useCallback, useState, useTransition } from "react";
import { listAuditForEntity } from "@/app/(charter)/actions/audit";
import { decideCase, getCase } from "@/app/(charter)/actions/cases";
import { createMitigation } from "@/app/(charter)/actions/risk";
import { getSettings } from "@/app/(charter)/actions/settings";
import {
  DATA_CLASS_LABEL,
  DATA_CLASS_TONE,
  HITL_LABEL,
  RISK_CATEGORY_LABEL,
  RISK_CATEGORY_TONE,
  slaTone,
  type Tone,
} from "@/lib/charter/rules";
import { Badge, Button, PageHeader, SectionCard } from "../../cosmos/kit";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  BarRow,
  Eyebrow,
  MetaCell,
  ScreenError,
  SmartEmptyState,
  StatusDot,
  Tabs,
} from "../base";
import { ModalProvider, useModal } from "../modal";
import { DecisionModal, MitigationModal } from "../modals";
import { useCharterData } from "../use-charter-data";

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Rascunho", tone: "accent" },
  SUBMITTED: { label: "Submetido", tone: "blue" },
  REVIEW: { label: "Em revisão", tone: "amber" },
  CHANGES: { label: "Ajustes pedidos", tone: "amber" },
  APPROVED: { label: "Aprovado", tone: "green" },
  RESTRICTED: { label: "Aprovado com restrições", tone: "green" },
  BLOCKED: { label: "Bloqueado", tone: "red" },
  ARCHIVED: { label: "Arquivado", tone: "accent" },
};

const EXPOSURE_LABEL: Record<string, string> = {
  INTERNAL: "Interno",
  EXTERNAL: "Externo",
};
const CRIT_LABEL: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
};

/** Heatmap 5×5 com a posição do caso plotada. */
function RiskPlot({
  severity,
  likelihood,
}: {
  severity: number;
  likelihood: number;
}) {
  const cells: ReactNode[] = [];
  for (let sev = 5; sev >= 1; sev--) {
    for (let like = 1; like <= 5; like++) {
      const score = sev * like;
      const tone = score >= 16 ? "red" : score >= 9 ? "amber" : "green";
      const here = sev === severity && like === likelihood;
      cells.push(
        <div
          key={`${sev}-${like}`}
          style={{
            aspectRatio: "1",
            borderRadius: "var(--r-xs)",
            display: "grid",
            placeItems: "center",
            fontSize: 10.5,
            fontWeight: 700,
            fontFamily: "var(--font-jetbrains-mono), monospace",
            background: here ? `var(--${tone})` : `var(--${tone}-soft)`,
            color: here ? "var(--accent-fg)" : `var(--${tone}-text)`,
            border: here
              ? `2px solid var(--${tone})`
              : "1px solid var(--hairline)",
            boxShadow: here
              ? `0 0 14px rgba(var(--${tone}-rgb),.6)`
              : undefined,
          }}
        >
          {here ? score : ""}
        </div>
      );
    }
  }
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: 4,
        }}
      >
        {cells}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 7,
          fontSize: 10,
          color: "var(--ink-faint)",
        }}
      >
        <span>← probabilidade</span>
        <span>severidade ↑</span>
      </div>
    </div>
  );
}

function CaseDetailInner({ param }: { param?: string }) {
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState("risco");

  const code = param ?? "";
  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getCase(code), [code])
  );
  // Papel da sessão para o rodapé do modal de decisão: a trilha registra quem
  // decidiu e sob que papel, então a tela precisa mostrar isso antes de gravar.
  const settings = useCharterData(useCallback(() => getSettings(), []));
  const audit = useCharterData(
    useCallback(
      () =>
        data?.id
          ? listAuditForEntity(data.id)
          : Promise.resolve({ ok: true as const, data: [] }),
      [data?.id]
    )
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading) {
    return (
      <div className="fade-in">
        <div className="skeleton" style={{ height: 96, borderRadius: 14 }} />
      </div>
    );
  }
  if (!data) {
    return (
      <SmartEmptyState
        icon="inbox"
        subtitle={`Nenhum caso com o código ${code} nesta organização.`}
        title="Caso não encontrado"
      />
    );
  }

  const meta = STATUS_META[data.status] ?? STATUS_META.DRAFT;
  const tone = slaTone(data.slaRemaining);
  const overdue = data.slaRemaining !== null && data.slaRemaining < 0;

  const openDecision = () =>
    open(
      <DecisionModal
        approvalPath={data.approvalPath}
        caseCode={data.code}
        caseTitle={data.title}
        dataClass={data.dataClass}
        deciderName={
          settings.data?.members.find(
            (m) => m.role === settings.data?.activeRole
          )?.name ?? "Você"
        }
        deciderRole={
          settings.data?.roles.find((r) => r.id === settings.data?.activeRole)
            ?.label ?? "—"
        }
        onClose={close}
        onSubmit={(input) =>
          startTransition(async () => {
            const res = await runWithToast(
              () => decideCase({ code: data.code, ...input }),
              { loading: "Registrando decisão…", success: "Decisão registrada" }
            );
            if (res.ok) {
              close();
              reload();
              audit.reload();
            }
          })
        }
        pending={pending}
        riskLabel={data.riskLabel}
        riskTone={data.riskTone}
        score={data.score}
        vendorName={data.vendorName}
      />
    );

  const openMitigation = () =>
    open(
      <MitigationModal
        cases={[{ code: data.code, title: data.title }]}
        defaultCase={data.code}
        onClose={close}
        onSubmit={(input) =>
          startTransition(async () => {
            const res = await runWithToast(() => createMitigation(input), {
              loading: "Criando mitigação…",
              success: (d) => `Mitigação ${d.code} criada`,
            });
            if (res.ok) {
              close();
              reload();
            }
          })
        }
        pending={pending}
      />
    );

  const risks = Object.entries(RISK_CATEGORY_LABEL) as [
    keyof typeof RISK_CATEGORY_LABEL,
    string,
  ][];
  const riskKey: Record<string, string> = {
    PRIVACY: "privacy",
    REGULATORY: "regulatory",
    SECURITY: "security",
    BIAS: "bias",
    IP: "ip",
    OPERATIONAL: "operational",
    REPUTATIONAL: "reputational",
  };

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={data.code}
        meta={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusDot label={meta.label} tone={meta.tone} />
            <Badge tone={DATA_CLASS_TONE[data.dataClass]}>
              {DATA_CLASS_LABEL[data.dataClass]}
            </Badge>
            <Badge tone={data.riskTone as Tone}>
              {data.riskLabel} · {data.score}
            </Badge>
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: `var(--${tone}-text)`,
              }}
            >
              SLA{" "}
              {data.slaRemaining === null
                ? "—"
                : overdue
                  ? "vencido"
                  : `${data.slaRemaining}/${data.slaTotal}`}
            </span>
          </div>
        }
        subtitle={data.objective}
        title={data.title}
        tone={meta.tone}
      >
        <Button icon="plus" onClick={openMitigation} variant="secondary">
          Nova mitigação
        </Button>
        <Button icon="gavel" onClick={openDecision}>
          Registrar decisão
        </Button>
      </PageHeader>

      {/* MetaCell em vez de sopa de badges: seis badges lado a lado não dizem
          qual campo é qual. */}
      <SectionCard bodyStyle={{ padding: 16 }} title="Contexto">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: 16,
          }}
        >
          <MetaCell label="Área" value={data.department ?? "—"} />
          <MetaCell label="Dono" value={data.ownerName ?? "—"} />
          <MetaCell label="Fornecedor" value={data.vendorName ?? "—"} />
          <MetaCell
            label="Exposição"
            value={EXPOSURE_LABEL[data.exposure] ?? data.exposure}
          />
          <MetaCell
            label="Criticidade"
            value={CRIT_LABEL[data.criticality] ?? data.criticality}
          />
          <MetaCell
            label="Human-in-the-loop"
            value={data.hitl ? HITL_LABEL[data.hitl as never] : "—"}
          />
          <MetaCell
            label="Caminho de aprovação"
            value={data.approvalPath ?? "—"}
          />
          <MetaCell
            label="Submetido em"
            mono
            value={
              data.submittedAt
                ? new Date(data.submittedAt).toLocaleDateString("pt-BR")
                : "—"
            }
          />
        </div>
      </SectionCard>

      {/* Estado condicional: restrições, bloqueio ou ajuste pedido. */}
      {data.status === "RESTRICTED" && data.restrictions.length > 0 && (
        <div style={{ marginTop: "var(--gap)" }}>
          <SectionCard
            icon="lock"
            subtitle="Válidas até serem levantadas ou o caso arquivado"
            title="Condições aceitas"
            tone="amber"
          >
            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 12.5,
                lineHeight: 1.7,
                color: "var(--ink)",
              }}
            >
              {data.restrictions.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </SectionCard>
        </div>
      )}
      {data.status === "BLOCKED" && data.blockReason && (
        <div style={{ marginTop: "var(--gap)" }}>
          <SectionCard icon="ban" title="Motivo do bloqueio" tone="red">
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65 }}>
              {data.blockReason}
            </p>
          </SectionCard>
        </div>
      )}
      {data.status === "CHANGES" && data.changeRequest && (
        <div style={{ marginTop: "var(--gap)" }}>
          <SectionCard icon="arrowLeft" title="Ajustes pedidos" tone="amber">
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65 }}>
              {data.changeRequest}
            </p>
          </SectionCard>
        </div>
      )}
      {data.vendorIneligible && (
        <div role="alert" style={{ marginTop: "var(--gap)" }}>
          <SectionCard
            icon="alert"
            title="Fornecedor ficou inelegível"
            tone="red"
          >
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.65 }}>
              A postura contratual do fornecedor mudou e não cobre mais a classe
              de dado deste caso. Exige revisão humana antes de continuar.
            </p>
          </SectionCard>
        </div>
      )}

      <div style={{ marginTop: "var(--gap)" }}>
        <Tabs
          onChange={setTab}
          tabs={[
            { id: "risco", label: "Perfil de risco" },
            {
              id: "mitigacoes",
              label: "Mitigações",
              count: data.mitigations.length,
            },
            { id: "decisoes", label: "Decisões", count: data.decisions.length },
            { id: "auditoria", label: "Auditoria" },
          ]}
          value={tab}
        />

        {tab === "risco" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)",
              gap: "var(--gap)",
              alignItems: "start",
            }}
          >
            <SectionCard
              subtitle="Sete categorias, 1 a 5 cada"
              title="Categorias"
            >
              {risks.map(([id, label]) => (
                <BarRow
                  key={id}
                  label={label}
                  max={5}
                  tone={RISK_CATEGORY_TONE[id]}
                  value={data.risks[riskKey[id]] ?? 1}
                />
              ))}
            </SectionCard>
            <SectionCard
              subtitle={`Severidade ${data.severity} × probabilidade ${data.likelihood} = ${data.score}`}
              title="Posição na matriz"
            >
              <RiskPlot likelihood={data.likelihood} severity={data.severity} />
              <p
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  lineHeight: 1.6,
                  marginTop: 12,
                  marginBottom: 0,
                }}
              >
                Severidade é o <strong>máximo</strong> das sete categorias, não
                a média: um risco de privacidade 5 não é diluído por seis
                categorias em 1.
              </p>
            </SectionCard>
          </div>
        )}

        {tab === "mitigacoes" && (
          <SectionCard bodyStyle={{ padding: 0 }} title="Mitigações do caso">
            {data.mitigations.length === 0 ? (
              <SmartEmptyState
                onPrimary={openMitigation}
                primaryLabel="Criar mitigação"
                subtitle="Nenhuma ação de mitigação registrada para este caso."
                title="Sem mitigações"
              />
            ) : (
              data.mitigations.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "84px minmax(0,1fr) 140px 110px 110px",
                    gap: 12,
                    padding: "11px 16px",
                    alignItems: "center",
                    borderBottom:
                      i === data.mitigations.length - 1
                        ? "none"
                        : "1px solid var(--hairline)",
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--ink-faint)" }}
                  >
                    {m.code}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--ink)" }}>
                    {m.action}
                  </span>
                  <Badge
                    tone={
                      RISK_CATEGORY_TONE[
                        m.category as keyof typeof RISK_CATEGORY_TONE
                      ]
                    }
                  >
                    {
                      RISK_CATEGORY_LABEL[
                        m.category as keyof typeof RISK_CATEGORY_LABEL
                      ]
                    }
                  </Badge>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {m.ownerName ?? "—"}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: m.overdue ? "var(--red-text)" : "var(--ink-muted)",
                    }}
                  >
                    {m.overdue
                      ? "atrasada"
                      : m.dueDate
                        ? new Date(m.dueDate).toLocaleDateString("pt-BR")
                        : "—"}
                  </span>
                </div>
              ))
            )}
          </SectionCard>
        )}

        {tab === "decisoes" && (
          <SectionCard title="Histórico de decisões">
            {data.decisions.length === 0 ? (
              <SmartEmptyState
                icon="gavel"
                subtitle="Este caso ainda não recebeu decisão de revisor."
                title="Sem decisões"
              />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {data.decisions.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      padding: 13,
                      borderRadius: "var(--r-md)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--hairline)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        marginBottom: 7,
                      }}
                    >
                      <Badge tone={STATUS_META[d.outcome]?.tone ?? "accent"}>
                        {STATUS_META[d.outcome]?.label ?? d.outcome}
                      </Badge>
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: "var(--ink-faint)" }}
                      >
                        {new Date(d.createdAt).toLocaleString("pt-BR")} ·{" "}
                        {d.deciderRole}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12.5,
                        lineHeight: 1.6,
                        color: "var(--ink-muted)",
                      }}
                    >
                      {d.rationale}
                    </p>
                    {d.conditions.length > 0 && (
                      <ol
                        style={{
                          margin: "8px 0 0",
                          paddingLeft: 18,
                          fontSize: 12,
                          lineHeight: 1.6,
                        }}
                      >
                        {d.conditions.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {tab === "auditoria" && (
          <SectionCard
            subtitle="Do mais recente ao mais antigo · append-only"
            title="Trilha de auditoria"
          >
            {(audit.data ?? []).length === 0 ? (
              <SmartEmptyState
                icon="history"
                subtitle="Nenhuma ação registrada para este caso ainda."
                title="Trilha vazia"
              />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {(audit.data ?? []).map((a) => (
                  <div
                    key={a.id}
                    style={{
                      paddingLeft: 12,
                      borderLeft: "2px solid var(--hairline-strong)",
                    }}
                  >
                    <Eyebrow>
                      {new Date(a.when).toLocaleString("pt-BR")} · {a.actor} ·{" "}
                      {a.role}
                    </Eyebrow>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--ink)",
                        marginTop: 3,
                      }}
                    >
                      {a.action}
                    </div>
                    {a.note && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--ink-muted)",
                          marginTop: 2,
                          lineHeight: 1.5,
                        }}
                      >
                        {a.note}
                      </div>
                    )}
                    {a.diff && a.diff.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {a.diff.map(([field, before, after]) => (
                          <div
                            className="mono"
                            key={field}
                            style={{
                              fontSize: 11,
                              color: "var(--ink-faint)",
                            }}
                          >
                            {field}: {before} → {after}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

export default function CaseDetailScreen({ param }: { param?: string }) {
  return (
    <ModalProvider>
      <CaseDetailInner param={param} />
    </ModalProvider>
  );
}
