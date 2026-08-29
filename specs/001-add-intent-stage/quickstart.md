# Quickstart: validar o Estágio de Intent

Pré-requisito: implementação completa (skills + extensão + entrada em `extensions.yml`).

## Cenário 1 — capturar ideia nova (US1, FR-001/002)

```
/speckit-intent toggle de dark mode nas configurações
```

Esperado: `specs/NNN-toggle-dark-mode/intent.md` criado, frontmatter `status: draft`, 5 seções preenchidas.

## Cenário 2 — roast me (US2, FR-003)

Durante o Cenário 1, esperado: entre 1 e 5 perguntas céticas, uma de cada vez, antes do resumo final. Responder cada uma antes da próxima aparecer.

## Cenário 3 — aprovação explícita (US3, FR-004/005/006/007)

Ao final do Cenário 1/2:
- Responder "ajusta X" → `intent.md` editado, `status` continua `draft`, novo resumo apresentado.
- Responder "aprovado" → `status` vira `approved`, commit feito (`git log -1` confirma).

Verificar a qualquer momento intermediário (`cat intent.md`) que `status` nunca é `approved` sem essa aprovação explícita ter acontecido.

## Cenário 4 — gate bloqueia specify sem intent aprovado (US4, FR-008/009/010)

```
# feature nova, sem passar por /speckit-intent
/speckit-specify outra feature qualquer
```

Esperado: bloqueado, mensagem clara sugerindo `/speckit-intent` primeiro, nenhum `spec.md` novo gerado.

Repetir com `intent.md` em `status: draft` na pasta alvo → mesmo bloqueio.

Repetir com `intent.md` em `status: approved` (ex: o do Cenário 3) → `/speckit-specify` roda normalmente, sem interferência.

## Verificação de não-regressão

Rodar `/speckit-specify` numa feature **já existente antes desta implementação** (se houver) — confirma que o gate não quebra fluxo pré-existente por engano (não há nenhuma hoje, `specs/` estava vazio antes de `001-add-intent-stage`, então este é o próprio caso de teste).
