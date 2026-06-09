"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createNewVoteRound } from "../../../../../actions/arts/confidence-vote";

export function NewRoundButton({
  piSessionId,
  artId,
  piId,
}: {
  piSessionId: string;
  artId: string;
  piId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const round = await createNewVoteRound(piSessionId);
      router.push(
        `/arts/${artId}/pi-planning?piId=${piId}&sessionId=${piSessionId}&round=${round.roundNumber}`
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
      <PlusIcon className="mr-1 h-3.5 w-3.5" />
      {isPending ? "Criando..." : "Nova Rodada"}
    </Button>
  );
}
