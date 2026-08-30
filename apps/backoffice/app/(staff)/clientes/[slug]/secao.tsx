import type { IconName } from "@repo/design-system/cosmos/icons";
import { SectionCard } from "@repo/design-system/cosmos/kit";
import type { ReactNode } from "react";

/**
 * Uma seção do detalhe do tenant, no formato do `backoffice-tenant-detail.jsx`.
 *
 * Existe para que "seção que carregou" e "seção que falhou" tenham a MESMA
 * moldura. Antes o erro saía como um parágrafo vermelho solto, fora do card —
 * a tela parecia ter uma seção a menos em vez de uma seção com problema, que é
 * uma diferença que muda o que o operador faz em seguida.
 */
export function Secao<T>({
  titulo,
  subtitulo,
  icone,
  resultado,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  icone?: IconName;
  /** O `Result` da action; o erro é renderizado dentro do card. */
  resultado: { ok: true; data: T } | { ok: false; error: string };
  children: (dados: T) => ReactNode;
}) {
  return (
    <SectionCard icon={icone} subtitle={subtitulo} title={titulo}>
      {resultado.ok ? (
        children(resultado.data)
      ) : (
        <p
          style={{
            margin: 0,
            padding: "11px 13px",
            borderRadius: "var(--r-md)",
            background: "var(--red-soft)",
            border: "1px solid rgba(var(--red-rgb),.3)",
            color: "var(--red-text)",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
          }}
        >
          {resultado.error}
        </p>
      )}
    </SectionCard>
  );
}

/** Seção sem `Result` por trás — dado que já veio junto com o tenant. */
export function SecaoSimples({
  titulo,
  subtitulo,
  icone,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  icone?: IconName;
  children: ReactNode;
}) {
  return (
    <SectionCard icon={icone} subtitle={subtitulo} title={titulo}>
      {children}
    </SectionCard>
  );
}
