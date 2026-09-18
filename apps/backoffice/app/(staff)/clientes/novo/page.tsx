import { PageHeader } from "@repo/design-system/cosmos/kit";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { requirePlatformStaff } from "@/lib/guard";
import { MODULOS_DA_PLATAFORMA } from "@/lib/modulos";
import { NewClientForm } from "./form";

/**
 * `ProvisionScreen` do handoff.
 *
 * A largura fica em 640 como no desenho: é formulário de uma coluna, e
 * esticá-lo na largura do painel afasta o rótulo do campo a ponto de a pessoa
 * perder a linha.
 */
export const metadata = { title: tituloDaAba("/clientes/novo") };

export default async function NewClientPage() {
  const staff = await requirePlatformStaff();

  return (
    <div
      style={{
        maxWidth: 640,
        display: "flex",
        flexDirection: "column",
        gap: "var(--gap)",
      }}
    >
      <PageHeader
        eyebrow={secaoDaRota("/clientes/novo")}
        subtitle="Numa transação só: slug único, cliente, dono (membro ou convite) e módulos."
        title="Provisionar cliente novo"
      />
      <NewClientForm
        canWrite={staff.canWrite}
        modulos={MODULOS_DA_PLATAFORMA}
      />
    </div>
  );
}
