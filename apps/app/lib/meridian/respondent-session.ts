import "server-only";

import { cookies } from "next/headers";
import { isTokenShape, RESPONDENT_PATH } from "./respondent-link";
import { TOKEN_ERROR } from "./respondent-lookup";

// Sessão curta do respondente (achado 28a do Lacre).
//
// O link novo leva o token no fragmento (`/meridian-responder#t=<token>`, ver
// `respondent-link.ts`), que o navegador não envia ao servidor. A página o lê no
// cliente e o troca por sessão numa server action (`startRespondentSession`,
// POST): o servidor valida e grava o cookie abaixo. Dali em diante página e
// server actions leem o cookie, e o token não aparece em nenhuma URL.
//
// O formato antigo, `/meridian-responder/<token>`, segue valendo até os links já
// emitidos expirarem (16/10/2026): `app/meridian-responder/[token]/route.ts` faz
// a troca no servidor. Esse caminho ainda deixa o token na URL daquela única
// requisição; por isso os links novos não o usam.

export const RESPONDENT_COOKIE = "meridian_resp";
export const RESPONDENT_COOKIE_PATH = RESPONDENT_PATH;

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
