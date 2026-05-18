"use client";

import { useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircleIcon } from "lucide-react";
import { resolveImpediment } from "@/app/actions/impediments";

interface ResolveImpedimentButtonProps {
  impedimentId: string;
}

export function ResolveImpedimentButton({ impedimentId }: ResolveImpedimentButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleResolve() {
    startTransition(async () => {
      await resolveImpediment(impedimentId);
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      disabled={isPending}
      onClick={handleResolve}
    >
      <CheckCircleIcon className="mr-1.5 h-3.5 w-3.5" />
      {isPending ? "Resolvendo…" : "Resolver"}
    </Button>
  );
}
