"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeFlow, saveStep } from "@/app/actions/onboarding/index";
import { approveMigrationMapping } from "@/app/actions/onboarding/migration";
import type { DryRunResult, ImportReport } from "@/lib/migration/types";
import {
  OnboardingWizardShell,
  type WizardStepMeta,
} from "../../company/components/onboarding-wizard-shell";
import {
  type ConnectFormData,
  StepConnectIntegration,
} from "./steps/step-connect-integration";
import { type DiscoveryFormData, StepDiscovery } from "./steps/step-discovery";
import { StepDryRun } from "./steps/step-dry-run";
import { StepImport } from "./steps/step-import";
import { StepPostMigration } from "./steps/step-post-migration";
import {
  type MigrationSource,
  type SourceSelectFormData,
  StepSourceSelect,
} from "./steps/step-source-select";

const STEPS: WizardStepMeta[] = [
  { key: "source_select", label: "Origem" },
  { key: "connect", label: "Conexão" },
  { key: "discovery", label: "Descoberta" },
  { key: "dry_run", label: "Preview" },
  { key: "import", label: "Import" },
  { key: "post_migration", label: "Resultado" },
];

type Props = {
  initialStep: number;
  completedSteps: string[];
  savedData: Record<string, unknown>;
  artNames: string[];
};

export function MigrationWizardClient({
  initialStep,
  completedSteps: initialCompleted,
  savedData,
  artNames,
}: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(
    Math.min(initialStep, STEPS.length - 1)
  );
  const [completedSteps, setCompletedSteps] =
    useState<string[]>(initialCompleted);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<MigrationSource>(
    (savedData.source_select as SourceSelectFormData | undefined)?.source ??
      "csv"
  );
  const [connectData, setConnectData] = useState<ConnectFormData | null>(
    (savedData.connect as ConnectFormData | null) ?? null
  );
  const [discoveryData, setDiscoveryData] = useState<DiscoveryFormData | null>(
    (savedData.discovery as DiscoveryFormData | null) ?? null
  );
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(
    (savedData.dry_run as DryRunResult | null) ?? null
  );
  const [importReport, setImportReport] = useState<ImportReport | null>(
    (savedData.import as ImportReport | null) ?? null
  );

  const stepKey = STEPS[currentStep].key;
  const isLastStep = currentStep === STEPS.length - 1;

  const nextDisabled =
    (stepKey === "connect" && !connectData?.connectionId) ||
    (stepKey === "discovery" && !discoveryData?.connectionId) ||
    (stepKey === "import" && !importReport) ||
    (stepKey === "post_migration" && !importReport);

  function getStepData(): unknown {
    switch (stepKey) {
      case "source_select":
        return { source };
      case "connect":
        return connectData ?? {};
      case "discovery":
        return discoveryData ?? {};
      case "dry_run":
        return dryRunResult ?? {};
      case "import":
        return importReport ?? {};
      case "post_migration":
        return importReport ?? {};
      default:
        return {};
    }
  }

  function handleNext() {
    setError(null);
    startTransition(async () => {
      try {
        // approve mapping first — if this fails, saveStep is not called
        if (
          stepKey === "discovery" &&
          connectData?.connectionId &&
          discoveryData?.mappingData
        ) {
          await approveMigrationMapping(
            connectData.connectionId,
            discoveryData.mappingData
          );
        }

        await saveStep({
          flowType: "migration_setup",
          stepKey,
          stepIndex: currentStep,
          data: getStepData() as Record<string, unknown>,
        });
        setCompletedSteps((prev) =>
          prev.includes(stepKey) ? prev : [...prev, stepKey]
        );
        setCurrentStep((s) => s + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro. Tente novamente.");
      }
    });
  }

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      try {
        await saveStep({
          flowType: "migration_setup",
          stepKey,
          stepIndex: currentStep,
          data: getStepData() as Record<string, unknown>,
        });
        await completeFlow("migration_setup");
        router.push("/onboarding/migration/complete");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao finalizar.");
      }
    });
  }

  return (
    <OnboardingWizardShell
      completedSteps={completedSteps}
      currentStep={currentStep}
      isNextDisabled={nextDisabled}
      isSaving={isPending}
      nextLabel={isLastStep ? "Concluir migração" : undefined}
      onBack={() => {
        setError(null);
        setCurrentStep((s) => Math.max(s - 1, 0));
      }}
      onNext={isLastStep ? handleComplete : handleNext}
      steps={STEPS}
    >
      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
          {error}
        </div>
      )}
      {stepKey === "source_select" && (
        <StepSourceSelect
          defaultValues={{ source }}
          onChange={(d: SourceSelectFormData) => setSource(d.source)}
        />
      )}
      {stepKey === "connect" && (
        <StepConnectIntegration
          defaultValues={connectData ?? undefined}
          onConnected={setConnectData}
          source={source}
        />
      )}
      {stepKey === "discovery" && (
        <StepDiscovery
          artNames={artNames}
          connectionId={connectData?.connectionId ?? ""}
          defaultValues={discoveryData ?? undefined}
          onChange={setDiscoveryData}
          source={source}
        />
      )}
      {stepKey === "dry_run" && (
        <StepDryRun
          connectionId={connectData?.connectionId ?? ""}
          mappingData={discoveryData?.mappingData ?? []}
          onResult={setDryRunResult}
          source={source}
        />
      )}
      {stepKey === "import" && (
        <StepImport
          connectionId={connectData?.connectionId ?? ""}
          mappingData={discoveryData?.mappingData ?? []}
          onComplete={setImportReport}
          source={source}
        />
      )}
      {stepKey === "post_migration" &&
        (importReport ? (
          <StepPostMigration report={importReport} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Nenhum relatório de importação disponível. Volte para a etapa de
            importação.
          </p>
        ))}
    </OnboardingWizardShell>
  );
}
