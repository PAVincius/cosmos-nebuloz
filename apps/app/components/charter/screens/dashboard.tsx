"use client";

// Visão Geral de Governança — FR-1. Port de `charter-screens-1.jsx`.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { getDashboard } from "@/app/(charter)/actions/dashboard";
import {
  getSetupProgress,
  type SetupProgress,
} from "@/app/(charter)/actions/setup";
import {
  DATA_CLASS_LABEL,
  DATA_CLASS_TONE,
  RISK_CATEGORY_LABEL,
  RISK_CATEGORY_TONE,
  SECTION_STATUS_LABEL,
  SECTION_STATUS_TONE,
  type Tone,
} from "@/lib/charter/rules";
import {
  BarRow,
  Legend,
  MetaCell,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  TableHead,
  TableRow,
} from "../base";
import { SetupPanel } from "../setup-panel";
import { useCharterData } from "../use-charter-data";

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Rascunho", tone: "accent" },
  SUBMITTED: { label: "Submetido", tone: "blue" },
  REVIEW: { label: "Em revisão", tone: "amber" },
  CHANGES: { label: "Ajustes pedidos", tone: "amber" },
  APPROVED: { label: "Aprovado", tone: "green" },
  RESTRICTED: { label: "Com restrições", tone: "green" },
  BLOCKED: { label: "Bloqueado", tone: "red" },
  ARCHIVED: { label: "Arquivado", tone: "accent" },
};

const QUEUE_COLS = "minmax(0,1fr) 128px 96px 84px 90px";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

function slaToneFor(sla: number | null): Tone {
  if (sla === null) {
    return "accent";
  }
  if (sla <= 1) {
    return "red";
  }
  if (sla <= 3) {
    return "amber";
  }
  return "green";
}

type CopiaVazia = {
  title: string;
  subtitle: string;
  tone: Tone;
  icon: IconName;
};

/**
 * Título, subtítulo, tom e ícone de uma SmartEmptyState que depende do
 * progresso de montagem, não do fato de a lista estar vazia. `setupProgress`
 * só é não nulo quando `getSetupProgress` respondeu com sucesso — enquanto
 * ainda carrega ou depois que falhou, os dois casos ficam indistinguíveis
 * (`null`), e sem saber se a montagem está incompleta o card não pode
 * escolher a frase que afirma uma conformidade que ninguém verificou. Errar
 * para o lado de não afirmar.
 */
function copiaDeMontagem(
  setupProgress: SetupProgress | null,
  incompleta: { title: string; subtitle: string },
  completa: { title: string; subtitle: string }
): CopiaVazia {
  if (!setupProgress) {
    return {
      title: "Nada aqui.",
      subtitle: "Não foi possível confirmar o estado da montagem inicial.",
      tone: "accent",
      icon: "inbox",
    };
  }
  return setupProgress.completo
    ? { ...completa, tone: "green", icon: "check" }
    : { ...incompleta, tone: "accent", icon: "inbox" };
}

