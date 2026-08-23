/**
 * Quantas pessoas a cerimônia conta como votantes de um PI.
 *
 * `PIParticipant` é a lista explícita de quem está na sala — e, até aqui,
 * nenhuma tela a escreve: só os scripts de seed. Uma rodada aberta a partir
 * dela nasceria com `participantCount = 0`, e uma participação de 0% nunca
 * alcança o mínimo de 50% exigido para revelar o resultado: a votação ficaria
 * eternamente sem placar, por mais votos que recebesse.
 *
 * Daí o recuo: sem lista explícita, o corpo da cerimônia é quem tem acesso ao
 * workspace — a única lista de gente que o produto de fato mantém. É
 * aproximação declarada, não verdade: no instante em que alguém registrar
 * participantes do PI, a lista explícita volta a mandar.
 *
 * `OBSERVER` fica de fora dos dois lados: observador assiste à cerimônia, não
 * vota, e contá-lo rebaixaria a participação de todo mundo.
 */

import type { database } from "@repo/database";

/** Só as duas contagens do client — o resto do Prisma não interessa aqui. */
export type ContagemDb = Pick<
  typeof database,
  "pIParticipant" | "tenantMember"
>;

export async function contarParticipantesDoPi(
  db: ContagemDb,
  { piPlanId, tenantId }: { piPlanId: string; tenantId: string }
): Promise<number> {
  const registrados = await db.pIParticipant.count({
    where: { piPlanId, tenantId, role: { not: "OBSERVER" } },
  });
  if (registrados > 0) {
    return registrados;
  }
  return db.tenantMember.count({ where: { tenantId } });
}
