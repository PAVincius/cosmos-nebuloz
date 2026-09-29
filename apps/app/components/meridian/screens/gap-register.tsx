"use client";

// Gap register canônico — US4. Port de `meridian-registry.jsx`.
//
// O registro atravessa assessments: é aqui que o gap é reavaliado e fechado, e
// é aqui que o custo de atraso para de correr. Promover cria trabalho em outro
// produto carregando `origin_gap_id` — e não transfere posse.

import type {
  MeridianAxis,
  MeridianGapState,
  MeridianSeverity,
} from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  Card,
  KpiCard,
  PageHeader,
  SectionCard,
  SkeletonKpi,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  type GapRow,
  listGapRegister,
  promoteGap,
} from "@/app/(meridian)/actions/gaps";
import { AXES, AXIS_IDS } from "@/lib/meridian/axes";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  FilterChips,
  MetaCell,
  ModalProvider,
  ModalShell,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  StatusDot,
  TableHead,
  TableRow,
  useMeridianData,
  useModal,
} from "../base";
import { CONFIDENCE, ConfPill } from "../seams";
import { EvidenceList } from "./evidence-list";
import { PromoteConfirm, type PromoteTarget } from "./promote-confirm";

export const GAP_STATE: Record<
  MeridianGapState,
  { label: string; tone: Tone; desc: string }
> = {
  OPEN: {
    label: "Aberto",
    tone: "red",
    desc: "Sem dono de execução. Custo de atraso correndo.",
  },
  PLANNED: {
    label: "No plano",
    tone: "amber",
    desc: "Sequenciado no plano de 12 meses, sem execução iniciada.",
  },
  PROMOTED: {
    label: "Promovido",
    tone: "accent",
    desc: "Virou trabalho em outro produto. O gap segue aqui, referenciado.",
  },
  RESOLVED: {
    label: "Resolvido",
    tone: "green",
    desc: "Reavaliado em novo assessment e fechado com evidência.",
  },
};

export const SEVERITY: Record<MeridianSeverity, { label: string; tone: Tone }> =
  {
    HIGH: { label: "Alta", tone: "red" },
    MEDIUM: { label: "Média", tone: "amber" },
    LOW: { label: "Baixa", tone: "accent" },
  };

const EFFORT: Record<string, string> = {
  S: "Pequeno",
  M: "Médio",
  L: "Grande",
};

const COLS = "78px minmax(0,2.4fr) 118px 116px 108px 150px";

