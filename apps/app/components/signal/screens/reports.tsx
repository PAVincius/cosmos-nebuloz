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

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  exportReport,
  freezeReport,
  listReports,
  type ReportRow,
} from "@/app/(signal)/actions/reports";
import {
  Eyebrow,
  ScreenError,
  SkeletonRows,
  SmartEmptyState,
  useSignalData,
} from "../base";

const KIND_LABEL: Record<string, string> = {
  EXECUTIVE: "Executivo",
  PORTFOLIO: "Portfólio",
};

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function MetaRow({ r }: { r: ReportRow }) {
  return (
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
      <span>
        {fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}
      </span>
      {r.pageCount === null ? null : <span>{r.pageCount} páginas</span>}
      {r.generatedBy ? <span>por {r.generatedBy}</span> : null}
      {r.generatedAt ? <span>em {fmtDate(r.generatedAt)}</span> : null}
    </div>
  );
}

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
    <div style={{ marginTop: 10 }}>
      <Eyebrow tone="amber">Ainda não dá para congelar</Eyebrow>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 12,
          lineHeight: 1.55,
          color: "var(--ink)",
        }}
      >
        {reason}
      </p>
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
    </div>
  );
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
    const res = await exportReport({ code: r.code });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // O arquivo sai do payload congelado, igual ao que o comitê leu.
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [r.code]);

  const hasBlock = Boolean(r.blockedReason) || blockers.length > 0;
  const blockReason = final || !hasBlock ? null : (r.blockedReason ?? error);

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${blockReason ? "rgba(var(--amber-rgb),.35)" : "var(--hairline)"}`,
        background: blockReason ? "var(--amber-soft)" : "var(--surface-2)",
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
          style={{ fontSize: 11, color: "var(--ink-faint)" }}
        >
          {r.code}
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
          {r.name}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          {KIND_LABEL[r.kind] ?? r.kind} · {r.periodLabel}
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
            background: final ? "var(--green-soft)" : "var(--surface-3)",
            color: final ? "var(--green-text)" : "var(--ink-muted)",
          }}
        >
          <Icon name={final ? "lock" : "edit"} size={11} />
          {final ? "Congelado" : "Rascunho"}
        </span>
      </div>

      <MetaRow r={r} />

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
          <Button onClick={download} size="sm" variant="ghost">
            Baixar dados
          </Button>
        ) : (
          <Button disabled={busy} onClick={freeze} size="sm">
            {busy ? "Congelando…" : "Congelar período"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ReportsScreen() {
  const fetcher = useCallback(() => listReports(), []);
  const { data, loading, error, reload } = useSignalData<ReportRow[]>(fetcher);

  const { drafts, finals } = useMemo(() => {
    const all = data ?? [];
    return {
      drafts: all.filter((r) => r.state === "DRAFT"),
      finals: all.filter((r) => r.state === "FINAL"),
    };
  }, [data]);

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
      />

      {loading ? <SkeletonRows cols="1fr" rows={3} /> : null}

      {!loading && (data ?? []).length === 0 ? (
        <SmartEmptyState
          icon="fileText"
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
