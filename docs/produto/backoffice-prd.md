# Back-office — Product Requirements Document

> **PRODUCT** Back-office (Big Bang) · **STAGE** Operação de clientes e sistema interno · **STATUS** Draft for review
> **VERSION** 2.0 · **DATE** 2026-09-22 · **OWNER** Product, Nebuloz
> **COMPANION** [Back-office SRD v2.0](./backoffice-srd.md) · [Mapa de fronteiras](./mapa-de-fronteiras.md)

> **Nota de 2026-09-22 — o escopo mudou.** A v1.0 (2026-08-20) tratava o painel só como operação de clientes e dizia
> que ele não é CRM nem BI. O código já é mais que isso: Growth, Funil, Propostas, Empresa e Financeiro formam o CRM e o
> ERP leves da própria Nebuloz. O dono decidiu que este documento descreve o que o código faz. O back-office tem dois
> lados, **operação de clientes** e **sistema interno**, e cada seção e requisito diz de que lado está. A frase "não é
> CRM nem BI" saiu. Na mesma decisão, o [Mapa de fronteiras](./mapa-de-fronteiras.md) virou o alvo normativo: onde o
> código diverge dele, o texto diz **gap**, com a evidência e o que teria de mudar.

No Mapa, o back-office é o Big Bang: transversal às quatro fases, papel VENDER E OPERAR, pergunta
"Como isso entra e roda?". Uma pessoa da equipe contrata, provisiona, acompanha e cobra um cliente sem
abrir o banco. No mesmo painel, a casa prospecta, vende, entrega e fecha o mês.

---

## 1. Problema

**Operar cliente dependia de SQL.** Contratar era uma sequência de atos que só existia na cabeça de
quem os executava: criar tenant, ligar módulo, semear dado, conferir, avisar o comercial. Tudo passava
pelo editor de SQL, nas mãos de quem tinha credencial de produção. O custo maior não era a lentidão.
Nada deixava rastro, e "desde quando estou sem acesso" se respondia reconstruindo log.

**A casa também rodava fora de sistema.** Funil, proposta, custo de aquisição, DPA de fornecedor,
consentimento de gravação, DRE e caixa viviam em planilha e markdown. Um número não conversava com o
outro, e nenhum tinha trilha.

> **POR QUE ESTE É O GARGALO**
> Os produtos entregam valor ao cliente. Sem o back-office, cada cliente novo exige uma pessoa técnica
> no console. A operação escala com quem sabe o procedimento, não com as vendas.

### Evidência

Referência: `main` @ `ea512044`. Caminho sem pasta raiz é relativo a `apps/backoffice/`; `P/` =
`packages/provisioning/src/`; `S/` = `packages/database/prisma/schema/`. **BB** = PRD & SRD do Big Bang
(projeto de design, ago/2026). `[inferido]` marca dedução de leitura, sem execução.

- Migrations aplicadas colando SQL no editor do Supabase, sem registro de quem provisionou; suspender módulo era um `UPDATE` sem confirmação (v1.0 deste PRD).
- DPA de fornecedores, modelo de CAC, plano de contas com DRE e caixa, e aviso de gravação viviam só em markdown (`docs/design-handoff/backoffice-gap-2026-09-05.md` §5).
- O painel está em produção em `backoffice.nebuloz.ai` (`docs/design/2026-08-laudo-backoffice.md:3`): 29 telas, 34 módulos de server action com 108 funções exportadas, 157 arquivos de teste.
- Em produção há 7 tenants de cliente, todos internos, de teste ou de demonstração, sem sinal de cliente pagante. O sistema interno tem 2 propostas, ambas ENVIADA, 1 lead e nenhum engajamento (banco de produção, consulta de 2026-09-22).
- Nenhuma medida deste PRD é coletada. O app não tem analytics nem coletor de erro (`next.config.ts:1-7`).

---

## 2. Usuários

