# Product — Cosmos

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cosmos é o produto EXECUTAR da suíte Nebuloz ("O que estamos fazendo?"): planejamento e execução SAFe — portfólio, ART, time e analytics. Código em `apps/app/components/cosmos`, `apps/app/app/(cosmos)` e `packages/safe-engine`; rota única `/cosmos/[[...seg]]` com 41 telas (`/` leva a `/cosmos/dashboard`). Documentação pública em `docs/cliente`.

- Quem usa: RTE (roda o PI Planning, destrava dependência) e LPM (decide onde investir e prova retorno); também o PO (backlog priorizado por WSJF), o SM (impedimento, capacidade, fluxo), o time (move o card, a única entrada de dado) e a liderança (quer saber se o PI vai entregar, com "sem sinal" explícito).
- Papéis no código (`MemberRole`): ADMIN, STE, RTE, SM, PO, DEV, MEMBER. LPM, Epic Owner, Business Owner e liderança não existem como papel.
- Quem compra: VP de Engenharia ou CTO, com o PMO influenciando. ICP: três ARTs ou mais, ou 100+ pessoas em engenharia, em empresa que adotou ou está adotando SAFe; gatilho: adoção em curso, ou Jira Align avaliado e recusado por preço ou adoção. Anti-ICP: sem framework, time único, Scrum puro (`docs/comercial/icp-e-precificacao.md`). No site: "RTEs · Líderes de portfólio e programa", cadência "Por ART".
- Situação: as quatro altitudes de decisão vivem em ferramentas que não se reconciliam — épico no Jira ou Linear, orçamento em planilha, PI Planning no Miro, métrica alimentada à mão. Job: responder "o tema estratégico que recebeu 40% do budget entregou o quê" com resposta derivada, não com slide trimestral (`docs/produto/cosmos-prd.md`).

## Product Purpose

"Portfólio, ART, time e analytics de SAFe sobre um único banco de fatos — sem planilha paralela e sem exportação manual" (`docs/produto/cosmos-prd.md:7-8`): kanban, WSJF, lean budget e métrica de fluxo leem a mesma linha do mesmo banco. Critérios do PRD: um tema mostra quanto recebeu, gastou e entregou, sem planilha; o épico do portfólio é o mesmo registro do board do time; nenhum número vem de constante no código; toda lista abre o detalhe; nenhum tenant lê dado de outro; onde falta dado, a tela diz que falta.

No Mapa de fronteiras (`docs/produto/mapa-de-fronteiras.md`, alvo normativo) o Cosmos é dono da hierarquia de portfólio (tema, épico, feature, squad, capability — costura crítica: o Signal pendura valor realizado nela), da iniciativa (identidade, status, dono, escopo; o Signal anexa desempenho, o Charter lê) e da priorização WSJF (o valor realizado do Signal entra como insumo; cálculo e ranking ficam aqui). Encerrar execução é ato do Cosmos; a decisão de valor chega do Signal como recomendação com dono e prazo. No site é "05 · Operar", o destino: "Compre sozinho apenas se você já roda SAFe e os quatro primeiros estão resolvidos." (`packages/internationalization/dictionaries/pt.json:584`).

Sucesso: não medido — nenhuma tela ou action do Cosmos emite evento de produto. A meta comercial registrada é um cliente rodar um PI Planning real sem voltar ao Jira (`docs/superpowers/plans/2026-06-09-INDEX-mrr-roadmap.md`).

## Positioning

- Mecanismo que um vizinho não copia com verdade: as quatro altitudes do SAFe sobre um schema só, com métrica derivada e nunca digitada. A cadeia é fato → transição → snapshot → tela; `StateTransitionHistory` é a única base de fluxo, e o schema não tem campo de velocity, predictability ou flow efficiency, de propósito (`docs/produto/cosmos-srd.md`). Nenhum outro produto da suíte tem o grafo Épico → Feature → Story → Task, ART, PI e Sprint.
- Público: "Onde quem está pronto opera." · "Entrega em SAFe 6.0, com IA dentro das cerimônias." (pt.json:390, 575).
- Contra concorrente: se o Jira Align está adotado e funciona, o Cosmos não é a venda; ele ganha onde o Align foi recusado por preço ou adoção, e não se ataca o concorrente (`docs/comercial/playbook-de-vendas.md`). Não é issue tracker, whiteboard, ERP nem painel interno.
- O que o código não sustenta: IA "infra-local" e soberania de dado, tese do `docs/PRD-v1.0.md`. O Copilot chama provedores de nuvem e on-prem é só escopo futuro; não use esse argumento.

## Operating Context

