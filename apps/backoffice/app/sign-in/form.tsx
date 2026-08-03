"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { type FormEvent, useState } from "react";

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
      <form className="space-y-4" onSubmit={submitTotp}>
        <div className="space-y-2">
          <Label htmlFor="totp">Código do autenticador</Label>
          <Input
            autoComplete="one-time-code"
            id="totp"
            inputMode="numeric"
            maxLength={TOTP_LENGTH}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
            value={totp}
          />
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <Button disabled={pending || totp.length !== TOTP_LENGTH} type="submit">
          {pending ? "Verificando…" : "Verificar"}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={submitCredentials}>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          autoComplete="email"
          id="email"
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          autoComplete="current-password"
          id="password"
          onChange={(e) => setPassword(e.target.value)}
          required
          type="password"
          value={password}
        />
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        disabled={pending || email === "" || password === ""}
        type="submit"
      >
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
