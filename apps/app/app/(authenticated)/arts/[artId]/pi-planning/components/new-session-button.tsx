"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { createReplanSession } from "../../../../../actions/arts/confidence-vote";

export function NewSessionButton({ piPlanId, artId }: { piPlanId: string; artId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const session = await createReplanSession(piPlanId);
      router.push(`/arts/${artId}/pi-planning?piId=${piPlanId}&sessionId=${session.id}`);
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
      <RefreshCwIcon className="h-3.5 w-3.5 mr-1" />
      {isPending ? "Criando..." : "Replan"}
    </Button>
  );
}
