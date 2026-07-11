import { appDesign } from "@/lib/app-design";

export default function WorkflowsLoading() {
  return (
    <div className={appDesign.shell}>
      <div className="shrink-0 border-hairline border-b bg-surface-2 px-8 py-6">
        <div className="mb-3 h-3 w-32 animate-pulse rounded bg-surface-3" />
        <div className="h-6 w-56 animate-pulse rounded bg-surface-3" />
      </div>
      <div className={appDesign.bodyScroll}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              className="h-[92px] animate-pulse rounded-cosmos-lg border border-hairline bg-surface-2"
              key={i}
            />
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              className="h-[64px] animate-pulse rounded-cosmos-md border border-hairline bg-surface-2"
              key={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
