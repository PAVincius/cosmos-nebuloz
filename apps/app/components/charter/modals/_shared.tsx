"use client";

// modals/_shared.tsx — o que dois ou mais modais do Charter compartilham.
// Movido de modals.tsx no split em um arquivo por modal; o barrel continua
// re-exportando para que os importadores não mudem.

export type DataClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
/** Confirmação que só habilita quando o formulário está pronto, e explica no
 *  `title` o que falta. Esconder o botão faria o usuário procurar. */
export function GatedAction({
  ready,
  reason,
  children,
}: {
  ready: boolean;
  reason?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        opacity: ready ? 1 : 0.45,
        pointerEvents: ready ? "auto" : "none",
      }}
      title={ready ? undefined : reason}
    >
      {children}
    </span>
  );
}
