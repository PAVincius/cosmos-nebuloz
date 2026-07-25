import { CheckIcon } from "lucide-react";
import type * as React from "react";

/** Foco visível discreto nos inputs dos wizards (anel fino, sem “glow”). */
export const wizardInputClassName =
  "shadow-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 focus-visible:border-border";

export const wizardDialogContentClassName =
  "max-w-2xl gap-0 overflow-hidden border-border/80 bg-background p-0 shadow-md sm:max-w-2xl";

export function WizardStepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex max-w-full flex-nowrap items-center justify-center overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div className="flex items-center" key={step}>
            <div
              aria-current={active ? "step" : undefined}
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-medium text-[10px] transition-colors",
                done
                  ? "bg-foreground text-background"
                  : active
                    ? "border border-foreground/70 bg-muted/30 text-foreground"
                    : "border border-border bg-muted/25 text-muted-foreground",
              ].join(" ")}
            >
              {done ? (
                <CheckIcon className="h-3 w-3" strokeWidth={2.5} />
              ) : (
                step
              )}
            </div>
            {step < total && (
              <div
                aria-hidden
                className={[
                  "mx-1.5 h-px w-5 sm:w-7",
                  done ? "bg-foreground/20" : "bg-border",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WizardStepHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-border/60 border-b pb-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/50 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-base leading-snug tracking-tight">
          {title}
        </h3>
        <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

export type WizardChromeDraft = {
  savedAtRelative: string;
  onDiscard: () => void;
};

export function WizardChromeHeader({
  step,
  total,
  stepLabel,
  summaryTitle,
  summaryIcon,
  draft,
}: {
  step: number;
  total: number;
  stepLabel: string;
  summaryTitle: React.ReactNode;
  summaryIcon: React.ReactNode;
  draft?: WizardChromeDraft | null;
}) {
  return (
    <div className="border-border/80 border-b px-6 py-5">
      <p className="font-medium text-muted-foreground text-xs">
        Etapa {step} de {total} — {stepLabel}
      </p>
      <div className="mt-3 flex justify-center">
        <WizardStepIndicator current={step} total={total} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-border/50 border-t pt-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/80 bg-muted/40 text-muted-foreground">
          {summaryIcon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-sm">{summaryTitle}</div>
          {draft && (
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-medium text-[10px] text-amber-800 dark:text-amber-200/90">
                Rascunho · {draft.savedAtRelative}
              </span>
              <button
                className="text-[10px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                onClick={draft.onDiscard}
                type="button"
              >
                Descartar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WizardBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[420px] overflow-y-auto px-6 py-6">
      <div className="rounded-xl border border-border/70 bg-card/40 p-5 shadow-[var(--card-shadow)]">
        {children}
      </div>
    </div>
  );
}

export function WizardFooterNav({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-border/80 border-t bg-muted/10 px-6 py-4">
      {children}
    </div>
  );
}
