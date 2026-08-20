"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * O que o cliente do better-auth devolve no campo `error`.
 *
 * Nulo em sucesso. As chamadas de 2FA **não lançam** em falha de credencial ou
 * de código — devolvem aqui. Quem trata só com `try/catch` deixa passar o caso
 * mais comum: `apps/backoffice/app/sign-in/form.tsx` acerta checando
 * `result?.error`, e o wizard de onboarding errava por não checar.
 */
export type RespostaDeErro = {
  message?: string;
  code?: string;
  status?: number;
} | null;

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
}) as unknown as ReturnType<typeof createAuthClient> & {
  twoFactor: {
    enable: (opts: { password: string }) => Promise<{
      data: { totpURI: string; backupCodes: string[] } | null;
      error: RespostaDeErro;
    }>;
    disable: (opts: { password: string }) => Promise<{
      data: unknown;
      error: RespostaDeErro;
    }>;
    /** `trustDevice` é opcional na lib e o padrão dela é `true` — 30 dias de
     *  dispositivo confiável. Está no tipo para que omitir seja escolha
     *  visível de quem chama, não herança silenciosa. */
    verifyTotp: (opts: { code: string; trustDevice?: boolean }) => Promise<{
      data: unknown;
      error: RespostaDeErro;
    }>;
  };
};

export const { signIn, signOut, signUp, useSession, getSession } = authClient;
