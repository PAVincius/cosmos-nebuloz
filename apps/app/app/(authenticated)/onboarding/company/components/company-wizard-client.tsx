"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  OnboardingWizardShell,
  type WizardStepMeta,
} from "./onboarding-wizard-shell";
import {
  StepCompanyProfile,
  validateCompanyProfile,
  type CompanyProfileFormData,
} from "./steps/step-company-profile";
import {
  StepSafeStructure,
  validateSafeStructure,
  type SafeStructureFormData,
} from "./steps/step-safe-structure";
import { StepSectors, type SectorsFormData } from "./steps/step-sectors";
import { StepOrgChart, type OrgChartFormData } from "./steps/step-org-chart";
import {
  StepUsersTeams,
  validateUsersTeams,
  type UsersTeamsFormData,
} from "./steps/step-users-teams";
import {
  StepPIsSprints,
  validatePIsSprints,
  type PISprintsFormData,
} from "./steps/step-pis-sprints";
import {
  StepHealthCheck,
  type HealthCheckData,
} from "./steps/step-health-check";
import {
  saveStep,
  completeFlow,
} from "@/app/actions/onboarding/index";
import {
  createSAFeStructureFromOnboarding,
  createPIsFromOnboarding,
} from "@/app/actions/onboarding/company";

const STEPS: WizardStepMeta[] = [
  { key: "company_profile", label: "Perfil" },
  { key: "safe_structure", label: "SAFe" },
  { key: "sectors", label: "Setores", optional: true },
  { key: "org_chart", label: "Org", optional: true },
  { key: "users_teams", label: "Times" },
  { key: "pis_sprints", label: "PIs" },
  { key: "health_check", label: "Revisão" },
];

interface Props {
  initialStep: number;
  completedSteps: string[];
  savedData: Record<string, unknown>;
  artNames: string[];
}

