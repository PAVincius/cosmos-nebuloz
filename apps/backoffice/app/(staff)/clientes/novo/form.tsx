"use client";

import type { ProductModule } from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { slugify } from "@repo/provisioning/src/slug";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { provisionTenantAction } from "@/app/actions/provisioning";
import { Campo, Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { MOTIVO_SOMENTE_LEITURA, WriteButton } from "@/components/write-button";

/**
 * Formulário de provisionamento.
 *
 * O status inicial por módulo é do handoff e não é enfeite: `provisionTenant`
 * aceita `ACTIVE` e `TRIAL`, e sem isto a única forma de nascer em trial era
 * provisionar ativo e corrigir o status na tela seguinte — duas escritas e duas
 * linhas de auditoria para uma decisão só.
 */

type StatusInicial = "ACTIVE" | "TRIAL";

const ROTULO_STATUS: Record<StatusInicial, string> = {
  ACTIVE: "Ativo",
  TRIAL: "Trial",
};

export function NewClientForm({
  modulos,
  canWrite,
}: {
  modulos: ProductModule[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  // COSMOS é o default histórico do provisionamento; se um dia sair do enum,
  // cai no primeiro que existir em vez de deixar o form sem nada marcado.
  const [status, setStatus] = useState<Record<string, StatusInicial>>(() => {
    const inicial = modulos.includes("COSMOS") ? "COSMOS" : modulos[0];
    return inicial ? { [inicial]: "ACTIVE" } : {};
  });
  const [pendingOwner, setPendingOwner] = useState<{
    slug: string;
    email: string;
  } | null>(null);

  // Ativo → Trial → fora, como no desenho. Um clique só percorre os três
  // estados; um checkbox não teria como expressar o do meio.
  const alternar = (module: string) =>
    setStatus((prev) => {
      const atual = prev[module];
      if (atual === undefined) {
        return { ...prev, [module]: "ACTIVE" };
      }
      if (atual === "ACTIVE") {
        return { ...prev, [module]: "TRIAL" };
      }
      return Object.fromEntries(
        Object.entries(prev).filter(([m]) => m !== module)
      );
    });

  const escolhidos = Object.entries(status);
  // O mesmo `slugify` do `provisionTenant`, não uma segunda cópia: as duas
  // divergiriam no primeiro acento ou nome longo, e a pessoa leria aqui um
  // slug que o banco não guardaria.
  const slug = slugify(name);
  const podeEnviar =
    canWrite && !pending && name.trim().length >= 2 && escolhidos.length > 0;

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await provisionTenantAction({
        name,
        ownerEmail,
        modules: escolhidos.map(([module, statusInicial]) => ({
          module: module as ProductModule,
          status: statusInicial,
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
        display: "flex",
        flexDirection: "column",
        gap: "var(--gap)",
      }}
    >
      {canWrite ? null : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "11px 14px",
            borderRadius: "var(--r-md)",
            border: "1px solid rgba(var(--amber-rgb),.35)",
            background: "var(--amber-soft)",
          }}
        >
          <Icon
            name="alert"
            size={15}
            style={{ color: "var(--amber-text)", flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: "var(--fs-base)",
              color: "var(--amber-text)",
              fontWeight: 600,
            }}
          >
            {MOTIVO_SOMENTE_LEITURA}
          </span>
        </div>
      )}

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

      <SectionCard
        bodyStyle={{ display: "flex", flexDirection: "column", gap: 16 }}
        icon="building"
        title="Dados do tenant"
      >
        <Campo
          hint={
            slug
              ? `slug gerado: ${slug} — se já existir, o servidor acrescenta sufixo numérico`
              : "o slug sai do nome, único por construção"
          }
          htmlFor="name"
          label="Nome da organização"
        >
          <input
            disabled={!canWrite}
            id="name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Atlas Energia"
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
            disabled={!canWrite}
            id="ownerEmail"
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="dono@cliente.com.br"
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
          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-nota)",
              color: "var(--ink-faint)",
              fontWeight: 500,
            }}
          >
            O clique alterna: Ativo → Trial → fora. Entram já com o status
            escolhido.
          </p>
          {modulos.map((module) => {
            const atual = status[module];
            return (
              <button
                aria-pressed={atual !== undefined}
                className="btn"
                disabled={!canWrite}
                key={module}
                onClick={() => alternar(module)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "var(--r-md)",
                  border: `1px solid ${atual ? "rgba(var(--accent-rgb),.4)" : "var(--hairline)"}`,
                  background: atual ? "var(--accent-soft)" : "var(--surface-2)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: "var(--fs-base)",
                  fontWeight: 700,
                  opacity: canWrite ? 1 : 0.6,
                  cursor: canWrite ? "pointer" : "not-allowed",
                }}
                type="button"
              >
                <span style={{ flex: 1 }}>{module}</span>
                {atual ? (
                  <Badge dot tone={atual === "ACTIVE" ? "green" : "blue"}>
                    {ROTULO_STATUS[atual]}
                  </Badge>
                ) : (
                  <span
                    style={{
                      fontSize: "var(--fs-nota)",
                      color: "var(--ink-faint)",
                      fontWeight: 600,
                    }}
                  >
                    fora
                  </span>
                )}
              </button>
            );
          })}
        </fieldset>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {/* Provisionar chega ao cliente em segundos e não tem desfazer — é
              o caso que `ConfirmarAcao` cita no próprio comentário. O alvo é
              o slug ao vivo: se o nome saiu errado, é aqui que se vê. */}
          {canWrite ? (
            <ConfirmarAcao
              alvo={slug || "—"}
              consequencia="O cliente ganha acesso em segundos; módulos marcados nascem ativos."
              desabilitado={!podeEnviar}
              executando={pending}
              onConfirmar={submit}
              rotulo={pending ? "Provisionando…" : "Provisionar tenant"}
              tom="accent"
            />
          ) : (
            <WriteButton canWrite={false}>Provisionar tenant</WriteButton>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
