"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { DryRunResult, MappingRule } from "@/lib/migration/types";
import { WizardStepHeader } from "../../../../components/wizard-ui";

type Props = {
  connectionId: string;
  source: string;
  mappingData: MappingRule[];
  onResult: (result: DryRunResult) => void;
};

export function StepDryRun({
  connectionId,
  source,
  mappingData,
  onResult,
}: Props) {
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/migration/${source}/dry-run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId, mappingData }),
        });
        if (!cancelled) {
          if (res.ok) {
            const data = (await res.json()) as DryRunResult;
            setResult(data);
            onResult(data);
          } else {
            const err = (await res.json()) as { error?: string };
            setError(err.error ?? "Dry-run failed");
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Falha ao simular importação. Verifique a conexão.");
          setLoading(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, mappingData, onResult, source]);

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Veja o impacto antes de confirmar. Nada é criado nesta etapa."
        icon={<ShieldCheckIcon className="h-5 w-5" />}
        title="Simulação de importação"
      />
      {loading ? (
        <p className="text-muted-foreground text-sm">Simulando...</p>
      ) : !loading && error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : (
        result && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["Épicos", result.counts.epics],
                  ["Stories", result.counts.stories],
                  ["Teams", result.counts.teams],
                ] as [string, number][]
              ).map(([label, count]) => (
                <div className="rounded-lg border p-3 text-center" key={label}>
                  <p className="font-bold text-2xl">{count}</p>
                  <p className="text-muted-foreground text-xs">{label}</p>
                </div>
              ))}
            </div>
            {result.conflicts.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="font-medium text-amber-600 text-sm">
                  ⚠️ {result.conflicts.length} conflito(s)
                </p>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {result.conflicts.map((c, i) => (
                    <div
                      className="flex gap-2 text-muted-foreground text-xs"
                      key={i}
                    >
                      <span className="truncate">{c.item}</span>
                      <span className="shrink-0 text-amber-600">
                        — {c.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-green-600 text-sm">
                ✅ Nenhum conflito detectado. Pronto para importar.
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}
