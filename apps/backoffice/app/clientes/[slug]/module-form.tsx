"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useState, useTransition } from "react";
import { contractModuleAction } from "@/app/actions/provisioning";

const MODULES = ["COSMOS", "CHARTER", "SIGNAL"] as const;
const STATUSES = ["ACTIVE", "TRIAL", "SUSPENDED", "CANCELED"] as const;

type ModuleRow = { module: string; status: string; expiresAt: string | null };

export function ModuleForm({
  slug,
  modules,
}: {
  slug: string;
  modules: ModuleRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const apply = (
    module: (typeof MODULES)[number],
    status: (typeof STATUSES)[number]
  ) =>
    startTransition(async () => {
      setError(null);
      const result = await contractModuleAction({ slug, module, status });
      if (!result.ok) {
        setError(result.error);
      }
    });

  return (
    <div className="space-y-3">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <table className="w-full text-sm">
        <tbody>
          {MODULES.map((module) => {
            const current = modules.find((m) => m.module === module);
            return (
              <tr className="border-b" key={module}>
                <td className="py-2 font-medium">{module}</td>
                <td className="py-2 text-muted-foreground">
                  {current?.status ?? "não contratado"}
                </td>
                <td className="space-x-2 py-2 text-right">
                  {STATUSES.map((status) => (
                    <Button
                      disabled={pending || current?.status === status}
                      key={status}
                      onClick={() => apply(module, status)}
                      size="sm"
                      variant="outline"
                    >
                      {status}
                    </Button>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
