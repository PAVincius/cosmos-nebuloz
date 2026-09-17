import { Carregando } from "@/components/carregando";

// Inventário de 18 fornecedores é uma tabela — sem grade de KPIs antes dela.
export default function Loading() {
  return <Carregando corpo="tabela" />;
}
