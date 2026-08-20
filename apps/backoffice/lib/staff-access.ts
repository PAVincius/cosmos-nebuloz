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
  /** Recusa com saída própria: a pessoa é da equipe, só não cadastrou o
   *  autenticador. Desfecho separado porque a ação é cadastrar, e oferecer
   *  "entrar com outra conta" aqui manda a pessoa para o mesmo lugar de novo. */
  | { status: "sem_2fa"; message: string }
  /** Cadastrou o 2FA, mas a sessão atual é anterior ao cadastro. A saída é
   *  encerrar a sessão — nem cadastrar de novo, nem trocar de conta. */
  | { status: "sessao_sem_2fa"; message: string }
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
      if (error.motivo === "SEM_SEGUNDO_FATOR") {
        return { status: "sem_2fa", message: error.message };
      }
      if (error.motivo === "SESSAO_SEM_SEGUNDO_FATOR") {
        return { status: "sessao_sem_2fa", message: error.message };
      }
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