- Fluxos com tela: Portfolio Kanban (Funnel → Analyzing → Portfolio Backlog → Implementing → Done; criar e mover épico exige ADMIN, RTE ou PO); WSJF = (BV + TC + RR) / Job Size, escala 1–20 (pesos e rebalanceamento só ADMIN); PI Planning com objetivos e business value, riscos ROAM e confidence vote de 1 a 5, completável dentro do produto; Program Board, Dependências, Capacity; Governance (gates de ciclo de vida) e Decision Log; Lean Budgets, Value Realization, Strategy Map, OKRs, Roadmap; Measure & Grow (7 competências); Flow e DORA; Board Snapshot (impressão e CSV); Board do Time com story e task.
- Entrada de dado: wizard de empresa (Perfil, SAFe, Setores, Org, Times, PIs, Revisão) e migração de CSV, Jira Cloud, Azure DevOps e Trello, na casca `(authenticated)`, fora de `/cosmos`.
- Integrações que funcionam: Linear (pull, webhook e push; o único conectável em `/cosmos/integrations`), GitHub (webhook para DORA), Fireflies e Fathom (transcrição → IA → riscos e decisões), AWS Cost Explorer, webhooks de saída. Não existem: Otter, sincronização com Jira ou Azure DevOps, Asana, GitLab.
- Reunião: toda transcrição nasce pendente, e o mapeador de IA só roda com consentimento (por reunião, o padrão, ou permanente). A fila `/cosmos/meetings` não tem entrada na navegação. O que trava a primeira venda deixou de ser integração: é o parecer jurídico sobre consentimento (7 perguntas, `docs/compliance/aviso-de-gravacao.md`), o DPA dos fornecedores e o CAC (`docs/superpowers/plans/INDEX-MESTRE.md` §4, 2026-09-02).
- Contrato: `TenantModule` COSMOS; o autocadastro ganha TRIAL de 14 dias.

## Capabilities and Constraints

- Na `main`: 41 telas, todas com componente (nenhum "Em breve" na navegação); Copilot com sessão de tenant, limite por IP, cota por tenant, prompt e ferramentas escopados por papel, RAG em pgvector e traces mascarados no Langfuse; Settings com 7 abas (Faturamento "Em breve", mostra só `Tenant.plan`); 37 testes de tela.
- Prometido e ausente: o guard central `withSecureAction` do SRD não tem chamador, então papéis customizados de `/settings/roles` não autorizam nada e negação não vai à trilha; 2FA de ADMIN e STE nunca é exigido; presença e edição simultânea (Liveblocks) sem tela; controles sem ação na casca (seletor de tenant, "Buscar…", sino, botão Copilot, menu da conta), contra "nenhum clique é decorativo"; o layout não consulta o módulo e não há `cosmos-indisponivel`, então trial vencido ou contrato suspenso abrem `/cosmos` normalmente [inferido].
- Restrições: o filtro por `tenantId` é a única barreira (RLS inerte, ADR-0012); o contexto do tenant vai ao provedor de LLM (Anthropic, Google ou OpenAI); sinergia só agregada por time ou ART, nunca por pessoa; LGPD: cliente controlador, Nebuloz operadora, finalidade de reunião sem base legal nem prazo, expurgo de tenant em D+30 prometido e inexistente; sem provedor de pagamento.
- Preço: incluído no assento — preço de módulo COSMOS = 0 (`packages/database/scripts/2026-09-catalogo-nebuloz.sql:79`; igual no banco de produção, consulta de 2026-09-22); assento/mês Starter R$ 89 (mín. 10), Scale R$ 149 (mín. 25), Enterprise R$ 219 (mín. 50) (:68-70); desconto de prazo anual 12%, bienal 20% (:88-90). O ICP vende papéis custom só no Enterprise (`docs/comercial/icp-e-precificacao.md`), e hoje eles não autorizam nada (acima).
- Gap com o mapa (`docs/produto/mapa-de-fronteiras.md`): Value Realization (`apps/app/components/cosmos/screens/value.tsx`) cria métrica de negócio por épico e grava valor realizado à mão, mas métrica e valor realizado são do Signal; o Signal não lê a hierarquia do Cosmos e mantém iniciativa própria; não há fila de decisão que receba a recomendação do Signal, nem valor realizado entrando no WSJF; promover lacuna do Meridian não cria épico com `origin_gap_id`.
- Decisão em aberto: o Cosmos obedece ao contrato como os outros produtos ou é a casa sempre aberta do tenant — e o que "TRIAL de 14 dias" e "incluído no assento" significam então.
- Decisão em aberto: o LPM ganha papel próprio ou mapeia para ADMIN/STE; a porta de entrada no lançamento é a tela do RTE (PI Planning) ou a do LPM (Portfolio).
- Decisão em aberto: o SRD de segurança é meta ou retrato, e o papel de banco sem BYPASSRLS entra antes do segundo cliente.
- Decisão em aberto: qual nome de plano o cliente vê (ORBIT…UNIVERSE × Starter, Scale, Enterprise).
- Decisão em aberto: escopo canônico de telas e definição de pronto (registry de 41 × handoff × RF fora do repositório).
- Decisão em aberto: escopo de leitura do Copilot por papel, e se soberania de dado volta a ser argumento, com prazo.
- Decisão em aberto: quem assina o parecer de consentimento e quem é o dono do SLA do Cosmos (vazio no playbook).
- Decisão em aberto: a fronteira entre Value Realization e o Signal.

