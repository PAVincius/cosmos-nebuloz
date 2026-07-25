import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";

export default function CompanySetupCompletePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <CheckCircle2Icon className="h-16 w-16 text-green-500" />
      <div>
        <h1 className="mb-2 font-bold text-3xl">Setup completo!</h1>
        <p className="max-w-md text-muted-foreground">
          Sua estrutura SAFe está configurada. Você já pode usar o COSMOS para
          seu próximo PI Planning.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Ir para o Dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/onboarding/migration">
            Migrar dados de outra ferramenta
          </Link>
        </Button>
      </div>
    </div>
  );
}
