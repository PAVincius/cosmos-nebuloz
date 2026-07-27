import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-card p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

function LaneSkeleton() {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-1.5">
      <Skeleton className="h-3 w-20" />
      <div className="grid h-9 grid-cols-4 gap-1.5">
        <Skeleton className="col-span-1 h-7 rounded" />
        <Skeleton className="col-span-2 h-7 rounded" />
        <div />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className={appDesign.shell}>
      <div className="flex items-start justify-between gap-4 p-6 pb-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-[420px] max-w-full" />
        </div>
        <Skeleton className="h-8 w-40 shrink-0 rounded-md" />
      </div>
      <div className={appDesign.bodyScroll}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </div>
          <div className="overflow-hidden rounded-lg border border-hairline bg-card">
            <div className="flex items-center gap-3 border-hairline border-b p-3">
              <Skeleton className="h-7 w-7 rounded-md" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-44" />
              </div>
            </div>
            <div className="space-y-2 p-4">
              <div className="grid grid-cols-[130px_1fr] gap-1.5">
                <div />
                <div className="grid grid-cols-4 gap-1.5">
                  <Skeleton className="h-6 rounded" />
                  <Skeleton className="h-6 rounded" />
                  <Skeleton className="h-6 rounded" />
                  <Skeleton className="h-6 rounded" />
                </div>
              </div>
              <LaneSkeleton />
              <LaneSkeleton />
              <LaneSkeleton />
              <LaneSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
