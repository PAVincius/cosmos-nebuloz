"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { AlertTriangleIcon } from "lucide-react";
import { useEffect } from "react";
import { appDesign } from "@/lib/app-design";

export default function StrategyMapError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[strategy-map]", error);
  }, [error]);

  return (
    <div className={appDesign.shell}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <AlertTriangleIcon className="h-8 w-8 text-rose-500" />
        <h2 className="font-semibold text-lg">Falha ao carregar o Strategy Map</h2>
        <p className="max-w-md text-muted-foreground text-sm">
          Não foi possível carregar os Strategic Themes. Tente novamente.
        </p>
        <Button onClick={() => reset()} type="button">
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
