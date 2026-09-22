import { Carregando } from "@/components/carregando";

// A carteira abre com a grade de KPIs antes da tabela: com o esqueleto de
// cartão a tela saltaria a altura inteira da grade quando os números
// chegassem. Próprio de `/clientes` para não depender do esqueleto do grupo,
// que tem a forma da Home.
export default function Loading() {
  return <Carregando corpo="kpis" />;
}
