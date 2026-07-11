"use client";

import { useEffect } from "react";
import { appDesign } from "@/lib/app-design";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RoadmapError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("[RoadmapError]", error);
  }, [error]);

  return (
    <div className={appDesign.shell}>
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            padding: "16px 18px",
            borderRadius: 12,
            border: "1px solid rgba(251,113,133,.35)",
            background:
              "linear-gradient(180deg, rgba(251,113,133,.10), rgba(251,113,133,.04))",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--red-text)",
              marginTop: 6,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--ink)",
                margin: 0,
              }}
            >
              Não foi possível carregar o Roadmap
            </p>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--ink-muted)",
                margin: "4px 0 0",
                maxWidth: 480,
              }}
            >
              Ocorreu uma falha ao buscar os itens do roadmap, ARTs ou épicos.
              Isso pode ser um problema temporário.
            </p>
            {error.digest && (
              <code
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--ink-subtle)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                  padding: "3px 8px",
                }}
              >
                {error.digest}
              </code>
            )}
            <div style={{ marginTop: 12 }}>
              <button
                onClick={reset}
                style={{
                  padding: "6px 14px",
                  background: "var(--red-text)",
                  color: "#160c12",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                type="button"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
