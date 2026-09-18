"use client";

import { useState, useTransition } from "react";
import { bootstrapMeridianAction } from "@/app/actions/provisioning";
import { Erro, INPUT } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { WriteButton } from "@/components/write-button";

export function MeridianBootstrap({
  slug,
  canWrite,
}: {
  slug: string;
  /** SRD FR-0.4 — MEMBER lê o cartão e não prepara nada. O `WriteButton`
   *  desabilita com o motivo em `sr-only`; a action recusa de novo. */
  canWrite: boolean;
}) {
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
      {message ? <Confirmacao>{message}</Confirmacao> : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label className="sr-only" htmlFor="meridian-consultant-email">
          E-mail do consultor de diagnóstico
        </label>
        <input
          disabled={!canWrite}
          id="meridian-consultant-email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail do consultor de diagnóstico"
          style={INPUT}
          type="email"
          value={email}
        />
        <WriteButton
          aria-label="Preparar o Meridian deste cliente"
          canWrite={canWrite}
          disabled={pending || !email.includes("@")}
          onClick={run}
        >
          {pending ? "Preparando…" : "Preparar"}
        </WriteButton>
      </div>
    </div>
  );
}
