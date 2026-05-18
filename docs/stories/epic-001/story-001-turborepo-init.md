# Story: Configuração do Turborepo e Tailwind
**Epic:** epic-001
**Status:** pending
**WSJF Score:** 20.0

## Description
Como um Desenvolvedor (Dev Agent), quero inicializar a base do Next-Forge v5.3.2 com Turborepo e configurar o Tailwind CSS com shadcn/ui, para que tenhamos a fundação para os próximos componentes.

## Acceptance Criteria
- [ ] O workspace pnpm deve estar configurado corretamente rodando Next.js no `apps/web`.
- [ ] O `shadcn/ui` deve estar instalado e o Tailwind configurado globalmente (Dark/Light mode).

## Technical Notes
- Seguir a divisão definida em `docs/architecture.md` (apps/web, packages/ui).

## Test Plan
- O `pnpm dev` deve rodar sem erros.
- A home page deve renderizar com o tema Dark do Tailwind.
