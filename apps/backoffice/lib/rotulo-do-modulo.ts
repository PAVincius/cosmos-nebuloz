/**
 * O nome de cada módulo como a pessoa o lê — "Cosmos", não "COSMOS".
 *
 * Separado de `lib/modulos.ts` de propósito: aquele é `server-only` (lê o
 * enum do Prisma) e quem precisa do rótulo é tela cliente. A lista é curta e
 * fechada; um módulo novo no enum aparece aqui pelo `?? modulo` até ganhar
 * nome próprio.
 */
export const ROTULO_DO_MODULO: Record<string, string> = {
  COSMOS: "Cosmos",
  CHARTER: "Charter",
  SIGNAL: "Signal",
  MERIDIAN: "Meridian",
  SCAFFOLD: "Scaffold",
};

export function rotuloDoModulo(modulo: string): string {
  return ROTULO_DO_MODULO[modulo] ?? modulo;
}
