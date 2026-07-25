"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon, DownloadIcon } from "lucide-react";
import { useState } from "react";
import type { ImportReport, MappingRule } from "@/lib/migration/types";
import { WizardStepHeader } from "../../../../components/wizard-ui";

type Props = {
  connectionId: string;
  source: string;
  mappingData: MappingRule[];
  onComplete: (report: ImportReport) => void;
};

export function StepImport({
  connectionId,
  source,
  mappingData,
  onComplete,
}: Props) {
  const [status, setStatus] = useState<"idle" | "importing" | "done" | "error">(
    "idle"
  );
  const [report, setReport] = useState<ImportReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function runImport() {
    setStatus("importing");
    try {
      const res = await fetch(`/api/migration/${source}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, mappingData }),
      });
      const data = (await res.json()) as ImportReport | { error: string };
      if (!res.ok || "error" in data) {
        throw new Error(
          ("error" in data ? data.error : null) ?? "Import failed"
        );
      }
      setReport(data as ImportReport);
      setStatus("done");
      onComplete(data as ImportReport);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Falha na importação");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description="Esta operação criará épicos, stories e times no COSMOS."
        icon={<DownloadIcon className="h-5 w-5" />}
        title="Importar dados"
      />
      {status === "idle" && (
        <Button onClick={() => void runImport()}>Iniciar importação</Button>
      )}
      {status === "importing" && (
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-muted-foreground text-sm">Importando...</span>
        </div>
      )}
      {status === "done" && report && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2Icon className="h-5 w-5" />
            <span className="font-medium">Importação concluída</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Épicos criados" value={report.created.epics} />
            <Stat label="Stories criadas" value={report.created.stories} />
            <Stat label="Erros" value={report.errors.length} />
          </div>
        </div>
      )}
      {status === "error" && (
        <p className="text-destructive text-sm">{errorMsg}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="font-bold text-2xl">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  );
}
