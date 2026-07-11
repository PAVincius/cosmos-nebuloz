import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-card p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="mt-3 h-7 w-16 rounded" />
      <Skeleton className="mt-2 h-3 w-24 rounded" />
    </div>
  );
}

function HealthCardSkeleton() {
  return (
    <div className="rounded-xl border border-hairline bg-card p-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-full rounded" />
      </div>
    </div>
  );
}

export default function ARTDetailLoading() {
  return (
    <div className={appDesign.shell}>
      {/* Header */}
      <div
        style={{
          padding: "22px 32px 20px",
          background:
            "linear-gradient(180deg, var(--surface-3) 0%, var(--surface-2) 45%, var(--surface) 100%)",
          borderBottom: "1px solid var(--hairline)",
          flexShrink: 0,
        }}
      >
        <Skeleton className="mb-3 h-2.5 w-40 rounded" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-7 w-52 rounded" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </div>

          <div className="rounded-xl border border-hairline bg-card">
            <div className="flex items-center gap-3 border-hairline border-b p-4">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="h-3 w-44 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <HealthCardSkeleton />
              <HealthCardSkeleton />
              <HealthCardSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
