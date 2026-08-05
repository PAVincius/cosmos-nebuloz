"use client";

import { authClient } from "@repo/auth/client";
import type { FormEvent } from "react";
import { useState } from "react";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";

const TOTP_LENGTH = 6;

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recarrega em vez de navegar pelo router: o cookie de sessão acabou de ser
  // emitido e quem precisa lê-lo é o servidor, no guard do layout.
  const enter = () => window.location.assign("/");

  const submitCredentials = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
    });

    if (result.error) {
      setError("E-mail ou senha incorretos.");
      setPending(false);
      return;
    }

    // Com 2FA ligada a chamada acima devolve sucesso sem criar sessão. Seguir
    // em frente aqui mandaria o usuário para uma tela que vai recusá-lo.
    const data = result.data as unknown as {
      twoFactorRedirect?: boolean;
    } | null;
    if (data?.twoFactorRedirect) {
      setNeedsTotp(true);
      setPending(false);
      return;
    }

    enter();
  };

  const submitTotp = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = (await authClient.twoFactor.verifyTotp({ code: totp })) as {
      error?: { message?: string } | null;
    } | null;

    if (result?.error) {
      setError("Código inválido. Confira o aplicativo autenticador.");
      setPending(false);
      return;
    }

    enter();
  };

  if (needsTotp) {
    return (
      <form
        onSubmit={submitTotp}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <Campo htmlFor="totp" label="Código do autenticador">
          <input
            autoComplete="one-time-code"
            className="mono"
            id="totp"
            inputMode="numeric"
            maxLength={TOTP_LENGTH}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
            style={{ ...INPUT, letterSpacing: ".3em", textAlign: "center" }}
            value={totp}
          />
        </Campo>

        {error ? <Erro>{error}</Erro> : null}

        <BotaoPrimario disabled={pending || totp.length !== TOTP_LENGTH}>
          {pending ? "Verificando" : "Verificar"}
        </BotaoPrimario>
      </form>
    );
  }

  return (
    <form
      onSubmit={submitCredentials}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <Campo htmlFor="email" label="E-mail">
        <input
          autoComplete="email"
          id="email"
          onChange={(e) => setEmail(e.target.value)}
          required
          style={INPUT}
          type="email"
          value={email}
        />
      </Campo>

      <Campo htmlFor="password" label="Senha">
        <input
          autoComplete="current-password"
          id="password"
          onChange={(e) => setPassword(e.target.value)}
          required
          style={INPUT}
          type="password"
          value={password}
        />
      </Campo>

      {error ? <Erro>{error}</Erro> : null}

      <BotaoPrimario disabled={pending || email === "" || password === ""}>
        {pending ? "Entrando" : "Entrar"}
      </BotaoPrimario>
    </form>
  );
}
