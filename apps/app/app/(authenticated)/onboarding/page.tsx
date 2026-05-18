import { redirect } from "next/navigation";
import { getProgress } from "@/app/actions/onboarding/index";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { BuildingIcon, ArrowRightIcon, DatabaseIcon } from "lucide-react";
import Link from "next/link";

export default async function OnboardingPage() {
  const [companyProgress, migrationProgress] = await Promise.all([
    getProgress("company_setup"),
    getProgress("migration_setup"),
  ]);

  // If company setup is in progress, redirect directly into it
  if (companyProgress && companyProgress.status === "in_progress") {
    redirect("/onboarding/company");
  }

  const companyDone = companyProgress?.status === "completed";
  const migrationDone = migrationProgress?.status === "completed";

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 gap-8">
      <div className="text-center max-w-xl">
        <h1 className="text-3xl font-bold mb-2">Bem-vindo ao COSMOS</h1>
        <p className="text-muted-foreground">
          Configure sua estrutura SAFe em minutos. Comece do zero ou migre de outra ferramenta.
        </p>
      </div>

      <div className="grid gap-4 w-full max-w-2xl sm:grid-cols-2">
        <Card className={companyDone ? "border-green-500/50 bg-green-500/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BuildingIcon className="h-4 w-4" />
              Configuração inicial
              {companyDone && (
                <span className="ml-auto text-xs text-green-600">✓ Concluído</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Configure portfólios, ARTs, times e o primeiro PI — 7 passos guiados.
            </p>
            <Button asChild disabled={companyDone}>
              <Link href="/onboarding/company">
                {companyDone ? "Concluído" : "Começar"}
                {!companyDone && <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className={migrationDone ? "border-green-500/50 bg-green-500/5" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DatabaseIcon className="h-4 w-4" />
              Migrar de outra ferramenta
              {migrationDone && (
                <span className="ml-auto text-xs text-green-600">✓ Concluído</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Importe projetos, épicos, times e sprints do Jira, Azure DevOps, Trello ou CSV.
            </p>
            <Button asChild variant="outline">
              <Link href="/onboarding/migration">
                {migrationDone ? "Ver relatório" : "Migrar dados"}
                <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {companyDone && (
        <Button variant="ghost" asChild>
          <Link href="/">Ir para o Dashboard →</Link>
        </Button>
      )}
    </div>
  );
}
