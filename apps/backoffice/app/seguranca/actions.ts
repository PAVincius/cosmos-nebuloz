"use server";

import { database } from "@repo/database";
import { requirePlatformStaffSemSegundoFator } from "@/lib/guard";

/**
 * Encerra todas as sessões da pessoa que acabou de cadastrar o 2FA.
 *
 * É o que fecha o buraco real do segundo fator: sessões abertas **antes** do
 * cadastro nunca viram desafio de TOTP e sobreviveriam a ele com o mesmo poder
 * de sempre — inclusive em outros navegadores, onde `signOut` não alcança.
 * Procurar um carimbo na sessão não resolvia isso (o better-auth 1.6.26 não
 * carimba nada); encerrar resolve.
 *
 * Todas, inclusive a atual, porque a tela manda para o login logo em seguida e
 * é justamente esse login que passa pelo autenticador. Assim não sobra dúvida
 * sobre qual sessão nasceu antes e qual nasceu depois do cadastro.
 *
 * Sem gate de 2FA no guard: por definição quem chama isto ainda está
 * cadastrando o segundo fator.
 */
export async function encerrarTodasAsSessoes(): Promise<{
  encerradas: number;
}> {
  const staff = await requirePlatformStaffSemSegundoFator();

  const { count } = await database.session.deleteMany({
    where: { userId: staff.userId },
  });
  return { encerradas: count };
}
