import { Carregando } from "@/components/carregando";

// O grafo é um canvas alto que ocupa a largura toda; das formas que existem,
// a de editor (duas colunas altas) é a que chega mais perto dessa altura —
// cartões curtos fariam a tela pular quando o grafo montasse.
export default function Loading() {
  return <Carregando corpo="documento" />;
}
