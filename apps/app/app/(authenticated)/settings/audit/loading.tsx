import { appDesign } from "@/lib/app-design";

export default function AuditLogLoading() {
  return (
    <div className={appDesign.shell}>
      <div className="shrink-0 border-hairline border-b bg-surface-2 px-8 py-6">
        <div className="mb-3 h-3 w-56 animate-pulse rounded bg-surface-3" />
        <div className="h-6 w-52 animate-pulse rounded bg-surface-3" />
      </div>
      <div className={`${appDesign.bodyScroll} flex flex-col gap-3`}>
        <div className="h-9 w-96 animate-pulse rounded-cosmos-pill bg-surface-2" />
        <div className="overflow-hidden rounded-cosmos-lg border border-hairline">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              className="h-11 animate-pulse border-hairline border-b bg-surface-2 last:border-0"
              key={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
