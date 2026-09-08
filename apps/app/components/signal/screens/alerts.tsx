"use client";

// Alertas — US5. Port de `signal-screens-2.jsx`.
//
// Fila, não mural. Cada cartão traz a REGRA que disparou, o que aconteceu, o
// próximo passo e o dono — e os dois botões que tiram o item da fila. Um painel
// de alertas em que não se age é uma lista de coisas ruins que o time aprende a
// rolar para baixo.
//
// A ordem é por severidade, não por data: WEAK ("usam e não rende") pede
// decisão, os outros dois pedem atenção. Alerta novo de baixa severidade não
// pode empurrar uma decisão pendente para o fim da página.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  type AlertRow,
  evaluateAlerts,
  listAlerts,
  setAlertState,
} from "@/app/(signal)/actions/alerts";
import {
  type ChipOption,
  Eyebrow,
  FilterChips,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useModal,
  useSignalData,
} from "../base";
import { ResolveAlertForm } from "../modal";

const STATE_FILTERS: ChipOption[] = [
  { id: "OPEN", label: "Abertos", tone: "red" },
  { id: "ACKNOWLEDGED", label: "Reconhecidos", tone: "amber" },
  { id: "RESOLVED", label: "Resolvidos", tone: "green" },
];

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

function AlertCard({ a, onAct }: { a: AlertRow; onAct: () => void }) {
  const router = useRouter();
  const { open } = useModal();
  const [busy, setBusy] = useState(false);
  const done = a.state === "RESOLVED";
  const resolvedNote = done ? a.note : null;

  const acknowledge = useCallback(async () => {
    setBusy(true);
    await setAlertState({ code: a.code, state: "ACKNOWLEDGED" });
    setBusy(false);
    onAct();
  }, [a.code, onAct]);

  const resolve = useCallback(() => {
    open(
      <ResolveAlertForm
        code={a.code}
        onResolved={async (note) => {
          const res = await setAlertState({
            code: a.code,
            state: "RESOLVED",
            note,
          });
          if (res.ok) {
            onAct();
          }
          return res.ok ? { ok: true } : { ok: false, error: res.error };
        }}
        question={a.question}
      />
    );
  }, [a.code, a.question, onAct, open]);

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${done ? "var(--hairline)" : `rgba(var(--${a.tone}-rgb),.35)`}`,
        background: done ? "var(--surface-2)" : `var(--${a.tone}-soft)`,
        opacity: done ? 0.72 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          flexWrap: "wrap",
        }}
      >
        <span
          className="mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10.5,
            fontWeight: 700,
            padding: "2px 9px",
            borderRadius: 99,
            background: `var(--${a.tone}-soft)`,
            color: `var(--${a.tone}-text)`,
          }}
        >
          <Icon name={a.icon} size={11} />
          {a.kindLabel}
        </span>
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-faint)" }}
        >
          {a.code}
        </span>
        <button
          className="lift"
          onClick={() => router.push(`/signal/initiative/${a.initiativeCode}`)}
          style={{
            border: 0,
            background: "none",
            padding: 0,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink)",
            textAlign: "left",
          }}
          type="button"
        >
          {a.initiativeCode} · {a.initiativeName}
        </button>
        <span
          className="mono"
          style={{
            marginLeft: "auto",
            fontSize: 10.5,
            color: "var(--ink-faint)",
          }}
        >
          {fmtDate(a.raisedAt)}
          {a.owner ? ` · ${a.owner}` : ""}
        </span>
      </div>

      {/* A pergunta que o alerta faz. É ela que decide se alguém abre isto. */}
      <p
        style={{
          margin: "9px 0 0",
          fontSize: 12.5,
          fontWeight: 700,
          lineHeight: 1.5,
          color: `var(--${a.tone}-text)`,
        }}
      >
        {a.question}
      </p>

      <p
        style={{
          margin: "7px 0 0",
          fontSize: 12,
          lineHeight: 1.55,
          color: "var(--ink-muted)",
        }}
      >
        {a.what}
      </p>

      {/* O próximo passo. Sem ele o cartão é só uma notícia ruim. */}
      <div style={{ marginTop: 10 }}>
        <Eyebrow tone={a.tone}>Próximo passo</Eyebrow>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--ink)",
          }}
        >
          {a.nextStep}
        </p>
      </div>

      {resolvedNote ? (
        <div style={{ marginTop: 10 }}>
          <Eyebrow tone="green">
            Resolvido{a.resolvedBy ? ` por ${a.resolvedBy}` : " pelo sistema"}
          </Eyebrow>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--ink-muted)",
            }}
          >
            {resolvedNote}
          </p>
        </div>
      ) : null}

      {done ? null : (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button onClick={resolve} size="sm">
            Resolver
          </Button>
          {a.state === "OPEN" ? (
            <Button
              disabled={busy}
              onClick={acknowledge}
              size="sm"
              variant="ghost"
            >
              {busy ? "Marcando…" : "Estou olhando"}
            </Button>
          ) : (
            <span
              className="mono"
              style={{
                alignSelf: "center",
                fontSize: 10.5,
                color: "var(--ink-faint)",
              }}
            >
              reconhecido
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Os textos do cabeçalho.
 *
 * Fora do JSX de propósito: a regra de leitura da tela — vermelho só quando
 * alguém precisa DECIDIR, âmbar quando precisa olhar — é o produto, e ela some
 * quando vira ternário no meio da marcação.
 */
function headerCopy(all: AlertRow[], state: string) {
  const open = all.filter((a) => a.state === "OPEN").length;
  const weak = all.filter(
    (a) => a.kind === "WEAK" && a.state !== "RESOLVED"
  ).length;
  return {
    tone: (weak > 0 ? "red" : "accent") as "red" | "accent",
    weakLine:
      weak > 0
        ? `${weak} ${weak === 1 ? "pede decisão" : "pedem decisão"}, não só atenção.`
        : undefined,
    openSuffix:
      state === "OPEN" ? ` · ${open} aberto${open === 1 ? "" : "s"}` : "",
    emptyTitle: state === "OPEN" ? "Nenhum alerta aberto" : "Nada neste filtro",
  };
}

export default function AlertsScreen() {
  const [state, setState] = useState("OPEN");
  const [evaluating, setEvaluating] = useState(false);
  const fetcher = useCallback(() => listAlerts(), []);
  const { data, loading, error, reload } = useSignalData<AlertRow[]>(fetcher);

  const rows = useMemo(
    () => (data ?? []).filter((a) => state === "all" || a.state === state),
    [data, state]
  );

  const revaluate = useCallback(async () => {
    setEvaluating(true);
    await evaluateAlerts();
    setEvaluating(false);
    reload();
  }, [reload]);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const { tone, weakLine, openSuffix, emptyTitle } = headerCopy(
    data ?? [],
    state
  );

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Decisão · fila"
        subtitle="Três regras, e cada uma faz uma pergunta diferente: ninguém usa, usam e não rende, ou o número parou de chegar. Todo alerta carrega o próximo passo — é o que separa uma fila de um mural."
        title="Alertas"
        tone={tone}
      >
        <Button disabled={evaluating} onClick={revaluate} variant="ghost">
          {evaluating ? "Avaliando…" : "Reavaliar regras"}
        </Button>
      </PageHeader>

      <FilterChips
        ariaLabel="Filtrar alertas por estado"
        onChange={setState}
        options={STATE_FILTERS}
        value={state}
      />

      {loading ? <SkeletonRows cols="1fr" rows={3} /> : null}

      {!loading && rows.length === 0 ? (
        <SmartEmptyState
          icon="check"
          subtitle="As regras rodam contra as iniciativas ativas e usam os limiares desta organização. Fila vazia com iniciativas ativas significa que adoção, retorno e fontes estão dentro do combinado."
          title={emptyTitle}
          tone="green"
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <SectionCard
          subtitle={weakLine}
          title={`${rows.length} ${rows.length === 1 ? "alerta" : "alertas"}${openSuffix}`}
          tone={tone}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((a) => (
              <AlertCard a={a} key={a.code} onAct={reload} />
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
