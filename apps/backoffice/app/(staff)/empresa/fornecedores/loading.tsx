import { Carregando } from "@/components/carregando";

// O inventário abre com a fileira de KPIs (assinados, pendentes, bloqueiam
// venda…) e só depois a tabela — a forma `kpis` é a que não pula.
export default function Loading() {
  return <Carregando corpo="kpis" />;
}
