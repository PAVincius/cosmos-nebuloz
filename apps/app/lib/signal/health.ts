// Saúde da fonte de dado.
//
// É a única desnormalização do módulo: `SignalConnection.health` é materializado
// para permitir índice e disparo de alerta, e a regra que o produz vive aqui.
// Cache com invalidação explícita — a exceção prevista na decisão D3 de
// `research.md`.
//
// A distinção que este arquivo protege: fonte ATRASADA e fonte CAÍDA pedem
// coisas diferentes. Atrasada é alguém que esqueceu de atualizar a planilha;
// caída é um OAuth revogado. Colapsar as duas em "com problema" faria metade
// dos casos ir para a pessoa errada.

export type ConnHealth = "HEALTHY" | "STALE" | "DOWN";

export type HealthInput = {
  /** Nulo = nunca sincronizou. */
  lastSyncAt: Date | null;
  /** Nulo = fonte manual, sem frequência esperada. */
  expectedFreqMinutes: number | null;
  /** Erro de conexão registrado no último sync. */
  errorMessage: string | null;
  /** Limiar do tenant, em horas. */
  staleHours: number;
  /** Injetável para o teste não depender do relógio. */
  now?: Date;
};

/**
 * Deriva a saúde.
 *
 * Ordem importa: erro registrado vence tempo. Uma fonte que falhou a
 * autenticação há dois minutos está DOWN, não HEALTHY só porque sincronizou
 * recentemente — o "sync recente" foi a própria tentativa que falhou.
 */
export function deriveHealth(input: HealthInput): ConnHealth {
  if (input.errorMessage) {
    return "DOWN";
  }

  // Fonte manual não fica atrasada por relógio. Uma planilha que alguém
  // prometeu atualizar "quando puder" não tem prazo que o sistema conheça —
  // marcá-la STALE todo dia treinaria a equipe a ignorar o alerta.
  if (input.expectedFreqMinutes === null) {
    return "HEALTHY";
  }

  if (!input.lastSyncAt) {
    // Conectada e nunca sincronizou: não é erro, mas também não é saudável.
    return "STALE";
  }

  const now = input.now ?? new Date();
  const hoursSince =
    (now.getTime() - input.lastSyncAt.getTime()) / (1000 * 60 * 60);
  return hoursSince > input.staleHours ? "STALE" : "HEALTHY";
}

/** Subconjunto do `Tone` do kit — o lib não importa componentes. */
export type SignalTone = "green" | "amber" | "red";

export const HEALTH_META: Record<
  ConnHealth,
  { label: string; tone: SignalTone; icon: string; hint: string }
> = {
  HEALTHY: {
    label: "Saudável",
    tone: "green",
    icon: "check",
    hint: "Sincronizando dentro do prazo.",
  },
  STALE: {
    label: "Atrasada",
    tone: "amber",
    icon: "clock",
    hint: "Sem sincronizar além do limiar. Os números que dependem dela pararam no tempo.",
  },
  DOWN: {
    label: "Desconectada",
    tone: "red",
    icon: "ban",
    hint: "A conexão falhou. Nenhum número novo entra até alguém reconectar.",
  },
};

/** Estado do mapeamento derivado da saúde da fonte que o alimenta. */
export type MappingState = "ACTIVE" | "REVIEW" | "BROKEN" | "STALE";

/**
 * Propaga a saúde da fonte para o mapeamento.
 *
 * `REVIEW` é o único estado que NÃO vem daqui: ele significa "alguém contestou
 * a atribuição", e é decisão humana. Por isso ele vence a propagação — uma
 * fonte que voltou a funcionar não encerra sozinha uma contestação de método.
 */
export function deriveMappingState(
  health: ConnHealth,
  humanState: MappingState | null
): MappingState {
  if (humanState === "REVIEW") {
    return "REVIEW";
  }
  if (health === "DOWN") {
    return "BROKEN";
  }
  if (health === "STALE") {
    return "STALE";
  }
  return "ACTIVE";
}

export const MAPPING_STATE_META: Record<
  MappingState,
  { label: string; tone: SignalTone }
> = {
  ACTIVE: { label: "Ativo", tone: "green" },
  REVIEW: { label: "Em revisão", tone: "amber" },
  BROKEN: { label: "Fonte caída", tone: "red" },
  STALE: { label: "Fonte atrasada", tone: "amber" },
};

/**
 * Texto do impacto: quais métricas de quais iniciativas param quando esta fonte
 * cai.
 *
 * Existe porque "Zendesk desconectado" não diz nada a quem lê o painel. O que
 * diz é "Retrabalho evitado (IN-014) e Tickets desviados (IN-021) congelados em
 * 04 jul" — a mesma informação, na forma em que ela vira decisão.
 */
export function describeImpact(
  affected: { metricLabel: string; initiativeCode: string }[],
  frozenAt: Date | null
): string | null {
  if (affected.length === 0) {
    return null;
  }
  const list = affected
    .map((a) => `${a.metricLabel} (${a.initiativeCode})`)
    .join(", ");
  const when = frozenAt
    ? ` congelados em ${frozenAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
    : " sem receber dado novo";
  return `${list}${when}.`;
}
