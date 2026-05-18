"use client";

import { authClient } from "@repo/auth/client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (password.length === 0) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Fraca", color: "#ef4444" };
  if (score <= 2) return { score, label: "Razoável", color: "#f97316" };
  if (score <= 3) return { score, label: "Boa", color: "#eab308" };
  return { score, label: "Forte", color: "#22c55e" };
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

type Props = {
  invitationId: string;
  email: string;
  workspaceName: string;
};

export function AcceptInviteForm({ invitationId, email, workspaceName }: Props) {
  const params = useParams();
  const token = params.token as string;

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = getPasswordStrength(password);
  const passwordsMatch = password === confirm;
  const canSubmit =
    name.trim().length >= 2 &&
    password.length >= 8 &&
    passwordsMatch &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const result = await authClient.signUp.email({
      name: name.trim(),
      email,
      password,
      callbackURL: `/invite/${token}/complete`,
    });

    if (result?.error) {
      const msg = result.error.message ?? "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists") || msg.toLowerCase().includes("único")) {
        setError("Já existe uma conta com este email. Faça login para aceitar o convite.");
      } else {
        setError(msg || "Erro ao criar conta. Tente novamente.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace badge */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Convite para</p>
        <p className="mt-0.5 text-base font-bold text-foreground">{workspaceName}</p>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Criar sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Complete o cadastro para aceitar o convite.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="name">
            Nome completo
          </label>
          <input
            id="name"
            type="text"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoComplete="name"
            autoFocus
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              className={`${inputClass} bg-muted text-muted-foreground cursor-not-allowed pr-20`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              CONVITE
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="password">
            Criar senha
          </label>
          <input
            id="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            autoComplete="new-password"
            required
            minLength={8}
          />
          {password.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor:
                        i <= Math.ceil((strength.score / 5) * 4)
                          ? strength.color
                          : "hsl(var(--border))",
                    }}
                  />
                ))}
              </div>
              <p className="text-xs" style={{ color: strength.color }}>
                {strength.label}
                {strength.score <= 2 && " — adicione maiúsculas, números e símbolos"}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="confirm">
            Confirmar senha
          </label>
          <input
            id="confirm"
            type="password"
            placeholder="Repita a senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`${inputClass} ${
              confirm.length > 0 && !passwordsMatch ? "border-destructive focus:ring-destructive" : ""
            }`}
            autoComplete="new-password"
            required
          />
          {confirm.length > 0 && !passwordsMatch && (
            <p className="text-xs text-destructive">Senhas não coincidem</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <p className="text-sm text-destructive">{error}</p>
            {error.includes("login") && (
              <Link
                href={`/sign-in?email=${encodeURIComponent(email)}&invite=${invitationId}`}
                className="mt-1 block text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Fazer login →
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Criando conta…" : "Criar conta e aceitar convite"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Ao criar uma conta você concorda com os{" "}
        <a href="/terms" className="underline underline-offset-2">Termos de Uso</a>.
      </p>
    </div>
  );
}