function GapDetail({ gap, onClose }: { gap: GapRow; onClose: () => void }) {
  const st = GAP_STATE[gap.state];
  const c = CONFIDENCE[gap.confidence];
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PromoteTarget | null>(null);

  const promote = async (targetProduct: PromoteTarget) => {
    setBusy(true);
    await runWithToast(
      () =>
        promoteGap({
          gapId: gap.id,
          targetProduct,
          targetLabel: gap.statement.split(":")[0] as string,
        }),
      {
        loading: "Promovendo gap…",
        success: `Promovido para o ${targetProduct}. O gap continua no Meridian, referenciado por origin_gap_id.`,
      }
    );
    setBusy(false);
    onClose();
  };

  return (
    <ModalShell
      icon="crosshair"
      onClose={onClose}
      subtitle={`${gap.orgName} · ${gap.assessmentCode} · eixo ${AXES[gap.axis].label} · dono sugerido ${gap.ownerLabel}`}
      title={`${gap.code} — ${st.label}`}
      tone={st.tone}
      width={640}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flexWrap: "wrap",
          }}
        >
          <Badge tone={st.tone}>{st.label}</Badge>
          <Badge tone={SEVERITY[gap.severity].tone}>
            {SEVERITY[gap.severity].label}
          </Badge>
          <ConfPill conf={gap.confidence} size="sm" />
        </div>

        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1.5,
          }}
        >
          {gap.statement}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
            gap: 12,
          }}
        >
          <MetaCell
            label="Custo de atraso"
            mono
            value={String(gap.costOfDelay)}
          />
          <MetaCell label="Esforço" value={EFFORT[gap.effort] ?? gap.effort} />
          <MetaCell label="Evidências" value={`${gap.evidenceCount} anexos`} />
          <MetaCell
            label="Registrado"
            mono
            value={new Date(gap.since).toLocaleDateString("pt-BR")}
          />
        </div>

        <SectionCard
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 8 }}
          icon="scale"
          title="Confiança do achado"
          tone={c.tone}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-muted)",
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: "var(--ink)" }}>{c.label}</strong> —{" "}
            {c.desc}.{" "}
            {gap.evidenceCount > 0
              ? `${gap.evidenceCount} evidência(s) anexada(s) no assessment de origem.`
              : "Sem evidência anexada — o achado vale como declaração, não como medição."}
          </div>
          {gap.evidenceCount > 0 && (
            <EvidenceList
              assessmentId={gap.assessmentId}
              total={gap.evidenceCount}
            />
          )}
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ink-faint)",
              paddingTop: 8,
              borderTop: "1px solid var(--hairline)",
            }}
          >
            Escala definida pelo Meridian e reusada por Signal e Scaffold sem
            redefinição.
          </div>
        </SectionCard>

        {gap.promotion ? (
          <SectionCard
            bodyStyle={{ display: "flex", flexDirection: "column", gap: 10 }}
            icon="outbound"
            title="Consumido por"
            tone="accent"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "12px 14px",
                borderRadius: "var(--r-md)",
                background: "var(--accent-soft)",
                border: "1px dashed rgba(var(--accent-rgb),.4)",
              }}
            >
              <Icon
                name="outbound"
                size={16}
                style={{ color: "var(--accent-text)", flexShrink: 0 }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "var(--accent-text)",
                  }}
                >
                  {gap.promotion.product}
                </div>
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}
                >
                  {gap.promotion.entityId
                    ? `${gap.promotion.entityId} · `
                    : "pendente · "}
                  {gap.promotion.label}
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-muted)",
                lineHeight: 1.55,
              }}
            >
              O destino referencia{" "}
              <span className="mono" style={{ color: "var(--ink)" }}>
                origin_gap_id={gap.code}
              </span>
              . Este gap não é editável de lá.
            </div>
          </SectionCard>
        ) : (
          <SectionCard
            bodyStyle={{ display: "flex", flexDirection: "column", gap: 12 }}
            icon="alert"
            title="Sem destino"
            tone={gap.state === "OPEN" ? "red" : "amber"}
          >
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-muted)",
                lineHeight: 1.55,
                maxWidth: "72ch",
              }}
            >
              {gap.state === "OPEN"
                ? "Nenhum trabalho foi criado para esta lacuna. O custo de atraso segue correndo e não há dono de execução."
                : "Sequenciado no plano de 12 meses, mas ainda não virou trabalho em nenhum produto."}
            </div>
            {pending ? (
              <PromoteConfirm
                busy={busy}
                defaultProduct={pending}
                gapCode={gap.code}
                onCancel={() => setPending(null)}
                onConfirm={promote}
              />
            ) : (
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <Button
                  disabled={busy}
                  icon="outbound"
                  onClick={() => setPending("COSMOS")}
                  size="sm"
                >
                  Promover a iniciativa
                </Button>
                <Button
                  disabled={busy}
                  icon="fileText"
                  onClick={() => setPending("SCAFFOLD")}
                  size="sm"
                  variant="secondary"
                >
                  Virar caso de negócio
                </Button>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </ModalShell>
  );
}

