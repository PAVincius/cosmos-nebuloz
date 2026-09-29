import { SkeletonCard } from "@/components/signal/base";

// Enquanto a tela troca, o miolo mostra esqueleto: o shell (menu, contagens)
// já está desenhado pelo layout, então nunca há tela em branco (SG-DEV-06).
export default function SignalLoading() {
  return <SkeletonCard />;
}
