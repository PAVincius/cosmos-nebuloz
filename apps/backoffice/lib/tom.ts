import type { Tone } from "@repo/design-system/cosmos/kit";

/**
 * "neutral" não tem variável de cor própria no kit (`var(--neutral)` não
 * existe e deixa o elemento sem cor) — cai no azul. Um lugar só: o mapa de
 * processos (`lib/ferramentas/processos.ts`) e o funil v2
 * (`lib/comercial/funil.ts`) tinham cada um sua cópia, byte a byte iguais.
 */
export function tomCss(tom: Tone): Tone {
  return tom === "neutral" ? "blue" : tom;
}
