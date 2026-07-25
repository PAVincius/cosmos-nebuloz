import { auth } from "@repo/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./components/onboarding-wizard";

type Props = {
  searchParams: Promise<{ from?: string; workspace?: string; error?: string }>;
};

export default async function OnboardingPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const sp = await searchParams;
  const fromInvite = sp.from === "invite";
  const workspaceName = sp.workspace ? decodeURIComponent(sp.workspace) : null;

  return (
    <OnboardingWizard
      fromInvite={fromInvite}
      userName={session.user.name ?? ""}
      workspaceName={workspaceName}
    />
  );
}
