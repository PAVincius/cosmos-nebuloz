import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

const KPI_COUNT = 4;
const ROW_COUNT = 6;

function KpiSkeleton() {
  return (
    <div className="overflow-hidden rounded-cosmos-lg border border-hairline bg-card p-4">
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="h-7 w-14" />
      <Skeleton className="mt-3 h-3 w-24" />
    </div>
  );
}

function MemberRowSkeleton() {
  return (
    <div className="flex items-center gap-2.5 border-hairline border-b px-3 py-[10px] last:border-b-0">
      <Skeleton className="size-[30px] shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-40" />
      </div>
      <Skeleton className="h-4 w-14 rounded-md" />
      <Skeleton className="h-4 w-16 rounded-full" />
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
          <Skeleton className="h-3 w-80" />
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

        <div className="overflow-hidden rounded-cosmos-lg border border-hairline bg-card">
          {Array.from({ length: ROW_COUNT }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <MemberRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
