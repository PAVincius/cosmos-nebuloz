import { PageHeader } from "@repo/design-system/cosmos/kit";
import { notFound } from "next/navigation";
import { cache } from "react";
import { listarCatalogoComercial } from "@/app/actions/catalogo-comercial";
import { getPropostaParaEdicao } from "@/app/actions/proposta-escopo";
import { listServices } from "@/app/actions/services";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { tituloDaAba } from "@/components/nav";
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

// `cache` do React: `generateMetadata` e a página leem a mesma proposta na
// mesma requisição, e sem isto seriam duas idas ao banco.
const lerProposta = cache((id: string) => getPropostaParaEdicao(id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id === "nova") {
    return { title: "Nova proposta — Back-office Nebuloz" };
  }
  const res = await lerProposta(id);
  // Sem cliente ainda (rascunho recém-criado), o título é o da lista.
  return {
    title:
      res.ok && res.data.clienteNome
        ? `${res.data.clienteNome} — Proposta — Back-office Nebuloz`
        : tituloDaAba("/propostas"),
  };
}

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
    nova ? Promise.resolve(null) : lerProposta(id),
  ]);

  // Id que não existe não é falha de leitura: retry não resolve. O
  // `not-found.tsx` do grupo já existe — é ele que responde.
  if (proposta && !proposta.ok && proposta.code === "NOT_FOUND") {
    notFound();
  }

  const existente = proposta?.ok ? proposta.data : null;

  // O cabeçalho fica nos dois caminhos: erro dentro da moldura do sucesso.
  const cabecalho = (
    <PageHeader
      eyebrow={existente ? `proposta · ${existente.numero}` : "nova proposta"}
      subtitle="Configura escopo e comercial de um lado; o documento se monta do outro."
      title={existente?.clienteNome || "Gerador de proposta"}
    />
  );

  // Erro de leitura tem retry (NFR-4): o botão faz o que "recarregue a
  // página" pedia em prosa, e dizer o motivo evita a pessoa achar que o
  // catálogo está vazio.
  const falhou = (motivo: string) => (
    <>
      {cabecalho}
      <FalhaAoCarregar
        motivo={motivo}
        nota="Se persistir, o catálogo comercial pode não ter sido semeado neste ambiente."
        titulo="Não foi possível abrir o gerador"
      />
    </>
  );
  if (!catalogo.ok) {
    return falhou(catalogo.error);
  }
  if (!servicos.ok) {
    return falhou(servicos.error);
  }
  if (proposta && !proposta.ok) {
    return falhou(proposta.error);
  }

  return (
    <>
      {cabecalho}
      <Gerador
        catalogo={catalogo.data}
        podeEscrever={staff.canWrite}
        proposta={existente}
        servicos={servicos.data.filter((s) => s.ativo)}
      />
    </>
  );
}
