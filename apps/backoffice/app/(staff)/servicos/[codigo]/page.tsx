import { PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { getServiceDetail } from "@/app/actions/services";
import { Erro } from "@/components/campo";
import { requirePlatformStaff } from "@/lib/guard";
import { DetalheDoServico } from "./detalhe";

export const dynamic = "force-dynamic";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · catálogo"
        subtitle={subtitulo}
        title={titulo}
      >
        <Link
          href="/servicos"
          style={{
            fontSize: "var(--fs-nota)",
            fontWeight: 700,
            color: "var(--accent-text)",
            textDecoration: "none",
          }}
        >
          ← Voltar ao catálogo
        </Link>
      </PageHeader>

      {res.ok ? (
        <DetalheDoServico servico={res.data} />
      ) : (
        <Erro>{res.error}</Erro>
      )}
    </div>
  );
}
