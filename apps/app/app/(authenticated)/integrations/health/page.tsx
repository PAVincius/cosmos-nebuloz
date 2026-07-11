import { Badge } from "@repo/design-system/components/cosmos/badge";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  PlugZapIcon,
} from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
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

// Integration.status: ACTIVE | INACTIVE | ERROR (see packages/database schema)
const STATUS_CONFIG: Record<
  string,
  { label: string; tone: "green" | "neutral" | "red"; icon: typeof ClockIcon }
> = {
  ACTIVE: { label: "Ativa", tone: "green", icon: CheckCircle2Icon },
  INACTIVE: { label: "Inativa", tone: "neutral", icon: ClockIcon },
  ERROR: { label: "Erro", tone: "red", icon: AlertCircleIcon },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.INACTIVE;
  const Icon = cfg.icon;
  return (
    <Badge tone={cfg.tone}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

// SyncLog.status: success | partial | error (see packages/database schema)
function syncLogTone(status: string): "green" | "amber" | "red" {
  if (status === "success") {
    return "green";
  }
  if (status === "partial") {
    return "amber";
  }
  return "red";
}

function syncLogIcon(status: string): string {
  if (status === "success") {
    return "✓";
  }
  if (status === "partial") {
    return "~";
  }
  return "✗";
}

function SyncLogEntry({ log }: { log: SyncLogRow }) {
  const hasErrors = Array.isArray(log.errors)
    ? (log.errors as unknown[]).length > 0
    : Boolean(log.errors);
  const tone = syncLogTone(log.status);

  return (
    <li className="flex items-center justify-between gap-4 border-hairline border-t py-2.5 font-mono text-[11.5px] first:border-t-0">
      <div className="flex items-center gap-2">
        <span className="font-bold" style={{ color: `var(--${tone}-text)` }}>
          {syncLogIcon(log.status)}
        </span>
        <span className="text-ink-muted">
          {new Date(log.createdAt).toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="flex items-center gap-3 text-ink-muted">
        <span>+{log.itemsCreated}</span>
        <span>↻{log.itemsUpdated}</span>
        <span>⊘{log.itemsSkipped}</span>
        {hasErrors && (
          <span
            className="flex items-center gap-1"
            style={{ color: "var(--red-text)" }}
          >
            <AlertCircleIcon className="h-3 w-3" /> erros
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
        badge={
          <RelationChip
            eyebrow="Hub"
            href="/integrations"
            icon={<PlugZapIcon />}
            label="Integration Hub"
            tone="accent"
          />
        }
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

      <div className={`${appDesign.bodyScroll} flex flex-col gap-4`}>
        {!result.ok && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-4 py-3 text-red-text text-sm">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            <span>
              Falha ao carregar integrações: {result.error}.{" "}
              <a className="underline" href="/integrations/health">
                Tentar novamente
              </a>
            </span>
          </div>
        )}

        {result.ok && integrations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-hairline border-dashed py-16 text-center">
            <PlugZapIcon className="h-8 w-8 text-ink-muted" />
            <div>
              <p className="font-semibold text-[13px] text-ink">
                Nenhuma integração configurada
              </p>
              <p className="mt-1 text-[12px] text-ink-muted">
                Conecte uma ferramenta no{" "}
                <a className="underline" href="/integrations">
                  Integration Hub
                </a>{" "}
                para ver o status de sincronização aqui.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
            {integrations.map((integration) => {
              const lastSync = integration.lastSyncAt
                ? new Date(integration.lastSyncAt).toLocaleString("pt-BR")
                : "Nunca";

              return (
                <SectionCard
                  actions={<StatusBadge status={integration.status} />}
                  key={integration.id}
                  subtitle={`${
                    STATUS_SOURCE_LABELS[integration.source] ??
                    integration.source
                  } · último sync: ${lastSync}`}
                  title={integration.name}
                >
                  {integration.syncLogs.length === 0 ? (
                    <p className="text-[12px] text-ink-muted">
                      Sem histórico de sync.
                    </p>
                  ) : (
                    <ul>
                      {integration.syncLogs.map((log) => (
                        <SyncLogEntry key={log.id} log={log} />
                      ))}
                    </ul>
                  )}
                </SectionCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
