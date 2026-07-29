import { appDesign } from "@/lib/app-design";

export default function GovernanceLoading() {
  return (
    <div className={appDesign.shell}>
      <div className="shrink-0 border-hairline border-b bg-surface-2 px-8 py-6">
        <div className="mb-3 h-3 w-40 animate-pulse rounded bg-surface-3" />
        <div className="h-6 w-72 animate-pulse rounded bg-surface-3" />
      </div>
      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              className="h-[86px] animate-pulse rounded-cosmos-lg border border-hairline bg-surface-2"
              key={i}
            />
          ))}
        </div>
        <div className="rounded-cosmos-lg border border-hairline bg-surface p-3">
          <div className="mb-2 h-4 w-56 animate-pulse rounded bg-surface-3" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                className="h-[64px] animate-pulse rounded-cosmos-md border border-hairline-strong bg-surface-2"
                key={i}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
