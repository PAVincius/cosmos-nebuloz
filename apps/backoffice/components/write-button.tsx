"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * SRD FR-0.4 — `MEMBER` do tenant `system` vê tudo e não escreve nada.
 *
 * O botão desabilita **com o motivo visível**, não em silêncio: um controle
 * apagado sem explicação faz a pessoa achar que a tela quebrou. O texto nomeia
 * o papel e a função que recusa, para o operador saber o que pedir a quem.
 *
 * Isto é conveniência de UI, **não** é a autorização. `assertCanWrite` recusa
 * de novo no servidor, em toda action — default deny. Se esta camada falhar ou
 * for contornada por RPC direto, a escrita continua barrada (coberto por
 * __tests__/write-button.test.tsx e pelo guard do package).
 */
export const MOTIVO_SOMENTE_LEITURA =
  "Somente leitura — seu papel no tenant system é MEMBER. assertCanWrite recusa esta ação no servidor.";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  canWrite: boolean;
  children: ReactNode;
};

export function WriteButton({ canWrite, children, ...props }: Props) {
  if (canWrite) {
    return (
      <button
        type="button"
        {...props}
        className="inline-flex items-center gap-2 rounded-md border border-transparent bg-primary px-3 py-2 font-semibold text-primary-foreground text-sm hover:opacity-90"
      >
        {children}
      </button>
    );
  }

  return (
    <span
      className="inline-flex cursor-not-allowed"
      title={MOTIVO_SOMENTE_LEITURA}
    >
      <button
        {...props}
        aria-describedby="motivo-somente-leitura"
        className="pointer-events-none inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 font-semibold text-muted-foreground text-sm opacity-60"
        disabled
        type="button"
      >
        {children}
      </button>
      {/* O motivo precisa existir no DOM, não só no title: title não é lido por
          leitor de tela em todo navegador, e a regra é "desabilita com motivo". */}
      <span className="sr-only" id="motivo-somente-leitura">
        {MOTIVO_SOMENTE_LEITURA}
      </span>
    </span>
  );
}
