import { redirect } from "next/navigation";
import { getOrCreateProgress } from "@/app/actions/onboarding/index";
import { getARTs } from "@/app/actions/arts/get-arts";
import { MigrationWizardClient } from "./components/migration-wizard-client";

export default async function MigrationSetupPage() {
  const progress = await getOrCreateProgress("migration_setup");

  if (progress.status === "completed") {
    redirect("/onboarding/migration/complete");
  }

  const arts = await getARTs();
  const artNames = arts.map((a) => a.name);
  const savedData = (progress.data as Record<string, unknown>) ?? {};

  return (
    <MigrationWizardClient
      initialStep={progress.currentStep}
      completedSteps={progress.completedSteps as string[]}
      savedData={savedData}
      artNames={artNames}
    />
  );
}
