import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ClipboardListIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { appDesign } from "@/lib/app-design";
import { listAuditLogs } from "../../../actions/audit/index";

export const metadata = {
  title: "Audit Log | Configurações | COSMOS",
  description: "Histórico de ações no workspace",
};

const ACTION_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  created: "default",
  updated: "secondary",
  deleted: "destructive",
  invited: "outline",
  removed: "destructive",
};

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

type SearchParams = { entityType?: string; period?: string };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const periodDays = params.period ? Number.parseInt(params.period, 10) : 30;
  const entityType = params.entityType ?? undefined;

  const from = new Date();
  from.setDate(from.getDate() - periodDays);

  const result = await listAuditLogs({ entityType, from, page: 1, limit: 50 });
  const logs = result.ok ? result.data.items : [];

  const csvParams = new URLSearchParams();
  if (entityType) {
    csvParams.set("entityType", entityType);
  }
  csvParams.set("period", String(periodDays));

  return (
    <div className={appDesign.shell}>
      <div className={appDesign.pageHeader}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
              <ClipboardListIcon className="size-5" />
              Audit Log
            </h1>
            <p className="text-muted-foreground text-sm">
              Histórico de todas as ações no workspace (últimos {periodDays}{" "}
              dias)
            </p>
          </div>
          <Button asChild className="gap-2" size="sm" variant="outline">
            <Link href={`/api/audit/export?${csvParams.toString()}`}>
              <DownloadIcon className="size-4" />
              Exportar CSV
            </Link>
          </Button>
        </div>
      </div>
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {/* Period Filter */}
            <div className="flex gap-1">
              {PERIOD_OPTIONS.map(({ label, days }) => {
                const active = periodDays === days;
                const href = entityType
                  ? `/settings/audit?period=${days}&entityType=${entityType}`
                  : `/settings/audit?period=${days}`;
                return (
                  <Link href={href} key={days}>
                    <Badge
                      className="cursor-pointer"
                      variant={active ? "default" : "outline"}
                    >
                      {label}
                    </Badge>
                  </Link>
                );
              })}
            </div>
            <div className="w-px bg-border" />
            {/* Entity Type Filter */}
            <div className="flex flex-wrap gap-1">
              <Link
                href={
                  params.period
                    ? `/settings/audit?period=${periodDays}`
                    : "/settings/audit"
                }
              >
                <Badge
                  className="cursor-pointer"
                  variant={entityType ? "outline" : "default"}
                >
                  Todos
                </Badge>
              </Link>
              {ENTITY_TYPES.map((et) => {
                const active = entityType === et;
                const href = `/settings/audit?period=${periodDays}&entityType=${et}`;
                return (
                  <Link href={href} key={et}>
                    <Badge
                      className="cursor-pointer"
                      variant={active ? "default" : "outline"}
                    >
                      {ENTITY_TYPE_LABELS[et] ?? et}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Logs Table */}
          <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
            <div className="border-hairline border-b bg-surface-2 px-5 py-4">
              <h2 className="font-semibold text-sm">
                Registros
                <span className="ml-2 font-normal text-muted-foreground text-xs">
                  ({logs.length})
                </span>
              </h2>
            </div>
            <div className="px-5">
              {logs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  Nenhum registro encontrado para os filtros selecionados.
                </div>
              ) : (
                <div className="divide-y divide-hairline text-sm">
                  {logs.map((log) => {
                    const date = new Date(log.createdAt);
                    const dateStr = date.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });
                    const timeStr = date.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        className="flex flex-wrap items-start gap-3 py-3"
                        key={log.id}
                      >
                        <div className="w-28 shrink-0 text-muted-foreground text-xs">
                          <p>{dateStr}</p>
                          <p>{timeStr}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {log.userId ?? "—"}
                          </p>
                        </div>
                        <Badge
                          className="shrink-0 capitalize"
                          variant={ACTION_VARIANTS[log.action] ?? "outline"}
                        >
                          {log.action}
                        </Badge>
                        <div className="shrink-0 text-right">
                          <p className="font-medium">
                            {ENTITY_TYPE_LABELS[log.entityType] ??
                              log.entityType}
                          </p>
                          <p className="max-w-32 truncate font-mono text-muted-foreground text-xs">
                            {log.entityId}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
