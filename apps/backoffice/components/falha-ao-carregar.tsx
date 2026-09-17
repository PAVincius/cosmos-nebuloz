"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Erro de leitura com saída — o padrão de recuperação (NFR-4) das telas que
 * dependem de uma leitura para existir.
 *
 * Vivia dentro de `propostas/[id]/page.tsx` como um parágrafo dizendo
 * "recarregue a página" em prosa; a carteira (`/`) tinha o próprio parágrafo
 * vermelho solto, sem cabeçalho e sem botão. Um lugar só, com o botão que faz
 * o que a prosa pedia: `router.refresh()` rebusca os Server Components sem
 * perder o shell nem o scroll — o F5 que a pessoa faria, só que no lugar
 * certo.
 *
 * Client de propósito: é o que permite o botão. As páginas que o usam são
 * Server Components e mantêm o `PageHeader` em volta — erro dentro da
 * moldura do sucesso, como `clientes/[slug]/secao.tsx` já fazia.
 */
export function FalhaAoCarregar({
  titulo,
  motivo,
  nota,
}: {
  /** O que não abriu: "Não foi possível abrir o gerador". */
  titulo: string;
  /** A mensagem do servidor — é mais precisa que qualquer texto daqui. Lista
   *  quando a tela soma leituras (Delivery, Capacidade, Biblioteca): uma linha
   *  por leitura que falhou, em vez de três mensagens coladas num parágrafo. */
  motivo: string | string[];
  /** O que pode estar por trás, quando tentar de novo não basta. */
  nota?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  // Sem repetição: banco fora derruba as três leituras com a mesma frase, e a
  // frase repetida três vezes não diz mais que uma. O título vai colado no
  // primeiro motivo; os outros são linhas soltas abaixo dele.
  const motivos = Array.from(
    new Set(Array.isArray(motivo) ? motivo : [motivo])
  ).map((m, i) => (i === 0 ? `${titulo}: ${m}` : m));

  return (
    <div
      role="alert"
      style={{
        margin: "24px 0",
        padding: 20,
        borderRadius: "var(--r-md)",
        border: "1px solid rgba(var(--red-rgb),.3)",
        background: "var(--red-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {motivos.map((linha) => (
        <p
          key={linha}
          style={{
            margin: 0,
            fontSize: "var(--fs-base)",
            fontWeight: 600,
            color: "var(--red-text)",
          }}
        >
          {linha}
        </p>
      ))}
      {nota ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-nota)",
            color: "var(--ink-faint)",
          }}
        >
          {nota}
        </p>
      ) : null}
      <div>
        <button
          className="btn"
          disabled={pendente}
          onClick={() => iniciar(() => router.refresh())}
          style={{
            padding: "7px 13px",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline-strong)",
            background: "var(--surface-2)",
            color: "var(--ink)",
            fontFamily: "inherit",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
            cursor: pendente ? "not-allowed" : "pointer",
            opacity: pendente ? 0.6 : 1,
          }}
          type="button"
        >
          {pendente ? "Tentando…" : "Tentar de novo"}
        </button>
      </div>
    </div>
  );
}
