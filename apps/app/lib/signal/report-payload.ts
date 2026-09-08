// Snapshot de relatório — US6. Puro: nenhuma consulta, nenhuma sessão.
//
// O `payload` É o relatório. Depois de congelado, ele deixa de acompanhar o
// banco: a fórmula pode ser reversionada, a fonte pode cair, a iniciativa pode
// ser encerrada — o PDF que o comitê leu continua dizendo exatamente o que
// dizia no dia. Reconstruir o relatório a partir das tabelas na hora de
// exportar destruiria isso silenciosamente, e ninguém perceberia até alguém
// comparar duas cópias impressas da mesma reunião.
//
// Por isso a regra-mãe do módulo aparece aqui em forma de tipo: nenhuma linha
// carrega ROI sem `formulaVersion` e `confidence`. Um número sem as duas não é
// um número defensável, é uma opinião com casas decimais.

import type { ConfidenceBand } from "./confidence";
import type { SignalVerdict } from "./verdict";

export type ReportEvidenceLine = {
  code: string;
  metricLabel: string;
  value: string;
  unit: string | null;
  windowLabel: string;
  sourceLabel: string;
  transform: string;
  /** Ressalva no momento do congelamento. Viaja junto ou some para sempre. */
  flag: string | null;
};

export type ReportInitiativeLine = {
  code: string;
  name: string;
  businessUnit: string;
  category: string;
  status: string;
  owner: string | null;
  adoptionPct: number;
  adoptionLabel: string;
  outcomeLabel: string | null;
  invested: number;
  returned: number;
  multiple: number | null;
  /** Sem versão não há ROI: a conta muda quando a fórmula muda. */
  formulaVersion: number | null;
  confidenceScore: number | null;
  confidenceBand: ConfidenceBand;
  verdict: SignalVerdict;
  evidence: ReportEvidenceLine[];
};

export type ReportPayload = {
  /** Versão do formato. Um leitor antigo tem de saber que não entende o novo. */
  schema: 1;
  generatedAt: string;
  organization: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  kind: "EXECUTIVE" | "PORTFOLIO";
  currency: string;
  bars: { adoptionBar: number; valueBar: number };
  totals: {
    invested: number;
    returned: number;
    multiple: number | null;
    atRisk: number;
    byVerdict: Record<SignalVerdict, number>;
  };
  initiatives: ReportInitiativeLine[];
  /** Fontes e a saúde delas no momento do congelamento. */
  sources: { code: string; name: string; health: string }[];
  /** Ressalvas de leitura. Vazio significa "nada a declarar", e isso é dito. */
  caveats: string[];
};

export type ReportPayloadInput = {
  generatedAt: Date;
  organization: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  kind: "EXECUTIVE" | "PORTFOLIO";
  currency: string;
  bars: { adoptionBar: number; valueBar: number };
  totals: ReportPayload["totals"];
  initiatives: ReportInitiativeLine[];
  sources: { code: string; name: string; health: string }[];
};

/** Uma página por bloco de leitura, mais a capa. Estimativa honesta e estável:
 *  o mesmo payload sempre dá o mesmo número, e é isso que a lista promete. */
const LINES_PER_PAGE = 6;

export function estimatePageCount(initiatives: ReportInitiativeLine[]): number {
  return 1 + Math.max(1, Math.ceil(initiatives.length / LINES_PER_PAGE));
}

/**
 * As ressalvas de leitura, escritas por extenso.
 *
 * Um relatório sem ressalvas e um relatório cujas ressalvas ninguém escreveu
 * são indistinguíveis no papel. Por isso a lista nunca fica implícita: quando
 * não há nada a declarar, o payload diz isso com todas as letras.
 */
export function buildCaveats(input: {
  initiatives: ReportInitiativeLine[];
  sources: { code: string; name: string; health: string }[];
}): string[] {
  const caveats: string[] = [];

  const unhealthy = input.sources.filter((s) => s.health !== "HEALTHY");
  if (unhealthy.length > 0) {
    caveats.push(
      `${unhealthy.length} ${unhealthy.length === 1 ? "fonte estava" : "fontes estavam"} fora do ar no fechamento (${unhealthy.map((s) => s.name).join(", ")}). Os números que dependem ${unhealthy.length === 1 ? "dela" : "delas"} são da última medição válida.`
    );
  }

  const noFormula = input.initiatives.filter((i) => i.formulaVersion === null);
  if (noFormula.length > 0) {
    caveats.push(
      `${noFormula.length} ${noFormula.length === 1 ? "iniciativa aparece" : "iniciativas aparecem"} sem ROI porque não ${noFormula.length === 1 ? "tem" : "têm"} fórmula ativa: ${noFormula.map((i) => i.code).join(", ")}. Ausência de número não é retorno zero.`
    );
  }

  const lowConfidence = input.initiatives.filter(
    (i) => i.confidenceBand === "LOW" || i.confidenceBand === "NONE"
  );
  if (lowConfidence.length > 0) {
    caveats.push(
      `${lowConfidence.length} ${lowConfidence.length === 1 ? "número tem" : "números têm"} confiança baixa (${lowConfidence.map((i) => i.code).join(", ")}). Servem para conversar, não para decidir renovação sozinhos.`
    );
  }

  const flagged = input.initiatives.flatMap((i) =>
    i.evidence.filter((e) => e.flag)
  );
  if (flagged.length > 0) {
    caveats.push(
      `${flagged.length} ${flagged.length === 1 ? "observação carrega" : "observações carregam"} ressalva e continua contando para o resultado. A cadeia de cada uma está no anexo de evidências.`
    );
  }

  if (caveats.length === 0) {
    caveats.push(
      "Nenhuma ressalva: todas as fontes estavam sincronizando, e todo ROI apresentado tem fórmula versionada e confiança medida."
    );
  }

  return caveats;
}

/**
 * Monta o snapshot. Datas viram ISO porque o payload vai para uma coluna Json
 * e volta como texto — deixar `Date` aqui criaria uma diferença entre o que foi
 * gravado e o que é lido de volta, exatamente no objeto que existe para não
 * mudar.
 */
export function buildReportPayload(input: ReportPayloadInput): ReportPayload {
  return {
    schema: 1,
    generatedAt: input.generatedAt.toISOString(),
    organization: input.organization,
    periodLabel: input.periodLabel,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    kind: input.kind,
    currency: input.currency,
    bars: input.bars,
    totals: input.totals,
    initiatives: input.initiatives,
    sources: input.sources,
    caveats: buildCaveats({
      initiatives: input.initiatives,
      sources: input.sources,
    }),
  };
}

/** Fontes que impedem o congelamento: as que alimentam número citado e caíram. */
export function freezeBlockers(input: {
  initiatives: ReportInitiativeLine[];
  sources: { code: string; name: string; health: string }[];
}): string[] {
  const cited = new Set(
    input.initiatives.flatMap((i) => i.evidence.map((e) => e.sourceLabel))
  );
  return input.sources
    .filter((s) => s.health === "DOWN")
    .filter((s) => cited.has(s.name) || cited.has(s.code))
    .map(
      (s) => `${s.code} · ${s.name} — reconectar antes de fechar o período.`
    );
}
