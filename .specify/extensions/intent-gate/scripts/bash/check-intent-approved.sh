#!/usr/bin/env bash
# check-intent-approved.sh
#
# Gate for /speckit-specify: verifies the target feature directory has an
# intent.md with `status: approved` in its YAML frontmatter.
#
# Usage: check-intent-approved.sh <feature-dir>
#
# Exit 0: intent.md exists and status is approved.
# Exit 1: intent.md missing, status not approved, or usage error.
#
# No yq/python3 dependency — the only frontmatter field this reads is a
# single `status:` key, so grep/sed is sufficient (see research.md in
# specs/001-add-intent-stage/ for the rationale).

set -euo pipefail

FEATURE_DIR="${1:-}"

if [[ -z "$FEATURE_DIR" ]]; then
  echo "intent-gate: uso: check-intent-approved.sh <feature-dir>" >&2
  exit 1
fi

INTENT_FILE="$FEATURE_DIR/intent.md"

if [[ ! -f "$INTENT_FILE" ]]; then
  echo "intent-gate: bloqueado — '$INTENT_FILE' não existe." >&2
  echo "intent-gate: rode /speckit-intent primeiro para esta feature." >&2
  exit 1
fi

# Extract the value of `status:` from the first YAML frontmatter block
# (between the first two lines that are exactly "---").
STATUS=$(awk '
  /^---$/ { delim++; next }
  delim == 1 && /^status:/ { sub(/^status:[[:space:]]*/, ""); print; exit }
  delim >= 2 { exit }
' "$INTENT_FILE" | tr -d '[:space:]')

if [[ "$STATUS" != "approved" ]]; then
  echo "intent-gate: bloqueado — '$INTENT_FILE' tem status '${STATUS:-<ausente>}', não 'approved'." >&2
  echo "intent-gate: complete a aprovação via /speckit-intent antes de rodar /speckit-specify." >&2
  exit 1
fi

echo "intent-gate: ok — intent aprovado para '$FEATURE_DIR'."
exit 0
