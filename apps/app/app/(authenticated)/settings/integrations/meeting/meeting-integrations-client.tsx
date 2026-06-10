"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useState, useTransition } from "react";
import {
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

export function MeetingIntegrationsClient({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState("Fireflies");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConnect() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await connectFireflies({ name, apiKey });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({
        webhookUrl: res.data.webhookUrl,
        webhookSecret: res.data.webhookSecret,
      });
      setApiKey("");
      setRows((prev) => [
        {
          id: res.data.id,
          provider: "fireflies",
          name,
          status: "ACTIVE",
          webhookUrl: res.data.webhookUrl,
          lastEventAt: null,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    });
  }

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
      <section className="space-y-4 rounded-lg border p-4">
        <h3 className="font-medium text-sm">Conectar Fireflies</h3>
        <p className="text-muted-foreground text-sm">
          Cole sua API key do Fireflies. As decisões, riscos e ações das
          cerimônias serão capturadas automaticamente no COSMOS.
        </p>
        <div className="space-y-2">
          <Label htmlFor="fireflies-name">Nome</Label>
          <Input
            id="fireflies-name"
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fireflies-key">API Key</Label>
          <Input
            id="fireflies-key"
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
              Conectado. Configure o webhook no Fireflies:
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
