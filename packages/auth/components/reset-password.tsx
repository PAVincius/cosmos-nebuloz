"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "../client";
import { MIN_PASSWORD_LENGTH } from "../password-policy";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

export const ResetPassword = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);

    const result = await authClient.resetPassword({ newPassword, token });

    setLoading(false);

    if (result?.error) {
      setError(result.error.message ?? "Não foi possível redefinir a senha.");
      return;
    }

    setDone(true);
  };

  if (!token || linkError) {
    return (
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">
            Link inválido ou expirado
          </h1>
          <p className="text-muted-foreground text-sm">
            Este link de redefinição de senha não é mais válido. Solicite um
            novo.
          </p>
        </div>
        <Link
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-center font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90"
          href="/forgot-password"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="font-semibold text-2xl tracking-tight">
            Senha redefinida
          </h1>
          <p className="text-muted-foreground text-sm">
            Sua senha foi alterada. Você já pode entrar com ela.
          </p>
        </div>
        <Link
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-center font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90"
          href="/sign-in"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          Definir nova senha
        </h1>
        <p className="text-muted-foreground text-sm">
          Escolha uma nova senha para sua conta.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="font-medium text-sm" htmlFor="newPassword">
            Nova senha
          </label>
          <input
            autoComplete="new-password"
            className={inputClass}
            id="newPassword"
            minLength={MIN_PASSWORD_LENGTH}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            required
            type="password"
            value={newPassword}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        <button
          className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={newPassword.length < MIN_PASSWORD_LENGTH || loading}
          type="submit"
        >
          {loading ? "Salvando…" : "Redefinir senha"}
        </button>
      </form>
    </div>
  );
};
