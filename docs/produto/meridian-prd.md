# Meridian — Product Requirements Document

> **PRODUCT** Meridian · **STAGE** Produto (cliente) · **STATUS** Draft for review
> **VERSION** 1.0 · **OWNER** Product, Nebuloz
> **COMPANION** [Meridian SRD v1.0](./meridian-srd.md)

AVALIAR — "Estamos prontos?": diagnóstico de prontidão para IA em cinco eixos, em que a
discordância entre respondentes vira dado auditável, com nota por eixo, lacunas por custo
de atraso e plano de 12 meses.

---

## 1. Problema

Uma organização que já usa IA em vários times raramente sabe onde está. Cada líder tem uma
resposta, e o caminho comum — entrevista, planilha, slide — gera uma nota que ninguém
reconstrói. **Essa nota não sobrevive à primeira pergunta do patrocinador:** "por que o
número mudou?". A divergência sumiu na média, e o ajuste humano ficou fora do registro.

> **POR QUE A DISCORDÂNCIA É O DADO**
> O Meridian mede cada eixo com mais de um respondente, marca o eixo contestado quando a
> dispersão passa do limiar e só aceita override com justificativa. O computado nunca some.

### Evidência

- A dor do ICP: "Usamos IA em vários times e ninguém sabe exatamente onde nem com que dado."
  (`docs/comercial/icp-e-precificacao.md:164`). O playbook trata a discordância interna como
  o sinal de compra mais forte (`docs/comercial/playbook-de-vendas.md:38-42`).
- O V1 está na `main` desde 2026-08-29 (`52db9df2`), com 230 casos de teste em 22 arquivos e
  12 cenários e2e, mas sem resposta de cliente pago nem depoimento
  (`docs/comercial/insumos-de-posicionamento.md:41-46`) e sem tela do zero ao relatório (§5).
- Em produção, o módulo está ativo em 4 tenants, todos internos ou de teste, com 2
  assessments, um deles no tenant `nebuloz` (banco de produção, consulta de 2026-09-22).

---

## 2. Usuários

Quem opera o Meridian é a consultoria Nebuloz, num tenant próprio, aplicando o diagnóstico em
várias organizações; o cliente responde por link (decisão do dono do produto, 2026-09-22). O
`ADMIN` do tenant não herda papel do Meridian (`packages/rbac/src/meridian-matrix.ts:6-10`).

| PAPEL | TRABALHO A FAZER | SUCESSO É |
|---|---|---|
| Consultora Nebuloz — `CONSULTANT` | Conduzir o diagnóstico de várias organizações: coleta, override, gaps, plano, promoção | Relatório entregue sem sair do produto nem abrir planilha |
| Revisora Nebuloz — `REVIEWER` | Decidir o eixo contestado com a divergência e a evidência na frente | Override com justificativa que o patrocinador lê |
| Leitor Nebuloz — `VIEWER` | Ler relatórios no tenant da consultoria | Número com origem visível |
| Respondente do cliente, sem conta | Responder, por link, a bateria de um eixo e anexar evidência | Bateria concluída em menos de 10 minutos (SC-006) |
| Patrocinador do cliente | Apresentar o diagnóstico e explicar por que o número mudou | Override apresentado como decisão, com a justificativa |
| Comprador — CIO ou CTO; o CFO co-assina acima de certo valor | Decidir por onde começar em IA | Lacunas priorizadas e plano sequenciado (`docs/comercial/icp-e-precificacao.md:160-167`) |
| Staff Nebuloz, no back-office | Ativar o módulo e dar o papel de consultora | Consultora entra e encontra o template pronto |

O patrocinador não entra no tenant da consultoria, onde todo papel vê todas as organizações.
O relatório precisa chegar a ele por fora, e o documento de entrega não existe (M-22).

---

## 3. Objetivos e não-objetivos

### Objetivos

| OBJETIVO | MEDIDA |
|---|---|
| Número defensável, não opinião | Todo score final rastreável até respostas ou override com justificativa (SC-003) |
| Discordância vira decisão registrada | Todo eixo acima do limiar na fila antes do relatório (SC-004) |
| Diagnóstico sem planilha paralela | Do zero ao relatório sem sair do produto (SC-001) |
| Comparação honesta com pares | Nenhuma comparação com coorte abaixo de 5 (SC-005) |

