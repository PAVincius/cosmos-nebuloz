"use client";

import Link from "next/link";

type Props = {
  /** Endereço para onde o link foi enviado. */
  email: string;
  /** Preenchido no convite: o aceite só termina depois da confirmação. */
  workspaceName?: string;
};

/**
 * Tela de "cadastro enviado".
 *
 * Com `requireEmailVerification` o cadastro não abre sessão: o better-auth
 * responde `token: null` e a pessoa só entra ao clicar no link do e-mail. O
 * formulário não tem para onde redirecionar, então mostra este aviso.
 */
export function VerifyEmailNotice({ email, workspaceName }: Props) {
  return (
    <div className="space-y-4 text-center">
      <h1 className="font-bold text-2xl tracking-tight">
        Verifique seu e-mail
      </h1>
      <p className="text-muted-foreground text-sm">
        Enviamos um link de confirmação para{" "}
        <strong className="text-foreground">{email}</strong>. Abra o e-mail e
        clique no link para ativar a conta
        {workspaceName ? ` e entrar em ${workspaceName}` : ""}.
      </p>
      <p className="text-muted-foreground text-xs">
        Não chegou? Olhe a caixa de spam. Se o link expirar, tente entrar com o
        seu e-mail e senha: enviamos um novo.
      </p>
      {workspaceName ? (
        <p className="text-muted-foreground text-xs">
          Já tem conta no Nebuloz com este e-mail? Entre e abra o convite de
          novo: o cadastro não cria uma segunda conta.
        </p>
      ) : null}
      <Link
        className="inline-block font-medium text-primary text-sm underline-offset-4 hover:underline"
        href="/sign-in"
      >
        Ir para o login
      </Link>
    </div>
  );
}
