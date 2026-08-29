---
name: "speckit-intent-gate-check"
description: "Verify the target feature's intent.md is approved before /speckit-specify proceeds"
argument-hint: "Feature directory to check (e.g. specs/003-user-auth)"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "cosmos-nebuloz"
  source: ".specify/extensions/intent-gate/commands/speckit.intent-gate.check.md"
user-invocable: true
disable-model-invocation: false
---

# Check Intent Approval

Gate invoked by `/speckit-specify` as a mandatory `before_specify` hook (see `.specify/extensions.yml`). Verifies that the feature directory `/speckit-specify` is about to write into already has an `intent.md` with `status: approved`.

## Behavior

- Resolves the target feature directory the same way `/speckit-specify` does.
- Runs `.specify/extensions/intent-gate/scripts/bash/check-intent-approved.sh <feature-dir>`.
- Exit code `0`: intent approved, `/speckit-specify` proceeds to its Outline.
- Exit code `1`: intent missing or not approved — `/speckit-specify` MUST stop before generating any `spec.md`, surfacing the script's stderr message. No silent bypass.

This skill mirrors `.specify/extensions/intent-gate/commands/speckit.intent-gate.check.md` — same pattern used by `speckit-agent-context-update` mirroring the `agent-context` extension's command.
