import { Carregando } from "@/components/carregando";

// Fora do grupo `(staff)`, então não herda o esqueleto padrão dele.
export default function Loading() {
  return <Carregando />;
}
