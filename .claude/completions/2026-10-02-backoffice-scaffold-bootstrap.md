# Cartão ScaffoldBootstrap na ficha do cliente (02/10/2026)

Pedido do CEO: a ficha `/clientes/[slug]` não tinha como dar o papel do Scaffold; `bootstrapScaffoldAction` existia sem tela.

- Aba **Scaffold** na ficha, só com o módulo `SCAFFOLD` contratado (`contratados.has("SCAFFOLD")`, como Charter e Meridian), com o cartão `scaffold-bootstrap.tsx`: e-mail, `WriteButton`, `Confirmacao` e `Erro`.
- `bootstrapScaffoldAction` passou a devolver também `role` (o domínio já devolvia). Sem isso, "já existia" não dizia qual papel a pessoa tem, e a tela suporia ADMIN.
- Sem selo de papel: `getClient` não lê `ScaffoldMembership`. O cartão aparece sempre que o módulo está contratado; a action é idempotente.
- Erros `USER_NOT_FOUND` e `USER_NOT_MEMBER` já chegam legíveis pelo `safeAction` (mensagem do `ProvisioningError`).
- Testes: cartão (somente leitura, criado, já tinha papel, os dois erros, e-mail sem @), aba só com contrato; mock de `bootstrapScaffoldAction` nos 4 testes de página.
- `tsc` no worktree acusa erros de Prisma/`@repo/database` (client gerado ausente, node_modules em symlink); nenhum nos arquivos tocados.
