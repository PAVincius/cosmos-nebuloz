import type { MeridianAxis } from "@repo/database";
import { AXIS_IDS } from "./axes";

// Benchmark anônimo.
//
// A coorte é global: setor × faixa de tamanho, sem tenant. Nenhuma coluna
// identifica organização — é o que permite que o agregado seja global sem
// violar o isolamento que todo o resto do módulo respeita.
//
// O limiar é aplicado na LEITURA (FR-033). O agregado existe no banco; é
// `readCohort` que decide se os percentis saem. Aplicar na escrita perderia o
// agregado e obrigaria a recomputar do zero quando a coorte cruzasse o mínimo.

/** Mínimo de organizações contribuintes para liberar a leitura. Fixo em V1 —
 *  configurável por tenant seria o mesmo que negociável. */
export const BENCH_THRESHOLD = 5;

export type Band = { p25: number; p50: number; p75: number };
export type CohortBands = Record<MeridianAxis, Band>;

export type CohortRead =
  | { cohortKey: string; n: number; withheld: true }
  | { cohortKey: string; n: number; withheld: false; bands: CohortBands };

/** `sector × sizeBand` normalizados. Acento e caixa fora para que "Saúde" e
 *  "saude" caiam na mesma coorte em vez de fatiar a amostra ao meio. */
export function cohortKeyOf(sector: string, sizeBand: string): string {
  const slug = sector.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return `${slug} · ${sizeBand.trim()}`;
}

/** Percentis por interpolação linear sobre a amostra ordenada. Método único e
 *  documentado — sem isso, dois lugares do sistema calculam "a mediana" e
 *  devolvem números diferentes para a mesma coorte. */
export function percentiles(values: number[]): Band {
  if (values.length === 0) {
    return { p25: 0, p50: 0, p75: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number): number => {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const low = sorted[lo] as number;
    if (lo === hi) {
      return Math.round(low);
    }
    const high = sorted[hi] as number;
    return Math.round(low + (high - low) * (pos - lo));
  };
  return { p25: at(0.25), p50: at(0.5), p75: at(0.75) };
}

/** Lê o Json de percentis guardado na coorte. Devolve `null` — e portanto
 *  leitura retida — quando falta qualquer eixo: banda incompleta desenharia um
 *  radar com lado faltando, que é pior do que não desenhar. */
export function bandsFrom(json: unknown): CohortBands | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const raw = json as Record<string, Band | undefined>;
  if (AXIS_IDS.some((a) => !raw[a])) {
    return null;
  }
  return Object.fromEntries(
    AXIS_IDS.map((a) => [a, raw[a] as Band])
  ) as CohortBands;
}

/**
 * Único ponto de aplicação do limiar. Quando retém, o retorno **não contém** os
 * percentis — não basta não renderizar: uma resposta de action com os números
 * dentro já é o vazamento.
 */
export function readCohort(input: {
  cohortKey: string;
  n: number;
  bands: CohortBands | null;
}): CohortRead {
  if (!input.bands || input.n < BENCH_THRESHOLD) {
    return { cohortKey: input.cohortKey, n: input.n, withheld: true };
  }
  return {
    cohortKey: input.cohortKey,
    n: input.n,
    withheld: false,
    bands: input.bands,
  };
}
