import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";

export default function MigrationCompletePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <CheckCircle2Icon className="h-16 w-16 text-green-500" />
      <div>
        <h1 className="mb-2 font-bold text-3xl">Migração concluída!</h1>
        <p className="max-w-md text-muted-foreground">
          Seus dados foram importados para o COSMOS. Revise os épicos e times no
          portfólio.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/portfolio">Ver portfólio</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ir para o Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
