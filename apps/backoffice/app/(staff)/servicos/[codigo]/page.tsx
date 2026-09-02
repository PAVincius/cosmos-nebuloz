import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { getServiceDetail, type ServiceDetail } from "@/app/actions/services";
import { Erro } from "@/components/campo";
import { requirePlatformStaff } from "@/lib/guard";
import { DetalheDoServico } from "./detalhe";

export const dynamic = "force-dynamic";

const RECORRENTE = new Set(["RETAINER"]);

const ROTULO_UNIDADE: Record<string, string> = {
  PROJETO: "Projeto fechado",
  SPRINT: "Por sprint",
  HORA: "Hora técnica",
  RETAINER: "Retainer mensal",
};

const TRILHA: Record<
  string,
  { label: string; tone: "accent" | "green" | "purple" | "blue" }
> = {
  readiness: { label: "AI Readiness", tone: "accent" },
  adoption: { label: "AI Adoption", tone: "green" },
  enablement: { label: "Enablement", tone: "purple" },
  custom: { label: "Modelo próprio", tone: "blue" },
};

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
  const { codigo } = await params;
  const [, res] = await Promise.all([
    requirePlatformStaff(),
    getServiceDetail(decodeURIComponent(codigo)),
  ]);

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
        />
      </div>

      {res.ok ? (
        <DetalheDoServico servico={res.data} />
      ) : (
        <Erro>{res.error}</Erro>
      )}
    </div>
  );
}
