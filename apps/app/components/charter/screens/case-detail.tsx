"use client";

// Caso — detalhe (FR-5) + Decisão (FR-6). Port de `charter-screens-2.jsx`.

import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { listAuditForEntity } from "@/app/(charter)/actions/audit";
import {
  decideCase,
  getCase,
  submitDraftCase,
} from "@/app/(charter)/actions/cases";
import {
  createMitigation,
  type MitigationRow as MitigationTableRow,
} from "@/app/(charter)/actions/risk";
import { getSettings } from "@/app/(charter)/actions/settings";
import {
  DATA_CLASS_LABEL,
  DATA_CLASS_RULE,
  DATA_CLASS_TONE,
  dataClassWeight,
  HITL_LABEL,
  RISK_CATEGORY_DESC,
  RISK_CATEGORY_LABEL,
  recommendPath,
  slaTone,
  type Tone,
} from "@/lib/charter/rules";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { BackLink } from "../back-link";
import {
  BarRow,
  MetaCell,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  Tabs,
} from "../base";
import { Callout, CheckRow } from "../form-kit";
import { ModalProvider, useModal } from "../modal";
import { DecisionModal } from "../modals/decision";
import { MitigationModal } from "../modals/mitigation";
import { AuditList, MitigationTable, RiskMiniMatrix } from "../parts";
import { FS } from "../type-scale";
import { useCharterData } from "../use-charter-data";
import { GatedFooterAction } from "./gated-footer-action";

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

const DECIDABLE = ["SUBMITTED", "REVIEW", "CHANGES"];
const HAS_TRAIL_SHORTCUT = ["APPROVED", "RESTRICTED", "BLOCKED"];

/** Tom por severidade declarada da própria categoria — não o tom fixo da
 *  categoria (esse é para comparar entre casos, este é para ler este caso). */
function riskValueTone(value: number): Tone {
  if (value >= 4) {
    return "red";
  }
  if (value >= 3) {
    return "amber";
  }
  return "green";
}

