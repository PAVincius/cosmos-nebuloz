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
  const [confiarNoDispositivo, setConfiarNoDispositivo] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recarrega em vez de navegar pelo router: o cookie de sessão acabou de ser
  // emitido e quem precisa lê-lo é o servidor, no guard do layout.
  //
  // A trilha de acesso (FR-30) não passa por aqui: a rota de auth grava o
  // desfecho do login no servidor (lib/registro-de-acesso.ts).
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

    // `trustDevice` explícito, e desmarcado por padrão. O padrão da lib é
    // `true` — 30 dias sem pedir segundo fator. Omitir o campo herdava isso
    // sem ninguém ter decidido, num painel que provisiona tenant e lê a
    // auditoria de todos os clientes.
    const result = (await authClient.twoFactor.verifyTotp({
      code: totp,
      trustDevice: confiarNoDispositivo,
    })) as {
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

        <label
          htmlFor="confiar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--fs-base)",
            color: "var(--ink-muted)",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <input
            checked={confiarNoDispositivo}
            id="confiar"
            onChange={(e) => setConfiarNoDispositivo(e.target.checked)}
            type="checkbox"
          />
          Confiar neste dispositivo por 30 dias
        </label>

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
