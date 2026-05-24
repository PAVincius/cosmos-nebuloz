"use client";

import { CopilotToolCallStep } from "./copilot-tool-call-step";
import type { ToolInvocation } from "./copilot-types";

type Props = { invocations: ToolInvocation[] };

export function CopilotStepsTimeline({ invocations }: Props) {
  if (invocations.length === 0) {
    return null;
  }

  return (
    <div className="my-2 flex flex-col gap-0.5 border-border/50 border-l-2 border-dashed pl-3">
      {invocations.map((inv) => (
        <CopilotToolCallStep invocation={inv} key={inv.toolCallId} />
      ))}
    </div>
  );
}