| PAPEL | TRABALHO A FAZER | SUCESSO É | LADO |
|---|---|---|---|
| Operação da plataforma (SRE, Customer Success) | Provisionar, contratar, destravar cliente | O cliente loga sem ninguém abrir o console | clientes |
| Comercial e RevOps | Funil, proposta na call, catálogo, renovação | Proposta enviada sem redigitar escopo; carteira ordenada por quem precisa de telefonema | os dois |
| Consultoria de delivery | Gates do Scaffold, engajamento, capacidade, IP | Gate parado aparece antes da reclamação; alocação visível antes de prometer prazo | os dois |
| Finanças da casa | DRE, lançamentos, títulos, caixa de 13 semanas, MRR, CAC | Fechar o mês sem planilha | interno |
| Segurança e compliance internos | Auditar sem mudar nada; DPA e consentimento | Leitura completa, escrita negada | os dois |
| Sponsor | Saber se a carteira está saudável | Saúde derivada do que a plataforma já grava | clientes |

O código conhece dois papéis. Staff é quem tem `TenantMember` no tenant interno `system`: `ADMIN` lê e escreve, `MEMBER`
só lê (`lib/guard.ts:9-19`, `:183`). Não há papel por área, então quem lança no DRE também suspende módulo de cliente.
Ser staff não dá acesso a cliente, e ser membro de cliente não dá acesso ao painel (`docs/runbooks/acesso-ao-backoffice.md:29-30`).

---

## 3. Objetivos e não-objetivos

### Objetivos

| OBJETIVO | MEDIDA | LADO | ESTADO |
|---|---|---|---|
| Tirar a operação do console | Tenants provisionados pelo painel | clientes | parcial — o fluxo existe (B-01); a medida não é coletada |
| Tenant no ar em menos de 10 min (BB §2) | Tempo de provisionar e preparar | clientes | parcial — não medido |
| Rastro em toda operação sensível | Operações com trilha | os dois | implementado (B-03) |
| Separar quem pede de quem aprova | Operações sensíveis com decisor distinto | os dois | parcial — uma de cinco passa pela fila (B-11) |
| Antecipar renovação e risco | Clientes em risco antes do vencimento | clientes | parcial — o painel não grava prazo (B-18) |
| Proposta ganha vira cliente sem redigitar escopo (BB §2) | Propostas ganhas que viram tenant | os dois | ausente (B-32) |
| Fechar o mês no painel | DRE, caixa e MRR sem planilha | interno | implementado (B-36) |

### Não-objetivos

- **Não é o produto.** Tela de cliente mora nos produtos. O back-office contrata, prepara e observa.
- **Não é dono de entidade compartilhada.** Pelo Mapa, o Big Bang lê política, engajamento e portfólio;
  tenant, papel e trilha são do Charter. Onde ele escreve, é gap (§8).
- **Não é o LAB.** O modelo próprio tem documento próprio ([LAB PRD](./lab-prd.md)) e volta ao menu quando
  tiver schema. Engenharia de ML não usa este painel.
- **Não é gateway de pagamento nem GRC.** Cobrança automática, nota fiscal, inadimplência e SIEM ficam
  fora (BB §5). O painel registra receita; não a cobra.
- **Não substitui o banco.** Emergência continua sendo SQL.

---

## 4. As oito seções

O menu tem 25 itens em oito seções (`components/nav.ts:60-204`). São 29 telas no grupo `(staff)`, mais
`/home` (redirect para `/`) e dois CSV. `/sign-in`, `/seguranca` e `/api` ficam fora do grupo; `/seguranca`
usa a variante do guard sem 2FA, para o staff cadastrar o autenticador.

| SEÇÃO | TELAS | LADO |
|---|---|---|
| Plataforma | Home, Clientes (carteira e detalhe), Aprovações, Observabilidade | clientes; Aprovações serve aos dois |
| Delivery | Engajamentos, Fila de gates, Capacidade, Biblioteca de IP | Fila de gates: clientes; o resto: interno |
| Growth | Maturidade de IA | interno |
| Comercial | Funil, Propostas, Serviços, Saúde e renovação, Benchmark | Saúde e renovação: clientes; o resto: interno |
| Empresa | Fornecedores e DPA, Consentimento, CAC, Financeiro (7 abas) | interno |
| Ferramentas | Modelagem BPMN, Mapa de processos, Diagramas | interno |
| Auditoria | Trilha de auditoria, Atividade do staff | os dois |
| Operações | Provisionar cliente, Versão e schema | clientes |

