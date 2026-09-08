# Contract: `check-intent-approved.sh` (extensão `intent-gate`)

Script bash invocado como hook `before_specify` (mandatory) por `/speckit-specify`.

## Input

```
check-intent-approved.sh <feature-dir>
```

`<feature-dir>` = `SPECIFY_FEATURE_DIRECTORY` resolvido pelo `/speckit-specify` que está prestes a rodar (ex: `specs/003-user-auth`).

## Output / exit codes

| Condição | Exit code | Stdout/stderr |
|---|---|---|
| `<feature-dir>/intent.md` existe e `status: approved` | `0` | silencioso (ou confirmação curta) |
| `<feature-dir>/intent.md` não existe | `1` | mensagem clara: intent ausente, sugestão de rodar `/speckit-intent` primeiro |
| `<feature-dir>/intent.md` existe, `status` != `approved` | `1` | mensagem clara: intent em draft, sugestão de completar aprovação |
| `<feature-dir>` vazio/não informado | `1` | erro de uso |

Exit code != 0 → `/speckit-specify` MUST parar antes da Outline (FR-008), sem gerar `spec.md`.

## Degradação (edge case aceito no spec.md)

Se `.specify/extensions.yml` estiver malformado, a leitura do hook já falha silenciosamente ANTES deste script ser invocado (comportamento pré-existente do `speckit-specify`, não modificado por esta feature) — nesse caso específico o gate não bloqueia. Risco aceito, documentado, não é bug desta feature.
