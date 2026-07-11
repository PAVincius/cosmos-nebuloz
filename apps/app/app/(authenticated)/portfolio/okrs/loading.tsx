import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const STAT_COUNT = 4;
const OKR_CARD_COUNT = 4;
const KR_ROW_COUNT = 3;

function KpiCardSkeleton() {
  return (
    <div className="space-y-3 rounded-[var(--r-lg)] border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-6 rounded-md" />
      </div>
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

function KrRowSkeleton() {
  return (
    <div className="border-hairline border-b py-[11px] last:border-b-0">
      <div className="mb-[7px] flex items-center justify-between gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-[7px] w-full rounded-full" />
    </div>
  );
}

function OkrCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-hairline bg-surface">
      <div className="flex items-start gap-3.5 border-hairline border-b px-[18px] py-4">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="px-[18px] pt-2 pb-4">
        {Array.from({ length: KR_ROW_COUNT }).map((_, i) => (
          <KrRowSkeleton key={`kr-row-${i}`} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: STAT_COUNT }).map((_, i) => (
          <KpiCardSkeleton key={`stat-${i}`} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: OKR_CARD_COUNT }).map((_, i) => (
          <OkrCardSkeleton key={`okr-card-${i}`} />
        ))}
      </div>
    </div>
  );
}
