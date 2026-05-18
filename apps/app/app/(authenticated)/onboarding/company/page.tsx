import { redirect } from "next/navigation";
import { getOrCreateProgress } from "@/app/actions/onboarding/index";
import { getARTs } from "@/app/actions/arts/get-arts";
import { CompanyWizardClient } from "./components/company-wizard-client";

export default async function CompanySetupPage() {
  const progress = await getOrCreateProgress("company_setup");

  if (progress.status === "completed") {
    redirect("/onboarding/company/complete");
  }

  const arts = await getARTs();
  const artNames = arts.map((a) => a.name);
  const stepData = (progress.data as Record<string, unknown>) ?? {};

  return (
    <CompanyWizardClient
      initialStep={progress.currentStep}
      completedSteps={progress.completedSteps as string[]}
      savedData={stepData}
      artNames={artNames}
    />
  );
}
