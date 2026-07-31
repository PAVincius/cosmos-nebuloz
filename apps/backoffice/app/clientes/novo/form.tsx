"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { provisionTenantAction } from "@/app/actions/provisioning";

const MODULES = ["COSMOS", "CHARTER", "SIGNAL"] as const;

export function NewClientForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [selected, setSelected] = useState<string[]>(["COSMOS"]);

  const toggle = (module: string) =>
    setSelected((prev) =>
      prev.includes(module)
        ? prev.filter((m) => m !== module)
        : [...prev, module]
    );

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await provisionTenantAction({
        name,
        ownerEmail,
        modules: selected.map((module) => ({
          module: module as (typeof MODULES)[number],
          status: "ACTIVE" as const,
        })),
      });

      if (result.ok) {
        router.push(`/clientes/${result.data.slug}`);
        return;
      }
      setError(result.error);
    });

  return (
    <div className="max-w-lg space-y-4">
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">Nome da organização</Label>
        <Input
          id="name"
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerEmail">E-mail do responsável</Label>
        <Input
          id="ownerEmail"
          onChange={(e) => setOwnerEmail(e.target.value)}
          type="email"
          value={ownerEmail}
        />
        <p className="text-muted-foreground text-xs">
          Se ainda não tiver conta, o cliente nasce sem dono e o convite fica
          pendente.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-medium text-sm">Módulos contratados</legend>
        {MODULES.map((module) => (
          <label className="flex items-center gap-2 text-sm" key={module}>
            <input
              checked={selected.includes(module)}
              onChange={() => toggle(module)}
              type="checkbox"
            />
            {module}
          </label>
        ))}
      </fieldset>

      <Button
        aria-label="Provisionar cliente"
        disabled={pending || name.trim().length < 2}
        onClick={submit}
      >
        {pending ? "Provisionando…" : "Provisionar cliente"}
      </Button>
    </div>
  );
}
