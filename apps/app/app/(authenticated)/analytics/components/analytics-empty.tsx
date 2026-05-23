import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";

type Props = {
  hasPIPlans: boolean;
  hasTeams: boolean;
};

export function AnalyticsEmptyBanners({ hasPIPlans, hasTeams }: Props) {
  if (hasPIPlans && hasTeams) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {hasPIPlans ? null : (
        <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
          Nenhum PI Planning encontrado.{" "}
          <Link href="/pi-planning">
            <Button className="ml-1 h-auto p-0 text-sm" variant="link">
              Criar PI Planning
            </Button>
          </Link>{" "}
          para ver métricas de predictability.
        </div>
      )}
      {hasTeams ? null : (
        <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
          Nenhum time cadastrado.{" "}
          <Link href="/teams">
            <Button className="ml-1 h-auto p-0 text-sm" variant="link">
              Criar times
            </Button>
          </Link>{" "}
          para ver métricas de velocity.
        </div>
      )}
    </div>
  );
}
