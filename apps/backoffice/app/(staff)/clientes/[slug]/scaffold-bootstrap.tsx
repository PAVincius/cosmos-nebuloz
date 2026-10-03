"use client";

import { useState, useTransition } from "react";
import { bootstrapScaffoldAction } from "@/app/actions/provisioning";
import { Erro, INPUT } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { WriteButton } from "@/components/write-button";

const PAPEL_DO_SCAFFOLD: Record<string, string> = {
  ADMIN: "Administrador",
};

function bootstrapMessage(data: { created: boolean; role: string }) {
  if (data.created) {
    return "Papel de Administrador do Scaffold atribuído.";
  }
  // Quem já tinha papel não é rebaixado nem trocado: a mensagem diz qual é o
  // papel que a pessoa tem, e não supõe que virou ADMIN.
  return `A pessoa já tinha o papel ${PAPEL_DO_SCAFFOLD[data.role] ?? data.role} no Scaffold — nada mudou.`;
}

export function ScaffoldBootstrap({
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
      const result = await bootstrapScaffoldAction({
        slug,
        adminEmail: email,
      });

      if (result.ok) {
        setMessage(bootstrapMessage(result.data));
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
        Dar acesso ao Scaffold
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-nota)",
          color: "var(--ink-subtle)",
          lineHeight: 1.55,
        }}
      >
        Atribui o papel de Administrador do Scaffold e cria as configurações. A
        pessoa precisa já ser membro desta organização. Rodar de novo não troca
        o papel de quem já tem um.
      </p>

      {error ? <Erro>{error}</Erro> : null}
      {message ? <Confirmacao>{message}</Confirmacao> : null}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label className="sr-only" htmlFor="scaffold-admin-email">
          E-mail do administrador do Scaffold
        </label>
        <input
          disabled={!canWrite}
          id="scaffold-admin-email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail do administrador do Scaffold"
          style={INPUT}
          type="email"
          value={email}
        />
        <WriteButton
          aria-label="Dar acesso ao Scaffold a este e-mail"
          canWrite={canWrite}
          disabled={pending || !email.includes("@")}
          onClick={run}
        >
          {pending ? "Atribuindo…" : "Atribuir"}
        </WriteButton>
      </div>
    </div>
  );
}
