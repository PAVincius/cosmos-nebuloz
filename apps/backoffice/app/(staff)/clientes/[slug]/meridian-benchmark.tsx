import { getMeridianBenchmark } from "@/app/actions/meridian-benchmark";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { MeridianBenchmarkControle } from "./meridian-benchmark-controle";

/** Lê a habilitação e monta o controle. Server component próprio: a página já
 *  está no teto de complexidade, e o erro de leitura fica dentro da moldura do
 *  cartão em vez de derrubar a ficha. */
export async function MeridianBenchmark({
  slug,
  canWrite,
}: {
  slug: string;
  canWrite: boolean;
}) {
  const res = await getMeridianBenchmark(slug);
  if (!res.ok) {
    return (
      <FalhaAoCarregar
        motivo={res.error}
        titulo="Não foi possível ler o benchmark do Meridian"
      />
    );
  }
  return (
    <MeridianBenchmarkControle
      canWrite={canWrite}
      estado={res.data}
      slug={slug}
    />
  );
}
