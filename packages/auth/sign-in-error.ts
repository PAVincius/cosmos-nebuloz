import type { RespostaDeErro } from "./client";

export const SENHA_INCORRETA = "Email ou senha incorretos.";

export const EMAIL_NAO_VERIFICADO =
  "Confirme seu e-mail para entrar. Enviamos um novo link de confirmação para a sua caixa de entrada.";

/**
 * Mensagem de falha do login.
 *
 * Com `requireEmailVerification`, o better-auth só responde EMAIL_NOT_VERIFIED
 * depois de conferir a senha — então este aviso não revela a ninguém que o
 * e-mail existe sem saber a senha. Todo outro erro segue genérico.
 */
export function signInErrorMessage(error: RespostaDeErro): string {
  return error?.code === "EMAIL_NOT_VERIFIED"
    ? EMAIL_NAO_VERIFICADO
    : SENHA_INCORRETA;
}
