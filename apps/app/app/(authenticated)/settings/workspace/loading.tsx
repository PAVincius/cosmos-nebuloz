import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

function FieldSkeleton() {
  return (
    <div>
      <Skeleton className="mb-1.5 h-3 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-hairline border-b p-3 last:border-b-0">
      <Skeleton className="size-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-40" />
      </div>
      <Skeleton className="h-5 w-14 rounded-md" />
    </div>
  );
}

export default function WorkspaceSettingsLoading() {
  return (
    <div className={appDesign.shell}>
      <div className={appDesign.pageHeader}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-7 w-40" />
        <Skeleton className="mt-2 h-3 w-80" />
      </div>

      <div
        className={appDesign.bodyScroll}
        style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}
      >
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton className="h-8 w-full rounded-md" key={i} />
          ))}
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-cosmos-lg border border-hairline bg-card p-4">
            <Skeleton className="mb-4 h-14 w-14 rounded-lg" />
            <div className="grid grid-cols-2 gap-3.5">
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}
          >
            <div className="overflow-hidden rounded-cosmos-lg border border-hairline bg-card">
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <RowSkeleton key={i} />
              ))}
            </div>
            <div className="overflow-hidden rounded-cosmos-lg border border-hairline bg-card p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton className="h-4 w-full" key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
