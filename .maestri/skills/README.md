# Skills por papel

Cópias revisadas de skills públicas (skills.sh), só markdown, sem script executável.
`setup-canvas.sh` copia cada uma para `.maestri/roles/<id>/.claude/skills/` do papel que a usa,
então só aquele agente a carrega. Atualizar = copiar de novo do commit novo e revisar o diff.

| Skill | Origem | Commit | Licença | Papéis |
|---|---|---|---|---|
| supabase-postgres-best-practices | supabase/agent-skills | 8331f91 | MIT | Plataforma, Infra |
| prisma-cli | prisma/skills | 1123817 | MIT | Plataforma, Infra |
| prisma-client-api | prisma/skills | 1123817 | MIT | todos os Devs |
| agent-browser | vercel-labs/agent-browser `skill-data/core` (v0.38.1) | 021d925 | Apache-2.0 | QA, todos os Devs |
| agent-browser-dogfood | vercel-labs/agent-browser `skill-data/dogfood` (v0.38.1) | 021d925 | Apache-2.0 | QA |
| sales-enablement | coreyhaines31/marketingskills | 5b2c000 | MIT | CRO, Propostas |
| pricing | coreyhaines31/marketingskills | 5b2c000 | MIT | CRO, CFO, Propostas |
| prospecting, cold-email | coreyhaines31/marketingskills | 5b2c000 | MIT | Pré-vendas |
| customer-research | coreyhaines31/marketingskills | 5b2c000 | MIT | Pré-vendas, Sucesso do Cliente |
| offers | coreyhaines31/marketingskills | 5b2c000 | MIT | Propostas |
| revops, attribution, analytics | coreyhaines31/marketingskills | 5b2c000 | MIT | RevOps |
| churn-prevention, onboarding | coreyhaines31/marketingskills | 5b2c000 | MIT | Sucesso do Cliente |
| content-strategy, seo-audit, launch, competitors | coreyhaines31/marketingskills | 5b2c000 | MIT | Growth |
| copywriting, copy-editing, social, emails | coreyhaines31/marketingskills | 5b2c000 | MIT | Conteúdo |
| better-accessibility, better-colors, better-interface, better-layout, better-typography, better-ui, better-writing, break, explain-interface, interface-review, variant | jakubkrehel/skills (v1.6.3) | 267330e | MIT | Devs de produto (Cosmos, Charter, Scaffold, Meridian, Signal, Backoffice) |

Não vieram: `mattpocock/skills` qa e to-prd (removidas do repo; `to-spec` já instalada é a sucessora),
`prisma-postgres` (é do banco hospedado da Prisma, não do ORM). ADR do repo vence skill:
o supabase-postgres empurra RLS, mas ADR-0012 registra RLS anulada pela conexão superuser.

`agent-browser` substituiu o `playwright-cli` nos agentes (2026-09-27). Das skills dele vieram só os markdown:
sem os `templates/*.sh` e sem as referências de proxy, profiling e WebGPU. O `name` do frontmatter foi trocado
(`core` → `agent-browser`, `dogfood` → `agent-browser-dogfood`) para não colidir com outras skills.

Camada de Receita (2026-09-27): da marketingskills vieram só os `.md`; os `evals/evals.json` ficaram de fora.

Interface (2026-09-30, pedido do CEO): da jakubkrehel/skills vieram só os `.md`; os `agents/openai.yaml` e os
arquivos de plugin ficaram de fora. Revisado sem script nem chamada de rede, exceto um `curl` de exemplo em
`explain-interface/no-browser.md` para baixar a página que o usuário quer explicar. O `DESIGN.md` do produto vence
skill: a lista de padrões recusados de cada `DESIGN.md` continua obrigatória, e trabalho de UI segue passando por `/impeccable`.
