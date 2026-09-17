import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listGateQueue } from "@/app/actions/scaffold-supervision";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota } from "@/components/nav";
import { requirePlatformStaff } from "@/lib/guard";
import { FilaDeGates } from "./fila-de-gates";

// Fila de supervisão do Scaffold — S-08, SN-06.
//
// Esta tela vive no back-office e não no app do cliente porque é a única
// superfície do produto que atravessa organizações: a ADR-0013 fez de
// `platformDb` a porta única para isso, e ela não é importável de `apps/app`.
// Ver `specs/002-scaffold-adoption/research.md` §R4.

export const dynamic = "force-dynamic";

export default async function ScaffoldSupervisionPage() {
  const [, fila] = await Promise.all([
    requirePlatformStaff(),
    listGateQueue({}),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/scaffold")} · supervisão`}
        subtitle="Gates de toda a carteira num lugar só. A fila mostra metadado — trilha, cliente, fase, idade e critérios — e nunca os artefatos por trás deles: ver o conteúdo exige entrar no tenant do cliente, e essa entrada fica registrada."
        title="Fila de gates"
      />
      {fila.ok ? (
        <FilaDeGates iniciais={fila.data} />
      ) : (
        <FalhaAoCarregar
          motivo={fila.error}
          titulo="Não foi possível carregar a fila"
        />
      )}
    </div>
  );
}