export function CompanyWizardClient({
  initialStep,
  completedSteps: initialCompleted,
  savedData,
  artNames: initialArtNames,
}: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(
    Math.min(initialStep, STEPS.length - 1)
  );
  const [completedSteps, setCompletedSteps] = useState<string[]>(initialCompleted);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Per-step form state, pre-populated from DB
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileFormData>(
    (savedData.company_profile as CompanyProfileFormData) ?? {
      legalName: "",
      displayName: "",
      country: "BR",
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
    }
  );

  const [safeStructure, setSafeStructure] = useState<SafeStructureFormData>(
    (savedData.safe_structure as SafeStructureFormData) ?? {
      portfolioName: "",
      portfolioDescription: "",
      valueStreams: [{ name: "", arts: [{ name: "", cadence: 10 }] }],
    }
  );

  const [sectors, setSectors] = useState<SectorsFormData>(
    (savedData.sectors as SectorsFormData) ?? {
      departments: [{ name: "" }],
      businessUnits: [],
    }
  );

  const [orgChart, setOrgChart] = useState<OrgChartFormData>(
    (savedData.org_chart as OrgChartFormData) ?? {
      nodes: [{ name: "", role: "", parentName: "" }],
    }
  );

  const [usersTeams, setUsersTeams] = useState<UsersTeamsFormData>(
    (savedData.users_teams as UsersTeamsFormData) ?? {
      invites: [{ email: "", name: "", safeRole: "DEVELOPER" }],
      teams: [{ name: "", artName: initialArtNames[0] ?? "" }],
    }
  );

  const [pisSprints, setPisSprints] = useState<PISprintsFormData>(
    (savedData.pis_sprints as PISprintsFormData) ?? {
      piName: "PI 2026-Q3",
      startDate: "",
      endDate: "",
      iterationCount: 5,
      sprintLengthDays: 14,
      artName: initialArtNames[0] ?? "",
    }
  );

  // Derive ART names from what was entered in the safe_structure step
  const derivedArtNames = safeStructure.valueStreams
    .flatMap((vs) => vs.arts.map((a) => a.name))
    .filter(Boolean);
  const artNamesForSteps =
    derivedArtNames.length > 0 ? derivedArtNames : initialArtNames;

  // Health check computed from form state
  const healthCheck: HealthCheckData = {
    hasPortfolio: !!safeStructure.portfolioName.trim(),
    hasART: safeStructure.valueStreams.some((vs) =>
      vs.arts.some((a) => a.name.trim())
    ),
    hasPI: !!pisSprints.piName.trim() && !!pisSprints.startDate,
    hasTeam: usersTeams.teams.some((t) => t.name.trim()),
    hasUsers: usersTeams.invites.some((i) => i.email.trim()),
  };

  const stepKey = STEPS[currentStep].key;

  function validateCurrentStep(): string | null {
    switch (stepKey) {
      case "company_profile":
        return validateCompanyProfile(companyProfile);
      case "safe_structure":
        return validateSafeStructure(safeStructure);
      case "users_teams":
        return validateUsersTeams(usersTeams);
      case "pis_sprints":
        return validatePIsSprints(pisSprints);
      default:
        return null;
    }
  }

  function getCurrentStepData(): Record<string, unknown> {
    switch (stepKey) {
      case "company_profile":
        return companyProfile as unknown as Record<string, unknown>;
      case "safe_structure":
        return safeStructure as unknown as Record<string, unknown>;
      case "sectors":
        return sectors as unknown as Record<string, unknown>;
      case "org_chart":
        return orgChart as unknown as Record<string, unknown>;
      case "users_teams":
        return usersTeams as unknown as Record<string, unknown>;
      case "pis_sprints":
        return pisSprints as unknown as Record<string, unknown>;
      default:
        return {};
    }
  }

  function handleNext() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await saveStep({
          flowType: "company_setup",
          stepKey,
          stepIndex: currentStep,
          data: getCurrentStepData(),
        });

        // Side effects on specific steps — errors are caught and surfaced to the user
        if (stepKey === "safe_structure") {
          await createSAFeStructureFromOnboarding(safeStructure);
        }
        if (stepKey === "pis_sprints") {
          await createPIsFromOnboarding({
            ...pisSprints,
            startDate: new Date(pisSprints.startDate),
            endDate: pisSprints.endDate
              ? new Date(pisSprints.endDate)
              : undefined,
          });
        }

        setCompletedSteps((prev) =>
          prev.includes(stepKey) ? prev : [...prev, stepKey]
        );

        if (currentStep < STEPS.length - 1) {
          setCurrentStep((s) => s + 1);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao salvar. Tente novamente."
        );
      }
    });
  }

  function handleSkip() {
    setError(null);
    startTransition(async () => {
      await saveStep({
        flowType: "company_setup",
        stepKey,
        stepIndex: currentStep,
        data: {},
      });
      setCurrentStep((s) => s + 1);
    });
  }

  function handleComplete() {
    startTransition(async () => {
      try {
        await completeFlow("company_setup");
        router.push("/onboarding/company/complete");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao finalizar."
        );
      }
    });
  }

  const isLastStep = currentStep === STEPS.length - 1;
  const isOptional = STEPS[currentStep].optional;

  return (
    <OnboardingWizardShell
      steps={STEPS}
      currentStep={currentStep}
      completedSteps={completedSteps}
      onBack={() => {
        setError(null);
        setCurrentStep((s) => Math.max(s - 1, 0));
      }}
      onNext={isLastStep ? handleComplete : handleNext}
      onSkip={isOptional ? handleSkip : undefined}
      isSaving={isPending}
      nextLabel={isLastStep ? "Concluir setup" : undefined}
    >
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {stepKey === "company_profile" && (
        <StepCompanyProfile
          defaultValues={companyProfile}
          onChange={setCompanyProfile}
        />
      )}
      {stepKey === "safe_structure" && (
        <StepSafeStructure
          defaultValues={safeStructure}
          onChange={setSafeStructure}
        />
      )}
      {stepKey === "sectors" && (
        <StepSectors defaultValues={sectors} onChange={setSectors} />
      )}
      {stepKey === "org_chart" && (
        <StepOrgChart defaultValues={orgChart} onChange={setOrgChart} />
      )}
      {stepKey === "users_teams" && (
        <StepUsersTeams
          defaultValues={usersTeams}
          artNames={artNamesForSteps}
          onChange={setUsersTeams}
        />
      )}
      {stepKey === "pis_sprints" && (
        <StepPIsSprints
          defaultValues={pisSprints}
          artNames={artNamesForSteps}
          onChange={setPisSprints}
        />
      )}
      {stepKey === "health_check" && <StepHealthCheck data={healthCheck} />}
    </OnboardingWizardShell>
  );
}
