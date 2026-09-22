import { Carregando } from "@/components/carregando";

// A biblioteca abre com três KPIs (resumo.tsx) antes da lista e da ficha:
// `kpis` é a forma que casa com o topo; o resto chega depois.
export default function Loading() {
  return <Carregando corpo="kpis" />;
}
