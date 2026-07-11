"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { CreateFeatureModal } from "../../../../components/create-feature-modal";

// ─── Types ──────────────────────────────────────────────────────────────

export type FeatureCtaButtonProps = {
  arts: Array<{ id: string; name: string }>;
  epics: Array<{ id: string; sequenceNumber: number | null; title: string }>;
  teams: Array<{ id: string; name: string }>;
};

// ─── Component ────────────────────────────────────────────────────────────

/** "+ Feature" trigger (screenDashPO `openFeatureModal()`) — opens M2. */
export function FeatureCtaButton({ arts, epics, teams }: FeatureCtaButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 rounded-md border border-hairline-strong bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold text-ink-muted transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Plus aria-hidden size={13} strokeWidth={2.4} />
        Feature
      </button>

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