export default function DashboardScreen() {
  const router = useRouter();
  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getDashboard(), [])
  );
  // Carrega separado do dashboard, não junto: se a montagem falhar, o
  // dashboard tem de renderizar mesmo assim — o painel é aditivo.
  const { data: setupProgress } = useCharterData(
    useCallback(() => getSetupProgress(), [])
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const k = data?.kpis;
  const filaVazia = copiaDeMontagem(
    setupProgress,
    {
      title: "Nenhum caso foi submetido ainda",
      subtitle: "A fila aparece aqui assim que o primeiro caso for submetido.",
    },
    {
      title: "Nada aguardando decisão",
      subtitle: "Toda submissão foi revisada dentro do SLA.",
    }
  );
  const alertasVazio = copiaDeMontagem(
    setupProgress,
    {
      title: "Ainda não há o que monitorar",
      subtitle:
        "Alertas aparecem aqui quando houver SLA, mitigação ou seção de política para acompanhar.",
    },
    {
      title: "Nada exige ação agora",
      subtitle:
        "Nenhum SLA vencido, nenhuma mitigação atrasada e nenhuma seção de política fora de publicação.",
    }
  );

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={
          data
            ? `${data.org.name} · postura ${data.org.posture}${data.org.geo ? ` · ${data.org.geo}` : ""}`
            : "Carregando…"
        }
        meta={
          data?.policy ? (
            <>
              <Badge dot tone="green">
                Política {data.policy.version} publicada
              </Badge>
              <Badge
                tone={
                  data.policy.daysToReview !== null &&
                  data.policy.daysToReview < 90
                    ? "amber"
                    : "accent"
                }
              >
                Revisão em {data.policy.daysToReview} dias
              </Badge>
              <Badge tone="accent">
                {data.policy.publishedCount}/{data.policy.sections.length}{" "}
                seções publicadas
              </Badge>
            </>
          ) : null
        }
        subtitle="Onde a política está, o que está esperando decisão e o que já é evidência auditável."
        title="Visão Geral de Governança"
        tone="accent"
      >
        <Button
          icon="download"
          onClick={() => router.push("/charter/audit")}
          variant="secondary"
        >
          Exportar resumo
        </Button>
        <Button icon="upload" onClick={() => router.push("/charter/policy")}>
          Publicar atualização
        </Button>
      </PageHeader>

      {setupProgress && (
        <div style={{ marginBottom: "var(--gap)" }}>
          <SetupPanel progresso={setupProgress} />
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        {loading || !k ? (
          <>
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </>
        ) : (
          <>
            <KpiCard
              delta={`${k.slaAtRisk} com SLA em risco`}
              deltaTone="amber"
              hint="Legal e Segurança"
              icon="inbox"
              label="Casos aguardando decisão"
              tone="amber"
              value={k.pending}
            />
            <KpiCard
              hint="score ≥ 16"
              icon="alert"
              label="Casos de alto risco ativos"
              tone="red"
              value={k.highRisk}
            />
            <KpiCard
              hint={`${k.ackDone}/${k.ackAll} pessoas`}
              icon="userCheck"
              label="Aceite de política"
              tone="green"
              unit="%"
              value={k.ackPct}
            />
            <KpiCard
              hint={`${k.vendorsTotal} no registro`}
              icon="plug"
              label="Fornecedores em revisão"
              tone="accent"
              value={k.vendorsInReview}
            />
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
          alignItems: "start",
        }}
      >
        <SectionCard
          action={
            <Button
              iconRight="arrowRight"
              onClick={() => router.push("/charter/cases")}
              size="sm"
              variant="soft"
            >
              Abrir casos
            </Button>
          }
          bodyStyle={{ padding: 0 }}
          icon="clock"
          subtitle="Ordenada por folga de SLA — o que vence primeiro aparece primeiro"
          title="Fila de revisão"
          tone="amber"
        >
          {loading || !data ? (
            <div
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : data.queue.length === 0 ? (
            <SmartEmptyState
              icon={filaVazia.icon}
              subtitle={filaVazia.subtitle}
              title={filaVazia.title}
              tone={filaVazia.tone}
            />
          ) : (
            <>
              <TableHead
                cols={QUEUE_COLS}
                labels={[
                  "Caso de uso",
                  "Classe de dado",
                  "Risco",
                  "Revisor",
                  { t: "SLA", align: "right" },
                ]}
              />
              {data.queue.map((u, i) => {
                const st = STATUS_META[u.status] ?? STATUS_META.DRAFT;
                const slaTone = slaToneFor(u.sla);
                return (
                  <TableRow
                    cols={QUEUE_COLS}
                    key={u.code}
                    label={`Abrir ${u.code}`}
                    last={i === data.queue.length - 1}
                    onClick={() => router.push(`/charter/case/${u.code}`)}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: "var(--ink-faint)",
                          }}
                        >
                          {u.code}
                        </span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ink)",
                          marginTop: 3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {u.title}
                      </div>
                    </div>
                    <Badge tone={DATA_CLASS_TONE[u.dataClass]}>
                      {DATA_CLASS_LABEL[u.dataClass]}
                    </Badge>
                    <span
                      className="mono"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: `var(--${u.riskTone}-text)`,
                      }}
                    >
                      {u.score} · {u.riskLabel}
                    </span>
                    {/* Cor + palavra: "sem revisor" escrito, não só vermelho. */}
                    <span
                      style={{
                        fontSize: 12,
                        color: u.reviewerName
                          ? "var(--ink-muted)"
                          : "var(--red-text)",
                        fontWeight: u.reviewerName ? 500 : 700,
                      }}
                    >
                      {u.reviewerName?.split(" ")[0] ?? "sem revisor"}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: `var(--${slaTone}-text)`,
                        }}
                      >
                        {u.sla === null
                          ? "—"
                          : u.sla < 0
                            ? "vencido"
                            : `${u.sla}d`}
                      </span>
                      <div style={{ marginTop: 4 }}>
                        <Progress
                          height={4}
                          tone={slaTone}
                          value={
                            u.sla === null || !u.slaTotal
                              ? 0
                              : Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    100 - (u.sla / u.slaTotal) * 100
                                  )
                                )
                          }
                        />
                      </div>
                    </div>
                  </TableRow>
                );
              })}
            </>
          )}
        </SectionCard>

        <SectionCard
          action={
            <Button
              iconRight="arrowRight"
              onClick={() => router.push("/charter/policy")}
              size="sm"
              variant="soft"
            >
              Abrir
            </Button>
          }
          icon="fileText"
          subtitle={
            data?.policy
              ? `${data.policy.name} · ${data.policy.version}`
              : undefined
          }
          title="Saúde da política"
          tone="accent"
        >
          {data?.policy ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {data.policy.sections.map((s) => (
                  <div
                    key={s.ordinal}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 2px",
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "var(--ink-faint)",
                        width: 16,
                        flexShrink: 0,
                      }}
                    >
                      {String(s.ordinal).padStart(2, "0")}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.name}
                    </span>
                    <Badge tone={SECTION_STATUS_TONE[s.status]}>
                      {SECTION_STATUS_LABEL[s.status]}
                    </Badge>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px solid var(--hairline)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <MetaCell
                  label="Aprovador"
                  value={data.policy.approver ?? "—"}
                />
                <MetaCell
                  label="Próxima revisão"
                  mono
                  value={fmtDate(data.policy.nextReview)}
                />
              </div>
            </>
          ) : (
            <SmartEmptyState
              icon="fileText"
              onPrimary={() => router.push("/charter/policy")}
              primaryLabel="Abrir Políticas"
              subtitle="Nenhuma política foi criada nesta organização ainda."
              title="Sem política"
            />
          )}
        </SectionCard>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.15fr",
          gap: "var(--gap)",
          alignItems: "start",
        }}
      >
        <SectionCard
          action={
            <Button
              iconRight="arrowRight"
              onClick={() => router.push("/charter/risk")}
              size="sm"
              variant="soft"
            >
              Matriz
            </Button>
          }
          icon="target"
          subtitle="Casos ativos com severidade 4 ou 5 na categoria"
          title="Exposição por categoria de risco"
          tone="red"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {(data?.categoryExposure ?? []).map((c) => (
              <BarRow
                hint={`de ${data?.activeCount ?? 0} casos ativos`}
                key={c.id}
                label={
                  RISK_CATEGORY_LABEL[c.id as keyof typeof RISK_CATEGORY_LABEL]
                }
                max={data?.activeCount || 1}
                onClick={() => router.push("/charter/risk")}
                tone={
                  RISK_CATEGORY_TONE[c.id as keyof typeof RISK_CATEGORY_TONE]
                }
                value={c.count}
              />
            ))}
          </div>
          <Legend
            items={[
              { tone: "red", label: "Privacidade e regulatório" },
              { tone: "amber", label: "Segurança e viés" },
              { tone: "accent", label: "PI, operacional, reputacional" },
            ]}
          />
        </SectionCard>

        <SectionCard
          bodyStyle={{ padding: 0 }}
          icon="bell"
          subtitle="Ordem de atenção — cada alerta abre onde a ação acontece"
          title="Alertas de governança"
          tone="amber"
        >
          {(data?.alerts ?? []).length === 0 ? (
            <SmartEmptyState
              icon={alertasVazio.icon}
              subtitle={alertasVazio.subtitle}
              title={alertasVazio.title}
              tone={alertasVazio.tone}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {(data?.alerts ?? []).map((a, i, arr) => (
                <button
                  className="navitem btn"
                  key={a.title}
                  onClick={() =>
                    router.push(
                      a.param
                        ? `/charter/${a.screen}/${a.param}`
                        : `/charter/${a.screen}`
                    )
                  }
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: "13px 16px",
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                    borderBottom:
                      i < arr.length - 1 ? "1px solid var(--hairline)" : "none",
                    background: "transparent",
                    textAlign: "left",
                    width: "100%",
                    cursor: "pointer",
                  }}
                  type="button"
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      background: `var(--${a.tone}-soft)`,
                      color: `var(--${a.tone}-text)`,
                      border: `1px solid rgba(var(--${a.tone}-rgb),.24)`,
                    }}
                  >
                    <Icon
                      name={a.icon as IconName}
                      size={14}
                      strokeWidth={2.1}
                    />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--ink)",
                        lineHeight: 1.4,
                      }}
                    >
                      {a.title}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11.5,
                        color: "var(--ink-muted)",
                        marginTop: 2,
                      }}
                    >
                      {a.sub}
                    </span>
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: `var(--${a.tone}-text)`,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {a.action}
                    <Icon name="chevronRight" size={13} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
