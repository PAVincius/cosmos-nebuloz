"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { CheckCircle2Icon, LinkIcon, XCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { WizardStepHeader } from "../../../../components/wizard-ui";
import type { MigrationSource } from "./step-source-select";

export type ConnectFormData = {
  source: MigrationSource;
  config: Record<string, unknown>;
  connectionId?: string;
};

type Props = {
  source: MigrationSource;
  defaultValues?: Partial<ConnectFormData>;
  onConnected: (data: ConnectFormData) => void;
};

export function StepConnectIntegration({
  source,
  defaultValues,
  onConnected,
}: Props) {
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
        const data = (await res.json()) as {
          connectionId?: string;
          error?: string;
        };
        if (!res.ok || data.error) {
          throw new Error(data.error ?? "Connection failed");
        }
        if (!data.connectionId) {
          throw new Error("No connection ID returned from server.");
        }
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
        description="Informe as credenciais para acessar a origem."
        icon={<LinkIcon className="h-5 w-5" />}
        title="Conectar integração"
      />
      <div className="flex flex-col gap-4">
        {source === "jira" && (
          <>
            <Field id="baseUrl" label="URL base do Jira">
              <Input
                id="baseUrl"
                onChange={(e) => update("baseUrl", e.target.value)}
                placeholder="https://yourorg.atlassian.net"
                value={(config.baseUrl as string) ?? ""}
              />
            </Field>
            <Field id="email" label="Email">
              <Input
                id="email"
                onChange={(e) => update("email", e.target.value)}
                type="email"
                value={(config.email as string) ?? ""}
              />
            </Field>
            <Field id="apiToken" label="API Token">
              <Input
                id="apiToken"
                onChange={(e) => update("apiToken", e.target.value)}
                type="password"
                value={(config.apiToken as string) ?? ""}
              />
            </Field>
          </>
        )}
        {source === "azure" && (
          <>
            <Field id="org" label="Organização Azure DevOps">
              <Input
                id="org"
                onChange={(e) => update("organization", e.target.value)}
                placeholder="minha-org"
                value={(config.organization as string) ?? ""}
              />
            </Field>
            <Field id="project" label="Projeto">
              <Input
                id="project"
                onChange={(e) => update("project", e.target.value)}
                value={(config.project as string) ?? ""}
              />
            </Field>
            <Field id="pat" label="Personal Access Token (PAT)">
              <Input
                id="pat"
                onChange={(e) => update("pat", e.target.value)}
                type="password"
                value={(config.pat as string) ?? ""}
              />
            </Field>
          </>
        )}
        {source === "trello" && (
          <>
            <Field id="apiKey" label="API Key">
              <Input
                id="apiKey"
                onChange={(e) => update("apiKey", e.target.value)}
                value={(config.apiKey as string) ?? ""}
              />
            </Field>
            <Field id="apiToken" label="API Token">
              <Input
                id="apiToken"
                onChange={(e) => update("apiToken", e.target.value)}
                type="password"
                value={(config.apiToken as string) ?? ""}
              />
            </Field>
          </>
        )}
        {source === "csv" && (
          <Field id="content" label="Conteúdo do CSV">
            <Textarea
              className="font-mono text-xs"
              id="content"
              onChange={(e) => update("content", e.target.value)}
              placeholder={
                "type,title,description,status,team,sprint,storyPoints,parentTitle\nepic,Meu Épico,..."
              }
              rows={8}
              value={(config.content as string) ?? ""}
            />
          </Field>
        )}
        <div className="flex items-center gap-3">
          <Button disabled={isPending} onClick={handleTest}>
            {status === "testing" ? "Testando..." : "Testar conexão"}
          </Button>
          {status === "ok" && (
            <span className="flex items-center gap-1.5 text-green-600 text-sm">
              <CheckCircle2Icon className="h-4 w-4" /> Conectado
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1.5 text-destructive text-sm">
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
