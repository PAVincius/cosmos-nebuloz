import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const KPI_COUNT = 4;
const ROW_COUNT = 5;

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-6 w-24" />
      <Skeleton className="mt-2 h-2.5 w-16" />
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card">
      <div className="flex items-center gap-3 border-hairline border-b px-4 py-3">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: ROW_COUNT }).map((_, i) => (
          <Skeleton className="h-9 w-full" key={i} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b px-6 py-5">
        <Skeleton className="h-3 w-full max-w-md" />
        <Skeleton className="mt-2 h-6 w-40" />
        <Skeleton className="mt-2 h-3.5 w-96" />
      </div>
      <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-6">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          {Array.from({ length: KPI_COUNT }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    </div>
  );
}
