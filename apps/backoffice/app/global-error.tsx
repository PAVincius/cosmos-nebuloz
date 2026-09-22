"use client";

import { FalhaGeral, type PropsDaFalhaGeral } from "@/components/falha-geral";

/**
 * Fronteira de erro da raiz.
 *
 * `(staff)/error.tsx` só pega o que quebra dentro do grupo. Uma falha no
 * layout raiz, no sign-in ou em `/seguranca` subia até aqui e, sem este
 * arquivo, caía na tela genérica do Next em inglês. Substitui o layout raiz
 * inteiro quando aparece — por isso traz o próprio `<html>`/`<body>`.
 */
export default function GlobalError(props: PropsDaFalhaGeral) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>
        <FalhaGeral {...props} />
      </body>
    </html>
  );
}
