"use client";

import { authClient } from "@repo/auth/client";
import { useState } from "react";

/**
 * Encerra a sessão e devolve ao login.
 *
 * Existe para um beco específico: quem cadastra o segundo fator continua com a
 * sessão aberta no sign-in **anterior** ao cadastro, e essa sessão não carrega
 * `twoFactorVerified`. O guard a recusa, corretamente — mas a única saída é
 * encerrar e entrar de novo, e um link para `/sign-in` não encerra nada.
 *
 * Sem isto, a pessoa acaba de cadastrar o autenticador e é recebida por uma
 * parede que parece dizer que o cadastro falhou.
 */
export function SairEEntrar({ rotulo }: { rotulo: string }) {
  const [saindo, setSaindo] = useState(false);

  const sair = async () => {
    setSaindo(true);
    try {
      await authClient.signOut();
    } finally {
      // Navegação dura: o cookie acabou de cair e quem precisa reler é o
      // servidor, no guard do layout.
      window.location.assign("/sign-in");
    }
  };

  return (
    <button
      className="mt-4 inline-block rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground text-sm disabled:opacity-60"
      disabled={saindo}
      onClick={sair}
      type="button"
    >
      {saindo ? "Saindo…" : rotulo}
    </button>
  );
}
