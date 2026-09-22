import { PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { Secao } from "@/components/secao";

/**
 * Não-encontrado do grupo `(staff)`.
 *
 * É para onde `notFound()` de `clientes/[slug]/page.tsx` (e qualquer rota
 * inexistente sob o shell) cai. Antes era o 404 do Next em inglês, fora do
 * painel. Aqui o layout do grupo envolve: navegação e topbar ficam, e a
 * pessoa lê o que pode ter acontecido no vocabulário do painel.
 */
export default function NaoEncontrado() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Nebuloz · não encontrado"
        subtitle="O endereço não corresponde a nada que o painel conheça."
        title="Não encontrado"
        tone="amber"
      />
      <Secao icon="alert" title="O que pode ter acontecido" tone="amber">
        <ul
          style={{
            margin: 0,
            padding: "0 0 0 18px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: "var(--fs-base)",
            lineHeight: 1.6,
            color: "var(--ink-muted)",
          }}
        >
          <li>O link é antigo e o cliente ou o item foi removido.</li>
          <li>O endereço foi digitado com um slug ou id que não existe.</li>
          <li>
            A tela existe, mas fora deste painel — o menu à esquerda lista tudo
            o que há.
          </li>
        </ul>
        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 14,
            fontSize: "var(--fs-base)",
            fontWeight: 700,
            color: "var(--accent-text)",
          }}
        >
          Voltar para a Home
        </Link>
      </Secao>
    </div>
  );
}