**Operação de clientes** é o que cria, muda, lê ou cobra um tenant de cliente, mais a plataforma que o serve.
**Sistema interno** é o que a Nebuloz registra sobre si mesma no tenant `system`: funil, proposta, catálogo, entrega, finanças e conhecimento.

> **RESTRIÇÃO DURA**
> Operação sensível não executa no clique. O BB §6 lista cinco: deleção de tenant, escrita avançada de
> MCP, desconto acima de 15%, export sensível e mudança grande de plano. Hoje só o desconto passa pela
> fila (`app/(staff)/aprovacoes/page.tsx:74-78`). Deleção, MCP e mudança de plano não existem no painel; o
> export da trilha existe, sem alçada (B-39). Fila que aceita auto-aprovação é decorativa, e pior que
> nenhuma, porque a trilha exibe um aprovador. O servidor a recusa.

> **FORA DO PAINEL, POR DECISÃO**
> Remover cliente, revogar staff e promover ADMIN são SQL (`components/nav.ts:243-245`; BB §6). O runbook chama isso de dívida (`docs/runbooks/acesso-ao-backoffice.md:60-64`).

---

## 5. Requisitos

Prioridade: **P0** necessário para operar · **P1** dentro de dois trimestres · **P2** desejável. Estado
na `main`: implementado, parcial ou ausente. B-01 a B-16 vêm da v1.0; B-17 em diante são novos. M-01 a
M-08 são os gaps do §8.

### 5.1 Operação de clientes

| ID | REQUISITO | PRI | ESTADO | EVIDÊNCIA |
|---|---|---|---|---|
| B-01 | Provisionar numa transação: slug, tenant, dono ADMIN ou convite de 14 dias, módulos ACTIVE ou TRIAL, evento `tenant.provisioned` | P0 | implementado | `P/tenant.ts:53-116`; `app/actions/provisioning.ts:145-178`. Gap M-01 |
| B-17 | Preparar Charter (papel, configurações, política) e Meridian (papel, template v3.2), idempotente | P0 | implementado | `P/charter.ts:67-159`; `P/meridian.ts:232-325`. Gap M-02, M-03 |
| B-02 | Contratar e trocar status de módulo, com confirmação nomeada e trilha | P0 | parcial | barreira em `components/confirmar-acao.tsx:5-30`; toda troca passa por `contractModule`, que grava `expiresAt` e `seats` nulos (`app/(staff)/clientes/[slug]/module-form.tsx:77-81`; `P/modules.ts:72-77`) |
| B-18 | O prazo vendido vira a vigência do módulo | P1 | ausente | o prazo vive só na proposta (`S/comercial.prisma:63-82`); o painel nunca grava `expiresAt`, e um trial self-service de 14 dias (`apps/app/app/actions/onboarding.ts:44-48`) perde o prazo na primeira troca feita aqui [inferido] |
| B-08 | Saúde e renovação derivadas; "Sem sinal" não vira OK | P0 | parcial | `lib/health.ts:13-54`; `app/actions/accounts.ts:68-108`; a renovação depende de B-18 |
| B-19 | Detalhe do cliente em abas | P0 | parcial | Resumo, Usuários, Integrações, Charter, Meridian e Trilha (`app/(staff)/clientes/[slug]/detalhe.tsx:190-245`); MCP, Políticas, Ambientes e Signal ficaram fora por falta de schema (`:36-41`) |
| B-20 | Trocar papel de membro do cliente sem deixar o tenant sem ADMIN | P0 | parcial | guarda em `app/actions/tenant-members.ts:120-137`; convidar e desativar pelo painel não existem. A busca por slug não filtra `isSystem` (`:45-54`): por RPC, um ADMIN troca o papel de outro staff no tenant `system`, o que o menu diz ser SQL [inferido] |
| B-21 | Integrações de cada cliente com status e erro, sem credencial | P0 | parcial | leitura em `app/actions/tenant-observability.ts:60-80`; testar, re-testar e configurar IdP não existem: "quem conecta é o cliente" (`detalhe.tsx:217`) |
| B-22 | Fila de gates do Scaffold só com metadado; entrar no cliente exige motivo de 12+ caracteres e grava `AccessLog` antes | P0 | implementado | `app/actions/scaffold-supervision.ts:8-22`, `:196-243`; ADR-0017 |
| B-23 | Lacuna promovida no Meridian vira engajamento (ADR-0014) | P1 | parcial | actions em `app/actions/scaffold.ts:50`, `:255`; a tela saiu em 2026-09-20 (`37ecceb9`) e nada as chama. Gap M-05, M-06 |
| B-12 | Suspender, arquivar ou remover cliente sem SQL, com retenção e aprovação dupla (BB FR-7) | P1 | ausente | `Tenant` não tem status (`S/tenant.prisma:25-41`); SQL por decisão (`components/nav.ts:243-245`); sem job de eliminação (`docs/compliance/lgpd-ropa-e-lacunas.md` §2.4) |
| B-24 | Cobrança coerente com o contrato | P1 | ausente | ativar é "sem cobrança automática" e o trial "não expira sozinho" (`module-form.tsx:31-44`); a receita é digitada em `AssinaturaDoTenant`, sem ligação com `TenantModule` (`S/empresa.prisma:267-325`) |
| B-25 | Políticas, MCP e config-as-code do cliente (BB FR-4, FR-11) | P2 | ausente | sem schema (`detalhe.tsx:36-41`); pelo Mapa, política é do Charter (M-03) |
| B-26 | Home diz o que exige atenção: aprovações, integrações quebradas, acessos recusados | P0 | parcial | `app/(staff)/page.tsx:100-131`, `:259`; o KPI de pipeline aberto (BB FR-1) não existe |
| B-27 | Conferir se o banco do ambiente acompanha o código | P1 | implementado | `lib/versao.ts:1-17`; `app/actions/versao.ts:33`; produção tem 115 migrations aplicadas (banco de produção, consulta de 2026-09-22), e o repo tem 115 em `packages/database/prisma/migrations` |