### Não-objetivos

- **Não é autosserviço do cliente.** O cliente responde e recebe o relatório; não conduz (§7).
- **Não pontua com IA.** O score sai de função pura (`apps/app/lib/meridian/scoring.ts:3-13`).
- **Não é o questionário do site**, que "não é o diagnóstico Meridian"
  (`packages/internationalization/dictionaries/pt.json:205`).
- **Não executa a lacuna.** Promover registra a intenção; a posse do gap fica aqui.

---

## 4. As telas

Sete ids atrás de `/meridian/[[...seg]]`, em três seções — Diagnose, Registro e Campo —, e
duas rotas fora do guard. Daqui em diante `screens/`, `actions/` e `lib/` abreviam
`apps/app/components/meridian/screens/`, `apps/app/app/(meridian)/actions/` e
`apps/app/lib/meridian/`; `schema` é `packages/database/prisma/schema/meridian.prisma`.

| TELA | O QUE FAZ | O QUE FALTA |
|---|---|---|
| Assessments | Carteira com quatro indicadores e filtro por status (`screens/assessments.tsx:102-126`) | Criar assessment |
| Detalhe | Abas Coleta, Scoring & Revisão, Gap register, Plano 12 meses e Relatório & Benchmark (`screens/assessment-detail.tsx:119-123`) | Atribuir respondente; o export do plano vai para o console |
| Fila de revisão · Benchmark pool | Contestados de toda a carteira; coortes por setor e faixa, sem percentis abaixo de 5 | — |
| Gap register | Registro de todas as organizações; promove para Cosmos ou Scaffold (`screens/gap-register.tsx:283-300`) | Criar, editar, apagar e ligar gaps |
| Escala de confiança · Visão do respondente | Os três selos com a distribuição dos gaps; o que o respondente vê | — |
| Bateria do respondente | `/meridian-responder/<token>`: um eixo, rascunho, evidência até 10 MB, envio | — |
| Meridian indisponível | Separa "não contratado" de "sem papel de diagnóstico" | Apontar a consultoria (§7) |

> **RESTRIÇÃO DURA** Nenhuma tela desenha comparação com coorte abaixo de 5, nem esconde o
> computado atrás do override (`screens/tab-relatorio.tsx:3-8`).

---

## 5. Requisitos

Cada linha cita os FR de [`spec.md`](../../specs/001-meridian-diagnose/spec.md). **PRI** repete a
prioridade da história na spec (P1 conduz · P2 entrega · P3 diferencial; "—" é transversal).
**ESTADO** na `main` @ `ea512044`: implementado · parcial · ausente.

