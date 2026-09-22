"use client";

/**
 * O conteúdo de `app/global-error.tsx`, fora do arquivo especial para poder
 * ser testado sem `<html>`/`<body>` (e porque arquivo especial do App Router
 * não exporta nada além do default).
 *
 * Mínima de propósito: quando esta tela aparece, o layout raiz é justamente o
 * que pode ter falhado — então ela não depende do CSS dele. Os tokens entram
 * com o valor do tema escuro como reserva, que é como o painel nasce. O
 * `digest` é o que o Next grava no log do servidor para esta falha: com ele o
 * suporte acha a linha.
 */
export type PropsDaFalhaGeral = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function FalhaGeral({ error, reset }: PropsDaFalhaGeral) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--canvas, #07080c)",
        color: "var(--ink, #f5f7fb)",
        fontFamily: "var(--font-manrope, system-ui), sans-serif",
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: "100%",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "var(--surface, #0c0f17)",
          border: "1px solid var(--hairline, rgba(255,255,255,.07))",
          borderRadius: "var(--r-xl, 18px)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "var(--fs-titulo, 19px)" }}>
          O painel não carregou
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-base, 13px)",
            lineHeight: 1.6,
            color: "var(--ink-muted, #b8c0d0)",
          }}
        >
          Algo falhou antes de qualquer tela montar. Tente de novo; se voltar a
          acontecer, avise o suporte com o código abaixo.
        </p>
        {error.digest ? (
          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-nota, 11.5px)",
              color: "var(--ink-muted, #b8c0d0)",
            }}
          >
            Código para o suporte:{" "}
            <span
              className="mono"
              style={{
                fontFamily:
                  "var(--font-jetbrains-mono, ui-monospace), monospace",
                fontWeight: 700,
              }}
            >
              {error.digest}
            </span>
          </p>
        ) : null}
        <button
          onClick={reset}
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            padding: "8px 14px",
            border: "none",
            borderRadius: "var(--r-md, 10px)",
            background: "var(--accent, #5cb4e4)",
            color: "var(--accent-fg, #07080c)",
            fontSize: "var(--fs-base, 13px)",
            fontWeight: 700,
            cursor: "pointer",
          }}
          type="button"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
