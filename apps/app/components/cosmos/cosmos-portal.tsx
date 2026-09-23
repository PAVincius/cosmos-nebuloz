"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Portal para `document.body` que continua dentro do escopo do Cosmos.
 *
 * Os tokens do Cosmos só existem sob `.cosmos-root` (The Scope Rule, no
 * DESIGN.md desta raiz). Um portal direto para o body lia os valores globais:
 * `--r-md` e `--r-xl` não existem lá (canto zero), e no tema claro
 * `--ink-faint` cai a 2,04:1 sobre branco. `display: contents` dá o escopo sem
 * dar caixa — o wrapper não herda a altura de 100dvh nem o fundo que
 * `.cosmos-root` declara, e quem está dentro se posiciona como antes.
 */
export function CosmosPortal({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="cosmos-root" style={{ display: "contents" }}>
      {children}
    </div>,
    document.body
  );
}