### 5.2 Sistema interno

| ID | REQUISITO | PRI | ESTADO | EVIDÊNCIA |
|---|---|---|---|---|
| B-28 | Maturidade de IA: 6 dimensões, 5 níveis, score congelado, degrau recomendado | P1 | implementado | `lib/growth/maturidade.ts:25-144`; `app/actions/maturidade.ts:275-340`. Gap M-04 |
| B-29 | Funil com peso, teto e critério por estágio, mudança append-only e perda com motivo | P1 | implementado | `app/actions/funil-config.ts:123-206`; `S/platform-ops.prisma:178-267`; `app/actions/leads.ts:471-557` |
| B-30 | Proposta ao vivo: plano com mínimo faturável, módulos, prazo, add-ons, serviços e desconto; ACV e TCV congelados | P0 | implementado | `lib/comercial/precificar.ts:50-122`; `app/actions/proposta-escopo.ts:56-265`; preços no [SRD](./backoffice-srd.md) §3 |
| B-31 | Enviar exige contato válido e um módulo, conferido no servidor | P0 | parcial | a tela exige (`app/(staff)/propostas/[id]/gerador-envio.tsx:48-55`); `submitProposalAction` não confere o contato (`app/actions/proposals.ts:214-247`) [inferido] |
| B-32 | Fechar a venda: aceite ou recusa, e a proposta ganha pré-preenche o provisionamento | P0 | ausente | nenhuma action grava `ACEITA` ou `RECUSADA`; `tenantProvisionadoSlug` só é lido (`app/actions/leads.ts:67`, `:142`); o "Ganho" do funil é inalcançável (`lib/comercial/funil.ts:162-173`); sem PDF, e-mail nem assinatura. Em produção, as 2 propostas estão em ENVIADA (banco de produção, consulta de 2026-09-22) |
| B-33 | Catálogo e preço mudam sem deploy | P1 | parcial | serviços `SV-NN` pela tela (`app/actions/services.ts:115-330`); plano, preço de módulo, prazo e add-on só por SQL (`app/actions/catalogo-comercial.ts:53` só lê). O catálogo de produção bate com as sementes, e um registro de teste inativo (SV-12) ficou nele (banco de produção, consulta de 2026-09-22) |
| B-34 | Engajamento por escopo fechado; capacidade por pessoa, acima de 100% com motivo; IP versionado com reuso medido | P1 | implementado | `app/actions/engagements.ts:116-249`; `app/actions/capacity.ts:196-299`; `app/actions/ip-library.ts:231-512`; falta o detalhe de engajamento. Gap M-06 |
| B-35 | Benchmark entre clientes e serviços, sem cancelado nem recusado | P2 | implementado | `app/actions/benchmark.ts:13-29` |
| B-36 | Financeiro em 7 abas, CAC, Fornecedores e DPA, Consentimento | P1 | implementado | `app/(staff)/empresa/financeiro/page.tsx:151-159`; `app/actions/empresa/`; `S/empresa.prisma` |
| B-37 | BPMN e diagramas com revisão append-only; mapa de processos | P2 | implementado | `S/governance.prisma:220-276`; `S/processos.prisma:4-39`; `app/actions/diagrams.ts`, `processos.ts` |
| B-10 | Capability de LAB à parte do papel ([LAB SRD](./lab-srd.md)) | P1 | ausente | por decisão, até o LAB ter schema (`components/nav.ts:16-22`) |

