"use client";

// back-link.tsx — retorno no topo de toda tela de detalhe. Saiu de `base.tsx`
// (que está na catraca de tamanho) como unidade própria, igual a
// `gated-footer-action.tsx`; os módulos que consomem o Charter reexportam
// daqui pelo mesmo ponto único de acoplamento.

import { Icon } from "@repo/design-system/cosmos/icons";
import { FS } from "./type-scale";

/** Volta para a lista de origem no topo de toda tela de detalhe. `<button>` de
 *  verdade — a tela de detalhe é alcançável por URL direta e o retorno precisa
 *  ser focável pelo teclado. */
export function BackLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        marginBottom: 14,
        padding: "6px 12px",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
        color: "var(--ink-muted)",
        fontSize: FS.base,
        fontWeight: 600,
        cursor: "pointer",
      }}
      type="button"
    >
      <Icon name="arrowLeft" size={14} />
      {label}
    </button>
  );
}
