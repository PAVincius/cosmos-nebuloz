"use client";

import { useState, useTransition } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { CheckCircle2Icon, XCircleIcon, LinkIcon } from "lucide-react";
import { WizardStepHeader } from "../../../../components/wizard-ui";
import type { MigrationSource } from "./step-source-select";

export interface ConnectFormData {
  source: MigrationSource;
  config: Record<string, unknown>;
  connectionId?: string;
}

interface Props {
  source: MigrationSource;
  defaultValues?: Partial<ConnectFormData>;
  onConnected: (data: ConnectFormData) => void;
}

export function StepConnectIntegration({ source, defaultValues, onConnected }: Props) {
  const [config, setConfig] = useState<Record<string, unknown>>(
    defaultValues?.config ?? {}
  );
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">(
    defaultValues?.connectionId ? "ok" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(key: string, value: unknown) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function handleTest() {
    setStatus("testing");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/migration/${source}/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        const data = (await res.json()) as { connectionId?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? "Connection failed");
        if (!data.connectionId) throw new Error("No connection ID returned from server.");
        setStatus("ok");
        onConnected({ source, config, connectionId: data.connectionId });
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Falha na conexão");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<LinkIcon className="h-5 w-5" />}
        title="Conectar integração"
        description="Informe as credenciais para acessar a origem."
      />
      <div className="flex flex-col gap-4">
        {source === "jira" && (
          <>
            <Field label="URL base do Jira" id="baseUrl">
              <Input
                id="baseUrl"
                value={(config.baseUrl as string) ?? ""}
                onChange={(e) => update("baseUrl", e.target.value)}
                placeholder="https://yourorg.atlassian.net"
              />
            </Field>
            <Field label="Email" id="email">
              <Input
                id="email"
                type="email"
                value={(config.email as string) ?? ""}
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>
            <Field label="API Token" id="apiToken">
              <Input
                id="apiToken"
                type="password"
                value={(config.apiToken as string) ?? ""}
                onChange={(e) => update("apiToken", e.target.value)}
              />
            </Field>
          </>
        )}
        {source === "azure" && (
          <>
            <Field label="Organização Azure DevOps" id="org">
              <Input
                id="org"
                value={(config.organization as string) ?? ""}
                onChange={(e) => update("organization", e.target.value)}
                placeholder="minha-org"
              />
            </Field>
            <Field label="Projeto" id="project">
              <Input
                id="project"
                value={(config.project as string) ?? ""}
                onChange={(e) => update("project", e.target.value)}
              />
            </Field>
            <Field label="Personal Access Token (PAT)" id="pat">
              <Input
                id="pat"
                type="password"
                value={(config.pat as string) ?? ""}
                onChange={(e) => update("pat", e.target.value)}
              />
            </Field>
          </>
        )}
        {source === "trello" && (
          <>
            <Field label="API Key" id="apiKey">
              <Input
                id="apiKey"
                value={(config.apiKey as string) ?? ""}
                onChange={(e) => update("apiKey", e.target.value)}
              />
            </Field>
            <Field label="API Token" id="apiToken">
              <Input
                id="apiToken"
                type="password"
                value={(config.apiToken as string) ?? ""}
                onChange={(e) => update("apiToken", e.target.value)}
              />
            </Field>
          </>
        )}
        {source === "csv" && (
          <Field label="Conteúdo do CSV" id="content">
            <Textarea
              id="content"
              value={(config.content as string) ?? ""}
              onChange={(e) => update("content", e.target.value)}
              placeholder={`type,title,description,status,team,sprint,storyPoints,parentTitle\nepic,Meu Épico,...`}
              rows={8}
              className="font-mono text-xs"
            />
          </Field>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={handleTest} disabled={isPending}>
            {status === "testing" ? "Testando..." : "Testar conexão"}
          </Button>
          {status === "ok" && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2Icon className="h-4 w-4" /> Conectado
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1.5 text-sm text-destructive">
              <XCircleIcon className="h-4 w-4" /> {errorMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
