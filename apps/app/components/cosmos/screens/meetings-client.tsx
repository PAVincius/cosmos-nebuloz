"use client";

// meetings-client.tsx — client half of the consent screen (see meetings.tsx).
// Fila de PENDING primeiro (o que trava o pipeline), GRANTED com revogar,
// DENIED/REVOKED como histórico sem ação. Duas coisas não são decoração:
//
// 1. O rótulo do estágio de PENDING deixa explícito que "Liberar" é uma
//    afirmação de quem clicou — não uma confirmação de um dado que o
//    sistema tem. Quando participantsKnown é true, o Cosmos mostra quem o
//    provedor viu na sala (MeetingParticipant); quando é false, diz isso
//    sem rodeio — "não sabemos quem estava na sala". Nos dois casos, quem
//    libera está afirmando que verificou consentimento fora do sistema: a
//    lista, quando existe, é do provedor, não da sala (ver
//    docs/compliance/consentimento-de-gravacao.md §4).
// 2. RBAC visível: só ADMIN/STE/RTE podem agir (mesmo ADMIN_ROLES de
//    consent.ts). Quem não tem o papel não vê botão nenhum — vê o estado e
//    quem pode agir, no espírito de podeAgir/quemPode do
//    getSetupProgress do Charter.
import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  ErrorState,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  type ConsentQueueRow,
  type ConsentQueueView,
  denyConsent,
  grantConsent,
  listConsentQueue,
  revokeConsent,
} from "@/app/actions/meeting/consent";
import { EmptyState } from "../empty-state";
import { useActionToast } from "../use-action-toast";

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function consentModeLabel(mode: string): string {
  return mode === "STANDING" ? "Declaração permanente" : "Por reunião";
}

const HISTORY_TONE: Record<string, "red" | "neutral"> = {
  DENIED: "red",
  REVOKED: "neutral",
};

function RowContent({
  row,
  right,
}: {
  row: ConsentQueueRow;
  right: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.title || "Reunião sem título"}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
            fontSize: 12,
            color: "var(--ink-faint)",
          }}
        >
          <span>{fmt(row.createdAt)}</span>
          <span>·</span>
          <span>{consentModeLabel(row.consentMode)}</span>
          <span>·</span>
          <span>
            {row.insightCount === 1
              ? "1 insight"
              : `${row.insightCount} insights`}
          </span>
        </div>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
      >
        {right}
      </div>
    </div>
  );
}

function RowShell({ row, right }: { row: ConsentQueueRow; right: ReactNode }) {
  return (
    <div
      style={{ padding: "12px 0", borderBottom: "1px solid var(--hairline)" }}
    >
      <RowContent right={right} row={row} />
    </div>
  );
}

