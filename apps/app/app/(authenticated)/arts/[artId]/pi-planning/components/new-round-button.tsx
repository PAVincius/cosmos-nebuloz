"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { createNewVoteRound } from "../../../../../actions/arts/confidence-vote";

export function NewRoundButton({ piSessionId, artId, piId }: { piSessionId: string; artId: string; piId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const round = await createNewVoteRound(piSessionId);
      router.push(`/arts/${artId}/pi-planning?piId=${piId}&sessionId=${piSessionId}&round=${round.roundNumber}`);
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={isPending}>
      <PlusIcon className="h-3.5 w-3.5 mr-1" />
      {isPending ? "Criando..." : "Nova Rodada"}
    </Button>
  );
}
