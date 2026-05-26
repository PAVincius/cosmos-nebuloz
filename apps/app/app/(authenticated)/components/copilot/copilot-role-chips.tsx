"use client";

import { Button } from "@repo/design-system/components/ui/button";
import type { SAFeRole } from "@/app/actions/safe-copilot/roles/detect-role";
import { ROLE_CHIPS } from "@/app/actions/safe-copilot/roles/role-chips";

type Props = {
  role: SAFeRole;
  onSelect: (prompt: string) => void;
};

export function CopilotRoleChips({ role, onSelect }: Props) {
  const chips = ROLE_CHIPS[role] ?? [];
  if (!chips.length) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
      {chips.map((chip) => (
        <Button
          className="h-7 rounded-full border-dashed text-xs"
          key={chip.label}
          onClick={() => onSelect(chip.prompt)}
          size="sm"
          variant="outline"
        >
          {chip.label}
        </Button>
      ))}
    </div>
  );
}
