import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const KPI_COUNT = 4;
const CARD_COUNT = 5;

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-6 w-14" />
      <Skeleton className="mt-2 h-2.5 w-20" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-hairline bg-card p-3.5">
      <Skeleton className="h-[7px] w-[7px] shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
      <Skeleton className="h-8 w-16 shrink-0" />
      <Skeleton className="h-8 w-24 shrink-0" />
      <Skeleton className="h-6 w-20 shrink-0" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="border-b px-6 py-5">
        <Skeleton className="h-5 w-64" />
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
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: CARD_COUNT }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
