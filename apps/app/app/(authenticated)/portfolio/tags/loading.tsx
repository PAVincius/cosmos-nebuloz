import { appDesign } from "@/lib/app-design";

export default function TagsLoading() {
  return (
    <div className={appDesign.shell}>
      <div className="shrink-0 border-hairline border-b bg-surface-2 px-8 py-6">
        <div className="mb-3 h-3 w-40 animate-pulse rounded bg-surface-3" />
        <div className="h-6 w-72 animate-pulse rounded bg-surface-3" />
      </div>
      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              className="h-[150px] animate-pulse rounded-cosmos-xl border border-hairline bg-surface-2"
              key={i}
            />
          ))}
        </div>
        <div className="rounded-cosmos-lg border border-hairline bg-surface">
          <div className="h-[52px] animate-pulse rounded-t-cosmos-lg border-hairline border-b bg-surface-2" />
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                className="h-[62px] animate-pulse rounded-cosmos-md border border-hairline bg-surface-2"
                key={i}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
