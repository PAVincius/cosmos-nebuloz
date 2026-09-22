import type { IconName } from "@repo/design-system/cosmos/icons";
import type { ReactNode } from "react";
import { Erro } from "@/components/campo";
import { Secao as Cartao } from "@/components/secao";

/**
 * Uma seção do detalhe do tenant, no formato do `backoffice-tenant-detail.jsx`.
 *
 * Existe para que "seção que carregou" e "seção que falhou" tenham a MESMA
 * moldura. Antes o erro saía como um parágrafo vermelho solto, fora do card —
 * a tela parecia ter uma seção a menos em vez de uma seção com problema, que é
 * uma diferença que muda o que o operador faz em seguida.
 *
 * O erro em si vem do `Erro` compartilhado. Esta seção tinha uma cópia inline
 * idêntica a ele, o que dava quatro implementações da mesma caixa vermelha
 * nesta rota — e a cópia daqui era a única sem `role="alert"`.
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
    <Cartao icon={icone} subtitle={subtitulo} title={titulo}>
      {resultado.ok ? children(resultado.data) : <Erro>{resultado.error}</Erro>}
    </Cartao>
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
    <Cartao icon={icone} subtitle={subtitulo} title={titulo}>
      {children}
    </Cartao>
  );
}
