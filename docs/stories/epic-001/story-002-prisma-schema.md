# Story: Prisma Schema & Banco de Dados
**Epic:** epic-001
**Status:** pending
**WSJF Score:** 18.5

## Description
Como um Desenvolvedor, quero inicializar o banco de dados PostgreSQL configurando as tabelas e entidades descritas na arquitetura, para que o sistema consiga salvar dados com multi-tenancy e grafos.

## Acceptance Criteria
- [ ] As tabelas `Tenant`, `User`, `TenantMember`, `Epic`, `Feature`, `DependencyLink`, `TeamWorkflowNode` e `TeamWorkflowEdge` devem existir no banco.
- [ ] Todas as relações devem suportar deleção em cascata e conter a coluna `tenantId`.

## Technical Notes
- Utilizar o arquivo Prisma providenciado no `docs/architecture.md`.
- Executar a primeira migration (ex: `npx prisma migrate dev`).

## Test Plan
- Os tipos gerados pelo Prisma Client devem estar acessíveis no `apps/web`.
