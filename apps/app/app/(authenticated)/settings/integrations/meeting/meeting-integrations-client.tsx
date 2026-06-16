"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useState, useTransition } from "react";
import {
  connectFathom,
  connectFireflies,
  disconnectMeetingIntegration,
  type MeetingIntegrationRow,
} from "@/app/actions/meeting/integrations";

type Props = {
  initial: MeetingIntegrationRow[];
};

type ConnectResult = {
  webhookUrl: string;
  webhookSecret: string;
};

function ConnectForm({
  label,
  defaultName,
  onConnect,
  onAddRow,
}: {
  label: string;
  defaultName: string;
  onConnect: (args: { name: string; apiKey: string }) => Promise<{
    ok: boolean;
    data?: { id: string; webhookUrl: string; webhookSecret: string };
    error?: string;
  }>;
  onAddRow: (row: MeetingIntegrationRow) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConnect() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await onConnect({ name, apiKey });
      if (!(res.ok && res.data)) {
        setError(res.error ?? "Erro desconhecido");
        return;
      }
      setResult({
        webhookUrl: res.data.webhookUrl,
        webhookSecret: res.data.webhookSecret,
      });
      setApiKey("");
      onAddRow({
        id: res.data.id,
        provider: label.toLowerCase(),
        name,
        status: "ACTIVE",
        webhookUrl: res.data.webhookUrl,
        lastEventAt: null,
        createdAt: new Date(),
      });
    });
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h3 className="font-medium text-sm">Conectar {label}</h3>
      <p className="text-muted-foreground text-sm">
        Cole sua API key do {label}. As decisões, riscos e ações das cerimônias
        serão capturadas automaticamente no COSMOS.
      </p>
      <div className="space-y-2">
        <Label htmlFor={`${label}-name`}>Nome</Label>
        <Input
          id={`${label}-name`}
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${label}-key`}>API Key</Label>
        <Input
          id={`${label}-key`}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="••••••••••••"
          type="password"
          value={apiKey}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button
        disabled={pending || apiKey.length === 0}
        onClick={handleConnect}
        type="button"
      >
        {pending ? "A conectar…" : "Conectar"}
      </Button>
      {result ? (
        <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">
            Conectado. Configure o webhook no {label}:
          </p>
          <p className="break-all font-mono text-xs">
            URL: {result.webhookUrl}
          </p>
          <p className="break-all font-mono text-xs">
            Secret: {result.webhookSecret}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export function MeetingIntegrationsClient({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();

  function handleDisconnect(id: string) {
    startTransition(async () => {
      const res = await disconnectMeetingIntegration({ id });
      if (res.ok) {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "PAUSED" } : r))
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <ConnectForm
        defaultName="Fireflies"
        label="Fireflies"
        onAddRow={(row) => setRows((prev) => [row, ...prev])}
        onConnect={connectFireflies}
      />
      <ConnectForm
        defaultName="Fathom"
        label="Fathom"
        onAddRow={(row) => setRows((prev) => [row, ...prev])}
        onConnect={connectFathom}
      />

      <section className="space-y-2">
        <h3 className="font-medium text-sm">Integrações conectadas</h3>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma integração de meeting conectada.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((r) => (
              <li className="flex items-center justify-between p-3" key={r.id}>
                <div>
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {r.provider} · {r.status}
                  </p>
                </div>
                {r.status === "ACTIVE" ? (
                  <Button
                    disabled={pending}
                    onClick={() => handleDisconnect(r.id)}
                    type="button"
                    variant="outline"
                  >
                    Desconectar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
