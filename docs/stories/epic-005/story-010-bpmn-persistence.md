# Story: Persistência de Modelos BPMN
**Epic:** epic-005
**Status:** pending
**WSJF Score:** 16.0

## Description
Como um sistema corporativo, preciso salvar o arquivo XML nativo gerado pelo modelador BPMN no banco de dados relacional atrelado a uma equipe de forma isolada por tenant, garantindo o controle de versão das definições.

## Acceptance Criteria
- [ ] Criar Server Actions no `apps/app` (ou rotas tRPC no `apps/api`) para `saveBpmnDefinition` e `loadBpmnDefinition`.
- [ ] O salvamento deve incrementar automaticamente o campo `version` caso já exista uma definição para aquele `teamId`.
- [ ] Garantir que o campo `xmlContent` (armazenado como texto longo) passe sem corrupção de encoding UTF-8.

## Technical Notes
- Utilizar o modelo Prisma `BpmnDefinition`.
- Validar se o XML inicia com `<?xml` ou `<bpmn:definitions` antes de autorizar a persistência para evitar injeção de lixo no banco.

## Test Plan
- Salvar um fluxo BPMN com uma string XML válida via API. Tentar carregar novamente e verificar se o retorno possui o mesmo tamanho em bytes e a versão correta.
