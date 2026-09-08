"use client";

// Trilha — US7. Port de `signal-screens-4.jsx`.
//
// Linha do tempo, não tabela. A pergunta que esta tela responde é "quem mudou
// este número, quando, e o que ele era antes?" — e a resposta só vale com o
// `de → para` visível. Uma trilha que diz "fórmula editada" sem dizer de quanto
// para quanto registra que algo aconteceu sem registrar o quê.
//
// O papel mostrado é o do MOMENTO do ato. Se ele acompanhasse o papel atual, a
// trilha reescreveria a história a cada promoção.

import { Icon } from "@repo/design-system/cosmos/icons";
import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import { type AuditRow, listAudit } from "@/app/(signal)/actions/audit";
import {
  type ChipOption,
  FilterChips,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useSignalData,
} from "../base";

const ENTITY_FILTERS: ChipOption[] = [
  { id: "signal.initiative", label: "Iniciativas", tone: "accent" },
  { id: "signal.roiformula", label: "Fórmulas", tone: "green" },
  { id: "signal.baseline", label: "Baselines", tone: "blue" },
  { id: "signal.connection", label: "Fontes", tone: "amber" },
  { id: "signal.report", label: "Relatórios", tone: "purple" },
];

const ENTITY_ICON: Record<string, string> = {
  "signal.initiative": "target",
  "signal.baseline": "flag",
  "signal.connection": "plug",
  "signal.mapping": "ruler",
  "signal.observation": "fileText",
  "signal.roiformula": "calculator",
  "signal.confidence": "shield",
  "signal.alert": "alert",
  "signal.report": "fileText",
  "signal.settings": "settings",
  "signal.member": "users",
};

const fmtWhen = (d: Date) =>
  new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function AuditItem({ r }: { r: AuditRow }) {
  return (
    <li
      style={{
        display: "flex",
        gap: 11,
        padding: "11px 0",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 26,
          height: 26,
          borderRadius: "var(--r-sm)",
          display: "grid",
          placeItems: "center",
          background: r.bySystem ? "var(--surface-3)" : "var(--accent-soft)",
          color: r.bySystem ? "var(--ink-faint)" : "var(--accent-text)",
        }}
      >
        <Icon name={ENTITY_ICON[r.entityType ?? ""] ?? "fileText"} size={13} />
      </span>

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
            style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}
          >
            {r.action}
          </span>
          {r.target ? (
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--ink-muted)" }}
            >
              {r.target}
            </span>
          ) : null}
          <span
            className="mono"
            style={{
              marginLeft: "auto",
              fontSize: 10.5,
              color: "var(--ink-faint)",
            }}
          >
            {r.actorName}
            {r.actorRole ? ` · ${r.actorRole}` : ""} · {fmtWhen(r.at)}
          </span>
        </div>

        {/* O de → para. Sem ele a linha diz que algo mudou, não o quê. */}
        {r.diff.length > 0 ? (
          <div
            className="mono"
            style={{
              marginTop: 6,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              fontSize: 11,
              color: "var(--ink-muted)",
            }}
          >
            {r.diff.map(([field, from, to]) => (
              <div key={`${field}-${from}-${to}`}>
                {field}:{" "}
                <span style={{ color: "var(--red-text)" }}>{from}</span> →{" "}
                <span style={{ color: "var(--green-text)" }}>{to}</span>
              </div>
            ))}
          </div>
        ) : null}

        {r.note ? (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 11.5,
              lineHeight: 1.55,
              color: "var(--ink-subtle)",
            }}
          >
            {r.note}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default function AuditScreen() {
  const [entity, setEntity] = useState("all");
  const fetcher = useCallback(() => listAudit(), []);
  const { data, loading, error, reload } = useSignalData<AuditRow[]>(fetcher);

  const rows = useMemo(
    () =>
      (data ?? []).filter((r) => entity === "all" || r.entityType === entity),
    [data, entity]
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Prova · trilha"
        subtitle="Toda mudança que afeta um número aparece aqui com o valor anterior, o novo, quem fez e em que papel estava na hora. A trilha não é editável — nem por administrador."
        title="Auditoria"
        tone="accent"
      />

      <FilterChips
        ariaLabel="Filtrar trilha por tipo de registro"
        onChange={setEntity}
        options={ENTITY_FILTERS}
        value={entity}
      />

      {loading ? <SkeletonRows cols="1fr" rows={6} /> : null}

      {!loading && rows.length === 0 ? (
        <SmartEmptyState
          icon="shield"
          subtitle="A trilha grava cada escrita junto com o ato que a causou. Vazia significa que nada foi alterado neste filtro — não que o registro falhou."
          title="Nenhum registro neste filtro"
          tone="accent"
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <SectionCard
          title={`${rows.length} ${rows.length === 1 ? "registro" : "registros"}`}
        >
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((r) => (
              <AuditItem key={r.id} r={r} />
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
