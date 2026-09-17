import { Carregando } from "@/components/carregando";

// Toda aba é uma tabela (DRE, lançamentos, títulos, caixa, plano) — o esqueleto imita as linhas.
export default function Loading() {
  return <Carregando corpo="tabela" />;
}
