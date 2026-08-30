import { Carregando } from "@/components/carregando";

// Grade de KPIs antes do conteúdo: com o esqueleto de cartão a tela saltaria a
// altura inteira da grade quando os números chegassem.
export default function Loading() {
  return <Carregando corpo="kpis" />;
}
