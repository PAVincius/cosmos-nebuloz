// Estagnação e taxa de override — S-09, SN-07, SG-08.
//
// Aritmética pura, num arquivo só, porque três lugares calculam a MESMA coisa:
// a varredura agendada, o badge da casca e o portfólio. Duas implementações
// divergem no primeiro arredondamento, e a divergência aparece como a sidebar
// dizendo "3 estagnadas" enquanto a lista mostra 2 — que faz a pessoa parar de
// confiar nos dois números.

const DAY_MS = 86_400_000;

/** Limiar default, o mesmo `STALL_THRESHOLD` do protótipo. Tenant pode
 *  sobrescrever em `ScaffoldSettings.stallThresholdDays`. */
export const DEFAULT_STALL_THRESHOLD_DAYS = 14;

/**
 * Dias inteiros desde o último movimento de gate.
 *
 * Sem gate nenhum, conta do início da trilha: uma trilha parada desde o
 * primeiro dia ESTÁ parada, e tratar isso como zero esconderia exatamente a que
 * mais precisa aparecer.
 */
export function stalledDays(lastGateAt: Date | null, startedAt: Date): number {
  const since = (lastGateAt ?? startedAt).getTime();
  return Math.max(0, Math.floor((Date.now() - since) / DAY_MS));
}

/**
 * `>=`, não `>`. O limiar é "há 14 dias sem movimento", e no 14º dia já faz 14
 * dias — um dia a mais de silêncio é um dia a mais de ninguém saber.
 */
export function isStalled(days: number, threshold: number): boolean {
  return days >= threshold;
}

/**
 * SG-08 — porcentagem de gates fechados por override.
 *
 * Devolve `null`, não zero, quando não houve gate fechado: zero por cento diz
 * "ninguém dispensou critério", que é uma afirmação diferente de "ainda não
 * houve gate". A distinção importa para o sponsor que recebe o número.
 */
export function overrideRate(input: {
  closed: number;
  overridden: number;
}): number | null {
  if (input.closed === 0) {
    return null;
  }
  return Math.round((input.overridden / input.closed) * 100);
}
