"use client";

// Fornecedor — detalhe (FR-9). Port de `charter-screens-3.jsx`.
// O painel de postura contratual mostra o raciocínio do teto, não só o teto.

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  getVendor,
  setVendorClauses,
  setVendorTier,
  type VendorDetail,
} from "@/app/(charter)/actions/vendors";
import {
  CLAUSE_LABEL,
  DATA_CLASS_LABEL,
  DATA_CLASS_TONE,
  type Tone,
} from "@/lib/charter/rules";
import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  SectionCard,
} from "../../cosmos/kit";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  BackLink,
  Eyebrow,
  GatedButton,
  MetaCell,
  ScreenError,
  SmartEmptyState,
  TableRow,
} from "../base";
import { Callout, CheckRow } from "../form-kit";
import { ModalProvider, useModal } from "../modal";
import { VendorTierModal } from "../modals";
import { useCharterData } from "../use-charter-data";

const CASE_COLS = "minmax(0,1fr) 120px 130px";
const SUBPROCESSOR_LIMIT = 5;
const HIGH_SCORE = 70;
const MID_SCORE = 45;

const TIER_META: Record<string, { label: string; tone: Tone }> = {
  APPROVED: { label: "Aprovado", tone: "green" },
  RESTRICTED: { label: "Restrito", tone: "amber" },
  REVIEW: { label: "Em revisão", tone: "accent" },
  BLOCKED: { label: "Bloqueado", tone: "red" },
};

function scoreTone(score: number): Tone {
  if (score >= HIGH_SCORE) {
    return "red";
  }
  if (score >= MID_SCORE) {
    return "amber";
  }
  return "green";
}

type PostureCell = {
  label: string;
  value: string;
  mono?: boolean;
  tone?: Tone;
};

const POSTURE_CELLS = (v: VendorDetail): PostureCell[] => [
  {
    label: "Região de processamento",
    value: v.region ?? "Não declarada",
    tone: v.region ? undefined : "red",
  },
  { label: "Retenção declarada", value: v.retention ?? "—", mono: true },
  {
    label: "DPA",
    value: v.dpa ? "Assinado" : "Pendente",
    tone: v.dpa ? "green" : "red",
  },
  {
    label: "Sub-processadores",
    value: String(v.subprocessors),
    mono: true,
  },
  {
    label: "Renovação",
    value: v.renewalAt
      ? new Date(v.renewalAt).toLocaleDateString("pt-BR")
      : "—",
  },
  { label: "Categoria", value: v.category ?? "—" },
];

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

