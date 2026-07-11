"use client";

import { useEffect } from "react";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RisksError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("[RisksError]", error);
  }, [error]);

  return (
    <div
      style={{
        padding: "40px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#e54d4d",
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontSize: 11,
            color: "#62666d",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
          }}
        >
          Erro ao carregar riscos
        </span>
      </div>
      <p
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "#f7f8f8",
          letterSpacing: "-0.4px",
          margin: 0,
        }}
      >
        Algo deu errado
      </p>
      <p style={{ fontSize: 13, color: "#8a8f98", margin: 0, maxWidth: 480 }}>
        Não conseguimos carregar o registro de riscos. Isso pode ser um
        problema temporário.
      </p>
      {error.digest && (
        <code
          style={{
            fontSize: 11,
            color: "#62666d",
            background: "#141516",
            border: "1px solid #23252a",
            borderRadius: 6,
            padding: "4px 10px",
          }}
        >
          {error.digest}
        </code>
      )}
      <button
        onClick={reset}
        style={{
          padding: "8px 20px",
          background: "#5e6ad2",
          color: "#f7f8f8",
          border: "none",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
        }}
        type="button"
      >
        Tentar novamente
      </button>
    </div>
  );
}
