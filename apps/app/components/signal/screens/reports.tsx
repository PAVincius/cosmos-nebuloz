"use client";

// Relatórios — US6. Port de `signal-screens-2.jsx`.
//
// A tela distingue duas coisas que a maioria dos painéis mistura: rascunho e
// congelado. Rascunho ainda acompanha o banco; congelado parou no tempo e é o
// que foi apresentado. Por isso o congelado mostra data, autor e páginas — e o
// rascunho travado mostra, por extenso, o que precisa ser reconectado.
//
// O motivo do bloqueio nunca aparece resumido nem atrás de um clique: é o único
// texto da tela que diz o que fazer, e escondê-lo transformaria o botão
// desabilitado num mistério.

import {
  Badge,
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  draftReport,
  exportReport,
  freezeReport,
  listReports,
  type ReportRow,
} from "@/app/(signal)/actions/reports";
import { fmtDay } from "@/lib/signal/dates";
import {
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
import { DraftReportForm } from "../modal";

const KIND_LABEL: Record<string, string> = {
  EXECUTIVE: "Executivo",
  PORTFOLIO: "Portfólio",
};

/**
 * O bloqueio por extenso.
 *
 * Nunca resumido nem atrás de um clique: é o único texto da tela que diz o que
 * fazer, e escondê-lo transformaria o botão desabilitado num mistério.
 */
function BlockNote({
  reason,
  blockers,
}: {
  reason: string | null;
  blockers: string[];
}) {
  if (!reason) {
    return null;
  }
  return (
    <Note emphasis label="Ainda não dá para congelar" tone="amber">
      {reason}
      {blockers.length > 0 ? (
        <ul
          className="mono"
          style={{
            margin: "7px 0 0",
            paddingLeft: 18,
            fontSize: 11,
            lineHeight: 1.7,
            color: "var(--ink-muted)",
          }}
        >
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </Note>
  );
}

/** Baixa o payload congelado como arquivo. Sai do payload, nunca da tela. */
function saveAsJson(code: string, payload: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${code}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function reportMeta(r: ReportRow): (string | null)[] {
  return [
    `${fmtDay(r.periodStart)} – ${fmtDay(r.periodEnd)}`,
    r.pageCount === null ? null : `${r.pageCount} páginas`,
    r.generatedBy ? `por ${r.generatedBy}` : null,
    r.generatedAt
      ? `em ${new Date(r.generatedAt).toLocaleDateString("pt-BR")}`
      : null,
  ];
}

function ReportCard({ r, onChanged }: { r: ReportRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const final = r.state === "FINAL";

  const freeze = useCallback(async () => {
    setBusy(true);
    setError(null);
    setBlockers([]);
    const res = await freezeReport({ code: r.code });
    setBusy(false);
    if (res.ok) {
      onChanged();
      return;
    }
    setError(res.error);
    setBlockers(res.blockers ?? []);
  }, [r.code, onChanged]);

  const download = useCallback(async () => {
    setError(null);
    const res = await exportReport({ code: r.code });
    if (res.ok) {
      saveAsJson(r.code, res.data);
      return;
    }
    setError(res.error);
  }, [r.code]);

  const hasBlock = Boolean(r.blockedReason) || blockers.length > 0;
  const blockReason = final || !hasBlock ? null : (r.blockedReason ?? error);
  // Erro de ação que NÃO é bloqueio (rede, permissão) aparece abaixo dos botões.
  const actionError = blockReason ? null : error;
  const cardTone = blockReason ? "amber" : undefined;
  const stateTone = final ? "green" : "neutral";
  const stateIcon = final ? "lock" : "edit";

  return (
    <ListCard tone={cardTone}>
      <ListCardHead
        code={r.code}
        context={`${KIND_LABEL[r.kind] ?? r.kind} · ${r.periodLabel}`}
        title={r.name}
      >
        <Badge icon={stateIcon} tone={stateTone}>
          {final ? "Congelado" : "Rascunho"}
        </Badge>
      </ListCardHead>

      <MetaRow items={reportMeta(r)} />

      {r.note ? (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--ink-muted)",
          }}
        >
          {r.note}
        </p>
      ) : null}

      <BlockNote blockers={blockers} reason={blockReason} />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {final ? (
          <Button icon="download" onClick={download} size="sm" variant="ghost">
            Baixar dados
          </Button>
        ) : (
          <Button disabled={busy} icon="lock" onClick={freeze} size="sm">
            {busy ? "Congelando…" : "Congelar período"}
          </Button>
        )}
      </div>
      <InlineError error={actionError} />
    </ListCard>
  );
}

export default function ReportsScreen() {
  const { open } = useModal();
  const fetcher = useCallback(() => listReports(), []);
  const { data, loading, error, reload } = useSignalData<ReportRow[]>(fetcher);

  const { drafts, finals } = useMemo(() => {
    const all = data ?? [];
    return {
      drafts: all.filter((r) => r.state === "DRAFT"),
      finals: all.filter((r) => r.state === "FINAL"),
    };
  }, [data]);

  const openNew = useCallback(() => {
    open(
      <DraftReportForm
        onDrafted={async (input) => {
          const res = await draftReport(input);
          if (res.ok) {
            reload();
          }
          return res.ok ? { ok: true } : { ok: false, error: res.error };
        }}
      />
    );
  }, [open, reload]);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Decisão · fechamento"
        subtitle="Congelar um período grava o que os números diziam naquele dia. Depois disso o relatório para no tempo — é o que permite conferir uma decisão velha sem discutir qual versão da conta valia."
        title="Relatórios"
        tone="accent"
      >
        <Button icon="plus" onClick={openNew}>
          Novo relatório
        </Button>
      </PageHeader>

      {loading ? <SkeletonRows cols="1fr" rows={3} /> : null}

      {!loading && (data ?? []).length === 0 ? (
        <SmartEmptyState
          icon="fileText"
          onPrimary={openNew}
          primaryIcon="plus"
          primaryLabel="Criar o primeiro"
          subtitle="Um relatório congelado é a única cópia que não muda quando a fórmula muda. Sem nenhum, toda conferência de decisão passada vira arqueologia no banco."
          title="Nenhum relatório"
          tone="accent"
        />
      ) : null}

      {drafts.length > 0 ? (
        <SectionCard
          subtitle="Ainda acompanham o banco: os números podem mudar até o congelamento."
          title={`${drafts.length} ${drafts.length === 1 ? "rascunho" : "rascunhos"}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {drafts.map((r) => (
              <ReportCard key={r.code} onChanged={reload} r={r} />
            ))}
          </div>
        </SectionCard>
      ) : null}

      {finals.length > 0 ? (
        <SectionCard
          subtitle="Parados no tempo. É o que foi apresentado, não o que o sistema pensa hoje."
          title={`${finals.length} ${finals.length === 1 ? "congelado" : "congelados"}`}
          tone="green"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {finals.map((r) => (
              <ReportCard key={r.code} onChanged={reload} r={r} />
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
