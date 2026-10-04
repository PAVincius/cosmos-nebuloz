# Scaffold — security maxing: publicar método é da Nebuloz (CRÍTICO)

Branch `fix/scaffold-sec-publish-version`, a partir de github/main e67c1069. Origem: nota "Andaime - checklist", achado crítico.

- `publishVersion` grava numa versão de template GLOBAL; a mais recente vira a base das trilhas novas de todas as organizações. Admin de cliente tinha `template.publish`.
- Matriz: `template.publish` fica só no CONSULTANT; nova permissão `overlay.manage` (ADMIN e CONSULTANT) para `saveOverlay` e `resolveConflict`, que são do tenant.
- Action: além da permissão, exige `Tenant.isInternalTenant` (marca que só a plataforma grava), com o código `TEMPLATE_PUBLISH_INTERNAL_ONLY`. Só o papel de consultor não basta, porque o admin do cliente consegue atribuí-lo a um colega.
- Efeito colateral aceito: o consultor da Nebuloz que opera dentro de um tenant de cliente não publica método dali; publica do tenant interno.
- Testes: matriz (3), `template-publish-guard.test.ts` (4: ADMIN recusado e nada gravado, consultor em tenant de cliente recusado, consultor no tenant interno publica, overlay pede `overlay.manage`). `__tests__/scaffold` 62 arquivos / 1111 testes; rbac 143.
- `tsc` neste worktree enxerga o pacote rbac do checkout principal (symlink), então acusa `overlay.manage` desconhecido; no CI resolve o pacote desta branch.
