import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

function IntegrationCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-[18px]">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <div className="flex items-center justify-between border-hairline border-t pt-3">
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-8 w-full rounded-md" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className={appDesign.shell}>
      <div className="shrink-0 border-hairline border-b p-6">
        <Skeleton className="mb-2 h-6 w-40" />
        <Skeleton className="h-3 w-96 max-w-full" />
      </div>

      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>

        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {[0, 1, 2].map((i) => (
            <IntegrationCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
