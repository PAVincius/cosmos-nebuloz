# Gate de PR

Vale para todo terminal do canvas. Escrito à mão — `pnpm knowledge:refresh` não sobrescreve este arquivo.
Padrões de código: `.claude/COMMON_MISTAKES.md`. Princípios: `.specify/memory/constitution.md`.

## Segurança (multi-tenant)
- [ ] Toda query filtra `tenantId: ctx.tenantId` vindo de `requireTenantSession(await headers())`
- [ ] Mutação passa por `requireRole` + `logAudit`
- [ ] Acesso cross-tenant só pela porta única (ADR-0013); não confiar em RLS (ADR-0012)
- [ ] Action retorna `Result<T>` via `safeAction`, sem vazar mensagem interna

## Testes
- [ ] Vitest escopado: `npx vitest run <arquivo>` dentro de `apps/app` (ou `apps/backoffice`)
- [ ] Nunca `pnpm fix` na raiz — reformata 100+ arquivos
- [ ] Bug corrigido deixa teste que falharia sem o fix

## Schema e banco
- [ ] Mudança em `packages/database/prisma/schema/*` só pelo terminal **Plataforma**; outros propõem
- [ ] Aplicar schema em produção só pela **Infra**, depois do QA — um por vez no canvas inteiro (pooler sem `DIRECT_URL`, migrate não segura lock)
- [ ] Coleta dado pessoal ou grava reunião? Parecer da **Compliance** antes de ir ao ar
- [ ] Escrita em produção: pedir "vai" ao usuário a cada operação

## Git
- [ ] Commit sem trailer `Co-Authored-By`
- [ ] Ao fechar tarefa: `.claude/completions/YYYY-MM-DD-<tarefa>.md`
- [ ] Entrega de back-office confirmada em backoffice.nebuloz.ai

## Floors
- [ ] Dev server na :3012 só num floor por vez (ou `PORT` próprio)
- [ ] Floor limpo (tudo commitado) antes de pedir `land` ao Maestro
