import { createHash, randomBytes } from "node:crypto";
import type { MeridianRespondentStatus } from "@repo/database";

// Link seguro do respondente.
//
// O respondente não tem conta na plataforma: a bateria dele é alcançada por um
// token de uso individual. Duas decisões que parecem detalhe e não são:
//
//   1. Só o hash é persistido. Um dump de banco com tokens em claro daria
//      acesso à bateria de todos os respondentes de todos os assessments.
//   2. Token inexistente, expirado e revogado são indistinguíveis na resposta.
//      Diferenciar diria a um estranho que aquele assessment existe.

// Mensagens dos dois erros que a superfície do respondente devolve —
// definidas aqui, não em respondent.ts ("use server" só permite exportar
// função async), pra `page.tsx` traduzir `res.error` em copy de tela sem
// duplicar o texto exato e arriscar os dois lados descolarem.
export const TOKEN_INVALID_MESSAGE = "Link inválido ou expirado.";
export const TOKEN_RATE_LIMITED_MESSAGE =
  "Muitas tentativas. Aguarde um minuto.";

/** 32 bytes de entropia, em hex. Opaco de propósito: nada no token diz de qual
 *  assessment ou de qual eixo ele é. */
export function issueToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const REEMISSAO_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Expiração do token reemitido: `min(agora + 14 dias, deadline)`, fixada no
 *  momento da reemissão. Nunca recalculada — estender o deadline do
 *  assessment depois não muda a vida do token já reemitido (achado P2 do
 *  Vigia sobre `assignRespondent`, que copia `deadline` direto). */
export function calcularExpiracaoDaReemissao(deadline: Date, now: Date): Date {
  const tetoPadrao = new Date(now.getTime() + REEMISSAO_TTL_MS);
  return tetoPadrao.getTime() < deadline.getTime() ? tetoPadrao : deadline;
}

/** DONE continua utilizável dentro do prazo: o respondente pode querer rever o
 *  que enviou. REVOKED e prazo vencido não — e a UI trata os dois como "link
 *  inválido", sem detalhar qual. */
export function isTokenUsable(
  respondent: { status: MeridianRespondentStatus; tokenExpiresAt: Date },
  now: Date
): boolean {
  if (respondent.status === "REVOKED") {
    return false;
  }
  return respondent.tokenExpiresAt.getTime() > now.getTime();
}
