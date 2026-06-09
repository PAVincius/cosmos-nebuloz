"use client";

import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import type { ImportReport } from "@/lib/migration/types";
import { WizardStepHeader } from "../../../../components/wizard-ui";

type Props = {
  report: ImportReport;
};

export function StepPostMigration({ report }: Props) {
  const hasErrors = report.errors.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        description={
          hasErrors
            ? "Migração concluída com alguns erros. Revise os itens abaixo."
            : "Migração concluída com sucesso. Todos os itens foram importados."
        }
        icon={
          hasErrors ? (
            <AlertCircleIcon className="h-5 w-5" />
          ) : (
            <CheckCircle2Icon className="h-5 w-5" />
          )
        }
        title="Resultado da migração"
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <p className="font-bold text-2xl">{report.created.epics}</p>
          <p className="text-muted-foreground text-xs">épicos criados</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="font-bold text-2xl">{report.created.stories}</p>
          <p className="text-muted-foreground text-xs">stories criadas</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="font-bold text-2xl">{report.totalProcessed}</p>
          <p className="text-muted-foreground text-xs">itens processados</p>
        </div>
        <div
          className={`rounded-lg border p-3 ${hasErrors ? "border-amber-300" : ""}`}
        >
          <p
            className={`font-bold text-2xl ${hasErrors ? "text-amber-600" : "text-green-600"}`}
          >
            {report.errors.length}
          </p>
          <p className="text-muted-foreground text-xs">erros</p>
        </div>
      </div>
      {hasErrors && (
        <div className="flex flex-col gap-2">
          <p className="font-medium text-sm">
            Itens com erro (revisão manual):
          </p>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border p-3">
            {report.errors.map((e, i) => (
              <div className="text-xs" key={i}>
                <span className="font-medium">{e.item}</span>
                <span className="text-muted-foreground"> — {e.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
