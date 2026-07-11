import { Skeleton } from "@repo/design-system/components/ui/skeleton";

function EntryCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="flex items-center gap-2.5 border-hairline border-b bg-surface-2 px-4 py-3">
        <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton className="h-20 rounded-lg" key={i} />
        ))}
      </div>

      <div className="rounded-lg border border-hairline bg-surface p-4">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="mb-2 h-20 w-full rounded-md" />
        <Skeleton className="mb-2 h-20 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {[0, 1, 2].map((i) => (
          <EntryCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
