import { Carregando } from "@/components/carregando";

// Cartões: a tela é uma pilha de SectionCard antes da tabela, e o veredito —
// o primeiro cartão — é o que a pessoa está esperando aparecer.
export default function Loading() {
  return <Carregando corpo="cartoes" />;
}
