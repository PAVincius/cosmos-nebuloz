"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { useState, useTransition } from "react";
import { bootstrapCharterAction } from "@/app/actions/provisioning";

export function CharterBootstrap({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await bootstrapCharterAction({
        slug,
        complianceEmail: email,
      });

      if (result.ok) {
        setMessage(
          result.data.created
            ? "Política criada com as nove seções em rascunho."
            : "Política já existia — apenas o papel foi garantido."
        );
        return;
      }
      setError(result.error);
    });

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="font-medium text-sm">Preparar o Charter</p>
      <p className="text-muted-foreground text-xs">
        Atribui o papel Compliance e cria a política inicial. Rodar de novo não
        duplica nada.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="flex gap-2">
        <Input
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail do responsável pelo Compliance"
          type="email"
          value={email}
        />
        <Button
          aria-label="Preparar o Charter deste cliente"
          disabled={pending || !email.includes("@")}
          onClick={run}
        >
          {pending ? "Preparando…" : "Preparar"}
        </Button>
      </div>
    </div>
  );
}
