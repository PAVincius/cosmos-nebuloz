import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listarCatalogoComercial } from "@/app/actions/catalogo-comercial";
import { getPropostaParaEdicao } from "@/app/actions/proposta-escopo";
import { listServices } from "@/app/actions/services";
import { requirePlatformStaff } from "@/lib/guard";
import { Gerador } from "./gerador";

/**
 * Gerador de proposta (FR-13).
 *
 * `/propostas/nova` abre em branco; `/propostas/<id>` abre um rascunho para
 * ajuste. O catálogo desce inteiro para o cliente porque o preview recalcula a
 * cada tecla — buscar preço no servidor a cada movimento do slider de assentos
 * transformaria uma negociação ao vivo numa sequência de esperas.
 */
export const dynamic = "force-dynamic";

export default async function GeradorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const nova = id === "nova";

  const [staff, catalogo, servicos, proposta] = await Promise.all([
    requirePlatformStaff(),
    listarCatalogoComercial(),
    listServices(),
    nova ? Promise.resolve(null) : getPropostaParaEdicao(id),
  ]);

  if (!catalogo.ok) {
    return <FalhaAoCarregar motivo={catalogo.error} />;
  }
  if (!servicos.ok) {
    return <FalhaAoCarregar motivo={servicos.error} />;
  }
  if (proposta && !proposta.ok) {
    return <FalhaAoCarregar motivo={proposta.error} />;
  }

  const existente = proposta?.ok ? proposta.data : null;

  return (
    <>
      <PageHeader
        eyebrow={existente ? `proposta · ${existente.numero}` : "nova proposta"}
        subtitle="Configura escopo e comercial de um lado; o documento se monta do outro."
        title={existente?.clienteNome || "Gerador de proposta"}
      />
      <Gerador
        catalogo={catalogo.data}
        podeEscrever={staff.canWrite}
        proposta={existente}
        servicos={servicos.data.filter((s) => s.ativo)}
      />
    </>
  );
}

/** Erro de leitura tem retry (NFR-4) — recarregar é o que resolve, e dizer o
 *  motivo evita a pessoa achar que o catálogo está vazio. */
function FalhaAoCarregar({ motivo }: { motivo: string }) {
  return (
    <div
      style={{
        margin: "24px 0",
        padding: 20,
        borderRadius: "var(--r-md)",
        border: "1px solid rgba(var(--red-rgb),.3)",
        background: "var(--red-soft)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "var(--fs-base)",
          color: "var(--red-text)",
        }}
      >
        Não foi possível abrir o gerador: {motivo}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: "var(--fs-nota)",
          color: "var(--ink-faint)",
        }}
      >
        Recarregue a página; se persistir, o catálogo comercial pode não ter
        sido semeado neste ambiente.
      </p>
    </div>
  );
}
