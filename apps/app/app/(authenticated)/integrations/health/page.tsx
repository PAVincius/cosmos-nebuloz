import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { listIntegrations } from "@/app/actions/integrations";
import type { SyncLogRow } from "@/app/actions/integrations/schema";
import { appDesign } from "@/lib/app-design";

export const metadata = {
  title: "Integration Health | COSMOS",
};

const STATUS_SOURCE_LABELS: Record<string, string> = {
  linear: "Linear",
  github: "GitHub",
  asana: "Asana",
  gitlab: "GitLab",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE" || status === "SUCCESS") {
    return (
      <Badge className="gap-1" variant="default">
        <CheckCircle2Icon className="h-3 w-3" />
        {status === "ACTIVE" ? "Ativa" : "OK"}
      </Badge>
    );
  }
  if (status === "ERROR" || status === "FAILED") {
    return (
      <Badge className="gap-1" variant="destructive">
        <XCircleIcon className="h-3 w-3" />
        Erro
      </Badge>
    );
  }
  return (
    <Badge className="gap-1" variant="secondary">
      <ClockIcon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function SyncLogEntry({ log }: { log: SyncLogRow }) {
  const hasErrors = Array.isArray(log.errors)
    ? (log.errors as unknown[]).length > 0
    : Boolean(log.errors);

  return (
    <li className="flex items-center justify-between gap-4 py-2 text-xs">
      <div className="flex items-center gap-2">
        <StatusBadge status={log.status} />
        <span className="text-muted-foreground">
          {new Date(log.createdAt).toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="flex gap-3 text-muted-foreground">
        <span>+{log.itemsCreated}</span>
        <span>~{log.itemsUpdated}</span>
        <span>skip {log.itemsSkipped}</span>
        {hasErrors && (
          <span className="text-destructive">
            <AlertCircleIcon className="inline h-3 w-3" /> erros
          </span>
        )}
      </div>
    </li>
  );
}

export default async function IntegrationHealthPage() {
  const result = await listIntegrations();
  const integrations = result.ok ? result.data : [];

  const active = integrations.filter((i) => i.status === "ACTIVE").length;
  const errored = integrations.filter((i) => i.status === "ERROR").length;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Integration Hub", href: "/integrations" },
          { label: "Health" },
        ]}
        stats={[
          { label: "Total", value: integrations.length, icon: ClockIcon },
          { label: "Ativas", value: active, icon: CheckCircle2Icon },
          { label: "Com erro", value: errored, icon: AlertCircleIcon },
        ]}
        subtitle="Status de sincronização e logs recentes por integração"
        title="Integration Health"
      />

      <div className={appDesign.bodyScroll}>
        {integrations.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma integração configurada. Adicione em{" "}
            <a className="underline" href="/integrations">
              Integration Hub
            </a>
            .
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => {
              const lastSync = integration.lastSyncAt
                ? new Date(integration.lastSyncAt).toLocaleString("pt-BR")
                : "Nunca";

              return (
                <Card key={integration.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">
                        {integration.name}
                      </CardTitle>
                      <StatusBadge status={integration.status} />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {STATUS_SOURCE_LABELS[integration.source] ??
                        integration.source}{" "}
                      · último sync: {lastSync}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {integration.syncLogs.length === 0 ? (
                      <p className="text-muted-foreground text-xs">
                        Sem histórico de sync.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {integration.syncLogs.map((log) => (
                          <SyncLogEntry key={log.id} log={log} />
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