### 5.3 Os dois lados

| ID | REQUISITO | PRI | ESTADO | EVIDÊNCIA |
|---|---|---|---|---|
| B-04 | Leitura para todo staff; escrita só ADMIN, checada no servidor | P0 | implementado | `lib/guard.ts:183`, `:191-198` |
| B-06 | Segundo fator obrigatório | P0 | implementado | `lib/guard.ts:54-90`, `:177`; `app/seguranca/actions.ts:6-25` |
| B-07 | Teto por pessoa, com cota própria para provisionar | P0 | implementado | 120 por minuto e 10 por hora (`lib/rate-limit.ts:18-24`) |
| B-03 | Trilha append-only em toda escrita | P0 | implementado | `P/audit.ts:22-46`; trigger `20260603000002_audit_log_immutable_trigger`. Conforme ao Mapa (entidade 16) |
| B-09 | Trilha de todos os clientes com filtro por cliente, ação, entidade e período, e CSV | P0 | implementado | `lib/audit-filtro.ts:29-60`; `app/(staff)/audit/exportar/route.ts:30-56` |
| B-38 | Atividade do staff separa ato de staff de ato do cliente | P1 | parcial | filtra `metadata.platformStaff` (`app/actions/clients.ts:138-149`), mas o cadastro self-service grava o mesmo selo com o cliente como ator (`P/audit.ts:39-44`; `apps/app/app/actions/onboarding.ts:36-52`) [inferido] |
| B-05 | Quem pede não decide, nem para rejeitar | P0 | implementado | `app/actions/approvals.ts:186-212` |
| B-11 | Operação sensível entra na fila, e aprovar a executa | P1 | parcial | só desconto acima de 15% (`app/actions/proposals.ts:246-271`; `app/actions/approvals.ts:256-304`) |
| B-39 | Export sensível passa por alçada e fica registrado | P1 | ausente | o CSV da trilha sai para qualquer staff, inclusive MEMBER, até 5.000 linhas, sem fila nem registro (`app/(staff)/audit/exportar/route.ts:19`, `:30-39`) |
| B-40 | Acesso ao painel registrado pelo servidor, inclusive a recusa de quem não é staff | P1 | parcial | `LOGIN` e `RECUSADO` saem do navegador (`app/sign-in/form.tsx:24-53`) por action sem sessão nem teto (`app/actions/access.ts:28-65`); a recusa "não é da equipe" não grava (`lib/staff-access.ts:29-52`) |
| B-16 | Leitura de dado de cliente registrada e recortada pela tarefa | P2 | parcial | só a travessia de gate grava `AccessLog` (B-22); abrir o detalhe ou exportar não grava; sem recorte |
| B-41 | Conceder e revogar staff com trilha | P1 | ausente | SQL em `packages/database/scripts/grant-staff-admin.sql`; a concessão não é auditada (`docs/runbooks/acesso-ao-backoffice.md:60-64`) |
| B-13 | Coletor de erro de produção | P1 | ausente | `next.config.ts:1-7` só liga log; não há `instrumentation.ts` |
| B-42 | Testes do painel rodam no CI | P0 | ausente | `package.json:10` só tem `test`, e o CI roda `turbo test:coverage` (`.github/workflows/ci.yml:262-263`) [inferido] |
| B-14 | E2E de entrar, provisionar e preparar, no CI | P1 | parcial | `apps/app/e2e/backoffice-charter-provisioning.spec.ts` não faz login com 2FA e espera "Clientes" em `/` (`:43-45`); nenhum workflow o roda |
| B-15 | Retenção ou particionamento do `AuditLog` | P2 | ausente | nenhuma migration particiona nem expurga; o `AuditLog` é imutável por decisão (ADR-0009) |