| ID | REQUISITO | PRI | ESTADO | EVIDÊNCIA |
|---|---|---|---|---|
| M-01 | Todo dado restrito ao tenant da sessão (FR-001) | — | parcial | `tenantId` no `where`; RLS inerte (ADR-0012); `reassessmentOfId` e o `assessmentId` do gap entram sem conferir o tenant (`actions/assessments.ts:345,388`; `actions/gaps.ts:203-226`) |
| M-02 | Recusa separa "não contratado" de "sem papel" (FR-002) | — | implementado | `lib/guards.ts:65-96`; `apps/app/app/meridian-indisponivel/page.tsx` |
| M-03 | Consultor conduz; os demais papéis leem (FR-003) | — | parcial | `packages/rbac/src/meridian-matrix.ts:62-79`; `withdrawContribution` escreve com qualquer papel (`actions/benchmark.ts:98-103`) |
| M-04 | Respondente vê só o seu eixo, por link individual com validade (FR-004) | P1 | implementado | `actions/respondent.ts:111-127,203-209`; `lib/respondent-token.ts:27-35` |
| M-05 | Criar assessment com organização, template e prazo (FR-005) | P1 | parcial | `actions/assessments.ts:348-417`; nenhuma tela chama |
| M-06 | Congelar o template no primeiro uso e recusar alteração (FR-006) | P1 | parcial | `lockedAt` gravado (`actions/assessments.ts:393-400`); não há escrita de template a recusar nem trava no banco |
| M-07 | Atribuir um ou mais respondentes por eixo (FR-007) | P1 | parcial | `actions/collection.ts:40-105`; sem tela, o link só sai do seed |
| M-08 | Convite e lembretes automáticos até conclusão ou prazo (FR-008) | P1 | ausente | `sendReminder` só grava `lastRemindedAt` (`actions/collection.ts:148-186`); `OVERDUE` nunca é gravado |
| M-09 | Rascunho retomável e evidência por pergunta, fora do banco (FR-009, FR-010) | P1 | implementado | `actions/respondent.ts:178-236,276-356`: bucket privado, `<tenant>/<assessment>/<uuid>`, até 10 MB |
| M-10 | Fechar coleta só com todo eixo coberto, aceitando pendência declarada (FR-011, FR-012) | P1 | implementado | `actions/collection.ts:231-272`; `screens/tab-coleta.tsx:47,249-273` |
| M-11 | Score 0–100 e confiança 0–1 por eixo, determinísticos, contestado acima do limiar (FR-013 a FR-015) | P1 | implementado | `lib/scoring.ts:3-13,97-178`; `apps/app/__tests__/lib/meridian-scoring.test.ts:80` |
| M-12 | Divergência resposta a resposta e fila global de contestados (FR-016, FR-020) | P1 | implementado | `actions/scoring.ts:315-421`; mostra só as perguntas que divergem |
| M-13 | Override com justificativa de 20+ caracteres; computado e histórico preservados; composite pelos finais (FR-017 a FR-019) | P1 | implementado | `actions/overrides.ts:21,37-96`; `actions/scoring.ts:134-153`; `lib/composite.ts:19-30` |
| M-14 | Derivar gap abaixo do limiar; criar, ajustar, remover e ligar gaps à mão, recusando ciclo (FR-021, FR-023) | P2 | parcial | derivação em `actions/scoring.ts:170-179,221-285`; edição e dependência só no servidor (`actions/gaps.ts:152-354`) |
| M-15 | Gap com todos os campos e posse que fica no Meridian (FR-022, FR-028) | P2 | implementado | `schema:394-428`; nenhum outro produto escreve `MeridianGap`, só os seeds |
| M-16 | Plano de 12 meses por ordenação topológica em quatro trimestres (FR-024) | P2 | implementado | `lib/plan.ts:27-38`; `actions/plan.ts:89-99` |
| M-17 | Plano em formato legível por máquina (FR-025) | P2 | parcial | `actions/plan.ts:178-260`; a tela o joga no console (`screens/tab-plano.tsx:62-73`); não há consumidor |
| M-18 | Registro canônico que atravessa assessments (FR-026) | P2 | parcial | a reavaliação cria gap novo em vez de reavaliar o antigo (`actions/scoring.ts:232-243`) |
| M-19 | Promover gap; o trabalho criado carrega a origem (FR-027) | P2 | parcial | a promoção só registra (`actions/gaps.ts:391-449`); só o Scaffold cria trabalho (`apps/app/app/(scaffold)/actions/tracks.ts:115-156`) |
| M-20 | Um estado por gap, toda transição registrada (FR-029) | P2 | parcial | `RESOLVED` inalcançável; `OPEN → PLANNED` em lote, sem entrada por gap (`actions/plan.ts:116-131`) |
| M-21 | Shape com score final, confiança e override marcado (FR-030) | P2 | implementado | `actions/report.ts:56-157` |
| M-22 | Documento de entrega ao patrocinador (FR-031) | P2 | ausente | sem PDF nem export do relatório (`.claude/completions/2026-08-28-meridian-diagnose.md:132-134`) |
| M-23 | Coortes por setor e faixa, só com opt-in, sem identificar organização (FR-032, FR-034) | P3 | implementado | `actions/benchmark.ts:58-91`; tabelas sem `tenantId` (`schema:500-527`) |
| M-24 | Coorte retida abaixo de 5 organizações (FR-033) | P3 | parcial | limiar na leitura (`lib/benchmark.ts:16,75-89`), mas `n` conta assessments (`actions/benchmark.ts:35,45`) |
| M-25 | Diff de reavaliação por eixo, gap e item de plano (FR-035) | P2 | parcial | gap casado pelo texto, que embute o score (`actions/report.ts:226-234`; `actions/scoring.ts:259`); plano vira contagem de gaps |
| M-26 | Escala medido · estimado · declarado, única na suíte (FR-036) | P3 | parcial | Meridian sim (`schema:85-89`); Signal, Scaffold e Cosmos não (§8) |
| M-27 | Trilha imutável, com antes e depois, de todo ato e de toda leitura de evidência (FR-037, FR-038) | — | parcial | contestado e `OPEN → PLANNED` sem entrada própria; `getDivergence`, `getBattery` e `saveDraft` sem trilha; `upsertGap` registra 3 dos 7 campos (`actions/gaps.ts:188-198`) |

