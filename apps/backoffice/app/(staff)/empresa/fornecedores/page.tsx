import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listarFornecedoresDpa } from "@/app/actions/empresa/fornecedores";
import { requirePlatformStaff } from "@/lib/guard";
import { Inventario } from "./inventario";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    listarFornecedoresDpa(),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Governança · Fornecedores"
        subtitle="Os 18 fornecedores do Charter interno, com o estado real do acordo de tratamento de dados por fonte primária."
        title="DPA dos fornecedores"
      />
      {res.ok ? (
        <Inventario iniciais={res.data.linhas} podeEscrever={staff.canWrite} />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {res.error}
        </p>
      )}
    </div>
  );
}
