import { Carregando } from "@/components/carregando";

// Formulário de alocação e cartão por pessoa — não há KPI aqui; o esqueleto do grupo faria a tela pular a grade inteira.
export default function Loading() {
  return <Carregando corpo="cartoes" />;
}
