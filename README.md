# Nebuloz

**Seis produtos que deixam uma organização pronta para usar IA, numa ordem fixa, com o método ficando com o time do cliente.**

Este é o monorepo da suíte: cinco produtos de cliente num único app (`app.nebuloz.ai`) e o back-office que vende e opera todos eles (`backoffice.nebuloz.ai`).

## Os produtos

Cada produto responde a uma pergunta. Quando dois produtos respondem à mesma pergunta, um dos dois está fora do lugar.

| Produto | Papel | Pergunta | Onde vive |
|---|---|---|---|
| **Meridian** | Avaliar | Estamos prontos? | `apps/app` · `/meridian` |
| **Scaffold** | Contratar | O que foi prometido? | `apps/app` · `/scaffold` |
| **Cosmos** | Executar | O que estamos fazendo? | `apps/app` · `/cosmos`, `packages/safe-engine` |
| **Signal** | Apurar | Valeu a pena? | `apps/app` · `/signal` |
| **Charter** | Governar (transversal) | É permitido? Sob qual risco? | `apps/app` · `/charter` |
| **Big Bang** | Vender e operar (transversal) | Como isso entra e roda? | `apps/backoffice` |

Os quatro primeiros correm em sequência; Charter e o back-office atravessam todas as fases. Cada estágio deixa um artefato versionado, com autor e justificativa, que o estágio seguinte lê sem editar.

A fronteira entre eles é explícita: toda entidade compartilhada (tenant, permissão, baseline, portfólio, escala de confiança…) tem exatamente um dono. O mapa está em [`docs/produto/mapa-de-fronteiras.md`](docs/produto/mapa-de-fronteiras.md), e cada produto tem PRD e SRD em [`docs/produto/`](docs/produto/).

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5.9 |
| Monorepo | pnpm + Turborepo |
| Dados | PostgreSQL (pgvector) via Prisma 7 |
| Auth | Better Auth, multi-tenant, com RBAC próprio (`packages/rbac`) |
| UI | Tailwind + shadcn/ui, design system em `packages/design-system` |
| Estado e tempo real | XState, Liveblocks, Tiptap |
| Qualidade | Biome, Vitest, Playwright |
| Observabilidade | Sentry, Better Stack |
| Deploy | Vercel |

## Estrutura

```
apps/
├── app/            # os cinco produtos de cliente (porta 3012)
├── backoffice/     # Big Bang — vender e operar (3013)
├── api/            # webhooks, cron e integrações
├── web/            # site nebuloz.ai (3001)
├── docs/           # documentação pública, gera de docs/cliente (3004)
├── docs-internal/  # PRDs e SRDs, gera de docs/produto (3014)
├── email/          # preview dos templates de e-mail (3003)
├── storybook/      # catálogo de componentes (6006)
└── memoria/        # memória de longo prazo dos agentes (local, MCP)
packages/
├── auth · rbac · provisioning · database   # plataforma comum aos seis produtos
├── safe-engine                              # motor SAFe do Cosmos
├── design-system                            # componentes e tokens
└── …                                        # observability, security, rate-limit, webhooks…
```

## Rodando localmente

Pré-requisitos: Node 20+, pnpm 10 e um PostgreSQL com a extensão `vector`.

```bash
pnpm install
cp apps/app/.env.example apps/app/.env.local   # preencha DATABASE_URL e BETTER_AUTH_SECRET
pnpm migrate                                   # gera o client e aplica as migrations
pnpm dev                                       # sobe todos os apps; o produto fica em :3012
```

Comandos do dia a dia:

```bash
pnpm test         # Vitest em todos os pacotes
pnpm check        # Biome (lint + format)
pnpm build        # build de todos os apps via Turborepo
pnpm size:guard   # nenhum arquivo novo acima de 800 linhas
```

## CI/CD

Três workflows em `.github/workflows/`:

- **`ci.yml`**: lint, typecheck, testes com cobertura contra Postgres efêmero, *schema drift*, auditoria de dependências, o grafo de completude do Cosmos e o build. Tem três jobs de IA: nota de risco no PR, geração de testes e correção de CI quebrado na `main`.
- **`pipeline.yml`**: o caminho até produção. Roda o CI e SAST (CodeQL e gitleaks), gera uma imagem imutável por commit com scan do Trivy, sobe um staging efêmero com smoke test e DAST (OWASP ZAP) e promove para produção com aprovação manual.
- **`dark-matter.yml`**: um ambiente efêmero por PR, com branch de banco no Neon e preview na Vercel, destruído quando o PR fecha.

Detalhes do pipeline em [`PIPELINE-CICD.md`](PIPELINE-CICD.md).

## Documentação

| O quê | Onde |
|---|---|
| Verdade de produto da suíte | [`PRODUCT.md`](PRODUCT.md) |
| PRD e SRD por produto | [`docs/produto/`](docs/produto/) |
| Decisões de arquitetura | [`docs/adr/`](docs/adr/) |
| Documentação para clientes | [`docs/cliente/`](docs/cliente/) |
| Guia para agentes de código | [`CLAUDE.md`](CLAUDE.md) |

## Origem e licença

A base do monorepo começou no template [next-forge](https://github.com/vercel/next-forge), da Vercel, sob licença MIT ([`license.md`](license.md)). Tudo que é produto — os seis produtos, o motor SAFe, a plataforma multi-tenant e o pipeline — foi construído aqui.
