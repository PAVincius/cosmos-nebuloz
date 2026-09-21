import { Carregando } from "@/components/carregando";

// A lista de avaliações é uma pilha de cartões (formulário de nova avaliação
// e a lista), não uma tabela.
export default function Loading() {
  return <Carregando corpo="cartoes" />;
}
