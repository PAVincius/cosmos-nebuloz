"use client";

// okrs.tsx — OKRs do portfólio (objetivos + key results), wired to listOkrs().

import { useEffect, useState } from "react";
import { listOkrs, type OkrView } from "@/app/(cosmos)/actions/okrs";
import type { Tone } from "@/lib/cosmos-data";
import { Icon } from "../icons";
import { Avatar, Badge, Button, KpiCard, PageHeader, Progress } from "../kit";

const STATUS_TONE: Record<string, Tone> = {
  ON_TRACK: "green",
  AT_RISK: "amber",
  BEHIND: "red",
  ACHIEVED: "blue",
};

function krStatus(v: number): { tone: Tone; label: string } {
  if (v >= 70) {
    return { tone: "green", label: "On track" };
  }
  if (v >= 40) {
    return { tone: "amber", label: "Em risco" };
  }
  return { tone: "red", label: "Atrasado" };
}

function ObjectiveCard({ o }: { o: OkrView }) {
  const tone = STATUS_TONE[o.status] ?? "neutral";
  const avg = o.keyResults.length
    ? Math.round(
        o.keyResults.reduce((s, k) => s + k.progressPct, 0) /
          o.keyResults.length
      )
    : 0;
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
          borderLeft: `3px solid var(--${tone})`,
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
            color: `var(--${tone})`,
            background: `var(--${tone}-soft)`,
            border: `1px solid rgba(var(--${tone}-rgb),.22)`,
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
            {o.title}
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
            <Avatar name={o.ownerName} size={20} tone={tone} />
            <span style={{ fontWeight: 500 }}>{o.ownerName}</span>
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
        {o.keyResults.map((k, i) => {
          const ks = krStatus(k.progressPct);
          return (
            <div
              key={k.id}
              style={{
                padding: "12px 0",
                borderBottom:
                  i < o.keyResults.length - 1
                    ? "1px solid var(--hairline)"
                    : "none",
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
                  {k.title}
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
                    {k.current}
                    {k.unit}
                  </span>{" "}
                  / {k.target}
                  {k.unit}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Progress height={7} tone={ks.tone} value={k.progressPct} />
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
                  {k.progressPct}%
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
  const [okrs, setOkrs] = useState<OkrView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listOkrs().then((r) => {
      if (r.ok) {
        setOkrs(r.data);
      }
      setLoading(false);
    });
  }, []);

  const allKrs = okrs.flatMap((o) => o.keyResults);
  const avgAll = allKrs.length
    ? Math.round(allKrs.reduce((s, k) => s + k.progressPct, 0) / allKrs.length)
    : 0;
  const onTrack = allKrs.filter((k) => k.progressPct >= 70).length;
  const atRisk = allKrs.filter((k) => k.progressPct < 40).length;
  const withOwner = okrs.filter((o) => o.ownerName !== "—").length;
  return (
    <div className="fade-in">
      <PageHeader
        meta={
          <>
            <Badge icon="star" tone="accent">
              {okrs.length} objetivos
            </Badge>
            <Badge tone="neutral">{allKrs.length} key results</Badge>
            <Badge dot tone="green">
              Check-in semanal
            </Badge>
          </>
        }
        subtitle="Objetivos e Key Results do portfólio. Conectam a estratégia às entregas dos ARTs e times."
        title="OKRs"
      >
        <Button icon="calendar" size="md" variant="secondary">
          Período atual
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
          hint="média dos key results"
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
          hint="< 40% do alvo"
          icon="alert"
          label="Key Results em risco"
          tone="red"
          value={atRisk}
        />
        <KpiCard
          hint={`de ${okrs.length} objetivos`}
          icon="target"
          label="Objetivos com dono"
          tone="purple"
          value={withOwner}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--gap)",
        }}
      >
        {!loading && okrs.length === 0 && (
          <KpiCard
            hint="Crie um OKR de portfólio"
            icon="target"
            label="Nenhum OKR"
            tone="accent"
            value="—"
          />
        )}
        {okrs.map((o) => (
          <ObjectiveCard key={o.id} o={o} />
        ))}
      </div>
    </div>
  );
}
