import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function SectionCard({
  title,
  description,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--card-shadow)]",
        className
      )}
    >
      <header className="flex items-center gap-3 border-hairline border-b bg-surface-2 px-[18px] py-[13px]">
        {!!icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-[14.5px] text-ink tracking-[-0.01em]">
            {title}
          </div>
          {!!description && (
            <div className="mt-px truncate text-[12.5px] text-ink-muted">
              {description}
            </div>
          )}
        </div>
        {!!action && <div className="ml-auto shrink-0">{action}</div>}
      </header>
      <div className={cn("p-[18px]", bodyClassName)}>{children}</div>
    </section>
  );
}
