import Link from "next/link";
import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";

export default function CompanySetupCompletePage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
      <CheckCircle2Icon className="h-16 w-16 text-green-500" />
      <div>
        <h1 className="text-3xl font-bold mb-2">Setup completo!</h1>
        <p className="text-muted-foreground max-w-md">
          Sua estrutura SAFe está configurada. Você já pode usar o COSMOS para
          seu próximo PI Planning.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">Ir para o Dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/onboarding/migration">
            Migrar dados de outra ferramenta
          </Link>
        </Button>
      </div>
    </div>
  );
}
