"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { activateBpmnDefinition } from "../actions";
import type { WorkflowTone } from "./workflow-row";

export type WorkflowToggleProps = {
  definitionId: string | null;
  active: boolean;
  tone: WorkflowTone;
  actorId: string;
};

/**
 * Activation toggle for a team's BPMN workflow. Reuses the existing
 * `activateBpmnDefinition` action (which deactivates sibling versions for
 * the same owner) — there is no `deactivate` action, so the switch is
 * disabled once a workflow is active.
 */
export function WorkflowToggle({
  definitionId,
  active,
  tone,
  actorId,
}: WorkflowToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const prefersReducedMotion = useReducedMotion();

  const disabled = active || !definitionId || isPending;

  function handleClick() {
    if (disabled || !definitionId) {
      return;
    }
    startTransition(async () => {
      await activateBpmnDefinition(definitionId, actorId);
      router.refresh();
    });
  }

  return (
    <button
      aria-checked={active}
      aria-label={active ? "Workflow ativo" : "Ativar workflow"}
      className="relative h-5 w-9 shrink-0 rounded-pill border transition-colors disabled:cursor-not-allowed"
      disabled={disabled}
      onClick={handleClick}
      role="switch"
      style={{
        background: active ? `var(--${tone}-soft)` : "var(--surface-3)",
        borderColor: active ? `rgba(var(--${tone}-rgb),.4)` : "var(--hairline)",
        opacity: isPending ? 0.6 : 1,
      }}
      type="button"
    >
      <motion.span
        animate={{ left: active ? 18 : 2 }}
        aria-hidden
        className="absolute top-[2px] h-[14px] w-[14px] rounded-full"
        style={{ background: active ? `var(--${tone})` : "var(--ink-faint)" }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 500, damping: 32 }
        }
      />
    </button>
  );
}
