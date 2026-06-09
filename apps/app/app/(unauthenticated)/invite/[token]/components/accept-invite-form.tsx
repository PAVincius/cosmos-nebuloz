"use client";

import { authClient } from "@repo/auth/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (password.length === 0) {
    return { score: 0, label: "", color: "" };
  }
  let score = 0;
  if (password.length >= 8) {
    score++;
  }
  if (password.length >= 12) {
    score++;
  }
  if (/[A-Z]/.test(password)) {
    score++;
  }
  if (/[0-9]/.test(password)) {
    score++;
  }
  if (/[^A-Za-z0-9]/.test(password)) {
    score++;
  }

  if (score <= 1) {
    return { score, label: "Fraca", color: "#ef4444" };
  }
  if (score <= 2) {
    return { score, label: "Razoável", color: "#f97316" };
  }
  if (score <= 3) {
    return { score, label: "Boa", color: "#eab308" };
  }
  return { score, label: "Forte", color: "#22c55e" };
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

type Props = {
  invitationId: string;
  email: string;
  workspaceName: string;
};

export function AcceptInviteForm({
  invitationId,
  email,
  workspaceName,
}: Props) {
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
    if (!canSubmit) {
      return;
    }
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
      if (
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("exists") ||
        msg.toLowerCase().includes("único")
      ) {
        setError(
          "Já existe uma conta com este email. Faça login para aceitar o convite."
        );
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
        <p className="font-semibold text-primary text-xs uppercase tracking-widest">
          Convite para
        </p>
        <p className="mt-0.5 font-bold text-base text-foreground">
          {workspaceName}
        </p>
      </div>

      <div className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Criar sua conta</h1>
        <p className="text-muted-foreground text-sm">
          Complete o cadastro para aceitar o convite.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="font-medium text-sm" htmlFor="name">
            Nome completo
          </label>
          <input
            autoComplete="name"
            autoFocus
            className={inputClass}
            id="name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
            required
            type="text"
            value={name}
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-medium text-sm" htmlFor="email">
            Email
          </label>
          <div className="relative">
            <input
              className={`${inputClass} cursor-not-allowed bg-muted pr-20 text-muted-foreground`}
              id="email"
              readOnly
              type="email"
              value={email}
            />
            <span className="-translate-y-1/2 absolute top-1/2 right-3 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-[10px] text-primary">
              CONVITE
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="font-medium text-sm" htmlFor="password">
            Criar senha
          </label>
          <input
            autoComplete="new-password"
            className={inputClass}
            id="password"
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            type="password"
            value={password}
          />
          {password.length > 0 && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    key={i}
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
                {strength.score <= 2 &&
                  " — adicione maiúsculas, números e símbolos"}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="font-medium text-sm" htmlFor="confirm">
            Confirmar senha
          </label>
          <input
            autoComplete="new-password"
            className={`${inputClass} ${
              confirm.length > 0 && !passwordsMatch
                ? "border-destructive focus:ring-destructive"
                : ""
            }`}
            id="confirm"
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha"
            required
            type="password"
            value={confirm}
          />
          {confirm.length > 0 && !passwordsMatch && (
            <p className="text-destructive text-xs">Senhas não coincidem</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <p className="text-destructive text-sm">{error}</p>
            {error.includes("login") && (
              <Link
                className="mt-1 block font-medium text-primary text-xs underline-offset-2 hover:underline"
                href={`/sign-in?email=${encodeURIComponent(email)}&invite=${invitationId}`}
              >
                Fazer login →
              </Link>
            )}
          </div>
        )}

        <button
          className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSubmit}
          type="submit"
        >
          {loading ? "Criando conta…" : "Criar conta e aceitar convite"}
        </button>
      </form>

      <p className="text-center text-muted-foreground text-xs">
        Ao criar uma conta você concorda com os{" "}
        <a className="underline underline-offset-2" href="/terms">
          Termos de Uso
        </a>
        .
      </p>
    </div>
  );
}
