"use client";

// okrs.tsx — OKRs do portfólio (objetivos + key results).

import { OKRS, type Okr, type Tone } from "@/lib/cosmos-data";
import { Icon } from "../icons";
import { Avatar, Badge, Button, KpiCard, PageHeader, Progress } from "../kit";

function krStatus(v: number): { tone: Tone; label: string } {
  if (v >= 70) {
    return { tone: "green", label: "On track" };
  }
  if (v >= 40) {
    return { tone: "amber", label: "Em risco" };
  }
  return { tone: "red", label: "Atrasado" };
}

function ObjectiveCard({ o }: { o: Okr }) {
  const avg = Math.round(o.krs.reduce((s, k) => s + k.v, 0) / o.krs.length);
  const st = krStatus(avg);
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--card-shadow)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "16px 20px",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--surface-2)",
          borderLeft: `3px solid var(--${o.tone})`,
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            borderRadius: "var(--r-md)",
            flexShrink: 0,
            color: `var(--${o.tone})`,
            background: `var(--${o.tone}-soft)`,
            border: `1px solid rgba(var(--${o.tone}-rgb),.22)`,
          }}
        >
          <Icon name="star" size={20} strokeWidth={1.8} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-subtle)",
                fontWeight: 700,
              }}
            >
              {o.id}
            </span>
            <Badge dot tone={o.tone}>
              {o.scope}
            </Badge>
          </div>
          <div
            className="display"
            style={{
              fontSize: 16.5,
              fontWeight: 700,
              letterSpacing: "-.015em",
              color: "var(--ink)",
              lineHeight: 1.3,
              textWrap: "pretty",
            }}
          >
            {o.objective}
          </div>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--ink-subtle)",
            }}
          >
            <Avatar name={o.owner} size={20} tone={o.tone} />
            <span style={{ fontWeight: 500 }}>{o.owner}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            className="mono"
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-.03em",
              color: `var(--${st.tone}-text)`,
              lineHeight: 1,
            }}
          >
            {avg}%
          </div>
          <div style={{ marginTop: 5 }}>
            <Badge dot tone={st.tone}>
              {st.label}
            </Badge>
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 20px 16px" }}>
        {o.krs.map((k, i) => {
          const ks = krStatus(k.v);
          return (
            <div
              key={i}
              style={{
                padding: "12px 0",
                borderBottom:
                  i < o.krs.length - 1 ? "1px solid var(--hairline)" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "var(--ink-faint)",
                    letterSpacing: ".06em",
                  }}
                >
                  KR{i + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--ink)",
                    textWrap: "pretty",
                  }}
                >
                  {k.text}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--ink-subtle)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{ color: `var(--${ks.tone}-text)`, fontWeight: 700 }}
                  >
                    {k.now}
                  </span>{" "}
                  / {k.goal}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Progress height={7} tone={ks.tone} value={k.v} />
                </div>
                <span
                  className="mono"
                  style={{
                    width: 44,
                    textAlign: "right",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: `var(--${ks.tone}-text)`,
                  }}
                >
                  {k.v}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OkrsScreen() {
  const allKrs = OKRS.flatMap((o) => o.krs);
  const avgAll = Math.round(
    allKrs.reduce((s, k) => s + k.v, 0) / allKrs.length
  );
  const onTrack = allKrs.filter((k) => k.v >= 70).length;
  const atRisk = allKrs.filter((k) => k.v < 40).length;
  return (
    <div className="fade-in">
      <PageHeader
        meta={
          <>
            <Badge icon="star" tone="accent">
              {OKRS.length} objetivos
            </Badge>
            <Badge tone="neutral">{allKrs.length} key results</Badge>
            <Badge dot tone="green">
              Check-in semanal
            </Badge>
          </>
        }
        subtitle="Objetivos e Key Results do portfólio · Q2 2026. Conectam a estratégia às entregas dos ARTs e times."
        title="OKRs"
      >
        <Button icon="calendar" size="md" variant="secondary">
          Q2 2026
        </Button>
        <Button icon="sparkles" size="md" variant="primary">
          Atualizar progresso
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
          delta="+8 pts"
          deltaTone="accent"
          hint="vs. check-in anterior"
          icon="gauge"
          label="Progresso médio dos OKRs"
          tone="accent"
          unit="%"
          value={avgAll}
        />
        <KpiCard
          hint={`de ${allKrs.length} no total`}
          icon="check"
          label="Key Results on track"
          tone="green"
          value={onTrack}
        />
        <KpiCard
          delta="−1"
          deltaTone="red"
          hint="< 40% do alvo"
          icon="alert"
          label="Key Results em risco"
          tone="red"
          value={atRisk}
        />
        <KpiCard
          hint="100% atribuídos"
          icon="target"
          label="Objetivos com dono"
          tone="purple"
          unit="/4"
          value={OKRS.length}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--gap)",
        }}
      >
        {OKRS.map((o) => (
          <ObjectiveCard key={o.id} o={o} />
        ))}
      </div>
    </div>
  );
}
