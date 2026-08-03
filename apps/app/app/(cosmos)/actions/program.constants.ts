// Constantes do Program Board. Ficam fora de program.ts porque aquele arquivo é
// "use server": um módulo de Server Actions só pode exportar função async.

// story-020 AC-004 — "Given a PI Plan in COMMITTED or CLOSED state ... the
// Program Board is read-only". Depois do commitment o plano é um compromisso do
// trem, não um rascunho; mover feature de célula reescreveria o que foi
// comprometido na sessão de PI Planning.
export const READ_ONLY_PI_STATUSES = ["COMMITTED", "CLOSED"];

export function isPiReadOnly(status: string): boolean {
  return READ_ONLY_PI_STATUSES.includes(status);
}
