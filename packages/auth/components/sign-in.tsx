"use client";

import Link from "next/link";
import { useState } from "react";
import {
  logLoginFailure,
  logLoginSuccess,
  logMfaFailed,
  logMfaVerified,
} from "../auth-events";
import { authClient } from "../client";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-4 focus:ring-[#5e6ad2]/15 focus:border-[#5e6ad2] transition-colors";

/** Micro-label em mono: mesma família dos rótulos do rail de cadência no painel. */
const labelClass =
  "font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground";

const buttonClass =
  "h-11 w-full rounded-lg bg-[#5e6ad2] font-semibold text-sm text-white transition-colors hover:bg-[#4f59c0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5e6ad2]/25 disabled:cursor-not-allowed disabled:opacity-45";

export const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
      callbackURL: "/cosmos/dashboard",
    });

    if (result?.error) {
      const msg = result.error.message ?? "";
      if (
        msg.toLowerCase().includes("two") ||
        msg.toLowerCase().includes("otp") ||
        msg.toLowerCase().includes("2fa")
      ) {
        setStep("totp");
      } else {
        setError("Email ou senha incorretos.");
        await logLoginFailure(email.trim().toLowerCase());
      }
      setLoading(false);
      return;
    }

    await logLoginSuccess(email.trim().toLowerCase());
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await authClient.twoFactor.verifyTotp({ code: totpCode });
      await logMfaVerified();
    } catch {
      setError("Código inválido. Verifique seu aplicativo autenticador.");
      await logMfaFailed();
      setLoading(false);
    }
  };

  if (step === "totp") {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="font-display font-semibold text-3xl tracking-[-0.02em]">
            Verificação em duas etapas
          </h1>
          <p className="text-muted-foreground text-sm">
            Digite o código de 6 dígitos do seu aplicativo autenticador.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleTotp}>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="totp">
              Código do autenticador
            </label>
            <input
              autoFocus
              className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.4em]`}
              id="totp"
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              pattern="[0-9]{6}"
              placeholder="000000"
              required
              type="text"
              value={totpCode}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <button
            className={buttonClass}
            disabled={totpCode.length !== 6 || loading}
            type="submit"
          >
            {loading ? "Verificando…" : "Verificar"}
          </button>

          <button
            className="w-full text-center text-muted-foreground text-sm transition-colors hover:text-foreground"
            onClick={() => {
              setStep("credentials");
              setError(null);
            }}
            type="button"
          >
            ← Voltar para o login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display font-semibold text-3xl tracking-[-0.02em]">
          Entrar
        </h1>
        <p className="text-muted-foreground text-sm">
          Use o e-mail da sua organização.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleCredentials}>
        <div className="space-y-2">
          <label className={labelClass} htmlFor="email">
            E-mail
          </label>
          <input
            autoComplete="email"
            className={inputClass}
            id="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="bia@empresa.com"
            required
            type="email"
            value={email}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className={labelClass} htmlFor="password">
              Senha
            </label>
            <Link
              className="text-[#5e6ad2] text-xs underline-offset-4 transition-colors hover:underline"
              href="/forgot-password"
            >
              Esqueci minha senha
            </Link>
          </div>
          <input
            autoComplete="current-password"
            className={inputClass}
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            type="password"
            value={password}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        <button
          className={buttonClass}
          disabled={!(email && password) || loading}
          type="submit"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="border-border border-t pt-6 text-muted-foreground text-sm">
        Não tem conta?{" "}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/sign-up"
        >
          Criar conta
        </Link>
      </p>
    </div>
  );
};
