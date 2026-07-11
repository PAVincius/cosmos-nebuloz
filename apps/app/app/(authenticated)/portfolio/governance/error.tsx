"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { appDesign } from "@/lib/app-design";

export default function GovernanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={appDesign.shell}>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-cosmos-lg border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-8 py-10 text-center">
          <AlertTriangle aria-hidden className="text-red-text" size={28} />
          <h2 className="font-semibold text-[15px] text-ink">
            Não foi possível carregar a governança
          </h2>
          <p className="text-[13px] text-ink-muted">{error.message}</p>
          <button
            className="mt-2 rounded-cosmos-pill border border-hairline-strong bg-surface px-4 py-2 font-semibold text-[13px] text-ink transition-colors hover:bg-surface-2"
            onClick={reset}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