### Onde o escrito e o código divergem

| TEMA | O QUE ESTÁ ESCRITO | O QUE O CÓDIGO FAZ — VALE HOJE |
|---|---|---|
| Override | score diferente do computado (FR-017) | diferente do final atual; pode voltar ao computado (`actions/overrides.ts:62-68`) |
| Coorte | 5 organizações (FR-033); 5 contribuições (SC-005) | 5 assessments distintos; a tela diz "Organizações contribuindo" (`screens/benchmark.tsx:79`) |
| Gap resolvido e finalizar | `RESOLVED` por reavaliação; `FINALISED` sem contestado (`data-model.md`) | nada grava `RESOLVED`; só o seed grava `FINALISED` (`apps/app/scripts/seed-meridian.ts:472`) |
| Relatório | só depois da fila de contestados (SC-004) | sai em qualquer estado (`actions/report.ts:56-78`) |
| Lembrete | automático até conclusão ou prazo (FR-008) | nada é enviado, e a tela diz que a pessoa "recebeu novo lembrete" (`screens/tab-coleta.tsx:54-57`) |
| Respostas | "Respostas e overrides são append-only" (`apps/app/components/meridian/shell.tsx:438-439`) | editáveis pelo token até o prazo, mesmo com a coleta fechada (`actions/respondent.ts:178-236`) |

---

## 6. Critérios de sucesso

Estado na `github/main` @ `ca12b6a8` (2026-09-29), conferido no código e contra o dogfood local de
2026-09-29 (`docs/qualidade/prontidao/meridian.md` §2). "Local" quer dizer que não rodou em produção:
o dogfood em produção parou no M2.

| CRITÉRIO DA SPEC (`spec.md:228-237`) | ESTADO NA MAIN |
|---|---|
| SC-001 · Do zero ao relatório sem sair do produto nem usar planilha | implementado, provado no local — criar assessment e atribuir respondente têm tela (`screens/assessments.tsx`, `screens/tab-coleta.tsx`); AS-110 do zero ao relatório pela tela. Produção não fechou |
| SC-002 · Scoring idêntico em 100% das repetições | implementado — teste do motor (`meridian-scoring.test.ts`, 13/13) |
| SC-003 · Todo score final rastreável até respostas ou override | parcial — override rastreável na trilha (FR-038), mas a resposta ainda muda depois do envio: o token vale até expirar, inclusive para quem está `DONE` (`lib/meridian/respondent-token.ts:46-54`) |
| SC-004 · Contestados na fila antes do relatório | ausente — a fila global lista o contestado, mas `getReport` não consulta a fila (`actions/report.ts:57`) |
| SC-005 · Nenhuma comparação com coorte abaixo de 5 | implementado — corte na leitura; `n` conta assessments |
| SC-006 · Respondente conclui em menos de 10 minutos | implementado, medido no local — cerca de 10 s por sessão com evidência anexada, feito por agente e não por pessoa nova (`diario.md:84`) |
| SC-007 · Nenhum item do plano antes de um pré-requisito | implementado — checado antes de gravar, com teste; 0 violações em 5 dependências (AS-104) |
| SC-008 · Toda leitura de evidência na trilha | implementado no servidor e provado no E2E (`meridian-dogfood.spec.ts:523`); na tela, "Ver evidência" só no painel de divergência. Coleta e gap entram por D-19 |
| SC-009 · Gap promovido editável só no Meridian | implementado |
| SC-010 · Carteira e registro em menos de 2 s com 200 assessments e 2.000 gaps | ausente — sem medição; as listas não paginam |
| SC-011 · Concorrência (distinto do SC-010, que mede volume com um usuário), em duas ondas simultâneas num único tenant: **(a) consultores** — carteira (`/meridian`) e detalhe do assessment, aba Coleta; **(b) respondentes** — a onda depois de "Reemitir e copiar", abrindo a bateria e salvando rascunho em `/meridian-responder/<token>`. A onda (b) é o pico provável do Meridian; o PI Planning é o pico do Cosmos. Critério nas duas: p95 < 2 s e erro < 1% (`specs/007-gate-maturidade-carga/spec.md`, FR-004). **HIPÓTESE, não validada:** o critério e o tamanho das ondas ("algumas centenas de usuários simultâneos por tenant", `regra-maturidade-e-carga.md:38-40`) não têm fonte até o levantamento com os 3 leads (`roteiro-concorrencia-leads.md`, T009) | primeiro relatório, **NÃO-GATE** (o Meridian não está apto no gate de maturidade): `k6/meridian-concorrencia.js`, commit `8934eaaf`, build de produção local e banco local. Corrida de 30 s com 10 VUs de consultor e 30 VUs de respondente, sobre 200 respondentes semeados: (a) p95 278,7 ms, erro 0%; (b) p95 198,4 ms, erro 0% (`.claude/completions/2026-09-27-spec-007-t006-t008.md:60-65`). É sinal, não prova: 40 VUs é bem menos que "centenas", e o banco local não tem latência de rede. Nunca contra produção |

