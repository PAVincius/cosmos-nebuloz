"use client";

// settings-audit-tab.tsx — Auditoria tab (Settings screen, tab 4). Real,
// tenant-scoped AuditLog entries via settings-audit.ts::getAuditTab,
// capped at 25/page with prev/next pagination (no unbounded pull). CSV
// export is a client-side string build from the same rows already on
// screen — no new export action, cheap and honest (only what's visible).
import { useState } from "react";
import {
  type AuditLogRow,
  getAuditTab,
} from "@/app/(cosmos)/actions/settings-audit";
import {
  Badge,
  Button,
  ErrorState,
  SectionCard,
  Skel,
  useAction,
} from "../kit";
import { fmtDate } from "./settings-shared";

const ACTION_TONE: Record<string, "green" | "red" | "amber" | "blue"> = {
  created: "green",
  deleted: "red",
  updated: "blue",
  status_changed: "amber",
};

// Spreadsheet apps (Excel/Sheets) treat a cell starting with =, +, -, @, tab
// or CR as a formula — a user-set field like actorName (User.name) could
// otherwise inject one (e.g. =HYPERLINK(...)) into anyone's export. Prefix
// with a leading apostrophe to force it back to plain text.
const FORMULA_INJECTION_RE = /^[=+\-@\t\r]/;

function sanitizeCsvField(value: string): string {
  return FORMULA_INJECTION_RE.test(value) ? `'${value}` : value;
}

export function toCsv(rows: AuditLogRow[]): string {
  const header = "id,actor,action,entityType,entityId,createdAt";
  const lines = rows.map((r) =>
    [r.id, r.actorName, r.action, r.entityType, r.entityId, r.createdAt]
      .map((v) => `"${sanitizeCsvField(String(v)).replaceAll('"', '""')}"`)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

function downloadCsv(rows: AuditLogRow[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AuditRow({ row }: { row: AuditLogRow }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 140px minmax(0,1.4fr) 130px",
        alignItems: "center",
        gap: 14,
        padding: "10px 16px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>
        {row.actorName}
      </span>
      <Badge tone={ACTION_TONE[row.action] ?? "neutral"}>{row.action}</Badge>
      <span
        className="mono"
        style={{
          fontSize: 12,
          color: "var(--ink-muted)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.entityType} · {row.entityId}
      </span>
      <span style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
        {fmtDate(row.createdAt)}
      </span>
    </div>
  );
}

export default function SettingsAuditTab() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useAction(() => getAuditTab(page), [page]);

  if (error) {
    return <ErrorState />;
  }

  return (
    <SectionCard
      action={
        data &&
        data.items.length > 0 && (
          <Button
            icon="download"
            onClick={() => downloadCsv(data.items)}
            size="sm"
            variant="secondary"
          >
            Exportar CSV
          </Button>
        )
      }
      icon="book"
      subtitle="AuditLog — ator, ação, entidade, data (25 por página, tenant-scoped)"
      title="Log de auditoria"
      tone="accent"
    >
      {loading && <Skel h={60} />}
      {!loading && data && data.items.length === 0 && (
        <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
          Nenhum evento de auditoria registrado ainda.
        </span>
      )}
      {!loading && data && data.items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.items.map((row) => (
            <AuditRow key={row.id} row={row} />
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 4,
            }}
          >
            <Button
              onClick={() => data.hasPrev && setPage((p) => Math.max(1, p - 1))}
              size="sm"
              style={
                data.hasPrev ? undefined : { opacity: 0.4, cursor: "default" }
              }
              variant="ghost"
            >
              Anterior
            </Button>
            <Button
              onClick={() => data.hasNext && setPage((p) => p + 1)}
              size="sm"
              style={
                data.hasNext ? undefined : { opacity: 0.4, cursor: "default" }
              }
              variant="ghost"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
