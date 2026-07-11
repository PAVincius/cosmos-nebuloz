"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CopilotError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("[CopilotError]", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div
        className="flex max-w-md items-start gap-3 rounded-xl border px-5 py-4"
        style={{
          borderColor: "var(--red-soft)",
          background: "var(--red-soft)",
        }}
      >
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0"
          style={{ color: "var(--red-text)" }}
        />
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-ink text-sm">
            Não foi possível carregar o Copilot
          </p>
          <p className="text-ink-muted text-xs">
            {error.message || "Ocorreu um erro inesperado ao iniciar o chat."}
          </p>
          <Button
            className="mt-1 w-fit"
            onClick={reset}
            size="sm"
            variant="outline"
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    </div>
  );
}
