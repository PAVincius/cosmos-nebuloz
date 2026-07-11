"use client";

import { CosmosButton } from "@repo/design-system/components/cosmos/cosmos-button";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { CreateFeatureModal } from "@/app/(authenticated)/components/create-feature-modal";

type ProgramBoardHeaderActionsProps = {
  arts: { id: string; name: string }[];
  epics: { id: string; sequenceNumber: number | null; title: string }[];
  teams: { id: string; name: string }[];
};

export function ProgramBoardHeaderActions({
  arts,
  epics,
  teams,
}: ProgramBoardHeaderActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <CosmosButton onClick={() => setOpen(true)} size="md" variant="primary">
        <PlusIcon aria-hidden size={14} strokeWidth={2.4} />
        Nova feature
      </CosmosButton>
      <CreateFeatureModal
        arts={arts}
        epics={epics}
        onOpenChange={setOpen}
        open={open}
        teams={teams}
      />
    </>
  );
}
