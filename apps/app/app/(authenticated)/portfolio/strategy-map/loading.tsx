import { appDesign } from "@/lib/app-design";

// Skeleton matching the 3-theme-card layout of the loaded content, per
// DESIGN.md §6 loading state.

function PillarCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="border-border/60 border-b px-4 pt-4 pb-3.5">
        <div className="h-3 w-8 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-8 w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        {[0, 1].map((i) => (
          <div
            className="h-8 animate-pulse rounded-md border border-border/60 bg-muted/40"
            key={i}
          />
        ))}
      </div>
      <div className="border-border/60 border-t bg-muted/20 px-3.5 py-3">
        <div className="h-[5px] animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

function ThemeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-[3px] bg-muted" />
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
        <div className="ml-auto h-1.5 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="grid gap-2 border-border/50 border-t px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            className="h-16 animate-pulse rounded-lg border border-border/60 bg-muted/40"
            key={i}
          />
        ))}
      </div>
    </div>
  );
}

export default function StrategyMapLoading() {
  return (
    <div className={appDesign.shell}>
      <div className="flex flex-col gap-2 border-border/50 border-b px-6 py-5">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="h-6 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <PillarCardSkeleton key={i} />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <ThemeCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