---

## 6. Critérios de sucesso

| CRITÉRIO | NA MAIN |
|---|---|
| Um cliente novo entra em produção sem ninguém abrir o console | atendido (B-01, B-17) |
| Toda operação sensível responde "quem fez, quando e por quê" sem consultar o banco | atendido na escrita (B-03); leitura só na travessia (B-16) |
| Nenhuma operação irreversível num clique | atendido (B-02) |
| Quem pede uma operação sensível não a aprova | atendido (B-05) |
| O comercial sabe quem renova nos próximos 60 dias sem perguntar | não atendido: não há prazo gravado (B-18) |
| Perder o acesso de um staff é uma ação, não um chamado | não atendido: é SQL (B-41) |
| Proposta ganha vira cliente sem redigitar escopo | não atendido (B-32) |
| A casa fecha o mês no painel | atendido no código (B-36); uso não medido |

---

## 7. Riscos

| RISCO | MITIGAÇÃO | NA MAIN |
|---|---|---|
| Painel vira gargalo de uma pessoa | Papéis distintos e E2E por papel | E2E fora do CI (B-14) |
| Confirmação vira clique automático; staff sem 2FA | Alvo escrito na barreira; 2FA no guard | feito (B-02, B-06) |
| Saúde afirma o que não sabe | "Sem sinal" é categoria própria | feito; renovação sem dado (B-18) |
| Fila vira carimbo | Auto-aprovação recusada no servidor | feito (B-05) |
| Dado de cliente além do necessário | Credencial fora do `select`; export com alçada | CSV sem alçada (B-39) |
| Garantia escrita que ninguém roda | Suíte do painel no CI | ausente (B-42) |
| O mesmo ADMIN lança no DRE e suspende cliente | Permissão por área | ausente (§9, item 6) |
| Isolamento por convenção | RLS efetiva (ADR-0012) | a conexão é superuser; isola o filtro por `tenantId` |
| O funil mede um ganho que ninguém grava | Evento de fechamento da venda | ausente (B-32) |

---

## 8. Dependências e fronteiras

| DEPENDE DE | NATUREZA |
|---|---|
| `@repo/provisioning` | Porta de escrita de plataforma, com trilha; `platformDb` só ali e aqui (ADR-0013) |
| `@repo/auth` | Sessão e TOTP (better-auth) |
| `@repo/rate-limit` | Teto por pessoa, contador no Postgres |
| `@repo/rbac` | Gate de módulo que os produtos leem, com cache de 5 min |
| Os cinco produtos | Charter e Meridian recebem o bootstrap (B-17); o Scaffold fornece a fila de gates (B-22); o cadastro self-service do Cosmos usa a mesma `provisionTenant`; o Signal só é contratado |

### Fronteiras no Mapa de fronteiras

O Mapa dá ao Big Bang três assinaturas: gerador de proposta, editor BPMN e MCP lab. Ele não é dono de nenhuma das 16
entidades compartilhadas; lê política (entidade 3), engajamento e gate (8) e portfólio (9). A trilha (16) está conforme:
registro único, diff `[campo, antes, depois]` do Charter, e o `AccessLog` separado de propósito, porque registra acesso,
não alteração (Mapa §3.6). O sistema interno (proposta, catálogo, funil, finanças) não é compartilhado.

