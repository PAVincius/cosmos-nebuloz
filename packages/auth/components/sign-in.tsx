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
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/40 focus:border-[#5e6ad2]/60 transition-colors";

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
      callbackURL: "/dashboard",
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
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-bold text-2xl tracking-tight">Verificação 2FA</h1>
          <p className="text-muted-foreground text-sm">
            Insira o código de 6 dígitos do seu aplicativo autenticador.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleTotp}>
          <div className="space-y-1.5">
            <label className="font-medium text-sm" htmlFor="totp">
              Código de verificação
            </label>
            <input
              autoFocus
              className={`${inputClass} text-center font-mono text-xl tracking-[0.5em]`}
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
            className="w-full rounded-lg bg-[#5e6ad2] px-4 py-2.5 font-semibold text-sm text-white transition-all hover:bg-[#4f59c0] disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Entrar</h1>
        <p className="text-muted-foreground text-sm">
          Acesse seu workspace no Cosmos.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleCredentials}>
        <div className="space-y-1.5">
          <label className="font-medium text-sm" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className={inputClass}
            id="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana@empresa.com"
            required
            type="email"
            value={email}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-medium text-sm" htmlFor="password">
              Senha
            </label>
            <Link
              className="text-muted-foreground text-xs transition-colors hover:text-primary"
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
          className="w-full rounded-lg bg-[#5e6ad2] px-4 py-2.5 font-semibold text-sm text-white transition-all hover:bg-[#4f59c0] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!(email && password) || loading}
          type="submit"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="text-center text-muted-foreground text-sm">
        Não tem conta?{" "}
        <Link
          className="font-medium text-primary underline-offset-4 hover:underline"
          href="/sign-up"
        >
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
};
