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
import { Badge, PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback } from "react";
import {
  type ConnectionRow,
  listConnections,
} from "@/app/(signal)/actions/connections";
import { HEALTH_META } from "@/lib/signal/health";
import {
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useSignalData,
} from "../base";
import { ListCard, ListCardHead, MetaRow, Note } from "../list-card";

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
  const cardTone = bad ? meta.tone : undefined;
  const metaItems = [
    `último sync ${sinceLabel(c.lastSyncAt)}`,
    freqLabel(c.expectedFreqMinutes),
    c.rowsLabel,
    `${c.mappingCount} ${c.mappingCount === 1 ? "métrica" : "métricas"}`,
    c.owner ? `dono: ${c.owner}` : null,
  ];

  return (
    <ListCard tone={cardTone}>
      <ListCardHead
        code={c.code}
        context={c.kind}
        title={
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
          >
            {c.icon ? <Icon name={c.icon} size={14} /> : null}
            {c.name}
          </span>
        }
      >
        <Badge icon={meta.icon} tone={meta.tone}>
          {meta.label}
        </Badge>
      </ListCardHead>

      <MetaRow items={metaItems} />

      {c.feeds.length > 0 ? (
        <div style={{ marginTop: 7, fontSize: 11, color: "var(--ink-subtle)" }}>
          Alimenta: {c.feeds.join(", ")}
        </div>
      ) : null}

      {/* O conserto. Não é o erro técnico — é o que fazer com ele. */}
      {c.errorMessage ? (
        <Note emphasis label="Como consertar" tone={meta.tone}>
          {c.errorMessage}
        </Note>
      ) : null}

      {/* O estrago. Sem isto, quem lê não sabe o tamanho da urgência. */}
      {c.impactNote ? (
        <Note label="Impacto" tone="red">
          {c.impactNote}
        </Note>
      ) : null}
    </ListCard>
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
