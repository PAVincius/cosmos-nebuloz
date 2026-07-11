import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

const KPI_COUNT = 4;
const CARD_COUNT = 6;

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-cosmos-lg border border-hairline bg-card p-4">
      <Skeleton className="mb-3 h-7 w-7 rounded-md" />
      <Skeleton className="mb-2 h-3 w-20" />
      <Skeleton className="h-6 w-14" />
    </div>
  );
}

function TeamCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-cosmos-lg border border-hairline bg-card">
      <div className="flex items-center gap-2.5 border-hairline border-b p-4">
        <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-md" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
          <Skeleton className="h-12 rounded-md" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className={appDesign.shell}>
      <div className="flex h-full flex-col gap-6 p-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-96" />
        </div>

        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}
        >
          {Array.from({ length: KPI_COUNT }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <KpiSkeleton key={i} />
          ))}
        </div>

        <div
          className="grid gap-3.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
          {Array.from({ length: CARD_COUNT }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <TeamCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
