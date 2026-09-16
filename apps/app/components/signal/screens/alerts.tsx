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

import {
  Badge,
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
import { fmtWhen } from "@/lib/signal/dates";
import {
  type ChipOption,
  FilterChips,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useModal,
  useSignalData,
} from "../base";
import {
  InlineError,
  ListCard,
  ListCardHead,
  MetaRow,
  Note,
} from "../list-card";
import { ResolveAlertForm } from "../modal";

const STATE_FILTERS: ChipOption[] = [
  { id: "OPEN", label: "Abertos", tone: "red" },
  { id: "ACKNOWLEDGED", label: "Reconhecidos", tone: "amber" },
  { id: "RESOLVED", label: "Resolvidos", tone: "green" },
];

function AlertCard({ a, onAct }: { a: AlertRow; onAct: () => void }) {
  const router = useRouter();
  const { open } = useModal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = a.state === "RESOLVED";
  const resolvedNote = done ? a.note : null;
  const cardTone = done ? undefined : a.tone;
  const meta = [fmtWhen(a.raisedAt), a.owner ? `dono: ${a.owner}` : null];

  const acknowledge = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await setAlertState({ code: a.code, state: "ACKNOWLEDGED" });
    setBusy(false);
    if (res.ok) {
      onAct();
      return;
    }
    // Sem isto o botão volta ao normal e a pessoa acha que reconheceu.
    setError(res.error);
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
    <ListCard muted={done} tone={cardTone}>
      <ListCardHead
        code={a.code}
        onTitleClick={() =>
          router.push(`/signal/initiative/${a.initiativeCode}`)
        }
        title={`${a.initiativeCode} · ${a.initiativeName}`}
      >
        <Badge icon={a.icon} tone={a.tone}>
          {a.kindLabel}
        </Badge>
      </ListCardHead>

      <MetaRow items={meta} />

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
      <Note emphasis label="Próximo passo" tone={a.tone}>
        {a.nextStep}
      </Note>

      {resolvedNote ? (
        <Note
          label={`Resolvido${a.resolvedBy ? ` por ${a.resolvedBy}` : " pelo sistema"}`}
          tone="green"
        >
          {resolvedNote}
        </Note>
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
            <Badge tone="neutral">reconhecido</Badge>
          )}
        </div>
      )}
      <InlineError error={error} />
    </ListCard>
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
