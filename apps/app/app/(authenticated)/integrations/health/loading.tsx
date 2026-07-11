import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { appDesign } from "@/lib/app-design";

function HealthCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-hairline bg-surface">
      <div className="flex items-center gap-3 border-hairline border-b bg-surface-2 p-3">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="ml-auto h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className={appDesign.shell}>
      <div className="shrink-0 border-hairline border-b p-6">
        <Skeleton className="mb-2 h-6 w-56" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>

      <div className={`${appDesign.bodyScroll} flex flex-col gap-4`}>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
          {[0, 1, 2].map((i) => (
            <HealthCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
