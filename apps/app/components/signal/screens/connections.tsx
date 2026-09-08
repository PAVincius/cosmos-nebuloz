"use client";

// Conexões — US4. Port de `signal-screens-3.jsx`.
//
// A tela existe para uma pergunta: "posso confiar nos números agora?". Por isso
// a fonte com problema vem primeiro, e por isso cada uma carrega DUAS coisas
// que o protótipo já trazia e que a maioria dos painéis de integração omite:
//
//   • o CONSERTO — "reautorizar em Zendesk Admin → Apps", não "erro 401"
//   • o IMPACTO — quais métricas de quais iniciativas pararam
//
// Sem as duas, "Zendesk desconectado" é uma notificação que ninguém age.

import { Icon } from "@repo/design-system/cosmos/icons";
import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback } from "react";
import {
  type ConnectionRow,
  listConnections,
} from "@/app/(signal)/actions/connections";
import { HEALTH_META } from "@/lib/signal/health";
import {
  Eyebrow,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useSignalData,
} from "../base";

function sinceLabel(date: Date | null): string {
  if (!date) {
    return "nunca sincronizou";
  }
  const hours = (Date.now() - new Date(date).getTime()) / 3_600_000;
  if (hours < 1) {
    return `há ${Math.max(1, Math.round(hours * 60))} min`;
  }
  if (hours < 48) {
    return `há ${Math.round(hours)} h`;
  }
  return `há ${Math.round(hours / 24)} dias`;
}

function freqLabel(minutes: number | null): string {
  if (minutes === null) {
    return "manual";
  }
  return minutes >= 60
    ? `a cada ${Math.round(minutes / 60)} h`
    : `a cada ${minutes} min`;
}

function ConnectionCard({ c }: { c: ConnectionRow }) {
  const meta = HEALTH_META[c.health];
  const bad = c.health !== "HEALTHY";

  return (
    <div
      style={{
        padding: "13px 15px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${bad ? `rgba(var(--${meta.tone}-rgb),.35)` : "var(--hairline)"}`,
        background: bad ? `var(--${meta.tone}-soft)` : "var(--surface-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {c.icon ? <Icon name={c.icon} size={15} /> : null}
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-faint)" }}
        >
          {c.code}
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
          {c.name}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          {c.kind}
        </span>
        <span
          className="mono"
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10.5,
            fontWeight: 700,
            padding: "2px 9px",
            borderRadius: 99,
            background: `var(--${meta.tone}-soft)`,
            color: `var(--${meta.tone}-text)`,
          }}
        >
          <Icon name={meta.icon} size={11} />
          {meta.label}
        </span>
      </div>

      <div
        className="mono"
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          marginTop: 7,
          fontSize: 10.5,
          color: "var(--ink-faint)",
        }}
      >
        <span>último sync {sinceLabel(c.lastSyncAt)}</span>
        <span>{freqLabel(c.expectedFreqMinutes)}</span>
        {c.rowsLabel ? <span>{c.rowsLabel}</span> : null}
        <span>
          {c.mappingCount} {c.mappingCount === 1 ? "métrica" : "métricas"}
        </span>
        {c.owner ? <span>dono: {c.owner}</span> : null}
      </div>

      {c.feeds.length > 0 ? (
        <div style={{ marginTop: 7, fontSize: 11, color: "var(--ink-subtle)" }}>
          Alimenta: {c.feeds.join(", ")}
        </div>
      ) : null}

      {/* O conserto. Não é o erro técnico — é o que fazer com ele. */}
      {c.errorMessage ? (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px dashed var(--hairline)",
          }}
        >
          <Eyebrow tone={meta.tone}>Como consertar</Eyebrow>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--ink)",
            }}
          >
            {c.errorMessage}
          </p>
        </div>
      ) : null}

      {/* O estrago. Sem isto, quem lê não sabe o tamanho da urgência. */}
      {c.impactNote ? (
        <div style={{ marginTop: 8 }}>
          <Eyebrow tone="red">Impacto</Eyebrow>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--ink-muted)",
            }}
          >
            {c.impactNote}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function ConnectionsScreen() {
  const fetcher = useCallback(() => listConnections(), []);
  const { data, loading, error, reload } =
    useSignalData<ConnectionRow[]>(fetcher);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const rows = data ?? [];
  const broken = rows.filter((c) => c.health !== "HEALTHY");
  const healthy = rows.filter((c) => c.health === "HEALTHY");

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Dado · fontes"
        subtitle="Toda métrica do Signal vem de uma destas. Quando uma para, os números que dependem dela param junto — e é isso que esta tela mostra antes de qualquer outra coisa."
        title="Conexões"
        tone={broken.length > 0 ? "red" : "accent"}
      />

      {loading ? <SkeletonRows cols="1fr" rows={4} /> : null}

      {!loading && rows.length === 0 ? (
        <SmartEmptyState
          icon="plug"
          subtitle="Sem fonte conectada, toda observação precisa ser lançada à mão — o que funciona, mas não escala. Conecte um rastreador de tarefas, um data warehouse ou uma planilha para começar."
          title="Nenhuma fonte conectada"
          tone="accent"
        />
      ) : null}

      {broken.length > 0 ? (
        <SectionCard
          subtitle="Enquanto estiverem assim, os números que dependem delas não avançam."
          title={`${broken.length} ${broken.length === 1 ? "fonte precisa" : "fontes precisam"} de atenção`}
          tone="red"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {broken.map((c) => (
              <ConnectionCard c={c} key={c.code} />
            ))}
          </div>
        </SectionCard>
      ) : null}

      {healthy.length > 0 ? (
        <SectionCard title={`${healthy.length} sincronizando`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {healthy.map((c) => (
              <ConnectionCard c={c} key={c.code} />
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
