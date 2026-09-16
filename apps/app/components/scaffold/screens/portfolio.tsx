"use client";

// Portfólio de trilhas — S-07, S-09, SG-08. Port de `scaffold-screens-1.jsx`.
//
// Toda trilha, fase, dono e bloqueio num lugar só. O que o protótipo desenha e
// aqui é dado real: os pips de fase, a bandeira de estagnação e a taxa de
// override por cliente.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  SectionCard,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listTracks,
  type PendingPromotion,
  type PortfolioSummary,
} from "@/app/(scaffold)/actions/tracks";
import { PHASE, PHASE_ORDER, PHASE_STATE } from "@/lib/scaffold/phases";
import {
  BarRow,
  Eyebrow,
  FilterChips,
  Legend,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  StatusDot,
  TableHead,
  TableRow,
} from "../base";
import { NewTrackModal } from "../new-track-modal";

const ARCHETYPE_LABEL: Record<string, string> = {
  TRIAGE: "Triagem de suporte",
  DOC_REVIEW: "Revisão de documentos",
  REPORTING: "Relatórios",
};

const PHASE_TONES = ["blue", "accent", "purple", "green"] as const;

type Track = PortfolioSummary["tracks"][number];

/** Progressão em quatro pontos. Lê-se de relance, o que uma barra de
 *  porcentagem não entrega: fase é discreta, não contínua. */
function PhasePips({ track, size = 8 }: { track: Track; size?: number }) {
  const idx = PHASE_ORDER.indexOf(track.currentPhase);
  const embedded = track.status === "EMBEDDED";
  return (
    <span
      aria-label={`Fase ${PHASE[track.currentPhase].n} de 4 — ${PHASE[track.currentPhase].label}`}
      role="img"
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      {PHASE_ORDER.map((p, i) => {
        const done = i < idx || embedded;
        const cur = i === idx && !embedded;
        const tone = cur
          ? PHASE_STATE[track.phaseState].tone
          : done
            ? "green"
            : "neutral";
        return (
          <span
            key={p}
            style={{
              width: cur ? size + 4 : size,
              height: size,
              borderRadius: 99,
              background: done || cur ? `var(--${tone})` : "var(--surface-3)",
              border: done || cur ? "none" : "1px solid var(--hairline-strong)",
              boxShadow: cur ? `0 0 8px rgba(var(--${tone}-rgb),.6)` : "none",
              transition: "all .2s ease",
            }}
            title={PHASE[p].label}
          />
        );
      })}
    </span>
  );
}

function StallFlag({ days, threshold }: { days: number; threshold: number }) {
  if (days < threshold) {
    return null;
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 99,
        background: "var(--red-soft)",
        border: "1px solid rgba(var(--red-rgb),.3)",
        fontSize: 10.5,
        fontWeight: 700,
        color: "var(--red-text)",
      }}
    >
      <Icon name="clock" size={11} strokeWidth={2.2} />
      {days}d parado
    </span>
  );
}

function PortfolioFunnel({ tracks }: { tracks: Track[] }) {
  const counts = PHASE_ORDER.map(
    (p) => tracks.filter((t) => t.currentPhase === p).length
  );
  const max = Math.max(...counts, 1);
  return (
    <SectionCard
      icon="flow"
      subtitle="Onde as trilhas do portfólio estão agora"
      title="Funil de fases"
      tone="accent"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          alignItems: "end",
          height: 128,
          padding: "0 4px",
        }}
      >
        {PHASE_ORDER.map((p, i) => (
          <div
            key={p}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
              height: "100%",
              justifyContent: "flex-end",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: `var(--${PHASE_TONES[i]}-text)`,
              }}
            >
              {counts[i]}
            </span>
            <div
              style={{
                width: "100%",
                height: `${Math.max(8, ((counts[i] ?? 0) / max) * 82)}%`,
                borderRadius: "8px 8px 3px 3px",
                background: `linear-gradient(180deg, rgba(var(--${PHASE_TONES[i]}-rgb),.55), rgba(var(--${PHASE_TONES[i]}-rgb),.18))`,
                border: `1px solid rgba(var(--${PHASE_TONES[i]}-rgb),.35)`,
              }}
            />
          </div>
        ))}
      </div>
      <Legend
        items={PHASE_ORDER.map((p, i) => ({
          label: `${PHASE[p].n} · ${PHASE[p].label}`,
          tone: PHASE_TONES[i],
        }))}
      />
    </SectionCard>
  );
}

