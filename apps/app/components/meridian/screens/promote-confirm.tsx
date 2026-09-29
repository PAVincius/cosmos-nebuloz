"use client";

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";

export type PromoteTarget = "COSMOS" | "SCAFFOLD";

const TARGETS: { id: PromoteTarget; label: string; desc: string }[] = [
  {
    id: "COSMOS",
    label: "Cosmos",
    desc: "vira iniciativa de execução",
  },
  {
    id: "SCAFFOLD",
    label: "Scaffold",
    desc: "vira caso de negócio para contratar",
  },
];

/** Passo de confirmação da promoção: o clique no gap só abre isto; a gravação
 *  acontece em "Confirmar", com o destino escolhido à vista. */
export function PromoteConfirm({
  gapCode,
  defaultProduct,
  busy,
  onConfirm,
  onCancel,
}: {
  gapCode: string;
  defaultProduct: PromoteTarget;
  busy: boolean;
  onConfirm: (product: PromoteTarget) => void;
  onCancel: () => void;
}) {
  const [product, setProduct] = useState<PromoteTarget>(defaultProduct);

  return (
    <fieldset
      style={{
        margin: 0,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        border: "1px solid var(--hairline)",
        borderRadius: 10,
      }}
    >
      <legend style={{ fontSize: 12.5, fontWeight: 700, padding: "0 6px" }}>
        Promover {gapCode} — escolha o destino
      </legend>
      {TARGETS.map((t) => (
        <label
          key={t.id}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 13,
          }}
        >
          <input
            checked={product === t.id}
            name="promote-target"
            onChange={() => setProduct(t.id)}
            type="radio"
          />
          <span>
            <strong>{t.label}</strong> · {t.desc}
          </span>
        </label>
      ))}
      <div style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>
        O gap continua no Meridian, referenciado. Nada é gravado até confirmar.
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        <Button
          disabled={busy}
          icon="check"
          onClick={() => onConfirm(product)}
          size="sm"
        >
          Confirmar promoção
        </Button>
        <Button disabled={busy} onClick={onCancel} size="sm" variant="ghost">
          Cancelar
        </Button>
      </div>
    </fieldset>
  );
}
