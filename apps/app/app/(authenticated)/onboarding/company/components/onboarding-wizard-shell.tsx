"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { CheckIcon } from "lucide-react";

export type WizardStepMeta = {
  key: string;
  label: string;
  optional?: boolean;
};

type OnboardingWizardShellProps = {
  steps: WizardStepMeta[];
  currentStep: number;
  completedSteps: string[];
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  isNextDisabled?: boolean;
  isSaving?: boolean;
  nextLabel?: string;
  children: React.ReactNode;
};

export function OnboardingWizardShell({
  steps,
  currentStep,
  completedSteps,
  onBack,
  onNext,
  onSkip,
  isNextDisabled = false,
  isSaving = false,
  nextLabel,
  children,
}: OnboardingWizardShellProps) {
  const isLast = currentStep === steps.length - 1;
  const pct = Math.round(
    (completedSteps.length / Math.max(steps.length - 1, 1)) * 100
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>
            Passo {currentStep + 1} de {steps.length}
          </span>
          <span>{pct}% completo</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const done = completedSteps.includes(step.key);
          const active = i === currentStep;
          return (
            <div className="flex shrink-0 items-center gap-1" key={step.key}>
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border font-medium text-xs transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && !done && "border-primary text-primary",
                  !(active || done) &&
                    "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {done ? <CheckIcon className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:inline",
                  active
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div className="mx-1 h-px w-4 bg-muted-foreground/20" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1">{children}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button
          disabled={currentStep === 0 || isSaving}
          onClick={onBack}
          variant="ghost"
        >
          ← Voltar
        </Button>
        <div className="flex gap-2">
          {onSkip && (
            <Button disabled={isSaving} onClick={onSkip} variant="outline">
              Pular
            </Button>
          )}
          <Button disabled={isNextDisabled || isSaving} onClick={onNext}>
            {isSaving
              ? "Salvando..."
              : (nextLabel ??
                (isLast ? "Concluir setup" : "Salvar e avançar →"))}
          </Button>
        </div>
      </div>
    </div>
  );
}