/** SG-08 — taxa de override, exposta sem ninguém pedir.
 *
 *  O PRD §7 nomeia "gate vira formalidade que todo mundo waiva" como o risco
 *  número um, e a mitigação escrita lá é esta taxa chegar ao sponsor. Escondê-la
 *  atrás de um relatório seria cumprir a letra e perder o motivo. */
function OverrideRateCard({
  rates,
}: {
  rates: PortfolioSummary["overrideRates"];
}) {
  return (
    <SectionCard
      icon="gavel"
      subtitle="SG-08 · gates fechados com critérios não atendidos"
      title="Taxa de override"
      tone="amber"
    >
      {rates.length === 0 ? (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--ink-faint)",
            padding: "8px 0",
          }}
        >
          Nenhum gate fechado ainda. A taxa aparece quando houver o primeiro.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rates.map((r) => (
            <BarRow
              hint={`${r.overridden} de ${r.closed} gates`}
              key={r.label}
              label={r.label}
              max={100}
              suffix="%"
              tone={r.rate > 30 ? "red" : r.rate > 0 ? "amber" : "green"}
              value={r.rate}
            />
          ))}
        </div>
      )}
      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          borderRadius: "var(--r-sm)",
          background: "var(--amber-soft)",
          border: "1px solid rgba(var(--amber-rgb),.25)",
          fontSize: 11.5,
          lineHeight: 1.55,
          color: "var(--ink-muted)",
        }}
      >
        Override alto vira formalidade — o PRD exige que essa taxa chegue ao
        sponsor sem ninguém pedir.
      </div>
    </SectionCard>
  );
}

/** Chaves estáveis para os esqueletos de KPI — índice de array como key faz o
 *  React remontar tudo quando a lista muda de tamanho. */
const KPI_SLOTS = ["tracks", "gates", "embed", "baselines"] as const;

const COLS = "108px 1.6fr 1fr 118px 130px 96px 110px";

