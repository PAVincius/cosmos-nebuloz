# Blocos A e B respondidos — transversal e Cosmos

Auditado contra **`origin/main`**. Legenda: **X** não · **Y** parcial · **Z** sim.

Onde a resposta depende de decisão de processo e não de código, está marcado
**→ você** em vez de chutada.

---

## A — Transversal

### A.1 Arquitetura e fronteiras

| # | Resp | Evidência |
|---|---|---|
| A1.1 | **→ você** | Há `docs/` extenso e `graphify-out/` com 10k nós, mas não achei diagrama de *fronteira de confiança*. Grafo de código não é o mesmo que trust boundary. |
| A1.2 | **Y** | Existe `@repo/eslint-plugin-cosmos`, e o job `cosmos-graph` valida o grafo. Não é uma regra de "quem pode importar quem" entre apps e pacotes. |
| A1.3 | **Z** | `requireTenantSession` + `withTenantDb`; 21 arquivos de teste afirmam escopo de tenant, incluindo `security/rls-effective.test.ts`. |
| A1.4 | **Z** | Job `schema-drift` no CI + migrations versionadas. |
| A1.5 | **Z** | `lib/health.ts` e `lib/lab.ts` documentam a derivação e explicam por que não viram coluna. |

### A.2 Segredos e dependências

