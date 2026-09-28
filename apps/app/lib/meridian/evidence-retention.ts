// Retenção de evidência do respondente — decisão do CEO, 2026-09-28
// (docs/qualidade/dogfood/meridian/atrito.md:60, parecer de compliance
// condição 3, docs/compliance/2026-09-24-parecer-meridian-respondente.md):
// o objeto no bucket `meridian-evidence` é eliminado 90 dias depois do
// fechamento do assessment (`closedAt`). O registro em `MeridianEvidence`
// continua — a trilha de auditoria não é apagada — só o objeto no bucket
// some, e `storagePath` vira este marcador.
//
// O marcador nunca colide com um path real: um path real é sempre
// `${tenantId}/${assessmentId}/${uuid}` (duas barras); o marcador não tem
// nenhuma.

export const EVIDENCE_RETENTION_DAYS = 90;

export const EVIDENCE_RETENTION_ELIMINATED_MARKER = "eliminado-por-retencao";

export function isEvidenceRetentionEliminated(storagePath: string): boolean {
  return storagePath === EVIDENCE_RETENTION_ELIMINATED_MARKER;
}

/** `now - 90 dias` — assessment fechado antes deste instante tem a
 *  evidência elegível pra eliminação. */
export function evidenceRetentionCutoff(now: Date): Date {
  return new Date(
    now.getTime() - EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
}
