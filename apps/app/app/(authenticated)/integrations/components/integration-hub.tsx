"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@repo/design-system/components/ui/card";
import {
  CheckCircle2Icon, AlertCircleIcon, ClockIcon, PlusIcon,
  TrashIcon, RefreshCwIcon, ExternalLinkIcon, PlugZapIcon,
} from "lucide-react";
import { deleteIntegration } from "@/app/actions/integrations";
import type { IntegrationRow } from "@/app/actions/integrations/schema";
import { ConnectWizard } from "./connect-wizard";

// ─── Source config ────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<string, { label: string; color: string; logo: string }> = {
  linear: { label: "Linear",          color: "bg-violet-500/10 text-violet-700 border-violet-400/30", logo: "⬡" },
  github: { label: "GitHub Projects", color: "bg-slate-500/10 text-slate-700 border-slate-400/30",   logo: "⚙" },
  asana:  { label: "Asana",           color: "bg-pink-500/10 text-pink-700 border-pink-400/30",       logo: "◈" },
  gitlab: { label: "GitLab",          color: "bg-orange-500/10 text-orange-700 border-orange-400/30", logo: "◆" },
};

const STATUS_CONFIG = {
  ACTIVE:   { label: "Ativa",    icon: CheckCircle2Icon, color: "text-green-600" },
  INACTIVE: { label: "Inativa",  icon: ClockIcon,        color: "text-muted-foreground" },
  ERROR:    { label: "Erro",     icon: AlertCircleIcon,  color: "text-red-600" },
};

function SyncLogBadge({ log }: { log: IntegrationRow["syncLogs"][number] }) {
  const color = log.status === "success" ? "text-green-600" : log.status === "partial" ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`font-medium ${color}`}>
        {log.status === "success" ? "✓" : log.status === "partial" ? "~" : "✗"}
      </span>
      <span>+{log.itemsCreated} ↻{log.itemsUpdated} ⊘{log.itemsSkipped}</span>
      <span className="text-muted-foreground/60">
        {new Date(log.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
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

  const src = SOURCE_CONFIG[integration.source] ?? { label: integration.source, color: "", logo: "◌" };
  const sts = STATUS_CONFIG[integration.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.INACTIVE;
  const StatusIcon = sts.icon;

  function handleDelete() {
    if (!confirm(`Remover integração "${integration.name}"?`)) return;
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
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${src.color}`}>
              {src.logo}
            </span>
            <div>
              <CardTitle className="text-sm font-semibold">{integration.name}</CardTitle>
              <CardDescription className="text-xs">{src.label}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusIcon className={`h-3.5 w-3.5 ${sts.color}`} />
            <span className={`text-xs font-medium ${sts.color}`}>{sts.label}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {integration.lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Último sync: {new Date(integration.lastSyncAt).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        )}

        {integration.syncLogs.length > 0 && (
          <div className="space-y-1 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Últimos syncs</p>
            {integration.syncLogs.slice(0, 3).map((log) => (
              <SyncLogBadge key={log.id} log={log} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs flex-1"
            onClick={() => setImportOpen(true)}
          >
            <RefreshCwIcon className="h-3 w-3" />
            Importar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            disabled={isPending}
            onClick={handleDelete}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>

      {importOpen && (
        <ConnectWizard
          mode="import"
          existingIntegration={integration}
          arts={arts}
          epics={epics}
          onClose={() => setImportOpen(false)}
        />
      )}
    </Card>
  );
}

// ─── Main hub ─────────────────────────────────────────────────────────────────

type Props = {
  integrations: IntegrationRow[];
  arts:         { id: string; name: string }[];
  epics:        { id: string; title: string }[];
};

export function IntegrationHub({ integrations, arts, epics }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Available sources banner */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold">Ferramentas suportadas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Import snapshot disponível para Linear e GitHub Projects. Asana e GitLab em breve.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color} ${key === "asana" || key === "gitlab" ? "opacity-50" : ""}`}
              >
                {cfg.logo} {cfg.label}
                {(key === "asana" || key === "gitlab") && <span className="ml-0.5 text-[10px]">em breve</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Integration grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Integrações ({integrations.length})
          </p>
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setWizardOpen(true)}>
            <PlusIcon className="h-3.5 w-3.5" />
            Conectar ferramenta
          </Button>
        </div>

        {integrations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
            <PlugZapIcon className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-semibold">Nenhuma integração configurada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Conecte Linear ou GitHub Projects para importar features e stories diretamente para o COSMOS.
              </p>
            </div>
            <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
              <PlusIcon className="h-4 w-4" />
              Conectar agora
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((i) => (
              <IntegrationCard key={i.id} integration={i} arts={arts} epics={epics} />
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como funciona</p>
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
          <div className="space-y-1">
            <p className="font-medium text-foreground">1. Conecte</p>
            <p>Informe seu API key ou token. O COSMOS testa a conexão e lista seus projetos/times.</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">2. Importe</p>
            <p>Selecione o projeto e mapeie para Epic, PI ou Time no COSMOS. Issues viram Features ou Stories.</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground">3. Use no COSMOS</p>
            <p>Features importadas aparecem no Program Board, WSJF, Flow Metrics e PI Planning — com link para o item original.</p>
          </div>
        </div>
      </div>

      {wizardOpen && (
        <ConnectWizard
          mode="connect"
          arts={arts}
          epics={epics}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}