export default function PortfolioScreen() {
  const router = useRouter();
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archetype, setArchetype] = useState("all");
  const [phase, setPhase] = useState("all");
  // `null` fechado; `{ promotion: null }` trilha sem lacuna; com promoção, S-01.
  const [creating, setCreating] = useState<{
    promotion: PendingPromotion | null;
  } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await listTracks({});
    if (res.ok) {
      setData(res.data);
    } else {
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.tracks.filter(
      (t) =>
        (archetype === "all" || t.archetype === archetype) &&
        (phase === "all" || t.currentPhase === phase)
    );
  }, [data, archetype, phase]);

  if (error) {
    return <ScreenError message={error} onRetry={load} />;
  }

  const loading = !data;
  const embedded = data?.embeddedCount ?? 0;
  const total = data?.tracks.length ?? 0;
  const stalled = data?.stalledCount ?? 0;
  const threshold = data?.stallThresholdDays ?? 14;

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Adoção"
        meta={
          <StatusDot
            label={
              stalled
                ? `${stalled} trilha${stalled > 1 ? "s" : ""} estagnada${stalled > 1 ? "s" : ""}`
                : "Portfólio em movimento"
            }
            tone={stalled ? "red" : "green"}
          />
        }
        subtitle="Cada trilha leva um processo do piloto à prática permanente — e o gate é o que impede a promessa eterna."
        title="Portfólio de trilhas"
      >
        <Button
          icon="puzzle"
          onClick={() => router.push("/scaffold/templates")}
          variant="secondary"
        >
          Templates
        </Button>
        <Button
          disabled={loading}
          icon="plus"
          onClick={() => setCreating({ promotion: null })}
        >
          Nova trilha
        </Button>
      </PageHeader>

      {data && data.pendingPromotions.length > 0 ? (
        <SectionCard
          icon="outbound"
          subtitle="S-01 · lacunas que o Meridian promoveu e ainda não viraram trilha"
          title="Aguardando trilha"
          tone="amber"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.pendingPromotions.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <Eyebrow>{p.gapCode}</Eyebrow>
                <span
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    color: "var(--ink)",
                    minWidth: 0,
                  }}
                >
                  {p.statement}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--ink-faint)" }}
                >
                  promovida {p.promotedAt.toLocaleDateString("pt-BR")}
                </span>
                <Button
                  icon="layers"
                  onClick={() => setCreating({ promotion: p })}
                  size="sm"
                >
                  Criar trilha
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: "var(--gap)",
        }}
      >
        {loading ? (
          KPI_SLOTS.map((slot) => <SkeletonKpi key={slot} />)
        ) : (
          <>
            <KpiCard
              hint={`${data.orgCount} ${data.orgCount === 1 ? "processo" : "processos"} em adoção`}
              icon="layers"
              label="Trilhas ativas"
              tone="accent"
              value={total - embedded}
            />
            <KpiCard
              hint="aguardando decisão de gate"
              icon="shield"
              label="Gates prontos"
              tone="amber"
              value={data.gateReadyCount}
            />
            <KpiCard
              hint="métrica-mãe do PRD"
              icon="check"
              label="Trilhas no Embed"
              tone="green"
              unit={`/${total}`}
              value={embedded}
            />
            <KpiCard
              hint="prontos para o Signal"
              icon="activity"
              label="Baselines assinados"
              tone="blue"
              unit={`/${total}`}
              value={data.signedBaselineCount}
            />
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "var(--gap)",
        }}
      >
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <PortfolioFunnel tracks={data.tracks} />
            <OverrideRateCard rates={data.overrideRates} />
          </>
        )}
      </div>

      <SectionCard
        action={
          <FilterChips
            allLabel="Todos os arquétipos"
            ariaLabel="Filtrar por arquétipo de processo"
            onChange={setArchetype}
            options={Object.entries(ARCHETYPE_LABEL).map(([id, label]) => ({
              id,
              label,
            }))}
            value={archetype}
          />
        }
        icon="layers"
        subtitle="S-07 · trilha, fase, dono e bloqueio num só lugar"
        title="Todas as trilhas"
        tone="accent"
      >
        <FilterChips
          allLabel="Todas as fases"
          ariaLabel="Filtrar por fase"
          onChange={setPhase}
          options={PHASE_ORDER.map((p) => ({ id: p, label: PHASE[p].label }))}
          value={phase}
        />
        <div
          style={{
            marginTop: 12,
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            overflow: "hidden",
          }}
        >
          <TableHead
            cols={COLS}
            labels={[
              "Trilha",
              "Processo",
              "Dono",
              "Fase",
              "Estado",
              "Últ. gate",
              "Situação",
            ]}
          />
          {loading ? (
            <div style={{ padding: 14 }}>
              <SkeletonCard />
            </div>
          ) : visible.length === 0 ? (
            <SmartEmptyState
              icon="search"
              onPrimary={() => {
                setArchetype("all");
                setPhase("all");
              }}
              primaryIcon="x"
              primaryLabel="Limpar filtros"
              subtitle="Limpe os filtros, ou promova uma lacuna do Meridian para o Scaffold."
              title="Nenhuma trilha nesse recorte"
              tone="accent"
            />
          ) : (
            visible.map((t, i) => (
              <TableRow
                cols={COLS}
                key={t.id}
                label={`Abrir trilha ${t.code}`}
                last={i === visible.length - 1}
                onClick={() => router.push(`/scaffold/track/${t.id}`)}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--accent-text)",
                  }}
                >
                  {t.code}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.processName}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "var(--ink-faint)",
                      marginTop: 1,
                    }}
                  >
                    {t.archetype
                      ? ARCHETYPE_LABEL[t.archetype]
                      : "sem arquétipo"}{" "}
                    · {t.templateLabel}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.ownerName ?? "—"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PhasePips track={t} />
                </span>
                <Badge tone={PHASE_STATE[t.phaseState].tone}>
                  {PHASE_STATE[t.phaseState].label}
                </Badge>
                <span
                  className="mono"
                  style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}
                >
                  {t.lastGateLabel ?? "—"}
                </span>
                <span>
                  {t.status === "EMBEDDED" ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--green-text)",
                      }}
                    >
                      entregue
                    </span>
                  ) : t.stalledDays >= threshold ? (
                    <StallFlag days={t.stalledDays} threshold={threshold} />
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                      em dia
                    </span>
                  )}
                </span>
              </TableRow>
            ))
          )}
        </div>
      </SectionCard>

      {creating && data ? (
        <NewTrackModal
          members={data.members}
          onClose={() => setCreating(null)}
          onCreated={(id) => router.push(`/scaffold/track/${id}`)}
          promotion={creating.promotion}
        />
      ) : null}
    </div>
  );
}
