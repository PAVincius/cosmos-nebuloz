import { TrendingUpIcon } from "lucide-react";
import { FunnelStepper } from "@/app/(authenticated)/components/funnel-stepper";
import { SectionCard } from "@/app/(authenticated)/components/section-card";

const STEPS = [
  { key: "FUNNEL", label: "Funnel" },
  { key: "ANALYZING", label: "Analyzing" },
  { key: "PORTFOLIO_BACKLOG", label: "Portfolio Backlog" },
  { key: "IMPLEMENTING", label: "Implementing" },
  { key: "DONE", label: "Done" },
] as const;

const STEP_INDEX: Record<string, number> = {
  FUNNEL: 0,
  ANALYZING: 1,
  PORTFOLIO_BACKLOG: 2,
  IMPLEMENTING: 3,
  DONE: 4,
  REJECTED: 4,
};

type LifecycleSectionProps = {
  lifecycleStatus: string;
};

export function LifecycleSection({ lifecycleStatus }: LifecycleSectionProps) {
  const activeIdx = STEP_INDEX[lifecycleStatus] ?? 0;

  const steps = STEPS.map((step, idx) => ({
    label: step.label,
    state: (idx < activeIdx ? "done" : idx === activeIdx ? "current" : "todo") as
      | "done"
      | "current"
      | "todo",
  }));

  return (
    <SectionCard
      icon={TrendingUpIcon}
      subtitle="Funnel → Done"
      title="Portfolio Lifecycle"
    >
      <FunnelStepper steps={steps} />
    </SectionCard>
  );
}