| # | Resp | Evidência |
|---|---|---|
| A2.1 | **Y** | GitGuardian roda como check do GitHub (visto no PR #57), mas **não há scan de segredo dentro do `ci.yml`** — depende do app externo estar ligado no repo. |
| A2.2 | **X** | Sem processo nem data de rotação registrada. |
| A2.3 | **X** | Os segredos expostos nesta sessão (senha do banco, `BETTER_AUTH_SECRET`) seguem sem confirmação de rotação. |
| A2.4 | **Z** | `ci.yml:242` — `pnpm audit --audit-level=high`. |
| A2.5 | **X** | Os críticos estão listados, sem dono nem prazo. |
| A2.6 | **X** | `requirements.txt`: 3 dependências, **nenhuma** com versão fixa. |
| A2.7 | **Y** | O CI valida com `--frozen-lockfile`, e foi exatamente isso que pegou a falha do PR #57 — mas pegou **depois** do merge do package.json, não antes. |

### A.3 CI/CD

| # | Resp | Evidência |
|---|---|---|
| A3.1 | **Y** | 12 jobs: `lint`, `typecheck`, `test`, `build`, `security-audit`, `schema-drift`, `cosmos-graph` e outros. `turbo test` alcança o backoffice; a cobertura dele não é coletada. |
| A3.2 | **→ você** | Depende de branch protection, que não dá para ler do repositório. |
| A3.3 | **→ você** | Idem. |
| A3.4 | **X** | Não existe `.github/CODEOWNERS`. |
| A3.5 | **Y** | Um `continue-on-error` no `ci.yml`. Falha declarada, não silenciada em massa. |
| A3.6 | **Z** | Deploy pela Vercel, rastreável ao commit e revertível pelo painel. |
| A3.7 | **X** | As migrations desta leva foram aplicadas colando SQL no editor do Supabase. |

### A.4 Observabilidade

| # | Resp | Evidência |
|---|---|---|
| A4.1 | **Y** | `apps/app`, `apps/web` e `apps/api` têm Sentry. **`apps/backoffice` não.** |
| A4.2 | **→ você** | Alerta é configuração do Sentry, fora do repositório. |
| A4.3 | **Y** | `packages/ai/lib/mascara.ts` mascara antes do Langfuse. Não há varredura equivalente no log geral. |
| A4.4 | **Z** | `AuditLog` por tenant, `AccessLog` para staff, e o Audit Explorer no painel. |

### A.5 QA e processo

| # | Resp | Evidência |
|---|---|---|
| A5.1 | **→ você** | |
| A5.2 | **X** | O `PULL_REQUEST_TEMPLATE.md` existe **em disco mas não está versionado** — não chega em PR de mais ninguém. E o checklist dele não tem item de segurança. |
| A5.3 | **X** | Não há suíte de regressão distinta da suíte de PR. |
| A5.4 | **→ você** | |
| A5.5 | **Y** | `docs/runbooks/charter-em-producao.md` existe; não há runbook de vazamento, abuso de agente ou custo. |

---

## B — Cosmos (`apps/app`)

### B.1 Segurança e multi-tenancy

| # | Resp | Evidência |
|---|---|---|
| B1.1 | **Z** | `requireTenantSession` nas actions, não só no layout. |
| B1.2 | **Z** | Padrão consistente nas actions auditadas. |
| B1.3 | **Z** | 21 arquivos de teste sobre escopo de tenant, incluindo `security/rls-effective.test.ts` e `security/tenant-unique-keys.test.ts`. |
| B1.4 | **Z** | `requireRole` no servidor; `write-button.test.tsx` prova que a UI é a metade cosmética. |
| B1.5 | **Z** por construção | Server Action do Next valida `Origin`/`Host`. Vale checar rota de API, não action. |
| B1.6 | **Y** | 6 de 29 rotas de API aplicam rate limit. As de webhook e copilot têm; as demais não. |
| B1.7 | **Z** | `@repo/security/encrypt` cifra; teste afirma que `config`/`token`/`apiKey` não saem no payload. |

### B.2 IA — entrada, saída e agência

| # | Resp | Evidência |
|---|---|---|
| B2.1 | **Z** | `lib/prompt-fence.ts` nas cinco ações de épico (PR #57). |
| B2.2 | **Z** | `system` e `prompt` separados pelo AI SDK; `prompt-hierarchy.test.ts` cobre a hierarquia. |
| B2.3 | **Y** | `generateObject` com schema zod nas que retornam estrutura; as de texto livre não validam antes de persistir. |
| B2.4 | **Z** | Nenhum `dangerouslySetInnerHTML` em código-fonte do `apps/app` (só no relatório gerado do Playwright). |
| B2.5 | **Z** | `tools-authz.test.ts` (PR #57) — e o guard só passou a ser exercido de fato naquele PR. |
| B2.6 | **Y** | A fila de aprovação existe no painel; o agente do Cosmos não a usa. |
| B2.7 | **Y** | Traço no Langfuse com tenant e modo; não é log de tool call com parâmetros. |
| B2.8 | **Y** | Prompt versionado com o código, sem rollback independente de deploy. |

### B.3 IA — dados, custo e RAG

| # | Resp | Evidência |
|---|---|---|
| B3.1 | **→ você** | É contrato, não código. |
| B3.2 | **Z** | `vector-search.ts:75` — `WHERE "tenantId" = ${tenantId}` parametrizado, em todas as consultas do arquivo. |
| B3.3 | **Y** | Há normalização no indexador; não há remoção de segredo. |
| B3.4 | **Y** | 8 arquivos com `maxOutputTokens`. Ainda faltam pontos de chamada. |
| B3.5 | **X** | Cota existe só para o Copilot (`quota.ts`, por tenant/PI/plano). Os outros pontos de IA não têm. |
| B3.6 | **Y** | Langfuse registra tokens; não há alerta de pico. |
| B3.7 | **X** | Não existe kill switch por tenant. |
| B3.8 | **Z** | `packages/ai/lib/mascara.ts`. |

### B.4 Testes

| # | Resp | Evidência |
|---|---|---|
| B4.1 | **Z** | 2735 testes; regras de estado, WSJF, budget lock e limite de WIP com teste próprio. |
| B4.2 | **Y** | Cobertura boa, não universal. |
| B4.3 | **Y** | Validação sim; concorrência quase não. |
| B4.4 | **Y** | Há testes de tela (`__tests__/screens/`), não para todas as críticas. |
| B4.5 | **Z** | 41 specs Playwright, com 6 personas semeadas em `e2e/setup/auth.setup.ts`. |
| B4.6 | **→ você** | Precisa rodar; historicamente havia specs apontando para rotas mortas. |
| B4.7 | **Z** | Nenhum teste chama LLM real. |
| B4.8 | **Z** | `security/rls-effective.test.ts`. |

### B.5 Cobertura

| # | Resp | Evidência |
|---|---|---|
| B5.1 | **Z** | `ci.yml:218` sobe `apps/app/coverage/`. |
| B5.2 | **Y** | Limiar de 80 configurado. `@repo/safe-engine` está em 72% — o limiar existe e é ultrapassado sem bloquear. |
| B5.3 | **X** | Só o número global. |
| B5.4 | **X** | Sem verificação de cobertura de código novo. |

---

## Contagem

| Bloco | X | Y | Z | → você |
|---|---|---|---|---|
| A — Transversal | 6 | 7 | 5 | 6 |
| B — Cosmos | 4 | 12 | 14 | 3 |
| C — Back office | 16 | 8 | 9 | 5 |

## Leitura dos três blocos juntos

**O Cosmos está muito à frente do painel, e a diferença não é de esforço — é de
quem olha.** O `apps/app` tem 2735 testes, 41 specs E2E, Sentry, cobertura no CI
com limiar. O `apps/backoffice` tem 185 testes de action, zero E2E, zero Sentry,
cobertura não medida. O produto tem cliente reclamando; o painel interno não tem
ninguém do lado de fora para reclamar, e o silêncio virou ausência de sinal.

**O bloco A é o que trava os outros dois.** Sem `CODEOWNERS` (A3.4), sem
processo de rotação (A2.2), sem suíte de regressão (A5.3) e com o template de PR
não versionado (A5.2), cada bloco de produto refaz sozinho o que devia ser
transversal. A5.2 é o mais barato de todos e o mais silencioso: o template está
no seu disco e em nenhum PR de mais ninguém.

**Os dois de A que eu atacaria antes de qualquer coisa do B:**

1. **A2.3 — os segredos desta sessão seguem sem rotação confirmada.** É o único
   item da lista inteira em que o risco já se materializou; o resto é
   probabilidade.
2. **A4.1 — Sentry no back-office.** Uma linha de config que destrava a seção
   C.5 inteira, hoje zerada. Enquanto não existir, "quais erros o painel tem"
   não é uma pergunta respondível.

**Um padrão que se repete nos três blocos:** quase todo Y é "existe para uma
parte". Rate limit em 6 de 29 rotas, cota só no Copilot, `maxOutputTokens` em 8
arquivos, cobertura só do app principal. Não é falta de decisão — a decisão foi
tomada e aplicada onde doía. O trabalho que sobra é propagação, e propagação é
justamente o que ninguém prioriza porque cada caso isolado parece pequeno.
