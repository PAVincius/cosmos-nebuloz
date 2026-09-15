"use client";

// Caso de negócio — detalhe. S-06.
// Port de `scaffold-baseline.jsx` + `scaffold-screens-baseline.jsx`.
//
// Três painéis carregam a tela: métricas (editáveis só em rascunho), contrato
// com o Signal (qual versão atravessa a fronteira) e histórico de versões.
//
// O card do Signal é o que torna a fronteira legível NO PONTO DE EMISSÃO: quem
// escreve a promessa vê, ali, o que vai ser apurado e por quanto tempo. Deixar
// isso para uma tela de relatório significaria descobrir a fronteira depois de
// atravessá-la.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type BusinessCaseDetail,
  contestBusinessCase,
  getBusinessCase,
  newVersionFromSigned,
  signBusinessCase,
  submitForSignature,
} from "@/app/(scaffold)/actions/business-case";
import {
  Eyebrow,
  Field,
  Input,
  MetaCell,
  ModalShell,
  ScreenError,
  SkeletonCard,
  StatusDot,
  Textarea,
} from "../base";
import { BC_STATE } from "./baselines";

const CONFIDENCE: Record<
  string,
  { label: string; tone: "green" | "amber" | "neutral"; hint: string }
> = {
  MEASURED: {
    label: "medido",
    tone: "green",
    hint: "tem série de dados por trás",
  },
  ESTIMATED: {
    label: "estimado",
    tone: "amber",
    hint: "tem cálculo, não série",
  },
  DECLARED: {
    label: "declarado",
    tone: "neutral",
    hint: "alguém afirmou; nada mediu",
  },
};

const BENEFIT_KIND: Record<string, string> = {
  COST_AVOIDED: "Custo evitado",
  REVENUE_PROTECTED: "Receita protegida",
  REVENUE_NEW: "Receita nova",
};

type Metric = BusinessCaseDetail["metrics"][number];

/** Delta percentual entre linha de base e meta. Derivado, nunca armazenado:
 *  guardar o delta criaria uma segunda fonte de verdade para a mesma
 *  aritmética, e as duas divergem no primeiro arredondamento. */
function deltaPct(m: Metric): number {
  const base = Number(m.baseValue);
  const target = Number(m.targetValue);
  if (!base) {
    return 0;
  }
  return Math.round(((target - base) / base) * 1000) / 10;
}

function ConfPill({ conf }: { conf: string }) {
  const c = CONFIDENCE[conf] ?? CONFIDENCE.DECLARED;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 99,
        background: `var(--${c?.tone}-soft)`,
        border: `1px solid rgba(var(--${c?.tone}-rgb),.3)`,
        fontSize: 10.5,
        fontWeight: 700,
        color: `var(--${c?.tone}-text)`,
      }}
      title={c?.hint}
    >
      {c?.label}
    </span>
  );
}

function MetricRow({ m, last }: { m: Metric; last: boolean }) {
  const d = deltaPct(m);
  const good = m.direction === "DOWN" ? d < 0 : d > 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(150px,1.6fr) 88px 88px 92px minmax(120px,1fr)",
        gap: 12,
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: last ? "none" : "1px solid var(--hairline)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
          {m.label}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 2 }}>
          {m.sourceLabel} · {m.sampleLabel}
        </div>
      </div>
      <div>
        <Eyebrow style={{ fontSize: 10.5, marginBottom: 3 }}>
          Linha de base
        </Eyebrow>
        <div
          className="mono"
          style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}
        >
          {m.baseValue}
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "var(--ink-faint)",
              marginLeft: 3,
            }}
          >
            {m.unit}
          </span>
        </div>
      </div>
      <div>
        <Eyebrow style={{ fontSize: 10.5, marginBottom: 3 }}>Meta</Eyebrow>
        <div
          className="mono"
          style={{ fontSize: 14, fontWeight: 800, color: "var(--accent-text)" }}
        >
          {m.targetValue}
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: "var(--ink-faint)",
              marginLeft: 3,
            }}
          >
            {m.unit}
          </span>
        </div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon
          name={m.direction === "DOWN" ? "trendingDown" : "trendingUp"}
          size={14}
          strokeWidth={2.2}
          style={{ color: good ? "var(--green-text)" : "var(--red-text)" }}
        />
        <span
          className="mono"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: good ? "var(--green-text)" : "var(--red-text)",
          }}
        >
          {d > 0 ? "+" : ""}
          {d}%
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ConfPill conf={m.confidence} />
      </div>
    </div>
  );
}

