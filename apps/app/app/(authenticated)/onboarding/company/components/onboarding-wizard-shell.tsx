"use client";

import { CheckIcon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";

export interface WizardStepMeta {
  key: string;
  label: string;
  optional?: boolean;
}

interface OnboardingWizardShellProps {
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
}

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
  const pct = Math.round((completedSteps.length / Math.max(steps.length - 1, 1)) * 100);

  return (
    <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full px-4 py-8 gap-6">
      {/* Progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Passo {currentStep + 1} de {steps.length}</span>
          <span>{pct}% completo</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
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
            <div key={step.key} className="flex items-center gap-1 shrink-0">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && !done && "border-primary text-primary",
                  !active && !done && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {done ? <CheckIcon className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:inline",
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div className="w-4 h-px bg-muted-foreground/20 mx-1" />
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
          variant="ghost"
          onClick={onBack}
          disabled={currentStep === 0 || isSaving}
        >
          ← Voltar
        </Button>
        <div className="flex gap-2">
          {onSkip && (
            <Button variant="outline" onClick={onSkip} disabled={isSaving}>
              Pular
            </Button>
          )}
          <Button onClick={onNext} disabled={isNextDisabled || isSaving}>
            {isSaving
              ? "Salvando..."
              : (nextLabel ?? (isLast ? "Concluir setup" : "Salvar e avançar →"))}
          </Button>
        </div>
      </div>
    </div>
  );
}