---

## 7. Riscos

| RISCO | MITIGAÇÃO HOJE |
|---|---|
| A primeira venda não passa pela tela: não há como criar assessment nem atribuir respondente | Nenhuma; só seed ou SQL |
| Resposta alterada depois do fechamento, com o computado congelado | Nenhuma; o token vale até o prazo, inclusive para quem concluiu |
| A tela promete o que o código não faz: lembrete "recebido", `origin_gap_id` no destino Cosmos, selo aplicado por outros produtos | Nenhuma |
| Isolamento por disciplina: a RLS está inerte, e a rota do respondente para sem `BYPASSRLS` | `withTenantDb` e `tenantId` no `where` ([ADR-0012](../adr/0012-rls-anulada-por-conexao-superuser.md)) |
| O arquivo de evidência sobrevive à eliminação LGPD | Nome anonimizado; o objeto fica no bucket (`apps/app/lib/inngest/lgpd-dsr.ts:218-233`) |
| `seed:meridian` sem argumento apaga o domínio do tenant `nebuloz`, onde `seed:meridian:nebuloz` grava o dogfood | Comentário no script, sem bloqueio (`apps/app/scripts/seed-meridian.ts:74,409-424`) |

### O que ainda supõe autosserviço — gaps contra a decisão de 2026-09-22

| GAP | EVIDÊNCIA | O QUE TERIA DE MUDAR |
|---|---|---|
| O back-office prepara o Meridian na página do cliente | `apps/backoffice/app/actions/provisioning.ts:117-142`; `apps/backoffice/app/(staff)/clientes/[slug]/meridian-bootstrap.tsx` | Preparar o tenant da consultoria |
| O enquadramento LGPD diz que o cliente cria o assessment e é controlador | `docs/compliance/operadora-controladora.md:36-54` | Refazer a análise com a Nebuloz conduzindo |
| O ADR-0014 supõe a lacuna no tenant do cliente, e o back-office toma o tenant da promoção como cliente | `docs/adr/0014-promocao-scaffold-materializa-no-backoffice.md:13-15`; `apps/backoffice/app/actions/scaffold.ts:144-161` | O `Engagement` saber a organização avaliada, hoje só texto em `orgName` |
| Sem escopo por organização no tenant, `VIEWER` para o patrocinador exporia os outros clientes | `schema:210-212`; `actions/assessments.ts:126-129` | Relatório entregue fora do tenant (M-22) ou escopo por organização |
| A recusa manda pedir papel "a um consultor da sua organização", e nenhuma tela atribui papel | `apps/app/app/meridian-indisponivel/page.tsx`; `lib/guards.ts:89-92` | Tela de papel e texto que aponte a consultoria |

---

## 8. Dependências

| DEPENDE DE | NATUREZA |
|---|---|
| Back-office | Ativa o módulo e dá `CONSULTANT` a um e-mail já cadastrado, com o template v3.2 de 15 perguntas (`packages/provisioning/src/meridian.ts:219-326`) |
| `@repo/auth` · `@repo/rbac` | Sessão de tenant, módulo contratado e matriz de 7 permissões × 3 papéis |
| `@repo/database` · `@repo/storage` | 16 modelos e 11 enums; `AuditLog` compartilhado ([ADR-0009](../adr/0009-auditoria-reusa-auditlog.md)); bucket privado `meridian-evidence` |
| Charter · Scaffold · job LGPD | Primitivas visuais; trilha criada a partir da promoção; eliminação do respondente (`apps/app/lib/inngest/lgpd-dsr.ts:175-233`) |

