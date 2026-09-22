import { Carregando } from "@/components/carregando";

// Fora do grupo `(staff)`, então não herda o esqueleto padrão dele — e a
// tela é um cartão centrado sem cabeçalho, então o esqueleto também é.
export default function Loading() {
  return <Carregando corpo="cartao-central" />;
}
