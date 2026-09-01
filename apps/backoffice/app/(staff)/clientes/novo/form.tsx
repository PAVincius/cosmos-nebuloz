"use client";

import type { ProductModule } from "@repo/database";
import { Badge } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { provisionTenantAction } from "@/app/actions/provisioning";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";

export function NewClientForm({ modulos }: { modulos: ProductModule[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  // COSMOS é o default histórico do provisionamento; se um dia sair do enum,
  // cai no primeiro que existir em vez de deixar o form sem nada marcado.
  const [selected, setSelected] = useState<string[]>(
    modulos.includes("COSMOS") ? ["COSMOS"] : modulos.slice(0, 1)
  );
  const [pendingOwner, setPendingOwner] = useState<{
    slug: string;
    email: string;
  } | null>(null);

  const toggle = (module: string) =>
    setSelected((prev) =>
      prev.includes(module)
        ? prev.filter((m) => m !== module)
        : [...prev, module]
    );

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await provisionTenantAction({
        name,
        ownerEmail,
        modules: selected.map((module) => ({
          module: module as ProductModule,
          status: "ACTIVE" as const,
        })),
      });

      if (result.ok) {
        if (result.data.ownerLinked) {
          router.push(`/clientes/${result.data.slug}`);
          return;
        }
        // Sem conta no e-mail informado, o cliente nasce sem dono e só o convite
        // espera. Redirecionar em silêncio faria quem provisionou acreditar que
        // já tem alguém capaz de entrar.
        setPendingOwner({ slug: result.data.slug, email: ownerEmail.trim() });
        return;
      }
      setError(result.error);
    });

  return (
    <div
      style={{
        maxWidth: 520,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {error ? <Erro>{error}</Erro> : null}

      {pendingOwner ? (
        <output
          style={{
            display: "block",
            padding: 14,
            borderRadius: "var(--r-md)",
            background: "var(--amber-soft)",
            border: "1px solid rgba(var(--amber-rgb),.3)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-base)",
              fontWeight: 700,
              color: "var(--amber-text)",
            }}
          >
            Cliente criado sem dono
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "var(--fs-base)",
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            {pendingOwner.email} ainda não tem conta. O convite ficou pendente:
            ninguém consegue entrar neste cliente até alguém aceitá-lo.
          </p>
          <Link
            href={`/clientes/${pendingOwner.slug}`}
            style={{
              display: "inline-block",
              marginTop: 9,
              fontSize: "var(--fs-base)",
              fontWeight: 700,
              color: "var(--accent-text)",
            }}
          >
            Abrir {pendingOwner.slug}
          </Link>
        </output>
      ) : null}

      <Campo htmlFor="name" label="Nome da organização">
        <input
          id="name"
          onChange={(e) => setName(e.target.value)}
          style={INPUT}
          value={name}
        />
      </Campo>

      <Campo
        hint="Se ainda não tiver conta, o cliente nasce sem dono e o convite fica pendente."
        htmlFor="ownerEmail"
        label="E-mail do responsável"
      >
        <input
          id="ownerEmail"
          onChange={(e) => setOwnerEmail(e.target.value)}
          style={INPUT}
          type="email"
          value={ownerEmail}
        />
      </Campo>

      <fieldset
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-md)",
          padding: "12px 14px",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 9,
        }}
      >
        <legend
          className="mono"
          style={{
            fontSize: "var(--fs-micro)",
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
            padding: "0 6px",
          }}
        >
          Módulos contratados
        </legend>
        {modulos.map((module) => (
          <label
            key={module}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              fontSize: "var(--fs-base)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <input
              checked={selected.includes(module)}
              onChange={() => toggle(module)}
              type="checkbox"
            />
            <Badge tone={selected.includes(module) ? "green" : "neutral"}>
              {module}
            </Badge>
          </label>
        ))}
      </fieldset>

      <BotaoPrimario
        disabled={pending || name.trim().length < 2}
        full={false}
        onClick={submit}
        rotulo="Provisionar cliente"
        type="button"
      >
        {pending ? "Provisionando…" : "Provisionar cliente"}
      </BotaoPrimario>
    </div>
  );
}
