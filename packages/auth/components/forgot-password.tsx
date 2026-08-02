"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "../client";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await authClient.requestPasswordReset({
      email: email.trim().toLowerCase(),
      redirectTo: "/reset-password",
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error.message ?? "Erro ao enviar email.");
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          Esqueci minha senha
        </h1>
        <p className="text-muted-foreground text-sm">
          Informe seu email e enviaremos um link para redefinir sua senha.
        </p>
      </div>

      {sent ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-center">
          <p className="text-green-700 text-sm dark:text-green-400">
            Email enviado! Verifique sua caixa de entrada.
          </p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="font-medium text-sm" htmlFor="email">
              Email
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

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <button
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!email || loading}
            type="submit"
          >
            {loading ? "Enviando…" : "Enviar link de redefinição"}
          </button>
        </form>
      )}

      <p className="text-center text-muted-foreground text-sm">
        Lembrou a senha?{" "}
        <Link
          className="font-medium text-primary underline-offset-4 hover:underline"
          href="/sign-in"
        >
          Voltar para o login
        </Link>
      </p>
    </div>
  );
};
