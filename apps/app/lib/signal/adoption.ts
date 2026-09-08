// Adoção — quanto da base licenciada de fato usa.
//
// A metade que o produto se recusa a mostrar sozinha. Adoção sem resultado é
// vaidade; resultado sem adoção é sorte ou erro de atribuição.

export type AdoptionSnapshotInput = {
  periodStart: Date;
  activeUsers: number;
  licensedUsers: number;
  frequencyLabel?: string | null;
  depthNote?: string | null;
};

export type AdoptionComputation = {
  /** 0..100, CRU. Arredonde só na apresentação — comparar contra a régua com
   *  valor arredondado faria 59,96% virar "adotada". */
  pct: number;
  activeUsers: number;
  licensedUsers: number;
  frequencyLabel: string | null;
  depthNote: string | null;
  /** Série cronológica de % para o sparkline. */
  trend: number[];
  /** Variação em pontos percentuais contra o período anterior. Nulo com menos
   *  de dois pontos: uma medição não tem tendência. */
  deltaPoints: number | null;
};

/** % de adoção. Base zero devolve 0, não NaN: iniciativa em rascunho não tem
 *  base licenciada, e NaN vazaria para a tela como "NaN%". */
export function adoptionPct(input: {
  activeUsers: number;
  licensedUsers: number;
}): number {
  if (input.licensedUsers <= 0) {
    return 0;
  }
  return (input.activeUsers / input.licensedUsers) * 100;
}

export function computeAdoption(
  snapshots: AdoptionSnapshotInput[]
): AdoptionComputation {
  if (snapshots.length === 0) {
    return {
      pct: 0,
      activeUsers: 0,
      licensedUsers: 0,
      frequencyLabel: null,
      depthNote: null,
      trend: [],
      deltaPoints: null,
    };
  }

  const ordered = [...snapshots].sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime()
  );
  const latest = ordered.at(-1) as AdoptionSnapshotInput;
  const trend = ordered.map(adoptionPct);
  const previous = trend.length >= 2 ? (trend.at(-2) as number) : null;
  const pct = adoptionPct(latest);

  return {
    pct,
    activeUsers: latest.activeUsers,
    licensedUsers: latest.licensedUsers,
    frequencyLabel: latest.frequencyLabel ?? null,
    depthNote: latest.depthNote ?? null,
    trend,
    deltaPoints: previous === null ? null : pct - previous,
  };
}

/** "78%" — inteiro, como o handoff apresenta na lista e no card. */
export function fmtAdoption(pct: number): string {
  return `${Math.round(pct)}%`;
}
