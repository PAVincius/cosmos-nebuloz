import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { getServiceDetail, type ServiceDetail } from "@/app/actions/services";
import { Erro } from "@/components/campo";
import { WriteButton } from "@/components/write-button";
import { requirePlatformStaff } from "@/lib/guard";
import { MODULOS_DA_PLATAFORMA } from "@/lib/modulos";
import { DetalheDoServico, ROTULO_UNIDADE, TRILHA } from "./detalhe";
import { EditarServico } from "./editar";

export const dynamic = "force-dynamic";

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

/** "Editar" no cabeçalho. É um link porque abre pela URL (`?editar=1`) — o
 *  formulário é componente de cliente e o cabeçalho não; um `<Link>` alcança
 *  os dois sem subir estado. Sem permissão de escrita, vira o botão
 *  desabilitado com motivo do resto do painel. */
function BotaoEditar({
  codigo,
  canWrite,
  editando,
}: {
  codigo: string;
  canWrite: boolean;
  editando: boolean;
}) {
  if (!canWrite) {
    return <WriteButton canWrite={false}>Editar</WriteButton>;
  }
  const base = `/servicos/${encodeURIComponent(codigo)}`;
  return (
    <Link
      className="btn"
      href={editando ? base : `${base}?editar=1`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 15px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${editando ? "var(--hairline-strong)" : "var(--accent)"}`,
        background: editando ? "var(--surface-2)" : "var(--accent)",
        color: editando ? "var(--ink-muted)" : "var(--accent-fg)",
        fontSize: "var(--fs-forte)",
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      {editando ? "Fechar edição" : "Editar"}
    </Link>
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
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const [{ codigo }, { editar }] = await Promise.all([params, searchParams]);
  const [staff, res] = await Promise.all([
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
  const editando = editar !== undefined;
  const focarEm = editar === "entregaveis" ? "entregaveis" : undefined;
  const edicao =
    res.ok && editando ? (
      <EditarServico
        focarEm={focarEm}
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
          {res.ok ? (
            <BotaoEditar
              canWrite={staff.canWrite}
              codigo={res.data.codigo}
              editando={editando}
            />
          ) : null}
        </PageHeader>
      </div>

      {edicao}

      {res.ok ? (
        <DetalheDoServico servico={res.data} />
      ) : (
        <Erro>{res.error}</Erro>
      )}
    </div>
  );
}