function VendorDetailView({
  data,
  reload,
}: {
  data: VendorDetail;
  reload: () => void;
}) {
  const router = useRouter();
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();
  const [assigned, setAssigned] = useState<string[]>(data.clauseCodes);

  const tier = TIER_META[data.tier] ?? TIER_META.REVIEW;
  const criticalTotal = data.library.filter((c) => c.critical).length;
  // Ausentes contra a seleção em edição, não contra o servidor: o Callout tem
  // de reagir enquanto o revisor marca as caixas, não depois de salvar.
  const missing = data.library.filter(
    (c) => c.critical && !assigned.includes(c.code)
  );
  const dirty = !sameSet(assigned, data.clauseCodes);

  const toggle = (code: string) =>
    setAssigned((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );

  const saveClauses = () =>
    startTransition(async () => {
      const res = await runWithToast(
        () => setVendorClauses({ vendorId: data.id, clauseCodes: assigned }),
        {
          loading: "Recalculando teto contratual…",
          success: (d) =>
            `Teto ${d.maxClass ? DATA_CLASS_LABEL[d.maxClass] : "nenhum"}${
              d.flagged.length
                ? ` · ${d.flagged.length} caso(s) ficaram inelegíveis`
                : ""
            }`,
        }
      );
      if (res.ok) {
        reload();
      }
    });

  const openTier = () =>
    open(
      <VendorTierModal
        onClose={close}
        onSubmit={(input) =>
          startTransition(async () => {
            const res = await runWithToast(
              () =>
                setVendorTier({
                  vendorId: data.id,
                  tier: input.tier as never,
                  rationale: input.rationale,
                }),
              {
                loading: "Aplicando situação…",
                success: (d) =>
                  d.flagged.length
                    ? `Situação aplicada · ${d.flagged.length} casos ficaram inelegíveis`
                    : "Situação aplicada",
              }
            );
            if (res.ok) {
              close();
              reload();
            }
          })
        }
        pending={pending}
        vendor={data}
      />
    );

  return (
    <div className="fade-in">
      <BackLink
        label="Fornecedores"
        onClick={() => router.push("/charter/vendors")}
      />

      <PageHeader
        eyebrow={`${data.code} · ${data.category ?? "sem categoria"} · ${data.region ?? "região não declarada"}`}
        meta={
          <>
            <Badge dot={data.tier === "REVIEW"} tone={tier.tone}>
              {tier.label}
            </Badge>
            {data.maxClass ? (
              <Badge tone={DATA_CLASS_TONE[data.maxClass]}>
                Máx: {DATA_CLASS_LABEL[data.maxClass]}
              </Badge>
            ) : (
              <Badge icon="ban" tone="red">
                Sem classe permitida
              </Badge>
            )}
            <Badge tone={data.dpa ? "green" : "red"}>
              {data.dpa ? "DPA assinado" : "Sem DPA"}
            </Badge>
            <Badge tone={data.retention ? "amber" : "red"}>
              Retenção {data.retention?.toLowerCase() ?? "não declarada"}
            </Badge>
          </>
        }
        subtitle={data.notes ?? undefined}
        title={data.name}
        tone={tier.tone}
      >
        <Button icon="shield" onClick={openTier}>
          Alterar situação
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        {/* Rótulo explícito no hint: sem ele, "score 71" lê como bom (FR-8.3). */}
        <KpiCard
          hint="maior = pior · postura contratual"
          icon="gauge"
          label="Score de risco do fornecedor"
          tone={scoreTone(data.score)}
          unit="/100"
          value={data.score}
        />
        <KpiCard
          hint={
            data.linkedCases.map((c) => c.code).join(" · ") ||
            "nenhum vinculado"
          }
          icon="inbox"
          label="Casos de uso vinculados"
          tone="accent"
          value={data.linkedCases.length}
        />
        <KpiCard
          hint={
            missing.length > 0 ? `${missing.length} ausente(s)` : "completas"
          }
          icon="book"
          label="Cláusulas críticas"
          tone={missing.length > 0 ? "amber" : "green"}
          value={`${criticalTotal - missing.length}/${criticalTotal}`}
        />
        <KpiCard
          hint={
            data.subprocessors > SUBPROCESSOR_LIMIT
              ? "acima do limite"
              : "mapeados no DPA"
          }
          icon="users"
          label="Sub-processadores"
          tone={data.subprocessors > SUBPROCESSOR_LIMIT ? "amber" : "accent"}
          value={data.subprocessors}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 1fr",
          gap: "var(--gap)",
          alignItems: "start",
        }}
      >
        <SectionCard
          action={
            <Badge tone={missing.length > 0 ? "amber" : "green"}>
              {assigned.length}/{data.library.length}
            </Badge>
          }
          icon="book"
          subtitle="Marcadas = presentes no contrato vigente"
          title="Cláusulas exigidas"
          tone={missing.length > 0 ? "amber" : "green"}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {data.library.map((c) => (
              <CheckRow
                checked={assigned.includes(c.code)}
                disabled={pending}
                hint={
                  c.critical
                    ? "Cláusula crítica — ausência bloqueia dado não-público"
                    : "Recomendada"
                }
                key={c.code}
                label={CLAUSE_LABEL[c.code] ?? c.name}
                onToggle={() => toggle(c.code)}
                right={
                  <span
                    className="mono"
                    style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
                  >
                    {c.code}
                  </span>
                }
                tone={c.critical ? "green" : "accent"}
              />
            ))}
          </div>

          {missing.length > 0 && (
            <Callout icon="alert" style={{ marginTop: 14 }} tone="amber">
              {missing.length} cláusula(s) crítica(s) ausente(s):{" "}
              {missing.map((m) => CLAUSE_LABEL[m.code] ?? m.name).join("; ")}.
              Enquanto isso, o fornecedor fica limitado a dado{" "}
              {data.maxClass ? DATA_CLASS_LABEL[data.maxClass] : "nenhum"}.
            </Callout>
          )}

          {/* Salvar recalcula o teto e reavalia todo caso vinculado — por isso
              só aparece com mudança pendente, nunca como botão sempre ligado. */}
          {dirty && (
            <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
              <GatedButton
                allowed={!pending}
                icon="check"
                onClick={saveClauses}
                reason="Recálculo em andamento"
              >
                Salvar cláusulas
              </GatedButton>
              <GatedButton
                allowed={!pending}
                onClick={() => setAssigned(data.clauseCodes)}
                reason="Recálculo em andamento"
                variant="secondary"
              >
                Descartar
              </GatedButton>
            </div>
          )}
        </SectionCard>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <SectionCard
            icon="fileText"
            title="Postura contratual e de dados"
            tone="accent"
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {POSTURE_CELLS(data).map((cell) => (
                <div
                  key={cell.label}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 9,
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  <MetaCell
                    label={cell.label}
                    mono={cell.mono}
                    tone={cell.tone}
                    value={cell.value}
                  />
                </div>
              ))}
            </div>

            {/* O teto é derivado, não escolhido (ADR-0003) — o raciocínio fica
                à vista para o revisor não ter de adivinhar de onde ele veio. */}
            <Eyebrow style={{ marginTop: 14 }}>Raciocínio do teto</Eyebrow>
            <ul
              style={{
                margin: "7px 0 0",
                paddingLeft: 16,
                fontSize: 11.5,
                color: "var(--ink-muted)",
                lineHeight: 1.65,
              }}
            >
              {data.reasoning.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            bodyStyle={{ padding: 0 }}
            icon="inbox"
            subtitle="Alterar a situação afeta todos eles"
            title="Casos de uso que dependem deste fornecedor"
            tone="blue"
          >
            {data.linkedCases.length === 0 ? (
              <SmartEmptyState
                icon="inbox"
                subtitle="Este fornecedor está no registro mas não sustenta nenhum caso ativo."
                title="Nenhum caso vinculado"
                tone="blue"
              />
            ) : (
              data.linkedCases.map((c, i) => (
                <TableRow
                  cols={CASE_COLS}
                  key={c.code}
                  label={`Abrir ${c.code}`}
                  last={i === data.linkedCases.length - 1}
                  onClick={() => router.push(`/charter/case/${c.code}`)}
                >
                  <div style={{ minWidth: 0 }}>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "var(--ink-faint)",
                      }}
                    >
                      {c.code}
                    </span>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--ink)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.title}
                    </div>
                  </div>
                  <Badge tone={DATA_CLASS_TONE[c.dataClass]}>
                    {DATA_CLASS_LABEL[c.dataClass]}
                  </Badge>
                  {c.exceedsMaxClass ? (
                    <Badge tone="red">Excede o teto</Badge>
                  ) : (
                    <Badge tone="green">Dentro do teto</Badge>
                  )}
                </TableRow>
              ))
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function VendorDetailInner({ param }: { param?: string }) {
  const code = param ?? "";
  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getVendor(code), [code])
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading) {
    return (
      <div className="skeleton" style={{ height: 240, borderRadius: 14 }} />
    );
  }
  if (!data) {
    return (
      <SmartEmptyState
        icon="plug"
        subtitle={`Nenhum fornecedor com o código ${code}.`}
        title="Fornecedor não encontrado"
      />
    );
  }

  return <VendorDetailView data={data} reload={reload} />;
}

export default function VendorDetailScreen({ param }: { param?: string }) {
  return (
    <ModalProvider>
      <VendorDetailInner param={param} />
    </ModalProvider>
  );
}
