"use client";

import { type ButtonHTMLAttributes, type ReactNode, useId } from "react";

/**
 * SRD FR-0.4 — `MEMBER` do tenant `system` vê tudo e não escreve nada.
 *
 * O botão desabilita **com o motivo visível**, não em silêncio: um controle
 * apagado sem explicação faz a pessoa achar que a tela quebrou. O texto nomeia
 * o papel que a pessoa tem e o que precisa agir, para o operador saber o que
 * pedir a quem — sem citar a função do servidor, que não diz nada a quem lê.
 *
 * Isto é conveniência de UI, **não** é a autorização. `assertCanWrite` recusa
 * de novo no servidor, em toda action — default deny. Se esta camada falhar ou
 * for contornada por RPC direto, a escrita continua barrada (coberto por
 * __tests__/write-button.test.tsx e pelo guard do package).
 *
 * O estilo é o mesmo do `BotaoPrimario` do `campo.tsx`, em token: este botão é
 * a ação primária das telas onde aparece, e antes ele vinha do shadcn
 * (`bg-primary`, `text-muted-foreground`) — a paleta do Big Bang é redefinida
 * por cima do Cosmos no `backoffice-theme.css`, então o botão do default-deny
 * era o único controle do painel pintado por outra régua.
 */

/** A mesma frase que as outras telas de default-deny usam — uma só, combinada. */
export const MOTIVO_SOMENTE_LEITURA =
  "Somente leitura: seu papel no back-office é MEMBER. Um ADMIN precisa fazer esta ação.";

const BASE = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 15px",
  borderRadius: "var(--r-md)",
  fontFamily: "inherit",
  fontSize: "var(--fs-forte)",
  fontWeight: 600,
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  canWrite: boolean;
  children: ReactNode;
};

export function WriteButton({ canWrite, children, ...props }: Props) {
  // O motivo precisa de id próprio: `aprovacoes` monta dois destes por pedido e
  // vários pedidos por tela. Com id fixo o documento nascia com uma dúzia de
  // elementos repetindo o mesmo id, e `aria-describedby` resolve pelo primeiro
  // — os outros apontavam para o motivo de outro botão.
  const idDoMotivo = useId();

  if (canWrite) {
    return (
      <button
        type="button"
        {...props}
        style={{
          ...BASE,
          border: "1px solid var(--accent)",
          background: "var(--accent)",
          color: "var(--accent-fg)",
          boxShadow:
            "0 1px 2px rgba(var(--accent-rgb),.4), 0 6px 16px -8px rgba(var(--accent-rgb),.6)",
          opacity: props.disabled ? 0.5 : 1,
          cursor: props.disabled ? "not-allowed" : "pointer",
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      style={{ display: "inline-flex", cursor: "not-allowed" }}
      title={MOTIVO_SOMENTE_LEITURA}
    >
      <button
        {...props}
        aria-describedby={idDoMotivo}
        disabled
        style={{
          ...BASE,
          border: "1px solid var(--hairline)",
          background: "var(--surface-2)",
          color: "var(--ink-faint)",
          opacity: 0.6,
          pointerEvents: "none",
        }}
        type="button"
      >
        {children}
      </button>
      {/* O motivo precisa existir no DOM, não só no title: title não é lido por
          leitor de tela em todo navegador, e a regra é "desabilita com motivo". */}
      <span className="sr-only" id={idDoMotivo}>
        {MOTIVO_SOMENTE_LEITURA}
      </span>
    </span>
  );
}
