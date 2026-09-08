import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listCapacity } from "@/app/actions/capacity";
import { listEngagements } from "@/app/actions/engagements";
import { listIpAssets } from "@/app/actions/ip-library";
import { listServices } from "@/app/actions/services";
import { requirePlatformStaff } from "@/lib/guard";
import { Biblioteca } from "./biblioteca";

export const dynamic = "force-dynamic";

export default async function IpPage() {
  const [staff, ativos, engajamentos, servicos, pessoas] = await Promise.all([
    requirePlatformStaff(),
    listIpAssets(),
    listEngagements(),
    listServices(),
    listCapacity(),
  ]);

  const tudoCarregou =
    ativos.ok && engajamentos.ok && servicos.ok && pessoas.ok;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Delivery · acervo"
        subtitle="O que dá para reusar no próximo cliente em vez de refazer. Versionado como os diagramas: o valor está em saber o que mudou entre a v3 e a v4."
        title="Biblioteca de IP"
      />
      {tudoCarregou ? (
        <Biblioteca
          engajamentos={engajamentos.data}
          iniciais={ativos.data}
          pessoas={pessoas.data}
          podeEscrever={staff.canWrite}
          servicos={servicos.data}
        />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {ativos.ok ? "" : ativos.error}
          {engajamentos.ok ? "" : engajamentos.error}
          {servicos.ok ? "" : servicos.error}
          {pessoas.ok ? "" : pessoas.error}
        </p>
      )}
    </div>
  );
}
