import { Skeleton } from "@repo/design-system/components/ui/skeleton";

function RowSkeleton() {
  return (
    <div className="grid items-center gap-3.5 rounded-lg border border-hairline bg-card p-3.5">
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
        <div className="flex-1">
          <Skeleton className="mb-1.5 h-3 w-24" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <Skeleton className="h-8 w-20 shrink-0 rounded-full" />
        <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-9 w-[220px]" />
      <div
        className="grid items-start gap-5"
        style={{ gridTemplateColumns: "1fr 1.6fr" }}
      >
        <div className="rounded-[14px] border border-hairline bg-card p-4">
          <Skeleton className="mb-3 h-4 w-32" />
          <Skeleton className="aspect-[4/3.9] w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-1.5 rounded-[14px] border border-hairline bg-card p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
