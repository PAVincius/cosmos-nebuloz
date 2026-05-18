# Story: Integração Multi-Tenant com Better Auth
**Epic:** epic-002
**Status:** pending
**WSJF Score:** 15.0

## Description
Como um Usuário, quero me autenticar no sistema de forma segura, para que a aplicação identifique a qual Tenant (Empresa) eu pertenço.

## Acceptance Criteria
- [ ] Implementar o `better-auth` com adaptadores para o Prisma.
- [ ] O token de sessão (ou context do tRPC) deve extrair e propagar o `tenantId` automaticamente nas requisições.

## Technical Notes
- Implementar Middlewares de Edge ou de tRPC para bloquear rotas caso a sessão não possua o Workspace correspondente ao ID.

## Test Plan
- Uma requisição a um endpoint protegido sem `tenantId` deve retornar 401 ou 403.
