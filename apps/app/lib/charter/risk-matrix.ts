/**
 * RFP §4.1.2 — matriz de risco impacto × probabilidade.
 *
 * O Charter guardava só impacto (`risk*`), o que responde "quão ruim seria" e
 * não "quão provável é". Duas coisas com o mesmo impacto e probabilidades
 * opostas exigem tratamento diferente, e sem o segundo eixo o comitê prioriza
 * no escuro.
 *
 * As dimensões continuam fixas em coluna. Torná-las configuráveis (dimensão
 * como dado) é redesenho de schema e está fora deste ciclo — a RFP exige "ao
 * menos" 5 e o Charter tem 7.
 */
export function severidade(impacto: number, probabilidade: number): number {
  return impacto * probabilidade;
}

/** Fronteira pertence ao nível mais alto: arredondar risco para baixo é como
 *  um caso escapa do gatilho de aprovação por um ponto. */
export function nivel(sev: number): "BAIXO" | "MEDIO" | "ALTO" | "CRITICO" {
  if (sev >= 15) {
    return "CRITICO";
  }
  if (sev >= 9) {
    return "ALTO";
  }
  if (sev >= 4) {
    return "MEDIO";
  }
  return "BAIXO";
}
