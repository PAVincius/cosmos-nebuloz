import { Skeleton } from "@repo/design-system/components/ui/skeleton";

const COLUMN_CARD_COUNTS = [3, 2, 4, 2, 1];

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-card">
      <Skeleton className="h-[3px] w-full rounded-none" />
      <div className="px-3 pt-2.5 pb-2">
        <Skeleton className="mb-1 h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="mt-2 flex gap-1.5">
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-4 w-10 rounded" />
        </div>
      </div>
    </div>
  );
}

function ColumnSkeleton({ count }: { readonly count: number }) {
  return (
    <div className="flex w-[350px] shrink-0 flex-col rounded-xl border border-border/30 bg-muted/10">
      <div className="flex items-center justify-between border-border/30 border-b bg-background/40 p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-6 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 p-3">
        {Array.from({ length: count }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <Skeleton className="h-8 w-52" />
      <div className="flex items-start gap-6 overflow-x-auto pb-4">
        {COLUMN_CARD_COUNTS.map((count, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <ColumnSkeleton count={count} key={i} />
        ))}
      </div>
    </div>
  );
}
