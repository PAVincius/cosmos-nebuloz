# Story: Componente Workspace Switcher
**Epic:** epic-002
**Status:** pending
**WSJF Score:** 12.0

## Description
Como um Usuário multi-tenant, quero poder alternar entre diferentes Workspaces (Empresas) no menu superior, para que eu visualize os dados corretos isoladamente.

## Acceptance Criteria
- [ ] A interface possui um Dropdown no canto superior esquerdo com a lista de Tenants que o usuário participa.
- [ ] Ao trocar de tenant, a interface deve forçar o recarregamento dos dados usando um full-screen loader para evitar vazamento de cache client-side.

## Technical Notes
- Utilizar `DropdownMenu` do shadcn/ui.
- Invalidar todos os roteadores do React Query/tRPC no momento da troca.

## Test Plan
- E2E Playwright: Usuário troca do Tenant A para Tenant B, o loader pisca, e as tabelas renderizam os dados exclusivamente do B.