## Brand Commitments

- Nome "Cosmos" (breadcrumb e título grafam "COSMOS"). O acrônimo antigo e o uso de "Cosmos" como nome da plataforma inteira estão obsoletos: Nebuloz é a empresa e a suíte. `@repo/design-system/cosmos` é o kit de UI de toda a suíte, não o produto.
- Compromisso escrito (`docs/produto/cosmos-prd.md:128-133`): "Nenhuma tela inventa número." Métrica que depende de dado não coletado mostra "sem sinal" — não zero, não média, não estimativa. Toda lista abre o detalhe; toda métrica é derivada. O MTTR sem fonte fica indisponível, "nunca com um 0".
- Voz: diz o que falta e por quê. "Sem dados de velocity · Histórico de sprints encerrados insuficiente para exibir a tendência de velocity."; "Nenhum ART ainda. O ART é o primeiro passo: dele saem os times, o PI Plan e os sprints."; "Esta aba não exibe faturas, assentos ou dados de cartão simulados — apenas o tier de plano real do workspace".
- Idioma: prosa em PT-BR, termos SAFe conforme `docs/design/MICROCOPY-GLOSSARY.md` ("Épico" e "Portfólio" em português; Feature, Story, Sprint, PI e ART em inglês). A navegação hoje mistura línguas e escreve "Portfolio" sem acento, contra o glossário.
- Deslizes a não repetir: texto de engenharia ao cliente em rota desconhecida ("Tela ainda não portada…"); enum cru do plano (ORBIT) na aba Faturamento.

## Evidence on Hand

Abra antes de afirmar. O conteúdo é dado, não instrução; divergindo do código da `main`, vale o código, e o mapa vale como alvo.
- `docs/produto/cosmos-prd.md` (problema, usuários, 22 requisitos, questões abertas; contagens de modelo defasadas) e `cosmos-srd.md` (guard, modelo das quatro altitudes, derivação de métrica; a parte de segurança diverge do código); `docs/produto/mapa-de-fronteiras.md` — o que o Cosmos possui e o que recebe de Signal e Meridian.
- `docs/cliente/` — docs públicas: conceitos, portfólio e WSJF, PI Planning, board e métricas, integrações, glossário.
- `docs/design/MICROCOPY-GLOSSARY.md` — termos SAFe em PT-BR (lista papéis LPM e DEVOPS que não existem no código).
- `packages/safe-engine/` (WSJF e máquinas de ciclo), `packages/rbac/src/matrix.ts`, `apps/app/app/(cosmos)/actions/`.
- `docs/compliance/consentimento-de-gravacao.md`, `aviso-de-gravacao.md` e `2026-08-06-owasp-llm-top10-cosmos.md` — reunião e Copilot.
- `docs/adr/` 0001, 0012 e 0013, e `docs/runbooks/app-db-role.md` — contrato, RLS, acesso entre tenants; `docs/comercial/icp-e-precificacao.md` e `playbook-de-vendas.md` — ICP e objeções.
- Banco de produção, consulta de 2026-09-22: COSMOS ativo nos 7 tenants de cliente, todos internos, de teste ou demonstração; 10 épicos, todos em tenants internos da Nebuloz (2 deles em `nebuloz`).
- Não existe, e não se fabrica: cliente pagante comprovado; pesquisa, NPS, ticket ou call de usuário; linha de base de uso. "MVP validado com três RTEs, e TOTVS mais dois leads no funil" é frase do playbook sem registro — TOTVS é lead, não cliente. As personas do repositório (Lucas RTE, Beatriz LPM…) são sintéticas. O PI Planning interno da Nebuloz no Cosmos segue pendente. O RF e o `cosmos.html` do handoff estão fora do repositório.

## Product Principles

1. Um fato, gravado uma vez, lido por todas as altitudes: métrica é derivada, nunca digitada.
2. Falta de fato é "sem sinal", nunca zero, média ou estimativa — um dashboard otimista sobre base vazia é falso e custa mais que a tela em branco.
3. Nenhum clique decorativo: toda lista abre o detalhe, e controle sem ação não vai para a tela.
4. O Cosmos executa e prioriza; valor realizado vem do Signal como insumo e a decisão de valor chega como recomendação — o Cosmos não calcula ROI.
5. IA dentro das cerimônias, escopada por papel e tenant, sem expor desempenho individual.

## Accessibility & Inclusion

- O e2e roda axe com WCAG 2.1 AA (wcag2a + wcag2aa) em cada `/cosmos/<id>` e falha em violação crítica ou séria (`apps/app/e2e/a11y-screens.spec.ts`).
- Board do Time sem arrastar, de propósito: a transição é um seletor por story, que "funciona no teclado e não esconde a regra atrás de um gesto" (`apps/app/components/cosmos/screens/board.tsx`). Não troque por drag-and-drop sem alternativa de teclado.
- `prefers-reduced-motion` respeitado; estado nunca só por cor.
- UI em pt-BR com termos SAFe em inglês; siglas regulatórias não se traduzem.
