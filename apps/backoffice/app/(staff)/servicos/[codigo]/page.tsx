import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getServiceDetail, type ServiceDetail } from "@/app/actions/services";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { tituloDaAba } from "@/components/nav";
import { requirePlatformStaff } from "@/lib/guard";
import { MODULOS_DA_PLATAFORMA } from "@/lib/modulos";
import { DetalheDoServico, ROTULO_UNIDADE, TRILHA } from "./detalhe";
import { BotaoEditar, EdicaoDoServico } from "./editar";

export const dynamic = "force-dynamic";

// `cache` do React: `generateMetadata` e a página leem o mesmo serviço na
// mesma requisição, e sem isto seriam duas idas ao banco.
const lerServico = cache((codigo: string) => getServiceDetail(codigo));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const res = await lerServico(decodeURIComponent(codigo));
  return {
    title: res.ok
      ? `${res.data.nome} — Serviço — Back-office Nebuloz`
      : tituloDaAba("/servicos"),
  };
}

const RECORRENTE = new Set(["RETAINER"]);

/** Os selos do cabeçalho: trilha, modelo de cobrança e as duas exceções que
 *  mudam o que dá para prometer — LAB e fora de catálogo. Componente próprio
 *  porque, inline, o `meta` levava a página inteira acima do teto de
 *  complexidade do lint. */
function SelosDoServico({ servico }: { servico: ServiceDetail }) {
  const trilha = TRILHA[servico.trilha];
  const recorrente = RECORRENTE.has(servico.unidadeDeCobranca);
  return (
    <>
      <Badge tone={trilha?.tone ?? "neutral"}>
        {trilha?.label ?? servico.trilha}
      </Badge>
      <Badge dot={recorrente} tone={recorrente ? "amber" : "neutral"}>
        {ROTULO_UNIDADE[servico.unidadeDeCobranca] ?? servico.unidadeDeCobranca}
      </Badge>
      {servico.exigeLab ? (
        <Badge dot tone="blue">
          requer LAB
        </Badge>
      ) : null}
      {servico.ativo ? null : <Badge tone="neutral">Fora do catálogo</Badge>}
    </>
  );
}

/**
 * Detalhe de um serviço do catálogo (`/servicos/SV-09`).
 *
 * A rota usa `codigo` e não `id`: é o que aparece em proposta e contrato, o que
 * a pessoa tem na mão quando vai procurar, e é único por tenant.
 */
export default async function ServicoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  // `?editar` não é lido aqui: é estado de tela, e quem o lê são os dois
  // componentes de cliente (`BotaoEditar`, `EdicaoDoServico`) — assim abrir e
  // fechar a edição não passa pelo servidor nem pelo esqueleto da rota.
  const { codigo } = await params;
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    lerServico(decodeURIComponent(codigo)),
  ]);
  // Id que não existe não é falha de leitura: retry não resolve. O
  // `not-found.tsx` do grupo já existe — é ele que responde.
  if (!res.ok && res.code === "NOT_FOUND") {
    notFound();
  }

  // Fora do JSX pelo mesmo motivo do `aria-current` do menu lateral: inline, o
  // ternário é lido pelo lint como valor vazando para o render.
  const titulo = res.ok ? res.data.nome : codigo;
  const subtitulo = res.ok
    ? (res.data.descricao ??
      "Sem descrição cadastrada — a proposta vai levar só o nome.")
    : "O código pedido não está no catálogo.";
  const trilha = res.ok ? TRILHA[res.data.trilha] : undefined;
  const selos = res.ok ? <SelosDoServico servico={res.data} /> : null;
  const codigoExibido = res.ok ? res.data.codigo : codigo;
  const edicao = res.ok ? (
    <EdicaoDoServico
      modulos={MODULOS_DA_PLATAFORMA}
      podeEscrever={staff.canWrite}
      servico={res.data}
    />
  ) : null;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <div>
        {/* Volta acima do cabeçalho, como no handoff: a trilha de retorno é a
            primeira coisa que se lê ao entrar por engano numa tela de detalhe. */}
        <Link
          href="/servicos"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            color: "var(--ink-subtle)",
            fontSize: "var(--fs-nota)",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <Icon name="arrowLeft" size={14} />
          Catálogo
        </Link>

        <PageHeader
          eyebrow={`serviço · ${codigoExibido}`}
          meta={selos}
          subtitle={subtitulo}
          title={titulo}
          tone={trilha?.tone ?? "accent"}
        >
          {res.ok ? <BotaoEditar canWrite={staff.canWrite} /> : null}
        </PageHeader>
      </div>

      {edicao}

      {res.ok ? (
        <DetalheDoServico servico={res.data} />
      ) : (
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível abrir o serviço"
        />
      )}
    </div>
  );
}
