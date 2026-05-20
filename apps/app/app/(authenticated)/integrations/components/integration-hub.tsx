"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  PlugZapIcon,
  PlusIcon,
  RefreshCwIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteIntegration } from "@/app/actions/integrations";
import type { IntegrationRow } from "@/app/actions/integrations/schema";
import { ConnectWizard } from "./connect-wizard";

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<
  string,
  { label: string; color: string; logo: string }
> = {
  linear: {
    label: "Linear",
    color: "bg-violet-500/10 text-violet-700 border-violet-400/30",
    logo: "⬡",
  },
  github: {
    label: "GitHub Projects",
    color: "bg-slate-500/10 text-slate-700 border-slate-400/30",
    logo: "⚙",
  },
  asana: {
    label: "Asana",
    color: "bg-pink-500/10 text-pink-700 border-pink-400/30",
    logo: "◈",
  },
  gitlab: {
    label: "GitLab",
    color: "bg-orange-500/10 text-orange-700 border-orange-400/30",
    logo: "◆",
  },
};

const STATUS_CONFIG = {
  ACTIVE: { label: "Ativa", icon: CheckCircle2Icon, color: "text-green-600" },
  INACTIVE: {
    label: "Inativa",
    icon: ClockIcon,
    color: "text-muted-foreground",
  },
  ERROR: { label: "Erro", icon: AlertCircleIcon, color: "text-red-600" },
};

function syncLogColor(status: string): string {
  if (status === "success") {
    return "text-green-600";
  }
  if (status === "partial") {
    return "text-amber-600";
  }
  return "text-red-600";
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

function SyncLogBadge({ log }: { log: IntegrationRow["syncLogs"][number] }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <span className={`font-medium ${syncLogColor(log.status)}`}>
        {syncLogIcon(log.status)}
      </span>
      <span>
        +{log.itemsCreated} ↻{log.itemsUpdated} ⊘{log.itemsSkipped}
      </span>
      <span className="text-muted-foreground/60">
        {new Date(log.createdAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}

function IntegrationCard({
  integration,
  arts,
  epics,
}: {
  integration: IntegrationRow;
  arts: { id: string; name: string }[];
  epics: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);

  const src = SOURCE_CONFIG[integration.source] ?? {
    label: integration.source,
    color: "",
    logo: "◌",
  };
  const sts =
    STATUS_CONFIG[integration.status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.INACTIVE;
  const StatusIcon = sts.icon;

  function handleDelete() {
    startTransition(async () => {
      await deleteIntegration(integration.id);
      router.refresh();
    });
  }

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg border font-bold text-sm ${src.color}`}
            >
              {src.logo}
            </span>
            <div>
              <CardTitle className="font-semibold text-sm">
                {integration.name}
              </CardTitle>
              <CardDescription className="text-xs">{src.label}</CardDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusIcon className={`h-3.5 w-3.5 ${sts.color}`} />
            <span className={`font-medium text-xs ${sts.color}`}>
              {sts.label}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {integration.lastSyncAt ? (
          <p className="text-muted-foreground text-xs">
            Último sync:{" "}
            {new Date(integration.lastSyncAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : null}

        {integration.syncLogs.length > 0 ? (
          <div className="space-y-1 border-t pt-2">
            <p className="mb-1 font-medium text-muted-foreground text-xs">
              Últimos syncs
            </p>
            {integration.syncLogs.slice(0, 3).map((log) => (
              <SyncLogBadge key={log.id} log={log} />
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2 pt-1">
          <Button
            className="h-7 flex-1 gap-1 text-xs"
            onClick={() => setImportOpen(true)}
            size="sm"
            variant="outline"
          >
            <RefreshCwIcon className="h-3 w-3" />
            Importar
          </Button>
          <Button
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            disabled={isPending}
            onClick={handleDelete}
            size="sm"
            variant="ghost"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>

      {importOpen ? (
        <ConnectWizard
          arts={arts}
          epics={epics}
          existingIntegration={integration}
          mode="import"
          onClose={() => setImportOpen(false)}
        />
      ) : null}
    </Card>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

type Props = {
  integrations: IntegrationRow[];
  arts: { id: string; name: string }[];
  epics: { id: string; title: string }[];
};

export function IntegrationHub({ integrations, arts, epics }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* ROI value proposition */}
      <div className="rounded-lg border bg-gradient-to-r from-violet-500/5 to-blue-500/5 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[240px] flex-1">
            <p className="font-semibold text-base tracking-tight">
              Continue no seu fluxo. Ganhe visibilidade SAFe.
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              Devs continuam no Linear ou GitHub. RTEs, LPMs e PMs veem Program
              Board, WSJF, Flow Metrics e PI Planning com os dados reais — sem
              pedir que o time troque de ferramenta.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-muted-foreground text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Sem ruptura de stack
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Features importadas aparecem no Program Board + WSJF
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                Link direto para o item original em cada card
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs ${cfg.color} ${key === "asana" || key === "gitlab" ? "opacity-40" : ""}`}
                key={key}
              >
                {cfg.logo} {cfg.label}
                {(key === "asana" || key === "gitlab") && (
                  <span className="ml-0.5 opacity-60">em breve</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Integration grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            Integrações ({integrations.length})
          </p>
          <Button
            className="h-8 gap-1.5"
            onClick={() => setWizardOpen(true)}
            size="sm"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Conectar ferramenta
          </Button>
        </div>

        {integrations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
            <PlugZapIcon className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-sm">
                Nenhuma integração configurada
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Conecte Linear ou GitHub Projects para importar features e
                stories diretamente para o COSMOS.
              </p>
            </div>
            <Button className="gap-1.5" onClick={() => setWizardOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              Conectar agora
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((i) => (
              <IntegrationCard
                arts={arts}
                epics={epics}
                integration={i}
                key={i.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="space-y-3 rounded-lg border p-4">
        <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Como funciona
        </p>
        <div className="grid gap-3 text-muted-foreground text-xs sm:grid-cols-3">
          <div className="space-y-1">
            <p className="font-medium text-foreground">1. Conecte</p>
            <p>
              Informe seu API key ou token. O COSMOS testa a conexão e lista
              seus projetos/times.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">2. Importe</p>
            <p>
              Selecione o projeto e mapeie para Epic, PI ou Time no COSMOS.
              Issues viram Features ou Stories.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">3. Use no COSMOS</p>
            <p>
              Features importadas aparecem no Program Board, WSJF, Flow Metrics
              e PI Planning — com link para o item original.
            </p>
          </div>
        </div>
      </div>

      {wizardOpen ? (
        <ConnectWizard
          arts={arts}
          epics={epics}
          mode="connect"
          onClose={() => setWizardOpen(false)}
        />
      ) : null}
    </div>
  );
}
