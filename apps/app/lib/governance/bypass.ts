const MIN_JUSTIFICATION_CHARS = 50;

export type BypassValidation =
  | { valid: true }
  | { valid: false; reason: string };

export function validateBypassJustification(
  justification: string
): BypassValidation {
  const trimmed = justification.trim();
  if (trimmed.length < MIN_JUSTIFICATION_CHARS) {
    return {
      valid: false,
      reason: `Justification must be at least ${MIN_JUSTIFICATION_CHARS} characters (got ${trimmed.length})`,
    };
  }
  return { valid: true };
}
