import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import { listarProcessos } from "@/app/actions/processos";
import { Erro } from "@/components/campo";
import { statusDe } from "@/lib/ferramentas/processos";
import { requirePlatformStaff } from "@/lib/guard";
import { Mapa } from "./mapa";

/**
 * Mapa de processos (spec §4): o grafo de conhecimento aplicado aos processos
 * da casa. O botão "Novo processo" vive dentro de `Mapa`, não aqui — a lição
 * do funil v2: `WriteButton` precisa de `onClick`, que um server component
 * não fornece, e um componente-ponte só para isso é peso morto.
 */
export const dynamic = "force-dynamic";

const SUBTITULO =
  "Cada processo é uma estrela da cor da sua área; a área é a nebulosa que a densidade desenha. Anéis por nível — estratégico no centro, operacional na borda.";

export default async function ProcessosPage() {
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    listarProcessos(),
  ]);

  if (!res.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PageHeader
          eyebrow="Ferramentas · mapa de processos"
          subtitle={SUBTITULO}
          title="Mapa de processos"
          tone="accent"
        />
        <Erro>{res.error}</Erro>
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
        eyebrow="Ferramentas · mapa de processos"
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
      />

      <Mapa inicial={res.data} podeEscrever={staff.canWrite} />
    </div>
  );
}
