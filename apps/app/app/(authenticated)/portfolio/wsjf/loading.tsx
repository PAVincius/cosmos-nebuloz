import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const KPI_COUNT = 4;
const ROW_COUNT = 6;

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card p-4">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-2 h-7 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-border/50 border-b px-3 py-2.5">
      <Skeleton className="h-[22px] w-[22px] shrink-0 rounded-md" />
      <Skeleton className="h-3 w-14 shrink-0" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-4 w-16 shrink-0 rounded-full" />
      <Skeleton className="h-3 w-8 shrink-0" />
      <Skeleton className="h-3 w-8 shrink-0" />
      <Skeleton className="h-3 w-8 shrink-0" />
      <Skeleton className="h-3 w-8 shrink-0" />
      <Skeleton className="h-3 w-8 shrink-0" />
      <Skeleton className="h-4 w-10 shrink-0" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}
      >
        {Array.from({ length: KPI_COUNT }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-hairline bg-card p-6">
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-9 w-40 shrink-0 rounded-md" />
      </div>

      <div className="overflow-hidden rounded-lg border border-hairline bg-card">
        {Array.from({ length: ROW_COUNT }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