function GapRegisterBody() {
  const modal = useModal();
  const [axis, setAxis] = useState<"all" | MeridianAxis>("all");
  const [severity, setSeverity] = useState<"all" | MeridianSeverity>("all");
  const [state, setState] = useState<"all" | MeridianGapState>("all");

  const fetcher = useCallback(
    () =>
      listGapRegister({
        ...(axis === "all" ? {} : { axis }),
        ...(severity === "all" ? {} : { severity }),
        ...(state === "all" ? {} : { state }),
      }),
    [axis, severity, state]
  );
  const { data, loading, error, reload } = useMeridianData<GapRow[]>(fetcher);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const rows = data ?? [];
  const open = rows.filter((g) => g.state === "OPEN");
  const unaddressedCod = open.reduce((s, g) => s + g.costOfDelay, 0);
  const maxCod = Math.max(1, ...rows.map((g) => g.costOfDelay));

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Diagnose · registro canônico"
        meta={
          <StatusDot
            label={
              open.length
                ? `${open.length} sem dono de execução`
                : "Todo gap tem destino"
            }
            tone={open.length ? "red" : "green"}
          />
        }
        subtitle="Toda lacuna de capacidade encontrada em qualquer assessment, ordenada por custo de atraso. O Meridian é dono deste registro — Scaffold e Cosmos leem, promovem, e nunca editam."
        title="Gap register"
        tone="red"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "var(--gap)",
        }}
      >
        {loading ? (
          [0, 1, 2, 3].map((i) => <SkeletonKpi key={i} />)
        ) : (
          <>
            <KpiCard
              hint="sem dono de execução"
              icon="alert"
              label="Gaps abertos"
              tone="red"
              unit={`de ${rows.length}`}
              value={open.length}
            />
            <KpiCard
              hint="soma do custo de atraso dos abertos"
              icon="clock"
              label="Custo de atraso parado"
              tone="amber"
              value={unaddressedCod}
            />
            <KpiCard
              hint="viraram trabalho em outro produto"
              icon="outbound"
              label="Promovidos"
              tone="accent"
              value={rows.filter((g) => g.state === "PROMOTED").length}
            />
            <KpiCard
              hint="fechados com reavaliação"
              icon="check"
              label="Resolvidos"
              tone="green"
              value={rows.filter((g) => g.state === "RESOLVED").length}
            />
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <FilterChips
          allLabel="Todos os eixos"
          ariaLabel="Filtrar por eixo"
          onChange={(v) => setAxis(v as typeof axis)}
          options={AXIS_IDS.map((a) => ({ id: a, label: AXES[a].label }))}
          value={axis}
        />
        <span style={{ width: 1, height: 20, background: "var(--hairline)" }} />
        <FilterChips
          allLabel="Toda severidade"
          ariaLabel="Filtrar por severidade"
          onChange={(v) => setSeverity(v as typeof severity)}
          options={(Object.keys(SEVERITY) as MeridianSeverity[]).map((id) => ({
            id,
            label: SEVERITY[id].label,
            tone: SEVERITY[id].tone,
          }))}
          value={severity}
        />
        <span style={{ width: 1, height: 20, background: "var(--hairline)" }} />
        <FilterChips
          allLabel="Todo estado"
          ariaLabel="Filtrar por estado"
          onChange={(v) => setState(v as typeof state)}
          options={(Object.keys(GAP_STATE) as MeridianGapState[]).map((id) => ({
            id,
            label: GAP_STATE[id].label,
            tone: GAP_STATE[id].tone,
          }))}
          value={state}
        />
      </div>

      {/* As cinco colunas fixas somam 570px. Abaixo de ~900px de conteúdo a
          coluna "Lacuna" — a única que carrega o texto — ficava com dezenas de
          pixels e cada gap virava doze linhas de uma palavra. Rolagem
          horizontal dentro do card mantém a medida legível; a tela inteira
          nunca rola de lado. */}
      <Card pad={false}>
        <div className="scroll" style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 900 }}>
            <TableHead
              cols={COLS}
              labels={[
                "Gap",
                "Lacuna",
                "Custo de atraso",
                "Confiança",
                "Esforço",
                "Estado",
              ]}
            />
            {loading ? (
              <div style={{ padding: 16 }}>
                <SkeletonCard />
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 24 }}>
                <SmartEmptyState
                  icon="crosshair"
                  onPrimary={() => {
                    setAxis("all");
                    setSeverity("all");
                    setState("all");
                  }}
                  primaryIcon="minus"
                  primaryLabel="Limpar filtros"
                  subtitle="Ajuste os filtros. Registro vazio de verdade só acontece depois de uma reavaliação que fecha tudo."
                  title="Nenhum gap neste recorte"
                  tone="accent"
                />
              </div>
            ) : (
              rows.map((g, i) => (
                <TableRow
                  cols={COLS}
                  key={g.id}
                  label={`Abrir gap ${g.code}`}
                  last={i === rows.length - 1}
                  onClick={() =>
                    modal.open(<GapDetail gap={g} onClose={modal.close} />)
                  }
                >
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 0,
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "var(--ink)",
                      }}
                    >
                      {g.code}
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
                    >
                      {g.assessmentCode}
                    </span>
                  </span>

                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                        lineHeight: 1.45,
                      }}
                    >
                      {g.statement}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        gap: 7,
                        marginTop: 5,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <Badge tone={SEVERITY[g.severity].tone}>
                        {AXES[g.axis].label}
                      </Badge>
                      <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                        {g.orgName} · {g.ownerLabel}
                      </span>
                    </span>
                  </span>

                  <span
                    style={{ display: "flex", alignItems: "center", gap: 9 }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 40,
                        height: 5,
                        borderRadius: 99,
                        background: "var(--surface-3)",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          height: "100%",
                          width: `${(g.costOfDelay / maxCod) * 100}%`,
                          borderRadius: 99,
                          background: `var(--${SEVERITY[g.severity].tone})`,
                        }}
                      />
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: `var(--${SEVERITY[g.severity].tone}-text)`,
                      }}
                    >
                      {g.costOfDelay}
                    </span>
                  </span>

                  <span>
                    <ConfPill conf={g.confidence} size="sm" />
                  </span>

                  <span
                    className="mono"
                    style={{ fontSize: 11.5, color: "var(--ink-muted)" }}
                  >
                    {EFFORT[g.effort] ?? g.effort}
                  </span>

                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      alignItems: "flex-start",
                      minWidth: 0,
                    }}
                  >
                    <Badge tone={GAP_STATE[g.state].tone}>
                      {GAP_STATE[g.state].label}
                    </Badge>
                    {g.promotion && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          color: "var(--ink-faint)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "100%",
                        }}
                      >
                        → {g.promotion.product}{" "}
                        {g.promotion.entityId ?? "pendente"}
                      </span>
                    )}
                  </span>
                </TableRow>
              ))
            )}
          </div>
        </div>
      </Card>

      <SectionCard
        icon="shield"
        subtitle="Por que promover não transfere posse"
        title="Regra de fronteira"
        tone="accent"
      >
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            color: "var(--ink-muted)",
            lineHeight: 1.6,
            maxWidth: "84ch",
          }}
        >
          Promover um gap cria trabalho em outro produto — épico no Cosmos, caso
          de negócio no Scaffold, política no Charter — sempre carregando{" "}
          <span className="mono" style={{ fontSize: 12, color: "var(--ink)" }}>
            origin_gap_id
          </span>
          . O gap continua sendo do Meridian: é aqui que ele é reavaliado e
          fechado, e é aqui que o custo de atraso para de correr. Se o Cosmos
          pudesse editar o enunciado do gap, a próxima reavaliação não teria
          contra o quê comparar.
        </p>
      </SectionCard>
    </div>
  );
}

export default function GapRegisterScreen() {
  return (
    <ModalProvider>
      <GapRegisterBody />
    </ModalProvider>
  );
}
