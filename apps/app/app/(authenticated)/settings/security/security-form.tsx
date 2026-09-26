"use client";

import { authClient } from "@repo/auth/client";
import { MIN_PASSWORD_LENGTH } from "@repo/auth/password-policy";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

export function SecurityForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);

    // `changePassword` não lança em senha atual incorreta — devolve `{ error }`
    // (mesma convenção documentada em packages/auth/client.ts para chamadas
    // do Better Auth que não lançam em falha de credencial).
    //
    // `revokeOtherSessions: true` — sem isso, uma sessão roubada sobrevive à
    // troca de senha. O better-auth derruba todas as sessões e recria só a
    // atual (novo token, cookie setado na resposta), então quem está aqui
    // continua logado e qualquer outro dispositivo/sessão cai.
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error.message ?? "Não foi possível trocar a senha.");
      return;
    }

    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
  };

  return (
    <form className="max-w-sm space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <label className="font-medium text-sm" htmlFor="currentPassword">
          Senha atual
        </label>
        <input
          autoComplete="current-password"
          className={inputClass}
          id="currentPassword"
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          type="password"
          value={currentPassword}
        />
      </div>

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

      {success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5">
          <p className="text-green-700 text-sm dark:text-green-400">
            Senha alterada com sucesso.
          </p>
        </div>
      )}

      <button
        className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canSubmit}
        type="submit"
      >
        {loading ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
