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

/** 32 bytes de entropia, em hex. Opaco de propósito: nada no token diz de qual
 *  assessment ou de qual eixo ele é. */
export function issueToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
