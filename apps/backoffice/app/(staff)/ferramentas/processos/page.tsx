import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { listarProcessos } from "@/app/actions/processos";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { statusDe } from "@/lib/ferramentas/processos";
import { requirePlatformStaff } from "@/lib/guard";
import { Mapa } from "./mapa";

const LINK_MODELADOR = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-muted)",
  display: "inline-flex",
  fontSize: "var(--fs-nota)",
  fontWeight: 700,
  gap: 6,
  padding: "6px 11px",
  textDecoration: "none",
} as const;

/**
 * Mapa de processos (spec §4): o grafo de conhecimento aplicado aos processos
 * da casa. O botão "Novo processo" vive dentro de `Mapa`, não aqui — a lição
 * do funil v2: `WriteButton` precisa de `onClick`, que um server component
 * não fornece, e um componente-ponte só para isso é peso morto.
 */
export const dynamic = "force-dynamic";

const SUBTITULO =
  "Cada processo é uma estrela da cor da sua área; a área é a nebulosa que a densidade desenha. Anéis por nível — estratégico no centro, operacional na borda.";

export const metadata = { title: tituloDaAba("/ferramentas/processos") };

export default async function ProcessosPage() {
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    listarProcessos(),
  ]);

  if (!res.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PageHeader
          eyebrow={`${secaoDaRota("/ferramentas/processos")} · mapa de processos`}
          subtitle={SUBTITULO}
          title="Mapa de processos"
          tone="accent"
        />
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível carregar o mapa"
        />
      </div>
    );
  }

  const { processos } = res.data;
  const modelados = processos.filter((p) => statusDe(p) === "MODELADO").length;
  const rascunhos = processos.filter((p) => statusDe(p) === "RASCUNHO").length;
  const naoMapeados = processos.filter(
    (p) => statusDe(p) === "NAO_MAPEADO"
  ).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/ferramentas/processos")} · mapa de processos`}
        meta={
          <>
            <Badge dot tone="green">
              {modelados} modelados
            </Badge>
            <Badge dot tone="amber">
              {rascunhos} rascunhos
            </Badge>
            {naoMapeados > 0 ? (
              <Badge dot tone="red">
                {naoMapeados} não mapeados
              </Badge>
            ) : null}
          </>
        }
        subtitle={SUBTITULO}
        title="Mapa de processos"
        tone="accent"
      >
        <Link href="/ferramentas/bpmn" style={LINK_MODELADOR}>
          Abrir modelador
        </Link>
      </PageHeader>

      <Mapa inicial={res.data} podeEscrever={staff.canWrite} />
    </div>
  );
}
