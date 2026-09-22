"use client";

import { PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Secao } from "@/components/secao";

/**
 * Fronteira de erro do grupo `(staff)`.
 *
 * Antes não existia: qualquer `throw` numa page caía na tela do Next em
 * inglês, fora do shell — a pessoa perdia navegação, topbar e o vocabulário
 * do painel de uma vez. Aqui o layout do grupo envolve, então o shell fica e
 * só o conteúdo diz que não carregou.
 *
 * "Tentar de novo" faz as duas coisas que um retry precisa: `router.refresh()`
 * rebusca os Server Components (sem isso, `reset()` renderizaria de novo o
 * mesmo resultado falho) e `reset()` desmonta esta fronteira.
 *
 * A mensagem do erro aparece em mono quando existe. É o que faz alguém
 * conseguir colar num ticket — "não carregou" não diz a ninguém o que olhar.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const tentarDeNovo = () =>
    iniciar(() => {
      router.refresh();
      reset();
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Nebuloz · erro"
        subtitle="Algo falhou ao montar esta tela. O painel continua de pé — só este conteúdo não veio."
        title="Não deu para carregar esta tela"
        tone="red"
      />
      <Secao icon="alert" title="O que aconteceu" tone="red">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error.message ? (
            <p
              className="mono"
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: "var(--r-md)",
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
                fontSize: "var(--fs-nota)",
                color: "var(--ink-muted)",
                overflowWrap: "anywhere",
              }}
            >
              {error.message}
            </p>
          ) : null}
          {/* O `digest` é o que o Next grava no log do servidor para esta
              falha: com ele o suporte acha a linha; sem ele, procura por
              horário. Em produção a mensagem some e o digest é tudo. */}
          {error.digest ? (
            <p
              style={{
                margin: 0,
                fontSize: "var(--fs-nota)",
                color: "var(--ink-muted)",
              }}
            >
              Código para o suporte:{" "}
              <span className="mono" style={{ fontWeight: 700 }}>
                {error.digest}
              </span>
            </p>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn"
              disabled={pendente}
              onClick={tentarDeNovo}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "9px 15px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--accent)",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                fontFamily: "inherit",
                fontSize: "var(--fs-forte)",
                fontWeight: 600,
                cursor: pendente ? "not-allowed" : "pointer",
                opacity: pendente ? 0.6 : 1,
              }}
              type="button"
            >
              {pendente ? "Tentando…" : "Tentar de novo"}
            </button>
            <Link
              href="/"
              style={{
                fontSize: "var(--fs-base)",
                fontWeight: 700,
                color: "var(--accent-text)",
              }}
            >
              Voltar para a Home
            </Link>
          </div>
        </div>
      </Secao>
    </div>
  );
}
