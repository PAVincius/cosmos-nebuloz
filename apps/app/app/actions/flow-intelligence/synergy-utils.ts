// INVARIANT: userId1 < userId2 always — enforced here before every write
export function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function computeSynergyScore({
  actualSp,
  predictedSp,
}: {
  actualSp: number;
  predictedSp: number;
}): number {
  if (predictedSp === 0) {
    return 0;
  }
  return ((actualSp - predictedSp) / predictedSp) * 100;
}
