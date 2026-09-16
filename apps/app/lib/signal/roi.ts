// ROI — retorno sobre investimento de uma iniciativa.
//
// Função pura, sem I/O, por exigência de TR-2 ("cálculo isolado da lógica de
// UI") e TR-3 ("passos rastreáveis"). Recebe as entradas já carregadas e
// devolve, além do total, o passo a passo — porque um número que o CFO não
// consegue reconstruir é um número que ele não vai defender no board.
//
// `invested` e `returned` NÃO existem como coluna: são somas das entradas. O
// protótipo do handoff guardava os dois lados e, na IN-031, eles discordavam em
// R$ 42 mil (desconto de atribuição aplicado duas vezes). Derivar elimina a
// classe de erro; guardar apenas adiciona uma invariante para vigiar.

export type RoiEntryInput = {
  kind: "RETURN" | "COST";
  label: string;
  total: number;
  quantityLabel?: string | null;
  unitLabel?: string | null;
  sourceLabel: string;
};

export type RoiStep = {
  label: string;
  kind: "RETURN" | "COST";
  total: number;
  /** Fração do lado (retorno ou custo) que esta entrada representa, 0..1. */
  share: number;
  sourceLabel: string;
};

export type RoiComputation = {
  invested: number;
  returned: number;
  /**
   * Razão retorno/investimento.
   *
   * `null` quando há retorno declarado mas nenhum custo: a conta é infinita, e
   * infinito na tela significa "esquecemos de lançar o custo", não "retorno
   * ilimitado". Nulo força a UI a dizer que falta dado, que é a verdade.
   *
   * Zero quando não há nem retorno nem custo — iniciativa em rascunho.
   */
  multiple: number | null;
  /** Retorno líquido. Negativo é informação, não erro. */
  net: number;
  steps: RoiStep[];
};

const sumBy = (entries: RoiEntryInput[], kind: RoiEntryInput["kind"]): number =>
  entries.reduce((acc, e) => (e.kind === kind ? acc + e.total : acc), 0);

/** Arredondamento de apresentação: uma casa, como toda tela do produto. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeRoi(entries: RoiEntryInput[]): RoiComputation {
  const returned = sumBy(entries, "RETURN");
  const invested = sumBy(entries, "COST");

  let multiple: number | null;
  if (invested > 0) {
    multiple = returned / invested;
  } else if (returned > 0) {
    multiple = null;
  } else {
    multiple = 0;
  }

  const steps: RoiStep[] = entries.map((e) => {
    const side = e.kind === "RETURN" ? returned : invested;
    return {
      label: e.label,
      kind: e.kind,
      total: e.total,
      share: side > 0 ? e.total / side : 0,
      sourceLabel: e.sourceLabel,
    };
  });

  return { invested, returned, multiple, net: returned - invested, steps };
}

/** Agregado de portfólio: soma os dois lados antes de dividir.
 *
 *  Somar múltiplos individuais e tirar a média daria peso igual a uma
 *  iniciativa de R$ 90 mil e a uma de R$ 900 mil — e o portfólio passaria a
 *  contar uma história que o caixa não confirma. */
export function computePortfolioRoi(
  computations: Pick<RoiComputation, "invested" | "returned">[]
): { invested: number; returned: number; multiple: number | null } {
  const invested = computations.reduce((a, c) => a + c.invested, 0);
  const returned = computations.reduce((a, c) => a + c.returned, 0);
  if (invested > 0) {
    return { invested, returned, multiple: returned / invested };
  }
  return { invested, returned, multiple: returned > 0 ? null : 0 };
}

/** Formatação BRL curta do handoff: "R$ 764 mil", "R$ 1,20 mi". */
export function fmtBRL(n: number): string {
  // O sinal vem antes do símbolo, com o menos tipográfico (U+2212): "R$ -24
  // mil" lê como "R$ menos-alguma-coisa" e o hífen some em fonte tabular.
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  }
  if (abs >= 1000) {
    return `${sign}R$ ${Math.round(abs / 1000)} mil`;
  }
  return `${sign}R$ ${abs}`;
}

/** "4,2×". Nulo vira travessão — nunca "0,0×", que afirmaria ausência de
 *  retorno onde o que falta é o custo. */
export function fmtMultiple(multiple: number | null): string {
  if (multiple === null) {
    return "—";
  }
  return `${multiple.toFixed(1).replace(".", ",")}×`;
}