### Fronteiras

O [Mapa de fronteiras](./mapa-de-fronteiras.md) (Arquitetura de produto, ago/2026 v1) é o
alvo normativo: põe o Meridian em AVALIAR como dono de três entidades, que os outros leem
sem alterar. Onde o código não chega lá, é gap (§6 do mapa, itens 4 a 6, 8, 11, 14, 15 e 19).

| ENTIDADE OU COSTURA | O MAPA DIZ | GAP NO CÓDIGO | O QUE TERIA DE MUDAR |
|---|---|---|---|
| Avaliação de prontidão | O Scaffold usa o score para escolher template; o Signal cita a avaliação sem recalcular | Ninguém fora do Meridian lê `MeridianAxisScore`, e o back-office mantém avaliação própria, de 6 dimensões (`packages/database/prisma/schema/platform-ops.prisma:667-715`) | O Scaffold usar o score final; o Signal citar o assessment; o back-office largar a rubrica própria |
| Escala de confiança · costura Meridian → Signal | Vocabulário único; o Signal o reusa na atribuição | O Signal usa Alta, Média e Baixa sobre escore 0–100 (`apps/app/lib/signal/confidence.ts:32-54`); o Scaffold redefine o enum (`packages/database/prisma/schema/scaffold.prisma:707-711`); o Cosmos usa `LOW/MEDIUM/HIGH` (`packages/database/prisma/schema/art-core.prisma:331`) | Os três usarem `MeridianConfidence`; até lá, a tela da escala promete o que não há (`screens/confidence-scale.tsx:28-44`) |
| Gap register | Scaffold e Cosmos leem; "gap virar iniciativa é ação do Cosmos, com origin_gap_id" | Scaffold e back-office gravam `targetEntityId` na linha do Meridian (`apps/app/app/(scaffold)/actions/tracks.ts:153-156`; `apps/backoffice/app/actions/scaffold.ts:166-188`); a promoção `COSMOS` só registra, e o Cosmos não tem campo de origem | Os consumidores pararem de escrever no Meridian; o Cosmos criar a iniciativa com a origem, atravessando do tenant da consultoria ao do cliente, travessia que o ADR-0013 hoje restringe |
| Engajamento, fase e trilha | Dono Scaffold; o back-office só lê | O ADR-0014, Accepted, faz do `Engagement` do back-office o destino da promoção; só testes chamam `materializarEngajamento` | Revisar o ADR-0014 |
| Usuário, papel e permissão | Dono Charter; nenhum segundo modelo de permissão | `MeridianRole` e `MeridianMembership`, com matriz própria | Papéis do Meridian como lente sobre o papel do Charter |
| Tenant · costura de auditoria | O Charter emite `tenant_id`; toda trilha no formato dele | O tenant nasce no back-office (`packages/provisioning/src/tenant.ts:53`); a trilha já segue o formato | Gap da plataforma, não só do Meridian |

---

## 9. Questões em aberto

- **Qual tenant é o da consultoria?** O seed usa `nebuloz`; o SQL de dogfood aponta para outro
  slug (`packages/database/scripts/2026-09-diagnostico-nebuloz.sql:49`).
- **O que entra no V1.1?** As telas que faltam (§4), o envio de lembrete, o documento de
  entrega — e quais regras passam a valer: resposta travada no fechamento, `FINALISED` e
  `RESOLVED` alcançáveis, relatório só depois da fila, arquivo apagado na eliminação?
- **O que se vende, e com qual cadência?** Convivem a bateria v3.2 (15 perguntas, 5 eixos);
  o SV-01, a R$ 48.000 por projeto, "4 semanas", "6 dimensões"
  (`packages/database/scripts/2026-09-catalogo-nebuloz.sql:21-23`); o site, "Duas semanas"
  (`packages/internationalization/dictionaries/pt.json:525`); e o módulo a R$ 1.200/mês,
  cobrança que supõe autosserviço (`packages/database/scripts/2026-08-preco-meridian.sql:41-45`).
  Os dois preços estão no banco de produção (consulta de 2026-09-22).
