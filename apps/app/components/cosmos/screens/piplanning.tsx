"use client";

// piplanning.tsx — PI Planning (confidence vote, objectives, ROAM risks).

import {
  CONFIDENCE_VOTE,
  type ConfidenceVote,
  PI_OBJECTIVES,
  PI_TEAMS,
  type PiObjective,
  ROAM_RISKS,
  type RoamRisk,
  type Tone,
} from "@/lib/cosmos-data";
import { Icon } from "../icons";
import {
  Avatar,
  Badge,
  Button,
  KpiCard,
  PageHeader,
  SectionCard,
} from "../kit";

const teamById = (id: string): { name: string; tone: Tone } =>
  PI_TEAMS.find((t) => t.id === id) || { name: id, tone: "neutral" };

function FistOfFive({ v, size = 9 }: { v: number; size?: number }) {
  const tone = v >= 4 ? "green" : v === 3 ? "amber" : "red";
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            width: size,
            height: size,
            borderRadius: 99,
            background: n <= v ? `var(--${tone})` : "var(--surface-3)",
            boxShadow: n <= v ? `0 0 7px rgba(var(--${tone}-rgb),.5)` : "none",
            border: n <= v ? "none" : "1px solid var(--hairline-strong)",
          }}
        />
      ))}
    </span>
  );
}

export default function PiPlanningScreen() {
  const committed = PI_OBJECTIVES.filter((o) => o.committed);
  const committedBV = committed.reduce((s, o) => s + o.bv, 0);
  const stretchBV = PI_OBJECTIVES.filter((o) => !o.committed).reduce(
    (s, o) => s + o.bv,
    0
  );
  const avgConf =
    CONFIDENCE_VOTE.reduce((s, v) => s + v.v, 0) / CONFIDENCE_VOTE.length;
  const openRisks = ROAM_RISKS.filter(
    (r) => r.status === "Owned" || r.status === "Accepted"
  ).length;

  return (
    <div className="fade-in" style={{ paddingBottom: 76 }}>
      <PageHeader
        meta={
          <>
            <Badge dot tone="accent">
              PI-26 · Dia 2 de 2
            </Badge>
            <Badge icon="check" tone="green">
              Objetivos travados
            </Badge>
          </>
        }
        subtitle="PI-26 · planejamento incremental do Payments ART. Confiança do time, objetivos e riscos ROAM."
        title="PI Planning"
      >
        <Button icon="externalLink" size="md" variant="secondary">
          Exportar plano
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        <KpiCard
          hint={`${committed.length} objetivos`}
          icon="target"
          label="Business Value committed"
          tone="green"
          value={committedBV}
        />
        <KpiCard
          hint="não committed"
          icon="zap"
          label="Business Value stretch"
          tone="purple"
          value={stretchBV}
        />
        <KpiCard
          delta="vote 2"
          deltaTone="accent"
          hint="fist-of-five"
          icon="gauge"
          label="Confiança média do ART"
          tone="accent"
          unit="/5"
          value={avgConf.toFixed(1)}
        />
        <KpiCard
          hint={`${ROAM_RISKS.length} no ROAM`}
          icon="alert"
          label="Riscos a endereçar"
          tone="amber"
          value={openRisks}
        />
      </div>

      {/* confidence vote */}
      <div style={{ marginBottom: "var(--gap)" }}>
        <SectionCard
          action={
            <Badge dot tone={avgConf >= 3.5 ? "green" : "amber"}>
              {avgConf >= 3.5 ? "ART confiante" : "atenção"}
            </Badge>
          }
          icon="users"
          subtitle="Fist-of-five por time · objetivos do PI"
          title="Confidence Vote"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: 12,
            }}
          >
            {CONFIDENCE_VOTE.map((cv: ConfidenceVote) => {
              const t = teamById(cv.id);
              return (
                <div
                  className="lift"
                  key={cv.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface-2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        background: `var(--${t.tone})`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {t.name}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <FistOfFive v={cv.v} />
                    <span
                      className="mono"
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color:
                          cv.v >= 4
                            ? "var(--green-text)"
                            : cv.v === 3
                              ? "var(--amber-text)"
                              : "var(--red-text)",
                      }}
                    >
                      {cv.v}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.45fr 1fr",
          gap: "var(--gap)",
        }}
      >
        {/* objectives */}
        <SectionCard
          action={
            <Badge tone="neutral">{PI_OBJECTIVES.length} objetivos</Badge>
          }
          bodyStyle={{ padding: 12 }}
          icon="target"
          subtitle="Committed e stretch · com business value"
          title="PI Objectives"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PI_OBJECTIVES.map((o: PiObjective, i: number) => {
              const t = teamById(o.team);
              return (
                <div
                  className="lift"
                  key={i}
                  style={{
                    display: "flex",
                    gap: 13,
                    alignItems: "center",
                    padding: "13px 14px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--hairline)",
                    background: o.committed
                      ? "var(--surface)"
                      : "var(--surface-2)",
                    borderLeft: `3px solid var(--${t.tone})`,
                    opacity: o.committed ? 1 : 0.92,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <Badge dot tone={t.tone}>
                        {t.name.replace("Squad ", "")}
                      </Badge>
                      {!o.committed && <Badge tone="neutral">stretch</Badge>}
                    </div>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--ink)",
                        lineHeight: 1.35,
                        textWrap: "pretty",
                      }}
                    >
                      {o.text}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 21,
                        fontWeight: 800,
                        color: o.committed
                          ? "var(--green-text)"
                          : "var(--ink-faint)",
                        letterSpacing: "-.02em",
                      }}
                    >
                      {o.bv}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--ink-subtle)",
                        fontWeight: 700,
                        letterSpacing: ".06em",
                      }}
                    >
                      BV
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <FistOfFive size={7} v={o.conf} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ROAM */}
        <SectionCard
          action={<Badge tone="amber">{openRisks} abertos</Badge>}
          bodyStyle={{ padding: 12 }}
          icon="alert"
          subtitle="Resolved · Owned · Accepted · Mitigated"
          title="Riscos · ROAM"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ROAM_RISKS.map((r: RoamRisk) => (
              <div
                className="lift"
                key={r.id}
                style={{
                  padding: "12px 13px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--hairline)",
                  background: "var(--surface-2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: "var(--ink-subtle)",
                      fontWeight: 600,
                    }}
                  >
                    {r.id}
                  </span>
                  <Badge tone={r.tone}>{r.status}</Badge>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "var(--ink)",
                    lineHeight: 1.4,
                    textWrap: "pretty",
                  }}
                >
                  {r.text}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11.5,
                    color: "var(--ink-subtle)",
                  }}
                >
                  <Avatar
                    name={r.owner}
                    size={20}
                    tone={r.tone === "neutral" ? "accent" : r.tone}
                  />
                  <span style={{ fontWeight: 500 }}>{r.owner}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* sticky ceremony CTA */}
      <div
        style={{
          position: "sticky",
          bottom: -40,
          marginTop: 18,
          paddingTop: 14,
          background: "linear-gradient(180deg, transparent, var(--canvas) 38%)",
        }}
      >
        <button
          className="btn"
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "15px",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--accent)",
            background: "var(--accent)",
            color: "var(--accent-fg)",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: ".01em",
            cursor: "pointer",
            boxShadow: "0 12px 30px -10px rgba(var(--accent-rgb),.8)",
          }}
        >
          <Icon name="send" size={18} strokeWidth={2.2} />
          Iniciar Cerimônia (Todos)
        </button>
      </div>
    </div>
  );
}
