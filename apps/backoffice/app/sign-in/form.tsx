"use client";

import { authClient } from "@repo/auth/client";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useState } from "react";

const TOTP_LENGTH = 6;

/**
 * Campo e input do `backoffice-shell.jsx` (BoField / boInputStyle).
 *
 * O botão é `<button type="submit">` nativo, não o `Button` do kit: aquele não
 * aceita `type` nem `disabled`, então dentro de um form ele não submete e não
 * trava durante o envio. O visual é o da variante primary, copiado do kit.
 */
const INPUT: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-md)",
  padding: "10px 12px",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
  outline: "none",
  width: "100%",
};

function Campo({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        className="mono"
        htmlFor={htmlFor}
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Enviar({
  pending,
  disabled,
  children,
}: {
  pending: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className="btn"
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "9px 15px",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "inherit",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--accent)",
        background: "var(--accent)",
        color: "var(--accent-fg)",
        width: "100%",
        boxShadow:
          "0 1px 2px rgba(var(--accent-rgb),.4), 0 6px 16px -8px rgba(var(--accent-rgb),.6)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      type="submit"
    >
      {pending ? "…" : null}
      {children}
    </button>
  );
}

function Erro({ children }: { children: string }) {
  return (
    <p
      role="alert"
      style={{
        margin: 0,
        padding: "9px 11px",
        borderRadius: "var(--r-md)",
        background: "var(--red-soft)",
        border: "1px solid rgba(var(--red-rgb),.3)",
        color: "var(--red-text)",
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  );
}

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

        <Enviar
          disabled={pending || totp.length !== TOTP_LENGTH}
          pending={pending}
        >
          {pending ? "Verificando" : "Verificar"}
        </Enviar>
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

      <Enviar
        disabled={pending || email === "" || password === ""}
        pending={pending}
      >
        {pending ? "Entrando" : "Entrar"}
      </Enviar>
    </form>
  );
}