// A informação que sustenta a decisão de liberar (docs/compliance/
// consentimento-de-gravacao.md §4/§7): quem estava na sala, segundo o
// provedor — nunca a sala em si. participantsKnown = false não é "sem
// externo", é "não sabemos", e precisa ficar tão visível quanto a lista.
function ParticipantsInfo({ row }: { row: ConsentQueueRow }) {
  if (!row.participantsKnown) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 8,
          fontSize: 12.5,
        }}
      >
        <Icon name="alert" size={13} strokeWidth={1.9} />
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>
          Não sabemos quem estava na sala
        </span>
        <span style={{ color: "var(--ink-faint)" }}>
          — o provedor não devolveu participantes desta reunião.
        </span>
      </div>
    );
  }

  const { participants } = row;
  const externalCount = participants.filter((p) => p.isExternal).length;
  const countLabel = `${participants.length} ${
    participants.length === 1 ? "participante" : "participantes"
  } · ${
    externalCount === 0
      ? "nenhum externo"
      : `${externalCount} ${externalCount === 1 ? "externo" : "externos"}`
  }`;

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: externalCount > 0 ? "var(--red-text)" : "var(--ink-muted)",
          marginBottom: participants.length > 0 ? 6 : 0,
        }}
      >
        {countLabel}
      </div>
      {participants.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {participants.map((p) => (
            <div
              key={p.email}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--ink-subtle)",
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name || p.email}
              </span>
              {p.isOrganizer && <Badge tone="blue">Organizador</Badge>}
              {p.isExternal && <Badge tone="red">Externo</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PendingRow({
  row,
  podeAgir,
  busy,
  onGrant,
  onDeny,
}: {
  row: ConsentQueueRow;
  podeAgir: boolean;
  busy: boolean;
  onGrant: () => void;
  onDeny: () => void;
}) {
  const grantTitle = row.participantsKnown
    ? "Você está afirmando que verificou o consentimento fora do sistema — a lista de participantes é a do provedor, não a da sala; quem entrou por link sem convite pode não aparecer."
    : "Você está afirmando que verificou o consentimento fora do sistema — o provedor não devolveu participantes desta reunião, então sua palavra é o único fundamento.";
  return (
    <div
      style={{ padding: "12px 0", borderBottom: "1px solid var(--hairline)" }}
    >
      <RowContent
        right={
          podeAgir ? (
            <>
              <Button
                disabled={busy}
                icon="ban"
                onClick={onDeny}
                size="sm"
                title="Negar consentimento — a transcrição fica registrada como negada, sem processar por IA."
                variant="secondary"
              >
                Negar
              </Button>
              <Button
                disabled={busy}
                icon="check"
                onClick={onGrant}
                size="sm"
                title={grantTitle}
                variant="primary"
              >
                Liberar
              </Button>
            </>
          ) : (
            <Badge tone="amber">Pendente</Badge>
          )
        }
        row={row}
      />
      <ParticipantsInfo row={row} />
    </div>
  );
}

function GrantedRow({
  row,
  podeAgir,
  busy,
  onRevoke,
}: {
  row: ConsentQueueRow;
  podeAgir: boolean;
  busy: boolean;
  onRevoke: () => void;
}) {
  const grantedLabel =
    row.consentMode === "STANDING"
      ? row.grantedByRef
        ? `Declaração: ${row.grantedByRef}`
        : "Liberação automática"
      : row.grantedByName
        ? `Liberado por ${row.grantedByName}`
        : "Liberado";
  const whenLabel = row.grantedAt ? ` · ${fmt(row.grantedAt)}` : "";
  return (
    <RowShell
      right={
        <>
          <span
            style={{
              fontSize: 12,
              color: "var(--ink-subtle)",
              textAlign: "right",
            }}
          >
            {grantedLabel}
            {whenLabel}
          </span>
          {podeAgir && (
            <Button
              disabled={busy}
              icon="refresh"
              onClick={onRevoke}
              size="sm"
              title="Revoga o consentimento: apaga insights ainda não aplicados, redige os já aplicados e zera o resumo da transcrição."
              variant="secondary"
            >
              Revogar
            </Button>
          )}
        </>
      }
      row={row}
    />
  );
}

function HistoryRow({ row }: { row: ConsentQueueRow }) {
  return (
    <RowShell
      right={
        <Badge tone={HISTORY_TONE[row.consentState] ?? "neutral"}>
          {row.consentState}
        </Badge>
      }
      row={row}
    />
  );
}

export default function MeetingsClient({
  initial,
  error: initialError,
}: {
  initial: ConsentQueueView | null;
  error: string | null;
}) {
  const [view, setView] = useState<ConsentQueueView | null>(initial);
  const [error, setError] = useState<string | null>(initialError);
  const [actingId, setActingId] = useState<string | null>(null);

  const reload = async () => {
    const res = await listConsentQueue();
    if (res.ok) {
      setView(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  const grant = async (id: string) => {
    setActingId(id);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => grantConsent({ transcriptId: id }), {
      loading: "Liberando transcrição...",
      success: "Consentimento liberado — o mapeador de IA foi enfileirado.",
      error: (err: string) => `Não foi possível liberar: ${err}`,
    });
    setActingId(null);
    if (res.ok) {
      await reload();
    }
  };

  const deny = async (id: string) => {
    setActingId(id);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => denyConsent({ transcriptId: id }), {
      loading: "Negando transcrição...",
      success: "Consentimento negado.",
      error: (err: string) => `Não foi possível negar: ${err}`,
    });
    setActingId(null);
    if (res.ok) {
      await reload();
    }
  };

  const revoke = async (id: string) => {
    setActingId(id);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => revokeConsent({ transcriptId: id }),
      {
        loading: "Revogando consentimento...",
        success:
          "Consentimento revogado — insights não aplicados foram apagados.",
        error: (err: string) => `Não foi possível revogar: ${err}`,
      }
    );
    setActingId(null);
    if (res.ok) {
      await reload();
    }
  };

  const rows = view?.rows ?? [];
  const podeAgir = view?.podeAgir ?? false;
  const quemPode = view?.quemPode ?? "ADMIN, STE ou RTE";
  const pending = rows.filter((r) => r.consentState === "PENDING");
  const granted = rows.filter((r) => r.consentState === "GRANTED");
  const history = rows.filter(
    (r) => r.consentState === "DENIED" || r.consentState === "REVOKED"
  );

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Compliance · Gravação"
        meta={
          <Badge tone={pending.length > 0 ? "amber" : "neutral"}>
            {pending.length} {pending.length === 1 ? "pendente" : "pendentes"}
          </Badge>
        }
        subtitle="Sem liberar aqui, a transcrição fica presa em PENDING e o mapeador de IA nunca roda."
        title="Consentimento de Gravação"
      />

      {!podeAgir && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
            color: "var(--ink-muted)",
            fontSize: 12.5,
          }}
        >
          <Icon name="lock" size={15} strokeWidth={1.9} />
          <span>
            Você pode ver o estado das transcrições, mas só {quemPode} podem
            liberar, negar ou revogar consentimento.
          </span>
        </div>
      )}

      {error && (
        <ErrorState message="Não foi possível carregar a fila de consentimento." />
      )}

      {!error && rows.length === 0 && (
        <EmptyState
          description="Quando uma transcrição de reunião chegar via integração, ela aparece aqui para liberação."
          icon="shield"
          title="Nenhuma transcrição ainda"
        />
      )}

      {!error && rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard
            icon="shield"
            subtitle="Liberar aqui é uma afirmação sua — você verificou o consentimento fora do sistema. Quando a lista de participantes aparece, é a do provedor, não a da sala; quando não aparece, o provedor não devolveu participantes e sua palavra é o único fundamento."
            title="Fila de liberação"
            tone="amber"
          >
            {pending.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Nenhuma transcrição pendente.
              </span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {pending.map((row) => (
                  <PendingRow
                    busy={actingId === row.id}
                    key={row.id}
                    onDeny={() => deny(row.id)}
                    onGrant={() => grant(row.id)}
                    podeAgir={podeAgir}
                    row={row}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon="check"
            subtitle="Consentimento concedido — mapeador de IA processado ou na fila."
            title="Liberadas"
            tone="green"
          >
            {granted.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                Nenhuma transcrição liberada ainda.
              </span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {granted.map((row) => (
                  <GrantedRow
                    busy={actingId === row.id}
                    key={row.id}
                    onRevoke={() => revoke(row.id)}
                    podeAgir={podeAgir}
                    row={row}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {history.length > 0 && (
            <SectionCard
              icon="history"
              subtitle="Registro — sem ação disponível."
              title="Histórico"
              tone="neutral"
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                {history.map((row) => (
                  <HistoryRow key={row.id} row={row} />
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
