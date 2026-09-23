import type { Tone } from "@repo/design-system/cosmos/kit";
import {
  ROTULO_DO_MODULO as MAPA_DO_MODULO,
  rotuloDoModulo as nomeDoModulo,
} from "./rotulo-do-modulo";

/**
 * O nome e o tom de cada enum que aparece na tela — plano do cliente e status
 * de módulo. A carteira mostrava "COSMOS · Ativo" e Contas "vanta · GALAXY":
 * o enum do banco na tela, e cada tela com a sua cópia do mapa.
 *
 * Valor fora do mapa aparece como veio, em tom neutro, em vez de sumir — um
 * plano novo no enum fica feio até ganhar nome, mas fica visível.
 */

/** O nome do módulo mora em `lib/rotulo-do-modulo.ts`; daqui sai junto, para
 *  quem monta uma linha com plano, módulo e status importar de um lugar só.
 *  (Sem `export … from`: o lint do repo proíbe arquivo-barril.) */
export const ROTULO_DO_MODULO = MAPA_DO_MODULO;

export function rotuloDoModulo(modulo: string): string {
  return nomeDoModulo(modulo);
}

export type Rotulo = { rotulo: string; tom: Tone };

/** `SubscriptionPlan` (`packages/database/prisma/schema/tenant.prisma`), do
 *  inicial ao enterprise. O tom sobe junto com o plano. */
const PLANOS: Record<string, Rotulo> = {
  ORBIT: { rotulo: "Orbit", tom: "neutral" },
  GALAXY: { rotulo: "Galaxy", tom: "blue" },
  NEBULA: { rotulo: "Nebula", tom: "purple" },
  UNIVERSE: { rotulo: "Universe", tom: "accent" },
};

/** `ModuleStatus` (`packages/database/prisma/schema/modules.prisma`). */
const STATUS_DO_MODULO: Record<string, Rotulo> = {
  ACTIVE: { rotulo: "Ativo", tom: "green" },
  TRIAL: { rotulo: "Trial", tom: "blue" },
  SUSPENDED: { rotulo: "Suspenso", tom: "amber" },
  CANCELED: { rotulo: "Cancelado", tom: "red" },
};

export function plano(valor: string): Rotulo {
  return PLANOS[valor] ?? { rotulo: valor, tom: "neutral" };
}

export function statusDoModulo(valor: string): Rotulo {
  return STATUS_DO_MODULO[valor] ?? { rotulo: valor, tom: "neutral" };
}
