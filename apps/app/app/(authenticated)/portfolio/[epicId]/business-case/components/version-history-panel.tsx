"use client";

import type { VersionSnapshot } from "@/app/actions/epics/business-case";

type Props = {
  versions: VersionSnapshot[];
};

export function VersionHistoryPanel({ versions }: Props) {
  if (versions.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-muted-foreground text-sm">
        Nenhum snapshot de versão ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
      <h3 className="font-medium text-sm">Histórico de versões</h3>
      <div className="max-h-48 space-y-2 overflow-y-auto">
        {[...versions].reverse().map((v, i) => (
          <div
            className="rounded border bg-background p-2 text-xs"
            key={`${v.savedAt}-${i}`}
          >
            <div className="mb-1 flex items-center justify-between text-muted-foreground">
              <span>
                Campo: <strong>{v.field}</strong>
              </span>
              <span className="flex items-center gap-1">
                {v.savedBy === "COPILOT" && (
                  <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    Copilot
                  </span>
                )}
                {new Date(v.savedAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {v.prev !== v.next && (
              <div className="space-y-1">
                <p className="text-red-500/70 line-through">
                  {v.prev.slice(0, 120)}
                  {v.prev.length > 120 && "…"}
                </p>
                <p className="text-green-600 dark:text-green-400">
                  {v.next.slice(0, 120)}
                  {v.next.length > 120 && "…"}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