/** O que atravessa a fronteira para o Signal, e quando.
 *
 *  A distinção "vigente" versus "em edição" é o motivo de `signedVersionId` e
 *  `currentVersionId` serem colunas separadas: o Signal continua apurando
 *  contra a assinada enquanto um rascunho existe por cima. */
function SignalContractCard({ bc }: { bc: BusinessCaseDetail }) {
  const signed = bc.versions.find((v) => v.id === bc.signedVersionId);
  const editing =
    bc.currentVersionId && bc.currentVersionId !== bc.signedVersionId
      ? bc.versions.find((v) => v.id === bc.currentVersionId)
      : null;

  return (
    <SectionCard
      icon="pulse"
      subtitle={
        signed
          ? editing
            ? `${signed.label} vigente · ${editing.label} em edição`
            : "O que atravessa a fronteira"
          : "O que atravessa a fronteira quando isto for assinado"
      }
      title="Contrato com o Signal"
      tone={signed ? "green" : "neutral"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {(
          [
            ["Métricas", `${bc.metrics.length} com linha de base e meta`],
            [
              "Janela de apuração",
              bc.windowMonths
                ? `${bc.windowMonths} meses · leitura ${bc.cadence === "quarterly" ? "trimestral" : "mensal"}`
                : "definida na assinatura",
            ],
            [
              "Início",
              bc.windowStart ? bc.windowStart.toLocaleDateString("pt-BR") : "—",
            ],
            ["Versão vigente", signed?.label ?? "nenhuma — nada assinado"],
            ["Referência", signed?.contentHash ?? "—"],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 12.5,
            }}
          >
            <span style={{ color: "var(--ink-faint)" }}>{k}</span>
            <span
              style={{
                fontWeight: 700,
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              {v}
            </span>
          </div>
        ))}

        <div
          style={{
            padding: "11px 12px",
            borderRadius: "var(--r-md)",
            background: signed ? "var(--green-soft)" : "var(--surface-2)",
            border: `1px solid ${signed ? "rgba(var(--green-rgb),.3)" : "var(--hairline)"}`,
          }}
        >
          {signed ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 5,
                }}
              >
                <Icon
                  name="lock"
                  size={14}
                  style={{ color: "var(--green-text)" }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--green-text)",
                  }}
                >
                  Artefato emitido
                </span>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  lineHeight: 1.5,
                }}
              >
                O Signal apura contra{" "}
                <span
                  className="mono"
                  style={{ fontWeight: 700, color: "var(--ink)" }}
                >
                  {bc.code}·{signed.label}
                </span>{" "}
                e não pode editá-lo.
                {editing && (
                  <>
                    {" "}
                    A{" "}
                    <span
                      className="mono"
                      style={{ fontWeight: 700, color: "var(--accent-text)" }}
                    >
                      {editing.label}
                    </span>{" "}
                    em edição só passa a valer quando o patrocinador assinar.
                  </>
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ink-muted)",
                lineHeight: 1.5,
              }}
            >
              Enquanto não houver assinatura, o Signal mostra esta iniciativa
              como{" "}
              <strong style={{ color: "var(--amber-text)" }}>
                aguardando promessa
              </strong>{" "}
              — não como zero.
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function VersionTrail({ bc }: { bc: BusinessCaseDetail }) {
  return (
    <SectionCard
      icon="history"
      subtitle="Assinado é imutável — alteração cria versão"
      title="Histórico de versões"
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {bc.versions.map((v, i) => {
          const s = BC_STATE[v.state] ?? BC_STATE.DRAFT;
          const last = i === bc.versions.length - 1;
          return (
            <div
              key={v.id}
              style={{ display: "flex", gap: 12, paddingBottom: last ? 0 : 16 }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 99,
                    display: "grid",
                    placeItems: "center",
                    background: `var(--${s?.tone}-soft)`,
                    color: `var(--${s?.tone}-text)`,
                    border: `1px solid rgba(var(--${s?.tone}-rgb),.35)`,
                  }}
                >
                  <Icon
                    name={v.state === "SIGNED" ? "lock" : "fileText"}
                    size={12}
                    strokeWidth={2.2}
                  />
                </span>
                {!last && (
                  <span
                    style={{
                      flex: 1,
                      width: 1,
                      background: "var(--hairline)",
                      marginTop: 4,
                    }}
                  />
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: "var(--ink)",
                    }}
                  >
                    {v.label}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                    {(v.signedAt ?? v.authoredAt).toLocaleDateString("pt-BR")}
                    {v.signedByLabel ? ` · ${v.signedByLabel}` : ""}
                  </span>
                  {v.contentHash && (
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        padding: "1px 6px",
                        borderRadius: 99,
                        background: "var(--chip-bg)",
                        color: "var(--ink-faint)",
                      }}
                    >
                      ref {v.contentHash}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-muted)",
                    marginTop: 3,
                    lineHeight: 1.45,
                  }}
                >
                  {v.note}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export default function BaselineDetailScreen({ param }: { param?: string }) {
  const router = useRouter();
  const [bc, setBc] = useState<BusinessCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Assinar e contestar são as duas saídas de AWAITING. Cada uma é um ato com
  // nome — o modal existe para a pessoa escrever o dela antes de decidir.
  const [modal, setModal] = useState<"sign" | "contest" | null>(null);
  const [form, setForm] = useState({
    signer: "",
    by: "",
    role: "",
    objection: "",
    asks: "",
  });
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!param) {
      return;
    }
    setError(null);
    const res = await getBusinessCase({ businessCaseId: param });
    if (res.ok) {
      setBc(res.data);
    } else {
      setError(res.error);
    }
  }, [param]);

  useEffect(() => {
    load();
  }, [load]);

  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
      setBusy(true);
      const res = await fn();
      setBusy(false);
      if (res.ok) {
        await load();
      } else {
        setError(res.error ?? "Erro inesperado");
      }
    },
    [load]
  );

  const openModal = useCallback((kind: "sign" | "contest") => {
    setForm({ signer: "", by: "", role: "", objection: "", asks: "" });
    setModalError(null);
    setModal(kind);
  }, []);

  const submitModal = useCallback(async () => {
    if (!(bc?.currentVersionId && modal)) {
      return;
    }
    setBusy(true);
    const res =
      modal === "sign"
        ? await signBusinessCase({
            businessCaseId: bc.id,
            versionId: bc.currentVersionId,
            signedByLabel: form.signer,
          })
        : await contestBusinessCase({
            businessCaseId: bc.id,
            versionId: bc.currentVersionId,
            byLabel: form.by,
            roleLabel: form.role,
            objection: form.objection,
            asks: form.asks,
          });
    setBusy(false);
    if (res.ok) {
      setModal(null);
      await load();
      return;
    }
    // A recusa fica no modal: a pessoa está no meio de escrever a objeção.
    setModalError(res.error);
  }, [bc, modal, form, load]);

  if (error) {
    return <ScreenError message={error} onRetry={load} />;
  }
  if (!bc) {
    return <SkeletonCard />;
  }

  const s = BC_STATE[bc.state] ?? BC_STATE.DRAFT;
  const current = bc.versions.find((v) => v.id === bc.currentVersionId);
  const canSign = form.signer.trim().length >= 4;
  const canContest =
    form.by.trim().length > 0 &&
    form.role.trim().length > 0 &&
    form.objection.trim().length >= 20 &&
    form.asks.trim().length >= 4;

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow={`trilha ${bc.trackCode}`}
        meta={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <StatusDot
              label={s?.label ?? bc.state}
              tone={s?.tone ?? "neutral"}
            />
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--ink-faint)",
              }}
            >
              {bc.code} · {current?.label ?? "—"}
            </span>
          </div>
        }
        subtitle={s?.desc}
        title={bc.processName}
      >
        <Button
          icon="arrowLeft"
          onClick={() => router.push("/scaffold/baselines")}
          variant="secondary"
        >
          Casos de negócio
        </Button>
        {bc.state === "DRAFT" && (
          <Button
            disabled={busy || bc.metrics.length === 0}
            icon="mail"
            onClick={() =>
              run(() => submitForSignature({ businessCaseId: bc.id }))
            }
            variant="primary"
          >
            Enviar para assinatura
          </Button>
        )}
        {bc.state === "AWAITING" && (
          <>
            <Button
              disabled={busy}
              icon="x"
              onClick={() => openModal("contest")}
              variant="secondary"
            >
              Contestar
            </Button>
            <Button
              disabled={busy}
              icon="check"
              onClick={() => openModal("sign")}
              variant="primary"
            >
              Assinar
            </Button>
          </>
        )}
        {(bc.state === "SIGNED" || bc.state === "CONTESTED") && (
          <Button
            disabled={busy}
            icon="plus"
            onClick={() =>
              run(() =>
                newVersionFromSigned({
                  businessCaseId: bc.id,
                  note:
                    bc.state === "CONTESTED"
                      ? `Revisão após objeção de ${bc.openContest?.byLabel ?? "contraparte"}.`
                      : "Revisão pós-assinatura — a versão vigente continua valendo até a nova ser assinada.",
                })
              )
            }
            variant="primary"
          >
            Nova versão
          </Button>
        )}
      </PageHeader>

      {bc.openContest && (
        <div
          style={{
            display: "flex",
            gap: 13,
            padding: "16px 18px",
            borderRadius: "var(--r-lg)",
            background: "var(--red-soft)",
            border: "1px solid rgba(var(--red-rgb),.32)",
          }}
        >
          <Icon
            name="alert"
            size={17}
            style={{ color: "var(--red-text)", flexShrink: 0, marginTop: 2 }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}
              >
                {bc.openContest.byLabel}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                {bc.openContest.roleLabel} ·{" "}
                {bc.openContest.createdAt.toLocaleDateString("pt-BR")}
              </span>
            </div>
            <p
              style={{
                fontSize: 13.5,
                color: "var(--ink-muted)",
                margin: "6px 0 0",
                lineHeight: 1.55,
                maxWidth: "80ch",
              }}
            >
              “{bc.openContest.objection}”
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginTop: 9,
                paddingTop: 9,
                borderTop: "1px solid rgba(var(--red-rgb),.22)",
              }}
            >
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--red-text)",
                }}
              >
                Pede: {bc.openContest.asks}
              </span>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(420px,1.9fr) minmax(300px,1fr)",
          gap: "var(--gap)",
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <SectionCard
            action={
              bc.state === "DRAFT" ? null : (
                <Icon
                  name="lock"
                  size={14}
                  style={{ color: "var(--ink-faint)" }}
                />
              )
            }
            bodyStyle={{ padding: 0 }}
            icon="scale"
            subtitle={
              bc.state === "DRAFT"
                ? "Editável — a linha de base precisa de série medida, não de opinião."
                : "Travado: o artefato saiu do rascunho."
            }
            title="Métricas e metas"
          >
            {bc.metrics.length === 0 ? (
              <div
                style={{
                  padding: "16px",
                  fontSize: 12.5,
                  color: "var(--ink-faint)",
                  lineHeight: 1.6,
                }}
              >
                Nenhuma métrica ainda. Sem ao menos uma, o artefato não pode ser
                enviado para assinatura — promessa vazia não se assina.
              </div>
            ) : (
              bc.metrics.map((m, i) => (
                <MetricRow
                  key={m.key}
                  last={i === bc.metrics.length - 1}
                  m={m}
                />
              ))
            )}
          </SectionCard>

          <SectionCard
            icon="target"
            subtitle="A ponte com o razão contábil"
            title="Benefício declarado"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 9,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="mono display"
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--ink)",
                    letterSpacing: "-.02em",
                  }}
                >
                  {bc.benefitAnnualCents === null ||
                  bc.benefitAnnualCents === undefined
                    ? "—"
                    : (bc.benefitAnnualCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      })}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
                  ao ano
                </span>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <Badge tone="blue">
                  {BENEFIT_KIND[bc.benefitKind] ?? bc.benefitKind}
                </Badge>
                {/* Hard versus soft é distinção do CFO, não nossa. Esconder
                    faria toda promessa parecer hard. */}
                <Badge tone={bc.benefitHard ? "green" : "amber"}>
                  {bc.benefitHard ? "Hard benefit" : "Soft benefit"}
                </Badge>
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                  lineHeight: 1.5,
                }}
              >
                {bc.benefitBasis}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingTop: 11,
                  borderTop: "1px solid var(--hairline)",
                }}
              >
                <Icon
                  name={bc.financeReviewedAt ? "check" : "alert"}
                  size={13}
                  style={{
                    color: bc.financeReviewedAt
                      ? "var(--green-text)"
                      : "var(--amber-text)",
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: bc.financeReviewedAt
                      ? "var(--green-text)"
                      : "var(--amber-text)",
                  }}
                >
                  {bc.financeReviewedAt
                    ? `Visado por Finanças em ${bc.financeReviewedAt.toLocaleDateString("pt-BR")}`
                    : "Sem visto de Finanças"}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <SignalContractCard bc={bc} />
          <VersionTrail bc={bc} />
          <SectionCard
            icon="clock"
            subtitle="Por quanto tempo o Signal mede"
            title="Janela de apuração"
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))",
                gap: 12,
              }}
            >
              <MetaCell
                label="Duração"
                value={bc.windowMonths ? `${bc.windowMonths} meses` : "—"}
              />
              <MetaCell
                label="Cadência"
                value={bc.cadence === "quarterly" ? "trimestral" : "mensal"}
              />
              <MetaCell
                label="Início"
                value={
                  bc.windowStart
                    ? bc.windowStart.toLocaleDateString("pt-BR")
                    : "na assinatura"
                }
              />
            </div>
          </SectionCard>
        </div>
      </div>

      {modal === "sign" ? (
        <ModalShell
          actions={
            <>
              <Button
                disabled={busy}
                onClick={() => setModal(null)}
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button
                disabled={busy || !canSign}
                icon="check"
                onClick={submitModal}
              >
                Assinar {current?.label ?? ""}
              </Button>
            </>
          }
          icon="check"
          onClose={() => setModal(null)}
          subtitle="S-06 · a versão assinada é imutável; o Signal apura contra ela até outra ser assinada"
          title={`Assinar o caso de negócio ${bc.code}`}
          tone="green"
          width={520}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
              <MetaCell label="Métricas" value={String(bc.metrics.length)} />
              <MetaCell
                label="Janela"
                value={bc.windowMonths ? `${bc.windowMonths} meses` : "—"}
              />
              <MetaCell
                label="Benefício"
                value={
                  bc.benefitAnnualCents === null
                    ? "—"
                    : (bc.benefitAnnualCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      })
                }
              />
            </div>
            <Field
              error={modalError ?? undefined}
              hint="O nome fica no registro da versão. Não é login — é quem responde pela promessa."
              htmlFor="bc-signer"
              label="Quem assina"
              required
            >
              <Input
                autoFocus
                disabled={busy}
                id="bc-signer"
                invalid={Boolean(modalError)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, signer: e.target.value }))
                }
                placeholder="Nome completo"
                value={form.signer}
              />
            </Field>
          </div>
        </ModalShell>
      ) : null}

      {modal === "contest" ? (
        <ModalShell
          actions={
            <>
              <Button
                disabled={busy}
                onClick={() => setModal(null)}
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button
                disabled={busy || !canContest}
                icon="x"
                onClick={submitModal}
              >
                Registrar objeção
              </Button>
            </>
          }
          icon="x"
          onClose={() => setModal(null)}
          subtitle="Devolve o caso para revisão. A objeção fica no histórico junto da versão que a recebeu."
          title={`Contestar ${bc.code} · ${current?.label ?? ""}`}
          tone="amber"
          width={560}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <Field htmlFor="bc-by" label="Quem contesta" required>
                <Input
                  autoFocus
                  disabled={busy}
                  id="bc-by"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, by: e.target.value }))
                  }
                  placeholder="Nome"
                  value={form.by}
                />
              </Field>
              <Field htmlFor="bc-role" label="Papel" required>
                <Input
                  disabled={busy}
                  id="bc-role"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value }))
                  }
                  placeholder="Ex.: Diretor médico"
                  value={form.role}
                />
              </Field>
            </div>
            <Field
              hint="Mínimo de 20 caracteres. Devolver sem explicar não é objeção — é silêncio com botão."
              htmlFor="bc-objection"
              label="Objeção"
              required
            >
              <Textarea
                disabled={busy}
                id="bc-objection"
                onChange={(e) =>
                  setForm((f) => ({ ...f, objection: e.target.value }))
                }
                placeholder="O que na promessa não se sustenta, e por quê."
                value={form.objection}
              />
            </Field>
            <Field
              error={modalError ?? undefined}
              htmlFor="bc-asks"
              label="O que precisa mudar"
              required
            >
              <Textarea
                disabled={busy}
                id="bc-asks"
                invalid={Boolean(modalError)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, asks: e.target.value }))
                }
                placeholder="Qual métrica, meta ou base de cálculo precisa ser revista."
                style={{ minHeight: 60 }}
                value={form.asks}
              />
            </Field>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
