import "server-only";
import { redirectToSignIn } from "@repo/auth/server";
import {
  type PlatformStaff,
  requirePlatformStaff,
  StaffAuthError,
} from "./guard";
import { RateLimitError } from "./rate-limit";

/** Os desfechos que o layout sabe desenhar. Sessão ausente não aparece aqui de
 *  propósito: ela não vira mensagem, vira redirect. */
export type StaffAccess =
  | { status: "ok"; staff: PlatformStaff }
  | { status: "forbidden"; message: string }
  | { status: "rate_limited"; message: string };

/**
 * Traduz o guard para o que uma página pode renderizar.
 *
 * Os dois casos que o `requirePlatformStaff` distingue têm respostas opostas:
 * quem não tem sessão precisa de um lugar para entrar; quem já entrou e não é
 * da equipe precisa saber disso. Tratar os dois como um só devolve o segundo
 * ao login que ele acabou de passar — e o laço não fecha nunca.
 */
export async function resolveStaffAccess(): Promise<StaffAccess> {
  try {
    return { status: "ok", staff: await requirePlatformStaff() };
  } catch (error) {
    // Fora do `try`: `redirect` funciona lançando, e engolir esse throw aqui
    // devolveria a página em branco que este trabalho veio remover.
    if (error instanceof StaffAuthError && error.code === "UNAUTHORIZED") {
      redirectToSignIn();
    }
    if (error instanceof StaffAuthError && error.code === "FORBIDDEN") {
      return { status: "forbidden", message: error.message };
    }
    // Estourar o teto não é falta de permissão, e desenhar como se fosse faria
    // a pessoa achar que perdeu acesso ao painel. Desfecho próprio, título
    // próprio: o que ela precisa saber é que basta esperar.
    if (error instanceof RateLimitError) {
      return { status: "rate_limited", message: error.message };
    }
    throw error;
  }
}