- **Como fica a promoção ao Scaffold até o ADR-0014 ser revisto?** O app cria `ScaffoldTrack`;
  o back-office, `Engagement`, no mesmo `targetEntityId`
  ([ADR-0014](../adr/0014-promocao-scaffold-materializa-no-backoffice.md)). O ADR deixa
  `SCAFFOLD` fora de `ProductModule`, e o enum o tem (`packages/database/prisma/schema/modules.prisma:15-21`);
  o [Scaffold PRD](./scaffold-prd.md) nega o `Engagement`; a revogação trata todo `SCAFFOLD`
  como trilha e o resto como `Engagement` (`actions/gaps.ts:501-523`).
- **Qual vocabulário é o oficial?** A aplicação diz "Assessment", "Gap register" e eixos em
  inglês; o site diz "diagnóstico", "lacuna" e português (pendente desde `6222b0d3`).
- **Qual diagnóstico da Nebuloz é o oficial?** AS-NBZ-001, com dois respondentes e cinco eixos
  contestados (`packages/database/scripts/2026-09-diagnostico-nebuloz.sql:3-24`), ou
  AS-NEBULOZ-01, com score declarado e confiança 0,30 (`packages/provisioning/src/meridian-nebuloz.ts:19-32`)?

---

## 10. Decisões

### 2026-09-26 · Link do respondente deixa de ser irrecuperável (CPO)

**Contexto.** No dogfood do AS-112 o consultor perdeu os 10 links duas vezes
(`docs/qualidade/dogfood/meridian/diario.md:8-9`). O token só existe no modal de atribuição, o banco
guarda o hash (`actions/collection.ts:75`) e o único remédio é revogar e atribuir de novo, o que cria
outro respondente (`actions/collection.ts:108-131`). A trava "Concluir só depois de Copiar" do #253
não resolveu: copiar não é colar em algum lugar (`atrito.md:138-144`). A causa não é pressa. Perder
o link é terminal, e deveria ser um atraso de um clique.

**Decisão.**
1. **P0: "Reemitir link" por respondente (opção a).** Gira o `tokenHash` do mesmo respondente, que
   mantém id, eixo, rascunho e status. O link antigo morre na hora. Fica bloqueado para
   `DONE` e `REVOKED`. Grava auditoria `meridian.respondent.reissue`. Mostra o link novo no
   mesmo modal do #253.
2. **P0, mesma entrega: "Reemitir e copiar todos os pendentes" (opção c, feita em cima da a).**
   Uma ação reemite todos os respondentes `INVITED`, `PENDING` e `OVERDUE` do assessment e devolve a
   lista nome · eixo · link para copiar de uma vez e baixar em `.txt`/`.csv`. A opção c pura
   ("copiar todos" ao fim das atribuições) foi descartada porque segura tokens no estado do
   cliente, e um reload faz perder tudo de novo.
3. **Depois: e-mail ao respondente (opção b).** Só entra depois que a spec 004 plugar o Resend no
   Better Auth e a Lacre der parecer sobre o e-mail do respondente (base legal, retenção, quem
   é o controlador no fluxo de consultoria). Não fica pronto para o lançamento.

**Prioridade frente à spec 004.** Correm em paralelo, sem disputar a vez: a 004 mexe na
autenticação (`packages/auth`) e isto mexe na coleta do Meridian (`actions/collection.ts`,
`tab-coleta.tsx`). Pelo tamanho que estimo (uma action, dois botões, um modal de lista), isto
entra antes do próximo ensaio de coleta. A opção b depende da 004 e não o contrário.

**Critério de pronto.** O consultor fecha a aba no meio da atribuição, volta e recupera os 10
links num único passo, sem revogar nada, em produção.

**Junto (achado P2 do Vigia, `atrito.md:42`).** A reemissão define um `tokenExpiresAt` próprio
em vez de copiar `assessment.deadline`. O Maestro decide o valor.

### 2026-09-29 · Atritos do dogfood local: dono e data (CPO)

Condição 10 da prontidão (`docs/qualidade/prontidao/meridian.md`): o gate pede dono e data para cada
atrito aberto. A3 e A5 foram confirmados pelo CEO em 2026-09-29 (D-19 e D-20 em
`registro-de-decisoes.md`).

