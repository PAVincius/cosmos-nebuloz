import { type NextRequest, NextResponse } from "next/server";
import { findRespondentByTokenOrThrow } from "@/lib/meridian/respondent-lookup";
import {
  isTokenShape,
  RESPONDENT_COOKIE,
  RESPONDENT_COOKIE_PATH,
  respondentCookieOptions,
} from "@/lib/meridian/respondent-session";

// Primeira carga do link do respondente (achado 28a do Lacre).
//
// O link que a consultoria emite é `/meridian-responder/<token>`, e os já
// emitidos precisam continuar valendo. Esta rota valida o token, o guarda num
// cookie de sessão curta (httpOnly, Secure, SameSite=Lax, expirando com o
// token) e redireciona para `/meridian-responder`, sem token. A página e as
// server actions leem o cookie, então o token só aparece na URL desta única
// requisição, e não em cada GET e cada action dali em diante.
//
// Token inexistente, expirado, revogado ou barrado pelo teto de tentativas
// terminam no mesmo redirecionamento, sem cookie: a página então mostra o texto
// único de "link inválido". Diferenciar confirmaria a um estranho que aquele
// assessment existe.

export const dynamic = "force-dynamic";

const redirectTo = (request: NextRequest | Request) => {
  const res = NextResponse.redirect(
    new URL(RESPONDENT_COOKIE_PATH, request.url),
    303
  );
  // Nada de cachear a troca, e o endereço do link não vai como referrer.
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const res = redirectTo(request);
  if (!isTokenShape(token)) {
    return res;
  }
  try {
    const respondent = await findRespondentByTokenOrThrow(token);
    res.cookies.set(
      RESPONDENT_COOKIE,
      token,
      respondentCookieOptions(respondent.tokenExpiresAt)
    );
  } catch {
    // Mesma resposta de todos os desfechos: o redirecionamento sem cookie.
  }
  return res;
}
