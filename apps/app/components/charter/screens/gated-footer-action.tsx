"use client";

// gated-footer-action.tsx — GatedButton com o motivo sempre visível ao lado,
// não só no `title` do hover. Extraído de `policy.tsx` (baseline do
// size:guard: não pode crescer) e reaproveitado por `case-detail.tsx`: as
// duas telas gateiam ação real (`disabled`) e ainda assim precisam do motivo
// legível sem passar o mouse — NFR-1.3. Não confundir com o `GatedAction` de
// `modals.tsx`: aquele só finge desabilitar (`pointer-events:none`), este usa
// `disabled` de verdade (`../base`'s `GatedButton`).

import type { IconName } from "@repo/design-system/cosmos/icons";
import type { ReactNode } from "react";
import { GatedButton } from "../base";
import { FS } from "../type-scale";

export function GatedFooterAction({
  allowed,
  reason,
  icon,
  onClick,
  variant,
  children,
}: {
  allowed: boolean;
  reason: string;
  icon: IconName;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <GatedButton
        allowed={allowed}
        icon={icon}
        onClick={onClick}
        reason={reason}
        variant={variant}
      >
        {children}
      </GatedButton>
      {!allowed && (
        <span
          style={{
            fontSize: FS.nota,
            color: "var(--ink-faint)",
            maxWidth: 220,
          }}
        >
          {reason}
        </span>
      )}
    </div>
  );
}
