import { Carregando } from "@/components/carregando";

// Folha de respostas: um cartão por dimensão. Sem KPI, sem tabela.
export default function Loading() {
  return <Carregando corpo="cartoes" />;
}
