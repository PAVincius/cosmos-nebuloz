"use client";

import { AlertTriangleIcon } from "lucide-react";
import { useEffect } from "react";
import { appDesign } from "@/lib/app-design";

export default function WorkspaceSettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // biome-ignore lint/suspicious/noConsole: surfaced to observability, dev-visible fallback
    console.error("[settings/workspace]", error);
  }, [error]);

  return (
    <div className={appDesign.shell}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <AlertTriangleIcon className="size-8 text-destructive" />
        <p className="font-semibold text-[15px] text-ink">
          Não foi possível carregar as configurações do workspace.
        </p>
        <p className="max-w-md text-[13px] text-ink-subtle">
          {error.message || "Tente novamente em instantes."}
        </p>
        <button
          className="mt-2 rounded-md border border-hairline bg-surface-2 px-4 py-2 font-medium text-[13px] text-ink hover:border-hairline-strong"
          onClick={reset}
          type="button"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
