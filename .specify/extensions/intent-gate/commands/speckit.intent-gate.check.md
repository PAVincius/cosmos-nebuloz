---
description: "Verify the target feature's intent.md is approved before /speckit-specify proceeds"
---

# Check Intent Approval

Gate invoked by `/speckit-specify` as a mandatory `before_specify` hook. Verifies that the feature directory `/speckit-specify` is about to write into already has an `intent.md` with `status: approved`.

## Behavior

- Resolves the target feature directory the same way `/speckit-specify` does (via `SPECIFY_FEATURE_DIRECTORY` resolution — explicit override, or `specs/<prefix>-<short-name>` freshly computed for this invocation).
- Runs `check-intent-approved.sh <feature-dir>`.
- Exit code `0`: intent approved, `/speckit-specify` proceeds to its Outline.
- Exit code `1`: intent missing or not approved — `/speckit-specify` MUST stop before generating any `spec.md`, surfacing the script's stderr message (which already names the file and suggests running `/speckit-intent` first). No silent bypass.

## Execution

- **Bash**: `.specify/extensions/intent-gate/scripts/bash/check-intent-approved.sh <feature-dir>`

No PowerShell variant — this repo's `.specify/init-options.json` declares `"script": "sh"` only (see plan.md Technical Context in `specs/001-add-intent-stage/`).
