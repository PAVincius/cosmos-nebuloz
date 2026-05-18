import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b px-6 py-3 flex items-center gap-3 shrink-0">
        <span className="font-semibold text-lg tracking-tight">COSMOS</span>
        <span className="text-xs text-muted-foreground uppercase tracking-widest">
          Setup
        </span>
      </header>
      <main className="flex-1 flex flex-col overflow-auto">{children}</main>
    </div>
  );
}
