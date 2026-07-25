import { redirect } from "next/navigation";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getOrCreateProgress } from "@/app/actions/onboarding/index";
import { MigrationWizardClient } from "./components/migration-wizard-client";

export default async function MigrationSetupPage() {
  const progress = await getOrCreateProgress("migration_setup");

  if (progress.status === "completed") {
    redirect("/onboarding/migration/complete");
  }

  const arts = await getARTs();
  const artNames = arts.map((a) => a.name);
  const savedData = (progress.data as Record<string, unknown>) ?? {};
  const completedSteps = Array.isArray(progress.completedSteps)
    ? (progress.completedSteps as string[])
    : [];

  return (
    <MigrationWizardClient
      artNames={artNames}
      completedSteps={completedSteps}
      initialStep={progress.currentStep}
      savedData={savedData}
    />
  );
}
