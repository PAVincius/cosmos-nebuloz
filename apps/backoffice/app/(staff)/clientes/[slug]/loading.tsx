import { Carregando } from "@/components/carregando";

// Detalhe do cliente: cabeçalho com selos e uma pilha de cartões por módulo. Sem KPI.
export default function Loading() {
  return <Carregando corpo="cartoes" />;
}