| Atrito | Decisão | Dono | Data ou gatilho |
|---|---|---|---|
| **A3** — "Ver evidência" só no painel de divergência | Exibir também em Coleta e no gap, escopo mínimo (D-19) | Regua (spec) → Bussola | Spec até **2026-10-01**; em `github/main` até **2026-10-08**, antes do M3 em produção |
| **Foco inicial do `ModalShell`** — ao abrir o modal, o foco fica no `body` | Corrigir: o foco vai ao primeiro controle do modal e volta ao gatilho ao fechar | Bussola | Em `github/main` até **2026-10-06**. Critério: abrir qualquer modal do Meridian pelo teclado leva o foco para dentro do modal |
| **A5** — ciclo de dependência e ajuste de severidade/esforço sem tela | Depois (D-20). Enquanto isso, prova pelo servidor | Crivo (teste de action) · Regua (backlog M-14) | Teste do ciclo (FR-023) pelo servidor até **2026-10-10**. Tela entra pelo evento que vier primeiro: (1) em produção, um `MeridianAssessment` de tenant com `isInternalTenant = false` chega a `status = REVIEW`, ou seja, fecha a coleta; (2) a consultora registra no `diario.md` um ajuste de gap sem caminho; (3) o teste de action acha defeito na recusa de ciclo. Data-limite para rever, mesmo sem evento: **2026-12-15** |

### 2026-09-29 · Benchmark travado por tenant, só a Nebuloz liga (CPO, sobre decisão do CEO)

**Contexto.** O CEO decidiu em 2026-09-29 que o benchmark fica desligado no primeiro contrato **e**
travado no produto (`docs/compliance/2026-09-29-memo-ceo-operadora-controladora-meridian.md`, item 4 e
§5 a). Hoje o default é `false`, mas o consultor do cliente liga a caixa ao criar o assessment
(`screens/assessments.tsx:211`), e o scoring passa a contribuir para a coorte (`actions/scoring.ts:200`,
`actions/benchmark.ts:55-72`). Ligado, a Nebuloz vira controladora sem linha no RoPA e sem aviso ao
respondente. A cláusula do DPA (§2.1) sozinha não impede o clique.

**Regra.**
1. **A permissão é do tenant, não do assessment.** Cada tenant tem uma habilitação de benchmark do
   Meridian, desligada por padrão. Enquanto estiver desligada, nenhum assessment desse tenant pode ter
   `benchmarkOptIn = true`.
2. **Só a Nebuloz liga, e só pelo back-office.** Quem liga é staff Nebuloz, na ficha do cliente em
   backoffice.nebuloz.ai. É obrigatório informar a referência do aditivo contratual (DPA §2.1). A ação
   grava auditoria com ator, data e referência. Nenhum papel do tenant do cliente liga ou desliga,
   inclusive ADMIN e CONSULTANT.
3. **Com a habilitação ligada, o opt-in continua por assessment.** A caixa aparece e o consultor decide
   assessment a assessment, como hoje.
4. **O servidor recusa, não só a tela.** `createAssessment` recusa `benchmarkOptIn = true` com a
   habilitação desligada. `runScoring`/`contributeToBenchmark` não contribui se a habilitação estiver
   desligada no momento do scoring, mesmo com um `benchmarkOptIn = true` antigo. Desligar a habilitação
   trava as contribuições futuras. Retirar o que já contribuiu segue a regra atual de
   `withdrawContribution`.
5. **Tenant interno.** `isInternalTenant = true` segue a mesma regra. Staff liga quando quiser, sem
   aditivo, porque a Nebuloz já é controladora do próprio dado.

**Fora desta regra.** Linha no RoPA e aviso próprio ao respondente são pré-requisito para ligar a
habilitação de um cliente externo (memo, §5 a). São da Lacre e não bloqueiam a trava.

**Dono e data.** Regua (spec curta) até **2026-10-01**; Bussola, em `github/main` até **2026-10-07**.
Critério de pronto: com a habilitação desligada, a caixa não aparece; chamar `createAssessment` direto
com `benchmarkOptIn: true` volta erro; e um assessment antigo com opt-in não gera contribuição no
scoring. **Bloqueia cliente externo.**

Antes do primeiro contrato, Pilar confere em produção se algum assessment de tenant externo tem
`benchmarkOptIn = true`, com o "vai" do CEO.

---

*Draft para revisão interna. Documento companheiro: Meridian SRD v1.0.*
