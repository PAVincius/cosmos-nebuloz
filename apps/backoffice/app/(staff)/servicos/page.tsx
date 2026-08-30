import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listServices } from "@/app/actions/services";
import { requirePlatformStaff } from "@/lib/guard";
import { Catalogo } from "./catalogo";

export const dynamic = "force-dynamic";

export default async function ServicosPage() {
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    listServices(),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · catálogo"
        subtitle="O que a Nebuloz vende. É daqui que saem os itens de uma proposta e o que um engajamento entrega."
        title="Serviços"
      />
      {res.ok ? (
        <Catalogo iniciais={res.data} podeEscrever={staff.canWrite} />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {res.error}
        </p>
      )}
    </div>
  );
}
