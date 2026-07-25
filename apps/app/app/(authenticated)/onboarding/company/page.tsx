import { redirect } from "next/navigation";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getOrCreateProgress } from "@/app/actions/onboarding/index";
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
      artNames={artNames}
      completedSteps={progress.completedSteps as string[]}
      initialStep={progress.currentStep}
      savedData={stepData}
    />
  );
}
