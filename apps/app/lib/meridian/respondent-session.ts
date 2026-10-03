import "server-only";

import { cookies } from "next/headers";
import { TOKEN_ERROR } from "./respondent-lookup";

// Sessão curta do respondente (achado 28a do Lacre).
//
// O link emitido continua `/meridian-responder/<token>`, e é por isso que os
// já emitidos seguem valendo. Mas o token só viaja na PRIMEIRA carga: o Route
// Handler daquela URL o valida, guarda num cookie e redireciona para
// `/meridian-responder`, sem token. Dali em diante, página e server actions
// leem o cookie — o token deixa de aparecer no caminho de cada requisição, e
// portanto nos runtime logs da Vercel.

export const RESPONDENT_COOKIE = "meridian_resp";
export const RESPONDENT_COOKIE_PATH = "/meridian-responder";

/** Forma que um token aceita antes de qualquer consulta: seguro para cookie e
 *  com tamanho limitado. O emitido é hex de 64; a fixture de E2E não é. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

export const isTokenShape = (value: string): boolean => TOKEN_SHAPE.test(value);

/** httpOnly (o JavaScript da página nunca lê o token), Secure em produção,
 *  SameSite=Lax, só no caminho da bateria, e expira junto com o token. */
export const respondentCookieOptions = (expires: Date) =>
  ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: RESPONDENT_COOKIE_PATH,
    expires,
  }) as const;

/** O token da sessão do respondente. Sem cookie, ou com valor que não tem a
 *  forma de um token, é o mesmo erro de link inválido de qualquer outro caso. */
export async function readRespondentToken(): Promise<string> {
  const value = (await cookies()).get(RESPONDENT_COOKIE)?.value;
  if (!(value && isTokenShape(value))) {
    throw TOKEN_ERROR;
  }
  return value;
}
