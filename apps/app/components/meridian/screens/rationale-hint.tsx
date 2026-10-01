// Dica viva da justificativa do override: diz o mínimo e quantos faltam,
// em vez de só deixar o botão desabilitado.
/** Mínimo de caracteres da justificativa de uma decisão sobre o eixo (override
 *  e confirmação do computado). */
export const RATIONALE_MIN = 20;

export function RationaleHint({
  length,
  min,
}: {
  length: number;
  min: number;
}) {
  const missing = min - length;
  const ok = missing <= 0;
  return (
    <span
      aria-live="polite"
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: ok ? "var(--green-text)" : "var(--amber-text)",
      }}
    >
      {ok
        ? `Mínimo atingido (${length}/${min} caracteres).`
        : `Mínimo de ${min} caracteres — faltam ${missing}.`}
    </span>
  );
}
