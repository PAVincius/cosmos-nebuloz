import type { ReactNode } from "react";

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b px-6 py-3">
        <span className="font-semibold text-lg tracking-tight">COSMOS</span>
        <span className="text-muted-foreground text-xs uppercase tracking-widest">
          Setup
        </span>
      </header>
      <main className="flex flex-1 flex-col overflow-auto">{children}</main>
    </div>
  );
}
