// S-06 / SC-004 — o contrato de saída para o Signal.
//
// O Scaffold é a FONTE DA VERDADE: emite o artefato assinado, imutável e
// versionado; o Signal apura contra ele por meses e nunca o edita.
//
// O Signal ainda não existe no repositório (research §R10). O que vive aqui é o
// que o Scaffold EMITE — nenhuma chamada é feita ao outro lado. Escrever o
// consumidor junto do produtor duplicaria o escopo e amarraria as duas pontas
// antes de haver a segunda.
//
// Lógica PURA: transformação de dado, sem Prisma e sem I/O. É o que permite a
// fixture do BC-104 provar SC-004 num teste de milissegundos.

export type ExportableMetric = {
  key: string;
  label: string;
  unit: string;
  baseValue: string;
  targetValue: string;
  direction: string;
  confidence: string;
  sourceLabel: string;
  sampleLabel: string;
};

export type ExportableCase = {
  id: string;
  code: string;
  tenantId: string;
  trackId: string;
  processName: string;
  signalInitiativeRef: string | null;
  windowStart: Date | null;
  windowMonths: number | null;
  cadence: string | null;
  benefitKind: string;
  benefitHard: boolean;
  benefitAnnualCents: number | null;
  benefitBasis: string;
  financeReviewedAt: Date | null;
  signedVersion: {
    label: string;
    contentHash: string | null;
    signedAt: Date | null;
    signedById: string | null;
    signedByLabel: string | null;
    metrics: ExportableMetric[];
  };
};

const isoDay = (d: Date | null): string | null =>
  d ? (d.toISOString().slice(0, 10) as string) : null;

/**
 * Fim do primeiro período de apuração.
 *
 * Calculado aqui, não pelo Signal: deixar para o consumidor significaria as
 * duas pontas implementarem a mesma regra de calendário, e regra de calendário
 * duplicada diverge em fevereiro.
 */
function firstRead(start: Date | null, cadence: string | null): string | null {
  if (!start) {
    return null;
  }
  const d = new Date(start);
  d.setUTCMonth(d.getUTCMonth() + (cadence === "quarterly" ? 3 : 1));
  // Último dia do período: voltar um dia do início do próximo.
  d.setUTCDate(d.getUTCDate() - 1);
  return isoDay(d);
}

// ── v2 — o contrato vigente ───────────────────────────────────────────────────

export type SignalBaselineV2 = {
  schema: "nebuloz.signal.baseline/2";
  business_case_id: string;
  business_case_code: string;
  version: string;
  content_hash: string | null;
  track_id: string;
  process_name: string;
  tenant_id: string;
  signal_initiative_ref: string | null;
  signed_by: string | null;
  signed_by_label: string | null;
  signed_at: string | null;
  window: {
    start: string | null;
    months: number | null;
    cadence: string;
    first_read: string | null;
  };
  metrics: {
    key: string;
    label: string;
    unit: string;
    base: number;
    target: number;
    direction: string;
    confidence: string;
    source: string;
    sample: string;
  }[];
  benefit: {
    kind: string;
    hard: boolean;
    annual_cents: number | null;
    currency: "BRL";
    basis: string;
    finance_reviewed_at: string | null;
  };
};

export function toSignalV2(bc: ExportableCase): SignalBaselineV2 {
  const v = bc.signedVersion;
  const cadence = bc.cadence ?? "monthly";
  return {
    schema: "nebuloz.signal.baseline/2",
    business_case_id: bc.id,
    business_case_code: bc.code,
    version: v.label,
    // Chave de idempotência: o Signal reimportando o mesmo hash não cria
    // leitura nova. Sem isto, uma reexecução do job duplicaria a série.
    content_hash: v.contentHash,
    track_id: bc.trackId,
    process_name: bc.processName,
    tenant_id: bc.tenantId,
    signal_initiative_ref: bc.signalInitiativeRef,
    signed_by: v.signedById,
    signed_by_label: v.signedByLabel,
    signed_at: v.signedAt?.toISOString() ?? null,
    window: {
      start: isoDay(bc.windowStart),
      months: bc.windowMonths,
      cadence,
      first_read: firstRead(bc.windowStart, cadence),
    },
    metrics: v.metrics.map((m) => ({
      key: m.key,
      label: m.label,
      unit: m.unit,
      base: Number(m.baseValue),
      target: Number(m.targetValue),
      // Minúsculas: o contrato é JSON entre produtos, não o enum do Prisma.
      // Vazar `DOWN` obrigaria o Signal a conhecer a nossa convenção interna.
      direction: m.direction.toLowerCase(),
      confidence: m.confidence.toLowerCase(),
      source: m.sourceLabel,
      sample: m.sampleLabel,
    })),
    benefit: {
      kind: bc.benefitKind.toLowerCase(),
      hard: bc.benefitHard,
      annual_cents: bc.benefitAnnualCents,
      currency: "BRL",
      basis: bc.benefitBasis,
      finance_reviewed_at: isoDay(bc.financeReviewedAt),
    },
  };
}

// ── v1 — compat com o SRD §6 ──────────────────────────────────────────────────

export type SignalBaselineV1 = {
  track_id: string;
  process_name: string;
  captured_at: string | null;
  signed_by: string | null;
  metrics: {
    volume_per_period: number | null;
    period: "day" | "week" | "month";
    cycle_time_minutes: number | null;
    error_rate: number | null;
    headcount_touching: number | null;
  };
  notes: string;
};

/** Chaves canônicas que o shape achatado do SRD §6 conhece. */
const V1_KEYS = {
  volume: "volume",
  cycle: "cycle",
  error: "error",
  headcount: "headcount",
} as const;

/**
 * O shape achatado do SRD §6, mantido como DERIVAÇÃO — não como schema interno.
 *
 * Três métricas fixas não descrevem "laudos dentro da janela de plantio" nem
 * "casos por analista/semana" (research §R3). Ele existe para não quebrar quem
 * já leu o SRD, e emite `null` para métrica ausente em vez de falhar: um
 * consumidor que espera três números lida melhor com um nulo do que com um
 * erro.
 */
export function toSignalV1(bc: ExportableCase): SignalBaselineV1 {
  const v = bc.signedVersion;
  const num = (key: string): number | null => {
    const m = v.metrics.find((x) => x.key === key);
    return m ? Number(m.baseValue) : null;
  };
  const errorPct = num(V1_KEYS.error);

  return {
    track_id: bc.trackId,
    process_name: bc.processName,
    // Da assinatura, não de `now`: o baseline foi capturado quando foi
    // assinado, e usar o relógio faria o mesmo artefato exportar datas
    // diferentes a cada chamada.
    captured_at: v.signedAt?.toISOString() ?? null,
    signed_by: v.signedById,
    metrics: {
      volume_per_period: num(V1_KEYS.volume),
      // O v1 do SRD só admite day/week/month. Cadência trimestral não tem
      // representação lá, e "month" é a aproximação que não mente sobre a
      // ordem de grandeza.
      period: "month",
      cycle_time_minutes: num(V1_KEYS.cycle),
      // Única conversão de unidade do contrato: o v2 guarda percentual, o SRD
      // §6 pede fração de 0 a 1. Ela vive aqui, não no consumidor.
      error_rate: errorPct === null ? null : errorPct / 100,
      headcount_touching: num(V1_KEYS.headcount),
    },
    notes: `${bc.code} · ${v.label}${v.contentHash ? ` · ref ${v.contentHash}` : ""}`,
  };
}
