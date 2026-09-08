"use client";

import { useState, useTransition } from "react";
import { bootstrapMeridianAction } from "@/app/actions/provisioning";
import { BotaoPrimario, Erro, INPUT } from "@/components/campo";

export function MeridianBootstrap({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await bootstrapMeridianAction({
        slug,
        consultantEmail: email,
      });

      if (result.ok) {
        setMessage(
          result.data.created
            ? "Template criado com a bateria dos cinco eixos."
            : "Template já existia — apenas o papel foi garantido."
        );
        return;
      }
      setError(result.error);
    });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 16,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
      }}
    >
      <p style={{ margin: 0, fontSize: "var(--fs-base)", fontWeight: 700 }}>
        Preparar o Meridian
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-nota)",
          color: "var(--ink-subtle)",
          lineHeight: 1.55,
        }}
      >
        Atribui o papel Consultor e cria o template inicial de diagnóstico.
        Rodar de novo não duplica nada.
      </p>

      {error ? <Erro>{error}</Erro> : null}
      {message ? (
        <output
          style={{
            display: "block",
            margin: 0,
            padding: "9px 11px",
            borderRadius: "var(--r-md)",
            background: "var(--green-soft)",
            border: "1px solid rgba(var(--green-rgb),.3)",
            color: "var(--green-text)",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
          }}
        >
          {message}
        </output>
      ) : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label className="sr-only" htmlFor="meridian-consultant-email">
          E-mail do consultor de diagnóstico
        </label>
        <input
          id="meridian-consultant-email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail do consultor de diagnóstico"
          style={INPUT}
          type="email"
          value={email}
        />
        <BotaoPrimario
          disabled={pending || !email.includes("@")}
          full={false}
          onClick={run}
          rotulo="Preparar o Meridian deste cliente"
          type="button"
        >
          {pending ? "Preparando…" : "Preparar"}
        </BotaoPrimario>
      </div>
    </div>
  );
}
