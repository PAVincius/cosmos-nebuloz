import { Carregando } from "@/components/carregando";

// KPIs em cima e o board embaixo — antes era `tabela`, e a tela pulava a altura da grade de números quando os dados chegavam.
export default function Loading() {
  return <Carregando corpo="kpis" />;
}
