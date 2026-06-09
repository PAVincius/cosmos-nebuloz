"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createReplanSession } from "../../../../../actions/arts/confidence-vote";

export function NewSessionButton({
  piPlanId,
  artId,
}: {
  piPlanId: string;
  artId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const session = await createReplanSession(piPlanId);
      router.push(
        `/arts/${artId}/pi-planning?piId=${piPlanId}&sessionId=${session.id}`
      );
    });
  }

  return (
    <Button
      disabled={isPending}
      onClick={handleClick}
      size="sm"
      variant="outline"
    >
      <RefreshCwIcon className="mr-1 h-3.5 w-3.5" />
      {isPending ? "Criando..." : "Replan"}
    </Button>
  );
}
