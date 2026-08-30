import { Carregando } from "@/components/carregando";

// Trilha de auditoria é uma tabela longa — o esqueleto imita as linhas para a
// altura bater com a da tela cheia.
export default function Loading() {
  return <Carregando corpo="tabela" />;
}
