import { Carregando } from "@/components/carregando";

// Um cartão de formulário (dados, dono, módulos) — sem KPI: o esqueleto do
// grupo desenharia uma grade de números que esta tela não tem.
export default function Loading() {
  return <Carregando corpo="cartoes" />;
}
