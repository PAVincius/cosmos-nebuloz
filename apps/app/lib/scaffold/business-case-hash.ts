import { createHash } from "node:crypto";

// O `ref` do artefato assinado — `a7f3c2e9` no protótipo.
//
// É PROVA, não identificador. Meses depois da assinatura, alguém precisa poder
// mostrar que os números contra os quais o Signal apura são os mesmos que o
// patrocinador aprovou. Isso impõe duas propriedades opostas, e é por elas que
// este arquivo existe em vez de um `JSON.stringify` inline:
//
//   • ESTÁVEL — o mesmo artefato produz sempre o mesmo hash, independente da
//     ordem em que o banco devolveu as métricas.
//   • SENSÍVEL — qualquer mudança na promessa muda o hash.
//
// O que entra é a PROMESSA: métrica, unidade, linha de base, meta, direção,
// confiança, janela e benefício. O que fica de fora é a prosa em volta —
// rótulo, fonte, amostra, nota. Corrigir um typo em "Cycle time da triagem" não
// pode invalidar uma assinatura; se pudesse, ninguém corrigiria o typo.
//
// `confidence` entra de propósito: `measured` e `declared` sobre os mesmos
// números são promessas diferentes, e é exatamente essa distinção que o
// patrocinador de BC-105 contesta no protótipo.

export type SignableMetric = {
  key: string;
  unit: string;
  /** String, não number: `Decimal` do Prisma serializa como string, e converter
   *  para float aqui introduziria o erro de ponto flutuante dentro da prova. */
  baseValue: string;
  targetValue: string;
  direction: string;
  confidence: string;
};

export type SignablePayload = {
  businessCaseCode: string;
  versionLabel: string;
  window: { start: string; months: number; cadence: string };
  benefit: {
    kind: string;
    hard: boolean;
    annualCents: number | null;
    basis: string;
  };
  metrics: SignableMetric[];
};

/** Serialização canônica: campos em ordem fixa, métricas ordenadas por `key`.
 *  Duas leituras do banco podem devolver ordens diferentes; sem isto, o mesmo
 *  artefato assinado teria dois `ref`. */
function canonical(payload: SignablePayload): string {
  const metrics = [...payload.metrics]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((m) =>
      [
        m.key,
        m.unit,
        m.baseValue,
        m.targetValue,
        m.direction,
        m.confidence,
      ].join("|")
    );

  return [
    payload.businessCaseCode,
    payload.versionLabel,
    payload.window.start,
    String(payload.window.months),
    payload.window.cadence,
    payload.benefit.kind,
    String(payload.benefit.hard),
    String(payload.benefit.annualCents ?? ""),
    payload.benefit.basis,
    ...metrics,
  ].join("\n");
}

/**
 * Hash curto do artefato assinado. Oito hex, como o protótipo mostra.
 *
 * Curto porque é para ser LIDO — alguém confere o `ref` numa tela contra o de
 * um PDF. Oito hex dão 4 bilhões de combinações, muito acima do número de
 * artefatos que um tenant assina, e a colisão aqui não é vetor de ataque:
 * ninguém escolhe o conteúdo do artefato do outro. Se algum dia for preciso
 * resistir a colisão adversarial, o hash completo continua disponível trocando
 * o `slice`.
 */
export function businessCaseHash(payload: SignablePayload): string {
  return createHash("sha256")
    .update(canonical(payload))
    .digest("hex")
    .slice(0, 8);
}
