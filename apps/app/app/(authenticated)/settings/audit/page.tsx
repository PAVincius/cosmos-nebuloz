import { listAuditLogs } from "../../../actions/audit/index";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import Link from "next/link";
import { ClipboardListIcon, DownloadIcon } from "lucide-react";
import { appDesign } from "@/lib/app-design";

export const metadata = {
  title: "Audit Log | Configurações | COSMOS",
  description: "Histórico de ações no workspace",
};

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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
  "Team", "Feature", "Epic", "Risk", "PIObjective", "PIPlan",
  "ART", "TenantMember", "TenantInvitation", "Tenant", "User",
];

type SearchParams = { entityType?: string; period?: string };

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const periodDays = params.period ? parseInt(params.period, 10) : 30;
  const entityType = params.entityType ?? undefined;

  const from = new Date();
  from.setDate(from.getDate() - periodDays);

  const result = await listAuditLogs({ entityType, from, page: 1, limit: 50 });
  const logs = result.ok ? result.data.items : [];

  const csvParams = new URLSearchParams();
  if (entityType) csvParams.set("entityType", entityType);
  csvParams.set("period", String(periodDays));

  return (
    <div className={appDesign.shell}>
      <div className={appDesign.pageHeader}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardListIcon className="size-5" />
            Audit Log
          </h1>
          <p className="text-muted-foreground text-sm">
            Histórico de todas as ações no workspace (últimos {periodDays} dias)
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-2">
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
      <div className="flex gap-3 flex-wrap">
        {/* Period Filter */}
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(({ label, days }) => {
            const active = periodDays === days;
            const href = entityType
              ? `/settings/audit?period=${days}&entityType=${entityType}`
              : `/settings/audit?period=${days}`;
            return (
              <Link key={days} href={href}>
                <Badge variant={active ? "default" : "outline"} className="cursor-pointer">
                  {label}
                </Badge>
              </Link>
            );
          })}
        </div>
        <div className="w-px bg-border" />
        {/* Entity Type Filter */}
        <div className="flex gap-1 flex-wrap">
          <Link href={params.period ? `/settings/audit?period=${periodDays}` : "/settings/audit"}>
            <Badge variant={!entityType ? "default" : "outline"} className="cursor-pointer">
              Todos
            </Badge>
          </Link>
          {ENTITY_TYPES.map((et) => {
            const active = entityType === et;
            const href = `/settings/audit?period=${periodDays}&entityType=${et}`;
            return (
              <Link key={et} href={href}>
                <Badge variant={active ? "default" : "outline"} className="cursor-pointer">
                  {ENTITY_TYPE_LABELS[et] ?? et}
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Registros
            <span className="ml-2 text-sm font-normal text-muted-foreground">({logs.length})</span>

          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum registro encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="divide-y text-sm">
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
                  <div key={log.id} className="flex items-start gap-3 py-3 flex-wrap">
                    <div className="shrink-0 text-xs text-muted-foreground w-28">
                      <p>{dateStr}</p>
                      <p>{timeStr}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {log.userId ?? "—"}
                      </p>
                    </div>
                    <Badge
                      variant={ACTION_VARIANTS[log.action] ?? "outline"}
                      className="shrink-0 capitalize"
                    >
                      {log.action}
                    </Badge>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">{ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-32">
                        {log.entityId}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}
