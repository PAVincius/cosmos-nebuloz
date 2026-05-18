"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  GitBranchIcon,
  LinkIcon,
  MessageSquareIcon,
  SettingsIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  upsertIntegration,
  deleteIntegration,
  type Integration,
} from "../../../../actions/settings/integrations";

// ─── Integration Catalog ──────────────────────────────────────────────────────

type IntegrationDef = {
  type: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
};

const INTEGRATION_CATALOG: IntegrationDef[] = [
  {
    type: "JIRA",
    name: "Jira",
    description: "Sincronize issues, sprints e projetos com o Jira Cloud.",
    icon: LinkIcon,
    fields: [
      { key: "url", label: "URL do Workspace", placeholder: "https://yourorg.atlassian.net" },
      { key: "email", label: "Email", placeholder: "user@example.com" },
      { key: "token", label: "API Token", placeholder: "••••••••••", type: "password" },
    ],
  },
  {
    type: "AZURE_DEVOPS",
    name: "Azure DevOps",
    description: "Integre boards, pipelines e repositórios do Azure DevOps.",
    icon: GitBranchIcon,
    fields: [
      { key: "organization", label: "Organização", placeholder: "myorg" },
      { key: "project", label: "Projeto", placeholder: "my-project" },
      { key: "token", label: "Personal Access Token", placeholder: "••••••••••", type: "password" },
    ],
  },
  {
    type: "GITHUB",
    name: "GitHub",
    description: "Conecte repositórios, PRs e issues do GitHub.",
    icon: GitBranchIcon,
    fields: [
      { key: "org", label: "Organização / Usuário", placeholder: "myorg" },
      { key: "token", label: "Personal Access Token", placeholder: "ghp_••••••••", type: "password" },
    ],
  },
  {
    type: "SLACK",
    name: "Slack",
    description: "Receba notificações e atualizações diretamente no Slack.",
    icon: MessageSquareIcon,
    fields: [
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://hooks.slack.com/services/..." },
      { key: "channel", label: "Canal padrão", placeholder: "#cosmos-alerts" },
    ],
  },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircleIcon className="h-3 w-3" />
        Conectado
      </Badge>
    );
  }
  if (status === "ERROR") {
    return (
      <Badge variant="destructive" className="gap-1">
        <TriangleAlertIcon className="h-3 w-3" />
        Erro
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <XCircleIcon className="h-3 w-3" />
      Inativo
    </Badge>
  );
}

// ─── Connect Dialog ───────────────────────────────────────────────────────────

function ConnectDialog({
  def,
  existing,
  onSuccess,
}: {
  def: IntegrationDef;
  existing?: Integration;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(
    (existing?.config ?? {}) as Record<string, string>
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await upsertIntegration({
          type: def.type,
          config: fields,
          status: "ACTIVE",
        });
        setOpen(false);
        onSuccess();
      } catch {
        setError("Erro ao conectar integração. Tente novamente.");
      }
    });
  }

  const isValid = def.fields.every((f) => fields[f.key]?.trim());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={existing ? "outline" : "default"}>
          {existing ? (
            <>
              <SettingsIcon className="mr-2 h-4 w-4" />
              Configurar
            </>
          ) : (
            <>
              <LinkIcon className="mr-2 h-4 w-4" />
              Conectar
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar {def.name}</DialogTitle>
          <DialogDescription>{def.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {def.fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-2">
              <Label htmlFor={`int-${field.key}`}>
                {field.label} <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`int-${field.key}`}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                value={fields[field.key] ?? ""}
                onChange={(e) =>
                  setFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
            </div>
          ))}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !isValid}>
            {isPending ? "Conectando..." : "Salvar conexão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export function IntegrationsBoard({
  initialIntegrations,
}: {
  initialIntegrations: Integration[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function handleDisconnect(type: string) {
    startTransition(async () => {
      await deleteIntegration(type);
      router.refresh();
    });
  }

  const integrationMap = Object.fromEntries(
    initialIntegrations.map((i) => [i.type, i])
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {INTEGRATION_CATALOG.map((def) => {
        const existing = integrationMap[def.type];
        const IconComp = def.icon;

        return (
          <Card key={def.type} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted">
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{def.name}</CardTitle>
                  </div>
                </div>
                {existing && <StatusBadge status={existing.status} />}
              </div>
              <CardDescription className="text-xs leading-relaxed">
                {def.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2 pt-0 mt-auto">
              <ConnectDialog def={def} existing={existing} onSuccess={refresh} />
              {existing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  onClick={() => handleDisconnect(def.type)}
                  disabled={isPending}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
