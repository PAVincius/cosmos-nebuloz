import { Skeleton } from "@repo/design-system/components/ui/skeleton";

export default function CopilotLoading() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar skeleton */}
      <aside className="hidden h-full w-64 flex-col border-hairline border-r bg-surface-2 lg:flex">
        <div className="flex items-center justify-between px-3 py-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
        <div className="flex-1 space-y-2 px-2 pb-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton className="h-8 w-full rounded-lg" key={i} />
          ))}
        </div>
      </aside>

      {/* Main column skeleton */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-start justify-between gap-4 border-hairline border-b px-8 py-6">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-40 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3.5 w-96 max-w-full" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        </div>

        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-14 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
          <Skeleton className="h-20 w-3/4 rounded-2xl" />
        </div>

        <div className="shrink-0 border-hairline border-t bg-surface-2 p-4">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
