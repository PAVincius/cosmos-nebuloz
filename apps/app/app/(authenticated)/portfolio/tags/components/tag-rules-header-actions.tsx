"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  LayersIcon,
  PlayIcon,
  PlusIcon,
  UsersIcon,
  WaypointsIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { NewTagRuleModal } from "./new-tag-rule-modal";

/**
 * Header row for /portfolio/tags: relation chips to the entities that Tag
 * Rules act on (rule 2 — clickable relation chips), plus the "Testar
 * regras" / "Nova regra" actions from cosmos.html screen-tags.
 */
export function TagRulesHeaderActions() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <RelationChip
        eyebrow="Portfolio"
        href="/portfolio/strategy-map"
        icon={<LayersIcon />}
        label="Temas"
        tone="blue"
      />
      <RelationChip
        eyebrow="Portfolio"
        href="/portfolio/value-streams"
        icon={<WaypointsIcon />}
        label="Value Streams"
        tone="purple"
      />
      <RelationChip
        eyebrow="Portfolio"
        href="/arts"
        icon={<UsersIcon />}
        label="ARTs"
        tone="accent"
      />

      <Button
        onClick={() =>
          toast.info("Execução de teste ainda não disponível", {
            description: "A simulação de regras será habilitada em breve.",
          })
        }
        type="button"
        variant="secondary"
      >
        <PlayIcon className="h-3.5 w-3.5" />
        Testar regras
      </Button>
      <Button onClick={() => setOpen(true)} type="button">
        <PlusIcon className="h-3.5 w-3.5" />
        Nova regra
      </Button>

      <NewTagRuleModal onOpenChange={setOpen} open={open} />
    </>
  );
}
