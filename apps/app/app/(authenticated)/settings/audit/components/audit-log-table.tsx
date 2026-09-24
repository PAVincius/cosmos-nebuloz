import { ClockIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { DataTable } from "@/app/(authenticated)/components/data-table";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import type { AuditLog } from "@/app/actions/audit/schema";

const PERIOD_OPTIONS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

const ENTITY_TYPES = [
  "Team",
  "Feature",
  "Epic",
  "Risk",
  "PIObjective",
  "PIPlan",
  "ART",
  "TenantMember",
  "TenantInvitation",
  "Tenant",
  "User",
];

// Prefixo, não entityType exato — cada produto abaixo grava vários entityType
// concretos sob o mesmo prefixo (ex.: meridian.assessment,
// meridian.override, meridian.promotion...), sem um valor fixo por tela.
// `listAuditLogs` lê entityType terminado em "." como startsWith.
const PREFIX_FILTERS = [{ label: "Meridian", prefix: "meridian." }];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  Team: "Time",
  Feature: "Feature",
  Epic: "Épico",
  Risk: "Risco",
  PIObjective: "Objetivo PI",
  PIPlan: "PI Plan",
  ART: "ART",
  TenantMember: "Membro",
  TenantInvitation: "Convite",
  Tenant: "Workspace",
  User: "Usuário",
};

function formatDiff(diff: AuditLog["diff"]): string {
  if (!diff) {
    return "—";
  }
  // Formato normativo do Cosmos: Record<campo, valor>. Alguns produtos
  // (Meridian) gravam Array<[campo, antes, depois]> de propósito — ver
  // `(meridian)/actions/_shared.ts` `AuditDiff`. Object.entries num array
  // itera por índice, não por campo, então os dois formatos precisam de
  // leitura separada.
  if (Array.isArray(diff)) {
    if (diff.length === 0) {
      return "—";
    }
    const preview = diff
      .slice(0, 2)
      .map(([field, before, after]) => `${field}: ${before} → ${after}`)
      .join(", ");
    return diff.length > 2 ? `${preview}…` : preview;
  }
  const entries = Object.entries(diff);
  if (entries.length === 0) {
    return "—";
  }
  const preview = entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
  return entries.length > 2 ? `${preview}…` : preview;
}

function targetLabel(row: AuditLog): string {
  const target = row.metadata?.target;
  return typeof target === "string" && target.length > 0
    ? target
    : row.entityId;
}

function pillStyle(active: boolean): CSSProperties {
  return active
    ? { background: "var(--accent-c)", color: "var(--on-accent, #fff)" }
    : { color: "var(--ink-faint)" };
}

type Props = {
  logs: AuditLog[];
  periodDays: number;
  entityType?: string;
};

export function AuditLogTable({ logs, periodDays, entityType }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Filters — server-driven via searchParams, styled as pill groups */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-fit gap-1 rounded-cosmos-pill border border-hairline bg-surface-2 p-1">
          {PERIOD_OPTIONS.map(({ label, days }) => {
            const active = periodDays === days;
            const href = entityType
              ? `/settings/audit?period=${days}&entityType=${entityType}`
              : `/settings/audit?period=${days}`;
            return (
              <Link href={href} key={days}>
                <span
                  className="block rounded-cosmos-pill px-3 py-1.5 font-semibold text-[12px] transition-colors"
                  style={pillStyle(active)}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1 rounded-cosmos-pill border border-hairline bg-surface-2 p-1">
          <Link href={`/settings/audit?period=${periodDays}`}>
            <span
              className="block rounded-cosmos-pill px-3 py-1.5 font-semibold text-[12px] transition-colors"
              style={pillStyle(!entityType)}
            >
              Todos
            </span>
          </Link>
          {ENTITY_TYPES.map((et) => {
            const active = entityType === et;
            const href = `/settings/audit?period=${periodDays}&entityType=${et}`;
            return (
              <Link href={href} key={et}>
                <span
                  className="block rounded-cosmos-pill px-3 py-1.5 font-semibold text-[12px] transition-colors"
                  style={pillStyle(active)}
                >
                  {ENTITY_TYPE_LABELS[et] ?? et}
                </span>
              </Link>
            );
          })}
          {PREFIX_FILTERS.map(({ label, prefix }) => {
            const active = entityType === prefix;
            const href = `/settings/audit?period=${periodDays}&entityType=${prefix}`;
            return (
              <Link href={href} key={prefix}>
                <span
                  className="block rounded-cosmos-pill px-3 py-1.5 font-semibold text-[12px] transition-colors"
                  style={pillStyle(active)}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <SectionCard
        accentRgb="167,139,250"
        icon={ClockIcon}
        noPadding={logs.length > 0}
        subtitle={`${logs.length} eventos registrados`}
        title="Eventos de Auditoria"
      >
        {logs.length === 0 ? (
          <div className="rounded-cosmos-lg bg-surface-2 py-16 text-center text-[13px] text-ink-muted">
            Nenhum evento corresponde aos filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              columns={[
                {
                  key: "createdAt",
                  label: "Timestamp",
                  mono: true,
                  render: (row) => {
                    const date = new Date(row.createdAt);
                    return (
                      <span
                        className="block whitespace-nowrap"
                        style={{ color: "var(--ink-faint)" }}
                      >
                        {date.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}{" "}
                        {date.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    );
                  },
                },
                {
                  key: "userId",
                  label: "Quem",
                  render: (row) => row.userId ?? "—",
                },
                {
                  key: "action",
                  label: "Ação",
                  mono: true,
                  render: (row) => (
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--accent-text)" }}
                    >
                      {row.action}
                    </span>
                  ),
                },
                {
                  key: "entityType",
                  label: "Entidade",
                  mono: true,
                  render: (row) => (
                    <div>
                      <div>
                        {ENTITY_TYPE_LABELS[row.entityType] ?? row.entityType}
                      </div>
                      <div
                        className="max-w-32 truncate text-[11px]"
                        style={{ color: "var(--ink-faint)" }}
                        title={row.entityId}
                      >
                        {targetLabel(row)}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "diff",
                  label: "Detalhe",
                  render: (row) => (
                    <span style={{ color: "var(--ink-muted)" }}>
                      {formatDiff(row.diff)}
                    </span>
                  ),
                },
              ]}
              getRowKey={(row) => row.id}
              rows={logs}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
