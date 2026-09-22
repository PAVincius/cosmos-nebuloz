"use client";

import type { ProductModule } from "@repo/database";
import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge } from "@repo/design-system/cosmos/kit";
import { slugify } from "@repo/provisioning/src/slug";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { provisionTenantAction } from "@/app/actions/provisioning";
import { Campo, Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { OQueFalta } from "@/components/o-que-falta";
import { Secao } from "@/components/secao";
import { MOTIVO_SOMENTE_LEITURA, WriteButton } from "@/components/write-button";
import { useAvisoAoSair } from "@/lib/rascunho-sujo";
import { rotuloDoModulo } from "@/lib/rotulo-do-modulo";

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

/** As três escolhas por módulo. "" é fora: o módulo não entra no payload. */
const OPCOES_DE_STATUS: { valor: StatusInicial | ""; rotulo: string }[] = [
  { valor: "ACTIVE", rotulo: ROTULO_STATUS.ACTIVE },
  { valor: "TRIAL", rotulo: ROTULO_STATUS.TRIAL },
  { valor: "", rotulo: "Fora" },
];

/** COSMOS é o default histórico do provisionamento; se um dia sair do enum,
 *  cai no primeiro que existir em vez de deixar o form sem nada marcado. */
function statusPadrao(modulos: ProductModule[]): Record<string, StatusInicial> {
  const inicial = modulos.includes("COSMOS") ? "COSMOS" : modulos[0];
  return inicial ? { [inicial]: "ACTIVE" } : {};
}

/** O submit cinza diz por quê — só o que ainda falta, para a frase
 *  encurtar conforme o formulário se completa. */
function oQueFaltaParaProvisionar(
  nomeValido: boolean,
  temModulo: boolean
): string[] {
  const falta: string[] = [];
  if (!nomeValido) {
    falta.push("nome com 2+ letras");
  }
  if (!temModulo) {
    falta.push("ao menos um módulo");
  }
  return falta;
}

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
  const [status, setStatus] = useState<Record<string, StatusInicial>>(() =>
    statusPadrao(modulos)
  );
  // Rascunho = algum campo diferente do inicial. Fechar a aba no meio do
  // provisionamento passa a avisar; limpo, sai em silêncio.
  const sujo =
    name !== "" ||
    ownerEmail !== "" ||
    JSON.stringify(status) !== JSON.stringify(statusPadrao(modulos));
  useAvisoAoSair(sujo);
  const [pendingOwner, setPendingOwner] = useState<{
    slug: string;
    email: string;
  } | null>(null);
  // A barreira abre pelo submit do `<form>` — clique no botão ou Enter num
  // campo chegam ao mesmo lugar, e nenhum dos dois pula a confirmação.
  const [perguntando, setPerguntando] = useState(false);

  // Três estados, três rádios — não um botão que percorre Ativo → Trial →
  // fora a cada clique: `aria-pressed` só sabe dizer ligado/desligado, e o
  // do meio ficava sem nome para quem não vê a cor do badge. Escolher "fora"
  // tira o módulo do payload, como antes.
  const definir = (module: string, valor: StatusInicial | "") =>
    setStatus((prev) => {
      if (valor === "") {
        return Object.fromEntries(
          Object.entries(prev).filter(([m]) => m !== module)
        );
      }
      return { ...prev, [module]: valor };
    });

  const escolhidos = Object.entries(status);
  // O mesmo `slugify` do `provisionTenant`, não uma segunda cópia: as duas
  // divergiriam no primeiro acento ou nome longo, e a pessoa leria aqui um
  // slug que o banco não guardaria.
  const slug = slugify(name);
  // Com o cartão "sem dono" na tela o cliente já existe: um segundo submit
  // faria o servidor sufixar o slug e nasceria outro. O formulário trava até
  // a pessoa abrir o cliente criado.
  const nomeValido = name.trim().length >= 2;
  const podeEnviar =
    canWrite &&
    !pending &&
    !pendingOwner &&
    nomeValido &&
    escolhidos.length > 0;
  // Somente leitura já tem o próprio aviso no topo, e com o cartão "sem
  // dono" o motivo do botão cinza é outro.
  const falta =
    canWrite && !pendingOwner
      ? oQueFaltaParaProvisionar(nomeValido, escolhidos.length > 0)
      : [];

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
          // `?criado=1`: o detalhe abre dizendo o nome do cliente que nasceu —
          // a operação mais importante do painel não termina em silêncio.
          router.push(`/clientes/${result.data.slug}?criado=1`);
          return;
        }
        // Sem conta no e-mail informado, o cliente nasce sem dono e só o convite
        // espera. Redirecionar em silêncio faria quem provisionou acreditar que
        // já tem alguém capaz de entrar.
        setPendingOwner({ slug: result.data.slug, email: ownerEmail.trim() });
        setPerguntando(false);
        return;
      }
      setError(result.error);
    });

  const pedirConfirmacao = (event: FormEvent) => {
    event.preventDefault();
    if (podeEnviar) {
      setPerguntando(true);
    }
  };

  return (
    <form
      aria-label="Provisionar cliente"
      onSubmit={pedirConfirmacao}
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

      <Secao
        bodyStyle={{ display: "flex", flexDirection: "column", gap: 16 }}
        icon="building"
        title="Dados do cliente"
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
            Escolha o status inicial de cada módulo. Fora = não contratado; os
            outros entram já com o status escolhido.
          </p>
          {modulos.map((module) => {
            const atual = status[module];
            return (
              <div
                aria-label={`Status inicial de ${rotuloDoModulo(module)}`}
                key={module}
                role="radiogroup"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  padding: "10px 12px",
                  borderRadius: "var(--r-md)",
                  border: `1px solid ${atual ? "rgba(var(--accent-rgb),.4)" : "var(--hairline)"}`,
                  background: atual ? "var(--accent-soft)" : "var(--surface-2)",
                  opacity: canWrite ? 1 : 0.6,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 90,
                    fontSize: "var(--fs-base)",
                    fontWeight: 700,
                  }}
                >
                  {rotuloDoModulo(module)}
                </span>
                {/* O estado atual em palavra, além da cor do badge. */}
                {atual ? (
                  <Badge dot tone={atual === "ACTIVE" ? "green" : "blue"}>
                    {ROTULO_STATUS[atual]}
                  </Badge>
                ) : (
                  <Badge tone="neutral">Fora</Badge>
                )}
                <span style={{ display: "inline-flex", gap: 12 }}>
                  {OPCOES_DE_STATUS.map((opcao) => (
                    <label
                      key={opcao.valor}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: "var(--fs-nota)",
                        fontWeight: 600,
                        color: "var(--ink-muted)",
                        cursor: canWrite ? "pointer" : "not-allowed",
                      }}
                    >
                      <input
                        checked={(atual ?? "") === opcao.valor}
                        disabled={!canWrite}
                        name={`status-${module}`}
                        onChange={() => definir(module, opcao.valor)}
                        type="radio"
                        value={opcao.valor}
                      />
                      {opcao.rotulo}
                    </label>
                  ))}
                </span>
              </div>
            );
          })}
        </fieldset>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          {/* Provisionar chega ao cliente em segundos e não tem desfazer — é
              o caso que `ConfirmarAcao` cita no próprio comentário. O alvo é
              o slug ao vivo: se o nome saiu errado, é aqui que se vê.

              O gatilho é o submit do formulário, não o botão interno da
              barreira: assim Enter num campo também chega aqui. A barreira
              monta já aberta (`aberto`) e some no Voltar. */}
          {perguntando ? (
            <ConfirmarAcao
              aberto
              alvo={slug || "—"}
              consequencia="O cliente ganha acesso em segundos: o responsável é vinculado ou convidado, e cada módulo marcado nasce com o status escolhido — ativo ou trial."
              executando={pending}
              onConfirmar={submit}
              onVoltar={() => setPerguntando(false)}
              rotulo={pending ? "Provisionando…" : "Provisionar cliente"}
              tom="accent"
            />
          ) : (
            <WriteButton
              canWrite={canWrite}
              disabled={!podeEnviar}
              type="submit"
            >
              Provisionar cliente
            </WriteButton>
          )}
          {perguntando ? null : <OQueFalta itens={falta} verbo="provisionar" />}
        </div>
      </Secao>
    </form>
  );
}
