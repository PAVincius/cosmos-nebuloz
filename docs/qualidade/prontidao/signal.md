# Prontidão do Signal para cliente externo

**Auditoria só leitura de código.** Metodologia: `docs/qualidade/gate-maturidade-carga.md`. Produção conferida via Vercel (projeto `cosmos-nebuloz-app`, team `team_CjCBX0DGD7HIlBL4MRqQmNzS`, deploy `dpl_2mBPsm1DYQ5Q1wVYo1A58482JWrb`, READY/production) em `4701a3d4acdc7afd69fac1b519c5e0ca72be9938` — mesmo commit citado pela Morgana. Estado da main remota (`ground/main`) confirmado em `4701a3d4`; o floor local (`a5a81a90`) está um merge atrás (só `.maestri/`, PR #268), com **zero commits de Signal** entre os dois — o código de Signal em produção é idêntico ao código de Signal neste checkout.

## Veredito: **NÃO APTO**

O gate de maturidade falha no primeiro critério (sem Success Criteria formal, E2E nunca executado). O SRD já é uma auto-auditoria requisito-a-requisito e aponta o motivo estrutural: para um tenant novo, **a UI não fecha o fluxo até ROI, confiança ou veredito** — só o script de seed grava adoção/resultado. O módulo é vendável no catálogo (confirmado em produção, `.claude/completions/2026-09-23-signal-no-catalogo.md`) sem que a jornada completa exista fora de dado semeado manualmente. Cobertura de teste está abaixo do próprio piso do time (funções 79,4%, branches 77,9% — piso é 80%), não há dogfood registrado, não há parecer de compliance, e seis das dez costuras com outros produtos previstas no SRD (§6) não existem.

## 1) Gate de maturidade (os três critérios)

| Critério | Resultado | Evidência |
|---|---|---|
| C1 — SC formal + E2E verde | ❌ Não cumprido | Zero "Success Criteria" formais: `grep -n "Success Criteria\|## SC\|SC-0" docs/produto/signal-prd.md docs/produto/signal-srd.md` → 0 ocorrências. E2E existe mas não roda verde: `apps/app/e2e/signal-a11y.spec.ts:71` tem `test.skip(true, "sem iniciativa semeada neste banco")` incondicional; `signal-journey.spec.ts:25,48,67,83,99,120` tem seis `test.skip` condicionados a dado semeado ausente. `.github/workflows/dark-matter.yml` provisiona ambiente por PR (Neon branch + seed) mas **não dispara Playwright em nenhum job** — os specs nunca rodaram em CI. |
| C2 — Dogfood sem P0/P1 aberto | Não avaliado (= não apto na prática) | Não existe `docs/qualidade/dogfood/signal/` (só Meridian tem pasta própria). O próprio PRD já documenta vários P0 "parcial" com gap real de implementação (§2 abaixo) — não há como fechar C2 sem esse dogfood existir. |
| C3 — Compliance quando aplicável | Não avaliado | `docs/compliance/` não tem parecer específico de Signal (`ls docs/compliance` não retorna nada com "signal"). Signal mede adoção/ROI sobre dado do próprio tenant, plausivelmente de risco baixo — mas isso não está confirmado por parecer nenhum, então fica em aberto, não dispensado. |

## 2) PRD/SRD contra o código

PRD (`docs/produto/signal-prd.md` §5, requisitos S-01..S-32) e SRD (`docs/produto/signal-srd.md`) já são eles mesmos um levantamento requisito-a-requisito com `arquivo:linha`. Resumo por status:

| ID | Requisito | Status | Evidência |
|---|---|---|---|
| S-01 | Criar/editar iniciativa | parcial | `actions/initiatives.ts:489-579` completo; tela só cria (`modal.tsx:124-129`), sem modo de edição (`screens/initiatives.tsx:96`) |
| S-02 | Ciclo DRAFT→ACTIVE→PAUSED→CLOSED/CANCELLED | implementado | `lib/signal/lifecycle.ts:22-44` — gap: status devia vir do Cosmos |
| S-03 | Ativar só com baseline assinado | implementado | `initiatives.ts:625-630` |
| S-04 | Baseline versionado imutável | implementado | `actions/baseline.ts:236-263` — gap: baseline devia vir do Scaffold |
| S-05 | Adoção/resultado com série e tendência ROI | parcial | cálculo e tela ok; **nenhuma action grava** dado real (só seed) |
| S-06 | ROI por componentes com fórmula versionada | parcial | `versionRoiFormula` testada, sem tela (`actions/roi.ts:157-267`) |
| S-07 | Confiança por fatores ponderados | parcial | pesos editáveis; pontuar só por action, sem tela |
| S-08 | Veredito adoção × múltiplo | implementado | `lib/signal/verdict.ts:75-85` |
| S-09 | Nenhum múltiplo sem versão + confiança | parcial | sidebar/overview/matriz vazam múltiplo sozinho |
| S-10 | Visão geral (portfólio, valor em risco, alertas) | parcial | sem bloco de alertas nem narrativa |
| S-11 | Detalhe (métricas, evidências, histórico) | parcial | evidência só contagem; sem histórico |
| S-12 | Corte por BU/programa/região/categoria | parcial | só BU+categoria, campo digitado, não árvore do Cosmos |
| S-13 | Filtro por status/categoria/BU/veredito/texto | parcial | falta filtro por veredito |
| S-14 | Conectar fonte, mapear evento→métrica | parcial | escrita só por action; nada dispara sync/health automaticamente |
| S-15 | Observação com origem rastreável | implementado | `actions/evidence.ts:142-177` — UI só manual |
| S-16 | Alertas LOW/WEAK/STALE | implementado | `lib/signal/alerts.ts:152-181` — disparo manual, sem agendador |
| S-17 | Todo alerta com dono | parcial | alerta aberto pelo código nasce sem `ownerId` |
| S-18 | Congelar relatório e exportar | parcial | JSON ok; sem PDF, rascunho sem tela |
| S-19 | Trilha append-only de→para | implementado | `actions/_shared.ts:98-168` |
| S-20 | Moeda da config em todo valor | parcial | `fmtBRL` fixa "R$" |
| S-21 | Acesso exige módulo + papel | implementado | `guards.ts:44-120` — gap: papel devia vir do Charter |
| S-22 | Incluir pessoa no Signal | **ausente** | provisionamento não cria membro; só seed |
| S-23 | Isolamento de tenant | implementado (não exercido) | RLS nas 18 tabelas — app conecta como superuser `BYPASSRLS` em dev, nunca testada de fato |
| S-24 | Acessibilidade (skip link, 44px, foco, contraste) | implementado (não verificado) | axe nunca executado (E2E skipado) |
| S-25 | Dicionário en-US | **ausente** | tudo fixo em PT-BR |
| S-26 | Conector real para 1 fonte | **ausente** | V1 só entrada manual |
| S-27 | Baseline importado do Scaffold | **ausente** (gap do mapa) | Signal cria baseline próprio, sem importador |
| S-28 | Anexar valor à árvore do Cosmos | **ausente** (gap do mapa) | `SignalInitiative` própria, sem chave para Epic/StrategicTheme |
| S-29 | Decisão de valor com dono+prazo → Cosmos | parcial | só leitura (veredito), nada persiste nem sai do Signal |
| S-30 | Atribuição de ganho com selo do Meridian | **ausente** (gap do mapa) | confiança é escala própria, não a do Meridian |
| S-31 | Encerramento com variância e lição ao Scaffold | **ausente** | só guarda motivo |
| S-32 | Citar avaliação de prontidão do Meridian | **ausente** | nenhuma referência |

SRD, por seção:
- **Guard (SG-01..08):** 6/8 implementado; faltam SG-07 (cache de papel nunca invalidado) e SG-08 (papel devia vir do Charter — gap).
- **Derivação/invariante ROI (SD-01..10):** 4 implementado, 3 parcial (SD-04 múltiplo vaza sem versão em 3 telas; SD-07 veredito trata fórmula vazia como 0 em vez de "sem lastro"; SD-09 sem dono por métrica), 3 **ausente** (SD-06 confiança não reage a queda de fonte; SD-08 sem selo Meridian; SD-10 sem atribuição de ganho).
- **Interfaces/costuras (§6):** 6 de 10 **ausentes** — Scaffold→Signal, Cosmos↔Signal, Meridian→Signal (2x), Signal→Scaffold, provisionamento não cria `SignalMember`/`SignalSettings`. Só Signal→Charter (trilha de auditoria) está implementado.
- **Não-funcionais (SN-01..11):** SN-06 (perf p95) nunca medido; SN-07 cobertura 88% de linhas mas **funções 79,4% / branches 77,9% — abaixo do piso de 80%** (`initiatives.ts` no pior caso, 67,5% de linhas); SN-09 (en-US) ausente; SN-11 (STALE automático) ausente, tudo manual.
- **Critérios de aceite (1-8, M1-M3):** 3 implementado, 4 parcial, 1 ausente (critério 2 — fluxo completo trava em "conectar fonte"); M1/M2/M3 (gaps do Mapa de Fronteiras) todos **ausentes**.
- **Aviso do próprio SRD:** os 416 testes passam, mas nenhum toca banco real — 12/14 arquivos de integração mockam `withTenantDb`; RLS nunca é exercitada nem em teste nem em dev.

**Riscos que bloqueiam venda a cliente externo** (PRD §7/§9):
1. Módulo tem preço no catálogo e é contratável, mas pela UI um tenant novo não chega a ROI, confiança nem veredito — só o seed grava adoção/resultado. Sem decisão registrada sobre travar a venda ou completar a UI antes.
2. Copy comercial promete conectores reais, telemetria por time e relatório para o conselho — nenhum existe hoje (S-26 ausente).
3. Modelo de dados próprio do Signal cresce a cada requisito novo (S-04, S-21, S-27, S-28, S-30) em vez de fechar o gap com o Mapa de Fronteiras — dívida arquitetural composta.
4. Nenhuma tela foi vista rodando nesta auditoria (só leitura de código); E2E nunca executado é o único sinal indireto de que o fluxo funciona.
5. Sem agendador: saúde e alertas só mudam por chamada manual de action — número pode ficar parado sem aviso em produção.
6. Regra de "mede adoção, não pessoas" só está no ICP, não virou requisito de produto (risco de vigilância de indivíduo).

## 3) Specs e completions

`specs/003-signal-measure/tasks.md`: **90 de 93 tasks fechadas.**
- `tasks.md:233` T090 não executado — perf p95 com 50 iniciativas, exige app rodando com sessão autenticada.
- `tasks.md:234` T091 não executado — comparação visual com screenshots do protótipo.
- `tasks.md:236-239` T093 parcial — `typecheck`/`build`/`ultracite` verdes na árvore Signal; falhas de `pnpm check`/`pnpm build` na raiz são de outras árvores (`apps/api`, env var `BASEHUB_TOKEN`), não do Signal.

Completions: `2026-09-02-signal-fundacao.md` (fases 1-2, schema/RBAC/guards/motor puro), `2026-09-02-signal-measure.md` (entrega das 10 telas, 416 testes, cobertura abaixo do piso já citada, lista "V1.5" pendente: conectores reais, benchmarking entre orgs, histórico de versão de mapeamento, export em PDF), `2026-09-23-signal-no-catalogo.md` (Signal confirmado ativo no catálogo de produção nessa data, só corrigiu link "Em breve aqui").

E2E escritos, nunca executados — confirmado por três fontes independentes: os três specs (`signal-journey`, `signal-tenant-isolation`, `signal-a11y`) com `test.skip` condicional/incondicional; o completion do measure dizendo explicitamente "não executado" para T086-T088; e `dark-matter.yml` provisionando ambiente por PR sem rodar Playwright em nenhum job.

## 4) Produção × local

Produção em `4701a3d4` (confirmado via Vercel, deploy READY/production). Histórico de Signal até esse commit: `f63e4991` (módulo de medição, PR #182, 2026-09-02), `85da4348`, `951f7277`, `837242d5`, `32ff504a` (documentação/roteamento). Zero commits de Signal entre o HEAD do floor local (`a5a81a90`) e produção — código idêntico nos dois lugares. Há um WIP não commitado neste working tree tocando `apps/app/app/(signal)/actions/shell.ts`, `layout.tsx` e `components/signal/shell.tsx` (troca de conta/tenant no shell) — não é meu, não está em main, fora do escopo desta auditoria, apenas registrado para não ser perdido.

## O que falta

| Item | Evidência | Dono sugerido | Tamanho |
|---|---|---|---|
| Escrever Success Criteria formais no PRD e alinhar com os critérios de aceite do SRD (fecha metade de C1) | `docs/produto/signal-prd.md` (0 SC hoje) | Norte/Regua (spec) | P |
| Semear dado de dogfood/QA e tirar os `test.skip` dos 3 E2E; adicionar job de Playwright no `dark-matter.yml` (fecha C1) | `apps/app/e2e/signal-{journey,tenant-isolation,a11y}.spec.ts`; `.github/workflows/dark-matter.yml` | dev Signal | M |
| Fazer o fluxo fechar por UI sem seed: telas/actions que gravem adoção/resultado real (S-05), fórmula ROI (S-06) e pontuação de confiança (S-07) | `docs/produto/signal-prd.md:134-142` (S-05, S-06, S-07) | dev Signal | G |
| Subir cobertura de funções/branches ao piso de 80% (hoje 79,4%/77,9%), priorizando `initiatives.ts` | `.claude/completions/2026-09-02-signal-measure.md` (SN-07) | dev Signal | M |
| Agendador para health/alertas (STALE automático), hoje só dispara por action manual | `docs/produto/signal-srd.md` (SN-11) | dev Signal | M |
| Conector real para ao menos 1 fonte (V1 hoje é só entrada manual) | `docs/produto/signal-prd.md` (S-26) | dev Signal | G |
| Dicionário en-US (hoje tudo fixo em PT-BR) | `docs/produto/signal-prd.md` (S-25) | dev Signal | M |
| Provisionamento criar `SignalMember`/`SignalSettings` automaticamente ao incluir pessoa (hoje só via seed) | `docs/produto/signal-srd.md` §6 (S-22) | dev Signal | M |
| Costuras do Mapa de Fronteiras: baseline vindo do Scaffold (S-27), iniciativa anexada à árvore do Cosmos (S-28), selo de confiança do Meridian (S-30), lição de encerramento ao Scaffold (S-31) | `docs/produto/signal-srd.md` §6 | Norte/Regua (spec) + dev Signal | G |
| Parecer de compliance dedicado (Signal mede adoção/ROI sobre dado do próprio tenant, ainda não confirmado formalmente) | `docs/compliance/` (sem arquivo signal) | Lacre | P |
| Dogfood interno de ponta a ponta com P0/P1/P2 rotulados e donos/datas, para fechar C2 do gate | `docs/qualidade/gate-maturidade-carga.md` | dev Signal | M |
| Decisão comercial: travar ou não a venda do módulo até o fluxo fechar sem seed, e revisar copy que promete conectores/telemetria/relatório inexistentes | PRD §7/§9; catálogo de produção | CEO | P (decisão) |
| Medir perf p95 (T090) e rodar comparação visual (T091) | `specs/003-signal-measure/tasks.md:233-234` | dev Signal | P |

## Próximas 3 ações, em ordem

1. **Decisão do CEO sobre a venda ativa do módulo** — hoje o Signal está no catálogo de produção sem que um tenant novo consiga, pela UI, chegar a ROI/confiança/veredito sem seed manual. Isso é risco comercial e reputacional imediato; decide se trava a venda, limita o escopo vendido, ou acelera o fechamento do item 2 antes de qualquer novo contrato.
2. **Fechar o fluxo ponta-a-ponta sem seed** (S-05/S-06/S-07: telas e actions que gravem adoção, ROI e confiança de verdade) — é o bloqueio mais profundo e o que torna o resto (E2E, dogfood, gate C1/C2) possível de verificar com dado real em vez de seed.
3. **Semear ambiente e rodar os 3 E2E de verdade no CI** (tirar os `test.skip`, adicionar job Playwright ao `dark-matter.yml`) — só faz sentido depois do item 2, mas fecha C1 do gate com evidência real em vez de "não avaliado".