| ID | ENTIDADE | NO MAPA | GAP NA MAIN | O QUE TERIA DE MUDAR |
|---|---|---|---|---|
| M-01 | Tenant e contrato (1) | O Charter é o único emissor de `tenant_id`; o contrato é dele | `provisionTenant` cria o tenant (`P/tenant.ts:53-116`), chamado pelo back-office e pelo cadastro do app (`apps/app/app/actions/onboarding.ts:36-52`); o back-office grava `TenantModule` (`P/modules.ts:52-151`) | Emitir tenant e contrato sob o Charter; back-office e cadastro viram chamadores |
| M-02 | Usuário, papel, permissão (2) | Um modelo, do Charter | Staff é `TenantMember` no `system` (`lib/guard.ts:165-176`); o painel troca papel de membro do cliente (`app/actions/tenant-members.ts:97-160`) e grava `CharterMembership` e `MeridianMembership` (`P/charter.ts:95-106`; `P/meridian.ts:260-271`) | Papel concedido por comando do Charter; o back-office pede e lê |
| M-03 | Política (3) | Do Charter; o Big Bang lê | O bootstrap cria a política com 9 seções em DRAFT (`P/charter.ts:132-145`); Fornecedores e DPA altera `CharterVendor` do tenant `nebuloz` (`app/actions/empresa/fornecedores.ts:263-341`) | O Charter cria a própria política inicial; o estado do DPA tem um dono só |
| M-04 | Avaliação de prontidão (4) | Do Meridian | A Maturidade de IA é avaliação própria do back-office, que o schema chama de diagnóstico do degrau 01 (`S/platform-ops.prisma:667-715`) | O diagnóstico de prospect roda no Meridian; o back-office lê o score |
| M-05 | Gap register (6) | Do Meridian; virar iniciativa é ato do Cosmos | `materializarEngajamento` grava `targetEntityId` na promoção, linha do Meridian (`app/actions/scaffold.ts:165-190`) | O back-office para de escrever no Meridian |
| M-06 | Engajamento, fase, gate (8) | Do Scaffold; o Big Bang lê | A fila lê só metadado, conforme. Mas a ADR-0014 faz do `Engagement` do back-office, contrato de serviço no `system` (`S/platform-ops.prisma:379-423`), o destino da promoção | Rever a ADR-0014; separar contrato de serviço da casa e engajamento do Scaffold |
| M-07 | Hierarquia de portfólio (9) | Do Cosmos; o Big Bang lê | O painel não lê a árvore (Mapa §6, ligação que falta) | Ler a árvore do Cosmos, sem copiá-la |
| M-08 | Assinatura do Big Bang | Gerador de proposta, editor BPMN, MCP lab | Gerador e BPMN existem (B-30, B-37); não há código de MCP no painel | Especificar o MCP lab ou tirá-lo do Mapa |

---

## 9. Questões em aberto

1. **Fechamento da venda (B-32).** Que evento fecha: aceite, assinatura ou pagamento? Quem o registra? Ele cria o cliente e a assinatura?
2. **Vigência e cobrança (B-18, B-24).** Onde nasce o prazo do contrato? Inadimplência suspende o módulo?
3. **Alçada (B-11, B-39).** Quais operações entram na fila, e em que ordem? O CSV da trilha continua aberto a MEMBER?
4. **Ciclo de vida de staff e de cliente (B-12, B-41).** SQL por decisão ou dívida? O menu diz uma coisa; o runbook, outra.
5. **Mapa (M-01 a M-07).** Tenant, contrato e papel passam ao Charter, ou o Mapa registra a plataforma como exceção? A Maturidade de IA sai do back-office? Em que ordem?
6. **Permissão por área.** Sistema interno e operação de clientes continuam sob o mesmo ADMIN?
7. **Vocabulário.** `PlanoComercial` (starter, scale, enterprise, diagnóstico) convive com `Tenant.plan` (ORBIT a UNIVERSE), que o painel mostra e nunca grava (`app/(staff)/clientes/[slug]/page.tsx:142-143`; `S/tenant.prisma:1-6`). A Escada do funil (01 Meridian a 05 Cosmos, `lib/comercial/funil.ts:67-76`) segue a jornada do site, não a cadeia do Mapa. Qual termo fica?
8. **Escala.** Hoje são 7 tenants de cliente, sem sinal de cliente pagante (banco de produção, consulta de 2026-09-22). Quantos em 12 meses, e quantas pessoas no painel? Os KPIs de Propostas somam só as 100 mais recentes (`app/(staff)/propostas/page.tsx:47-60`; `lib/paginacao.ts:24`).

---

*Draft para revisão interna. Documento companheiro: Back-office SRD v2.0.*
