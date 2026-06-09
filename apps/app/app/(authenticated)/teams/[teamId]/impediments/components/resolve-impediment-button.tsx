"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircleIcon } from "lucide-react";
import { useTransition } from "react";
import { resolveImpediment } from "@/app/actions/impediments";

type ResolveImpedimentButtonProps = {
  impedimentId: string;
};

export function ResolveImpedimentButton({
  impedimentId,
}: ResolveImpedimentButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleResolve() {
    startTransition(async () => {
      await resolveImpediment(impedimentId);
    });
  }

  return (
    <Button
      className="h-8 text-xs"
      disabled={isPending}
      onClick={handleResolve}
      size="sm"
      variant="outline"
    >
      <CheckCircleIcon className="mr-1.5 h-3.5 w-3.5" />
      {isPending ? "Resolvendo…" : "Resolver"}
    </Button>
  );
}
