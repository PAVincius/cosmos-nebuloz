# BaseHub — estrutura do blog do nebuloz.ai

O schema do repositório BaseHub que alimenta `apps/web` estava vazio. Por isso o `basehub build`
gerava tipos sem `blog`, e o preview do projeto Vercel `nebuloz-web` morria no type check
(`"PostsItem" is not assignable to keyof FragmentsMap`).

- Código (PR #306, já na main): saíram as queries `legalPages` de `packages/cms/index.ts` e a rota
  `/.well-known/vercel/flags` do web, que exigia `BETTER_AUTH_SECRET`.
- BaseHub (Mutation API, `transactionAwaitable`): documento `blog` na raiz com as collections
  `authors` (`avatar` imagem obrigatória, `xUrl` texto), `categories` (só `_title`) e `posts`
  (`authors` e `categories` como referências múltiplas, `date`, `description`, `image`, `body`).
  Commit na branch `main` do BaseHub. Conteúdo de exemplo: autor "Equipe Nebuloz", categoria
  "Novidades" e o post `bem-vindo-ao-blog-da-nebuloz`.
- `packages/cms/basehub-types.d.ts` regenerado a partir do schema novo.

Armadilha: um bloco criado com `type: "image"` sai como Media genérico (`MediaBlockUnion`) e quebra
o `fragmentOn("BlockImage")`. Use `type: "media"` com `subTypes: ["image"]`. O update não aceita
`subTypes`; para corrigir, é preciso apagar e recriar o bloco.

Validação local: `basehub build`, `tsc --noEmit` (cms e web) e `next build` do web, todos verdes.
O `/[locale]/blog` renderiza sem o aviso "CMS: ... falhou".

Node dentro do sandbox: o `fetch` nativo só usa o proxy com `NODE_USE_ENV_PROXY=1`.
