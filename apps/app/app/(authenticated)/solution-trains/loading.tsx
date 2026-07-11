import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-6 w-14" />
    </div>
  );
}

function TrainCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="flex items-center gap-2.5 border-hairline border-b bg-surface-2 p-3">
        <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="mb-1.5 h-3.5 w-32" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
      <div className="p-4">
        <Skeleton className="mb-1.5 h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="mt-4 flex items-center justify-between border-hairline border-t pt-3">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className={appDesign.shell}>
      <div className="shrink-0 border-hairline border-b p-6">
        <Skeleton className="mb-3 h-2.5 w-20" />
        <Skeleton className="mb-2 h-6 w-56" />
        <Skeleton className="h-3 w-96 max-w-full" />
      </div>

      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <TrainCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
