"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { BotIcon } from "./copilot-icons";
import {
  type CopilotMode,
  type CopilotSurface,
  useCopilot,
} from "./copilot-provider";

type CopilotTriggerButtonProps = {
  mode: CopilotMode;
  surface: CopilotSurface;
  contextRef?: Record<string, string>;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
};

export function CopilotTriggerButton({
  mode,
  surface,
  contextRef,
  label = "Copilot",
  variant = "outline",
  size = "sm",
}: CopilotTriggerButtonProps) {
  const { openCopilot } = useCopilot();

  return (
    <Button
      className="gap-1.5"
      onClick={() =>
        openCopilot({ mode, surface, contextRef: contextRef ?? {} })
      }
      size={size}
      variant={variant}
    >
      <BotIcon className="h-4 w-4" />
      {label}
    </Button>
  );
}
