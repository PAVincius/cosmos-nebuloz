import { Pendente } from "@/components/shell";

export default function Page() {
  return (
    <Pendente
      motivo="Depende da entidade Proposal e da função priceProposal(). O gate de desconto acima de 15% também depende de Approval."
      titulo="Propostas"
    />
  );
}
