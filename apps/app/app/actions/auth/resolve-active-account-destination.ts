"use server";

import { resolvePostLoginDestination } from "@/app/(authenticated)/_lib/resolve-post-login-destination";
import { safeAction } from "../_base";

/**
 * Fina — envolve resolvePostLoginDestination() para o cliente chamar depois
 * de confirmar uma troca de conta (FR-006, spec 009): o destino pós-troca é
 * a mesma decisão do destino pós-login (catálogo para tenant interno,
 * produto contratado para os demais), não um destino novo.
 */
export async function resolveActiveAccountDestination() {
  return safeAction(() => resolvePostLoginDestination());
}
