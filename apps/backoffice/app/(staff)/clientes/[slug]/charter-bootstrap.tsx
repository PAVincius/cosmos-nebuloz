"use client";

import { useState, useTransition } from "react";
import { bootstrapCharterAction } from "@/app/actions/provisioning";
import { BotaoPrimario, Erro, INPUT } from "@/components/campo";

export function CharterBootstrap({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await bootstrapCharterAction({
        slug,
        complianceEmail: email,
      });

      if (result.ok) {
        setMessage(
          result.data.created
            ? "Política criada com as nove seções em rascunho."
            : "Política já existia — apenas o papel foi garantido."
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
        Preparar o Charter
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-nota)",
          color: "var(--ink-subtle)",
          lineHeight: 1.55,
        }}
      >
        Atribui o papel Compliance e cria a política inicial. Rodar de novo não
        duplica nada.
      </p>

      {error ? <Erro>{error}</Erro> : null}
      {/* O sucesso ganha a mesma moldura do erro, em verde: sem ela a
          confirmação virava um parágrafo solto e lia como legenda do campo.
          `<output>` traz `role="status"` de fábrica — mesmo padrão do esqueleto
          de carregamento. */}
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
        {/* `sr-only` é a convenção da casa para rótulo invisível — mesma do
            write-button.tsx e da tela de aprovações. */}
        <label className="sr-only" htmlFor="compliance-email">
          E-mail do responsável pelo Compliance
        </label>
        <input
          id="compliance-email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e-mail do responsável pelo Compliance"
          style={INPUT}
          type="email"
          value={email}
        />
        <BotaoPrimario
          disabled={pending || !email.includes("@")}
          full={false}
          onClick={run}
          rotulo="Preparar o Charter deste cliente"
          type="button"
        >
          {pending ? "Preparando…" : "Preparar"}
        </BotaoPrimario>
      </div>
    </div>
  );
}
