# Quickstart: Reemitir link do respondente (Meridian)

Pré-requisito: `pnpm dev` (apps/app em `:3012`), um assessment em `COLLECTING` com pelo menos um respondente atribuído.

## Cenário 1 — Reemitir link individual (US1, FR-001/FR-002)

1. Atribuir um respondente, fechar o modal sem copiar o link.
2. Na linha do respondente, clicar "Reemitir link".
3. **Esperado**: link novo exibido; o link antigo (`/meridian-responder/<token-antigo>`) não abre mais a bateria.

## Cenário 2 — Bloqueios (US1, FR-003 a FR-005)

1. Marcar um respondente como `DONE` (completar a bateria) e tentar "Reemitir link".
2. **Esperado**: bloqueado, mensagem explicando que já concluiu.
3. Revogar um respondente e tentar "Reemitir link".
4. **Esperado**: bloqueado, mensagem explicando que foi revogado.
5. Com um assessment de `deadline` vencido, tentar "Reemitir link" em qualquer respondente elegível.
6. **Esperado**: bloqueado, mensagem de prazo vencido.

## Cenário 3 — Auditoria (US1, FR-007)

1. Reemitir um link.
2. Conferir o log de auditoria do assessment.
3. **Esperado**: entrada `meridian.respondent.reissue` para o respondente.

## Cenário 4 — Reemitir e copiar todos os pendentes (US2, FR-008 a FR-011)

1. Ter vários respondentes em `INVITED`/`PENDING`/`OVERDUE` (e opcionalmente algum `DONE`).
2. Clicar "Reemitir e copiar todos os pendentes".
3. **Esperado**: lista com nome · eixo · link de todos os pendentes (não inclui os `DONE`).
4. Clicar "copiar tudo".
5. **Esperado**: conteúdo completo na área de transferência.
6. Baixar `.txt`/`.csv`.
7. **Esperado**: arquivo com o mesmo conteúdo.

## Cenário 5 — Lote sem pendentes (FR-013)

1. Num assessment onde todos os respondentes já são `DONE` ou `REVOKED`, clicar "Reemitir e copiar todos os pendentes".
2. **Esperado**: mensagem informando que não há pendentes — não aparece lista vazia como sucesso.

## Cenário 6 — `tokenExpiresAt` fixado (FR-006)

1. Reemitir um link.
2. Estender o `deadline` do assessment depois.
3. **Esperado**: o `tokenExpiresAt` do link já reemitido não muda (fica no valor calculado no momento da reemissão).
