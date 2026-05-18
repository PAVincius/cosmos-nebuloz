import Link from "next/link";
import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";

export default function MigrationCompletePage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
      <CheckCircle2Icon className="h-16 w-16 text-green-500" />
      <div>
        <h1 className="text-3xl font-bold mb-2">Migração concluída!</h1>
        <p className="text-muted-foreground max-w-md">
          Seus dados foram importados para o COSMOS. Revise os épicos e times
          no portfólio.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/portfolio">Ver portfólio</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Ir para o Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