function CaseDetailInner({ param }: { param?: string }) {
  const router = useRouter();
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState("overview");
  // Motivo da última recusa do gate de submissão. Fica na tela, não só no
  // toast: o requester precisa ler o que ajustar depois que o toast sumiu.
  const [gateError, setGateError] = useState<string | null>(null);

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
  if (loading || !data) {
    return (
      <div className="fade-in">
        <SkeletonCard />
      </div>
    );
  }

  const meta = STATUS_META[data.status] ?? STATUS_META.DRAFT;
  const rec = recommendPath(
    data.dataClass,
    data.exposure as never,
    data.criticality as never
  );
  const eligible =
    data.vendorMaxClass !== null &&
    dataClassWeight(data.vendorMaxClass) >= dataClassWeight(data.dataClass);
  const lastDecider = data.decisions[0]?.deciderRole ?? "—";
  const mitigationRows: MitigationTableRow[] = data.mitigations.map((m) => ({
    id: m.id,
    code: m.code,
    useCaseCode: data.code,
    useCaseTitle: data.title,
    category: m.category,
    action: m.action,
    ownerName: m.ownerName,
    dueDate: m.dueDate,
    status: m.status,
    overdue: m.overdue,
  }));

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

  // Sem `disabled` preventivo: a action roda o gate e decide; a tela mostra o
  // motivo. Um botão apagado não diz ao requester o que falta.
  const submitDraft = () =>
    startTransition(async () => {
      const res = await runWithToast(
        () => submitDraftCase({ caseId: data.id }),
        {
          loading: "Submetendo…",
          success: (d) => `Caso ${d.code} submetido — caminho: ${d.path}`,
        }
      );
      if (res.ok) {
        setGateError(null);
        reload();
        audit.reload();
      } else {
        setGateError(res.error);
      }
    });

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

  return (
    <div className="fade-in">
      <BackLink
        label="Casos de Uso"
        onClick={() => router.push("/charter/cases")}
      />

      <PageHeader
        eyebrow={
          <>
            {data.department ?? "—"} · caso de uso ·{" "}
            {EXPOSURE_LABEL[data.exposure]?.toLowerCase() ?? "—"}
            {data.submittedAt &&
              ` · submetido ${new Date(data.submittedAt).toLocaleDateString("pt-BR")}`}
          </>
        }
        meta={
          <>
            <Badge
              dot={["REVIEW", "SUBMITTED"].includes(data.status)}
              tone={meta.tone}
            >
              {meta.label}
            </Badge>
            <Badge tone={DATA_CLASS_TONE[data.dataClass]}>
              {DATA_CLASS_LABEL[data.dataClass]}
            </Badge>
            <Badge tone={data.riskTone as Tone}>
              Risco {data.score} · {data.riskLabel}
            </Badge>
            {data.hitl && (
              <Badge tone="accent">
                {HITL_LABEL[data.hitl as keyof typeof HITL_LABEL]}
              </Badge>
            )}
          </>
        }
        subtitle={data.objective}
        title={data.title}
        tone={meta.tone}
      >
        {data.status === "DRAFT" && (
          <Button disabled={pending} icon="send" onClick={submitDraft}>
            Submeter para revisão
          </Button>
        )}
        {DECIDABLE.includes(data.status) && (
          <GatedFooterAction
            allowed={data.can.decide}
            icon="gavel"
            onClick={openDecision}
            reason="Seu papel de governança não decide caso de uso"
          >
            Registrar decisão
          </GatedFooterAction>
        )}
        {HAS_TRAIL_SHORTCUT.includes(data.status) && (
          <Button
            icon="history"
            onClick={() => setTab("trail")}
            variant="secondary"
          >
            Ver trilha
          </Button>
        )}
      </PageHeader>

      {gateError && (
        <Callout icon="ban" style={{ marginBottom: "var(--gap)" }} tone="red">
          {gateError}
          {data.vendorId && !eligible && (
            <>
              {" "}
              <Link
                href={`/charter/vendor/${data.vendorCode}`}
                style={{ color: "var(--red-text)", fontWeight: 700 }}
              >
                Ajustar fornecedor {data.vendorName}
              </Link>
            </>
          )}
        </Callout>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        <KpiCard
          hint={`sev ${data.severity} × prob ${data.likelihood}`}
          icon="target"
          label="Risco composto"
          tone={data.riskTone as Tone}
          value={data.score}
        />
        <KpiCard
          hint={DATA_CLASS_RULE[data.dataClass]}
          icon="shield"
          label="Classe de dado"
          tone={DATA_CLASS_TONE[data.dataClass]}
          value={DATA_CLASS_LABEL[data.dataClass].split(" ")[0]}
        />
        <KpiCard
          hint={`prazo ${rec.slaDays} dias úteis`}
          icon="clock"
          label="SLA restante"
          tone={slaTone(data.slaRemaining)}
          unit={data.slaRemaining === null ? "" : "d"}
          value={data.slaRemaining === null ? "—" : data.slaRemaining}
        />
        <KpiCard
          hint={`${data.mitigations.filter((m) => m.status === "DONE").length} concluídas`}
          icon="users"
          label="Mitigações vinculadas"
          tone="accent"
          value={data.mitigations.length}
        />
      </div>

      <Tabs
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Visão geral" },
          { id: "risk", label: "Risco" },
          {
            id: "mitigations",
            label: "Mitigações",
            count: data.mitigations.length,
          },
          { id: "trail", label: "Trilha", count: audit.data?.length ?? 0 },
        ]}
        value={tab}
      />

      {tab === "overview" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--gap)",
            alignItems: "start",
          }}
        >
          <SectionCard
            icon="fileText"
            subtitle="O que foi declarado no intake — base de toda a decisão"
            title="Declaração do caso"
          >
            <p
              style={{
                fontSize: FS.base,
                lineHeight: 1.7,
                color: "var(--ink)",
                marginBottom: 16,
              }}
            >
              {data.objective}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {[
                ["Área", data.department ?? "—"],
                ["Responsável", data.ownerName ?? "—"],
                ["Exposição", EXPOSURE_LABEL[data.exposure] ?? data.exposure],
                [
                  "Criticidade",
                  CRIT_LABEL[data.criticality] ?? data.criticality,
                ],
                [
                  "Revisão humana",
                  data.hitl
                    ? HITL_LABEL[data.hitl as keyof typeof HITL_LABEL]
                    : "—",
                ],
                ["Decidido por", lastDecider],
              ].map(([l, val]) => (
                <div
                  key={l}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 9,
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  <MetaCell label={l} value={val} />
                </div>
              ))}
            </div>
          </SectionCard>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--gap)",
            }}
          >
            <SectionCard
              icon="route"
              subtitle="Calculado pela política — não escolhido pelo requester"
              title="Caminho de aprovação derivado"
              tone={rec.tone}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 11 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 9,
                    background: `rgba(var(--${rec.tone}-rgb),.08)`,
                    border: `1px solid rgba(var(--${rec.tone}-rgb),.22)`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: FS.base,
                        fontWeight: 700,
                        color: `var(--${rec.tone}-text)`,
                      }}
                    >
                      {rec.path}
                    </div>
                    <div
                      style={{
                        fontSize: FS.nota,
                        color: "var(--ink-muted)",
                        marginTop: 2,
                      }}
                    >
                      SLA de {rec.slaDays} dias úteis · exige{" "}
                      {HITL_LABEL[rec.hitl].toLowerCase()}
                    </div>
                  </div>
                </div>
                <Callout icon="shield" tone={DATA_CLASS_TONE[data.dataClass]}>
                  {DATA_CLASS_RULE[data.dataClass]}
                </Callout>
              </div>
            </SectionCard>

            {data.vendorId && (
              <SectionCard
                action={
                  <Button
                    icon="arrowRight"
                    onClick={() =>
                      router.push(`/charter/vendor/${data.vendorCode}`)
                    }
                    size="sm"
                    variant="soft"
                  >
                    Abrir
                  </Button>
                }
                icon="plug"
                subtitle={`${data.vendorCategory ?? "sem categoria"} · ${data.vendorRegion ?? "região não declarada"}`}
                title="Fornecedor"
                tone={eligible ? "blue" : "red"}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    marginBottom: 13,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: FS.base,
                        fontWeight: 700,
                        color: "var(--ink)",
                      }}
                    >
                      {data.vendorName}
                    </div>
                    <div
                      style={{ fontSize: FS.nota, color: "var(--ink-muted)" }}
                    >
                      {data.vendorDpa ? "DPA assinado" : "sem DPA"} · retenção{" "}
                      {data.vendorRetention?.toLowerCase() ?? "não declarada"}
                    </div>
                  </div>
                </div>
                {!eligible && (
                  <Callout icon="ban" tone="red">
                    Este fornecedor não é elegível a dado{" "}
                    <strong>{DATA_CLASS_LABEL[data.dataClass]}</strong> — classe
                    máxima permitida é{" "}
                    {data.vendorMaxClass
                      ? DATA_CLASS_LABEL[data.vendorMaxClass]
                      : "nenhuma"}
                    . Aprovar exige troca de fornecedor ou exceção formal com
                    mitigação compensatória.
                  </Callout>
                )}
              </SectionCard>
            )}

            {data.status === "RESTRICTED" && data.restrictions.length > 0 && (
              <SectionCard
                icon="lock"
                subtitle="Condições que acompanham o caso até serem levantadas"
                title="Restrições ativas"
                tone="green"
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {data.restrictions.map((r) => (
                    <CheckRow
                      checked
                      disabled
                      key={r}
                      label={r}
                      onToggle={() => {
                        // Somente leitura: restrição é levantada via nova decisão.
                      }}
                      tone="green"
                    />
                  ))}
                </div>
              </SectionCard>
            )}
            {data.status === "BLOCKED" && data.blockReason && (
              <SectionCard icon="ban" title="Motivo do bloqueio" tone="red">
                <p style={{ margin: 0, fontSize: FS.base, lineHeight: 1.65 }}>
                  {data.blockReason}
                </p>
              </SectionCard>
            )}
            {data.status === "CHANGES" && data.changeRequest && (
              <SectionCard
                icon="arrowLeft"
                title="Ajustes solicitados"
                tone="amber"
              >
                <p style={{ margin: 0, fontSize: FS.base, lineHeight: 1.65 }}>
                  {data.changeRequest}
                </p>
              </SectionCard>
            )}
            {data.vendorIneligible && (
              <SectionCard
                icon="alert"
                title="Fornecedor ficou inelegível"
                tone="red"
              >
                <p style={{ margin: 0, fontSize: FS.base, lineHeight: 1.65 }}>
                  A postura contratual do fornecedor mudou e não cobre mais a
                  classe de dado deste caso. Exige revisão humana antes de
                  continuar.
                </p>
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {tab === "risk" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: "var(--gap)",
            alignItems: "start",
          }}
        >
          <SectionCard
            icon="target"
            subtitle="Severidade declarada de 1 a 5 · o composto usa a maior severidade"
            title="Perfil de risco por categoria"
            tone="red"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {(
                Object.entries(RISK_CATEGORY_LABEL) as [
                  keyof typeof RISK_CATEGORY_LABEL,
                  string,
                ][]
              ).map(([id, label]) => {
                const key = id.toLowerCase() as keyof typeof data.risks;
                const val = data.risks[key] ?? 1;
                return (
                  <BarRow
                    hint={RISK_CATEGORY_DESC[id]}
                    key={id}
                    label={label}
                    max={5}
                    suffix="/5"
                    tone={riskValueTone(val)}
                    value={val}
                  />
                );
              })}
            </div>
          </SectionCard>
          <SectionCard
            icon="gauge"
            subtitle="Severidade × probabilidade"
            title="Posição na matriz"
            tone={data.riskTone as Tone}
          >
            <RiskMiniMatrix lik={data.likelihood} sev={data.severity} />
            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 9,
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                }}
              >
                <MetaCell
                  label="Severidade"
                  mono
                  value={`${data.severity}/5`}
                />
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 9,
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                }}
              >
                <MetaCell
                  label="Probabilidade"
                  mono
                  value={`${data.likelihood}/5`}
                />
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 9,
                  background: `rgba(var(--${data.riskTone}-rgb),.09)`,
                  border: `1px solid rgba(var(--${data.riskTone}-rgb),.22)`,
                }}
              >
                <MetaCell
                  label="Composto"
                  mono
                  tone={data.riskTone as Tone}
                  value={data.score}
                />
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "mitigations" && (
        <SectionCard
          action={
            <Button
              icon="plus"
              onClick={openMitigation}
              size="sm"
              variant="soft"
            >
              Nova mitigação
            </Button>
          }
          bodyStyle={{ padding: 0 }}
          icon="shield"
          subtitle="Cada risco alto exige dono e prazo — sem isso a aprovação não sustenta auditoria"
          title="Mitigações deste caso"
          tone="amber"
        >
          {mitigationRows.length === 0 ? (
            <SmartEmptyState
              icon="shield"
              onPrimary={openMitigation}
              primaryIcon="plus"
              primaryLabel="Nova mitigação"
              subtitle="Casos com severidade 4 ou 5 precisam de pelo menos uma mitigação com dono e prazo."
              title="Nenhuma mitigação registrada"
              tone="amber"
            />
          ) : (
            <MitigationTable rows={mitigationRows} />
          )}
        </SectionCard>
      )}

      {tab === "trail" && (
        <SectionCard
          bodyStyle={{ padding: 0 }}
          icon="history"
          subtitle="Append-only — nenhuma entrada é editada ou removida"
          title="Trilha de auditoria do caso"
        >
          {(audit.data ?? []).length === 0 ? (
            <SmartEmptyState
              icon="history"
              subtitle="A trilha começa na submissão do caso."
              title="Sem entradas ainda"
            />
          ) : (
            <AuditList rows={audit.data ?? []} />
          )}
        </SectionCard>
      )}
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
