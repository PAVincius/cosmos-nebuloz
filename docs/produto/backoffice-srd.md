# Back-office — Software Requirements Document

> **PRODUCT** Back-office (Big Bang) · **COMPANION** [Back-office PRD v2.0](./backoffice-prd.md) · [Mapa de fronteiras](./mapa-de-fronteiras.md)
> **STATUS** Engineering draft · **VERSION** 2.0 · **DATE** 2026-09-22 · **AUDIENCE** Engenharia, Segurança

> **Nota de 2026-09-22.** A v1.0 (2026-08-20) especificava 16 rotas, 15 módulos de action, três módulos de
> produto e teto no Upstash. A v2.0 descreve a `main` @ `ea512044`: 29 telas, 34 módulos de action, cinco
> módulos, teto no Postgres e o sistema interno que o PRD v2.0 passou a assumir. Cada requisito traz estado
> e evidência. Onde o código diverge do [Mapa de fronteiras](./mapa-de-fronteiras.md), é gap (IDs M-01 a
> M-08, definidos no PRD §8).

Guard único, trilha append-only, fila de aprovação, saúde derivada e porta única cross-tenant — e o que
falta para o painel caber no Mapa.

---

## 1. Escopo

Especifica `apps/backoffice` e a parte de `packages/provisioning` que ele usa. Dois lados, como no PRD:

- **Operação de clientes.** Guard de staff, provisionamento, ciclo de vida de módulo, bootstrap de Charter e
  Meridian, saúde e renovação, fila de gates do Scaffold, trilha e acesso, versão do schema.
- **Sistema interno.** Maturidade de IA (gap M-04), funil, propostas e catálogo, engajamento, capacidade e
  IP, financeiro, CAC, DPA, consentimento e ferramentas (BPMN, processos, diagramas). Todo esse dado mora no
  tenant `system`.

**Fora de escopo:** funcionalidade entregue ao cliente (os produtos), o LAB ([LAB SRD](./lab-srd.md)),
gateway de pagamento e nota fiscal, e operação de emergência. O painel cobre o caminho normal; não
substitui o banco.

Convenções: caminho sem pasta raiz é relativo a `apps/backoffice/`; `P/` = `packages/provisioning/src/`;
`S/` = `packages/database/prisma/schema/`. **BB** = PRD & SRD do Big Bang (projeto de design, ago/2026).
`[inferido]` = dedução de leitura, sem execução.

### Definições

| TERMO | SIGNIFICADO |
|---|---|
| Staff | `TenantMember` no tenant interno `system` (id e slug `system`). `ADMIN` escreve; `MEMBER` lê |
| Cliente | Tenant com `isSystem = false`. A tela diz "cliente"; o schema, "tenant" |
| Módulo | `ProductModule`: COSMOS, CHARTER, SIGNAL, MERIDIAN, SCAFFOLD. Status ACTIVE, TRIAL, SUSPENDED ou CANCELED (`S/modules.prisma:15-28`) |
| Acesso a módulo | ACTIVE ou TRIAL, com `expiresAt` nulo ou futuro (`packages/rbac/src/modules.ts:13-33`) |
| Provisionar | Criar tenant, dono ou convite, e módulos, numa transação |
| Preparar | Bootstrap: papel e estrutura mínima do Charter ou do Meridian |
| Aprovação | `PlatformApproval`: pedido com motivo, impacto, solicitante e decisor |
| Saúde | Veredito derivado: SEM_SINAL, OK, ATENCAO ou RISCO. Nunca campo gravado |
| Travessia | Entrada registrada no tenant do cliente, a partir da fila de gates |
| Plano | `PlanoComercial` (proposta) não é `Tenant.plan` (ORBIT a UNIVERSE) |
| Capability | Permissão à parte do papel. Nenhuma existe; a primeira seria `lab` |

---

## 2. Arquitetura

```
  Operação · Comercial · Delivery · Finanças · Segurança (só leitura)
                              │
                              ▼
               ┌──────────────────────────────┐
               │     requirePlatformStaff     │  sessão · teto · membership · 2FA
               └──────────────┬───────────────┘
       ┌──────────────────────┼────────────────────────┐
       ▼                      ▼                        ▼
┌──────────────┐   ┌─────────────────────┐   ┌───────────────────────┐
│ Operação de  │   │ Os dois lados       │   │ Sistema interno       │
│ clientes     │   │ aprovações · trilha │   │ funil · propostas ·   │
│ clientes ·   │   │ acesso · atividade  │   │ delivery · empresa ·  │
│ saúde · gates│   │                     │   │ ferramentas           │
└──────┬───────┘   └──────────┬──────────┘   └───────────┬───────────┘
       ▼                      ▼                          ▼
┌──────────────────────────────────────┐       Prisma direto,
│ @repo/provisioning                   │       tenant `system`
│ tenant · módulo · bootstrap · trilha │                 │
│ platformDb (leitura cross-tenant)    │                 │
└──────────────────┬───────────────────┘                 │
                   └──────────────┬──────────────────────┘
                                  ▼
                   PostgreSQL (Supabase) · Prisma
                                  │
     ┌───────────────┬────────────┴──────┬──────────────────────┐
     ▼               ▼                   ▼                      ▼
 tenant do       Charter e Meridian   Scaffold              Upstash (cache de
 cliente         do cliente           (metadado de gate)    módulo, opcional)
```
*FIGURA 1 — TODO CAMINHO PASSA PELO GUARD; TODA ESCRITA DE PLATAFORMA PASSA PELO PACOTE, COM TRILHA.*

| COMPONENTE | RESPONSABILIDADE | EVIDÊNCIA |
|---|---|---|
| `lib/guard.ts` | Sessão, teto, membership, 2FA, `canWrite` | `:151-185` |
| `lib/rate-limit.ts` | Teto por pessoa; contador no Postgres; degrada aberto | `:53-101` |
| `lib/safe-action.ts` | `Result`; o erro sai só com código | `:19-30` |
| `app/actions/` e `app/seguranca/actions.ts` | 34 módulos `"use server"`, 108 funções exportadas | — |
| `P/tenant.ts`, `modules.ts`, `charter.ts`, `meridian.ts`, `audit.ts` | Escrita de plataforma, sempre com trilha | — |
| `P/platform-db.ts` | `platformDb`, a porta cross-tenant (ADR-0013) | `:4-18` |
| `lib/health.ts`, `lib/comercial/`, `lib/empresa/`, `lib/growth/` | Regras puras: saúde, preço, funil, finanças, maturidade | — |
| Rotas | CSV da trilha e dos títulos; `api/health` público; `api/auth` | `app/(staff)/audit/exportar/route.ts`; `app/api/health/route.ts` |

---

## 3. Modelo de dados

```
TENANT DO CLIENTE                        TENANT `system` (dado da casa)
Tenant ─1:N─ TenantModule                PlatformApproval   (solicitante ≠ decisor)
  ├─1:N─ TenantMember ── User            AccessLog          (entrada, recusa, travessia)
  ├─1:N─ TenantInvitation                Lead ─0..1─ Proposal ─1:N─ ProposalItem ─N:1─ Service
  ├─1:N─ Integration                     PlanoComercial · PrecoDeModulo · TermoDeContrato · AddOnComercial
  └─1:N─ AuditLog (append-only)          Engagement ─1:N─ StaffAllocation ─N:1─ StaffPerson
Charter e Meridian (bootstrap)           IpAsset ─1:N─ IpAssetVersion · AvaliacaoDeMaturidade
                                         Lancamento · Titulo · AssinaturaDoTenant · CacPeriodo · SemanaDeCaixa
                                         StaffDiagram ─1:N─ StaffDiagramVersion · StaffProcess
```
*FIGURA 2 — ENTIDADES PRINCIPAIS.*

| ENTIDADE | ONDE | CAMPOS-CHAVE |
|---|---|---|
| `TenantModule` | `S/modules.prisma:30-47` | `tenantId`, `module`, `status`, `contractedAt`, `expiresAt`, `seats` |
| `PlatformApproval` | `S/governance.prisma:160-207` | `acao`, `alvoTipo`, `alvoId`, `motivo`, `impacto`, `payload`, `status`, `solicitanteId`, `decisorId`, `decididoEm`, `nota`, `targetTenantId` |
| `AuditLog` | `S/system.prisma:81` | `tenantId`, `actorId`, `action`, `entityType`, `entityId`, `diff`, `metadata.platformStaff` |
| `AccessLog` | `S/platform-ops.prisma:641` | `email`, `evento` (LOGIN, LOGOUT, RECUSADO), `motivo`, `ip`, `userAgent`. Registra acesso, não escrita |
| `Proposal` | `S/platform-ops.prisma:271-352` | `status` (RASCUNHO, AGUARDANDO_APROVACAO, ENVIADA, ACEITA, RECUSADA), escopo, `acvCentavos`, `tcvCentavos`, `tenantProvisionadoSlug`, `aprovacaoId` |
| `AssinaturaDoTenant` | `S/empresa.prisma:267-325` | `clienteSlug` (texto, sem FK), `planoSlug`, `valorMensalCentavos`, `encerradaEm` |

**Não existe campo `health`.** A saúde é derivada, e a ausência é a especificação: campo marcado à mão
envelhece no dia em que alguém esquece de atualizar, e um painel que afirma "saudável" sobre dado velho é
pior que um painel vazio. Também não existem status de tenant nem vínculo entre `AssinaturaDoTenant` e
`TenantModule`. Essas duas ausências são lacunas (PRD B-12, B-24), não decisão.

### Catálogo e fórmula de proposta

O preço mora em tabela do tenant `system` e muda sem deploy (`S/comercial.prisma:1-10`). As sementes vêm
do handoff (`packages/database/scripts/2026-08-comercial.sql:3-5`) e batem com a tabela comercial
(`docs/comercial/icp-e-precificacao.md:17-37`) e com o banco de produção, consulta de 2026-09-22.

| ITEM | VALOR | FONTE NO REPO |
|---|---|---|
| Starter | R$ 89 por assento, mínimo 10, teto de 25 usuários | `2026-08-comercial.sql:70` |
| Scale | R$ 149 por assento, mínimo 25, teto de 100 | `:71` |
| Enterprise | R$ 219 por assento, mínimo 50, sem teto, roles custom | `:72` |
| Diagnóstico | Sem plataforma: 0 assento, R$ 0. Inserido direto em produção, sem script | `.claude/completions/2026-09-16-plano-piso-zero.md:3-5` |
| Módulo, por mês | Cosmos R$ 0 (vai no assento); Charter R$ 1.800; Signal R$ 1.200; Meridian R$ 1.200 | `2026-08-comercial.sql:88-100`; `2026-08-preco-meridian.sql:41-45` |
| Scaffold | Sem preço de módulo: é vendido por projeto. Produção não tem a linha (consulta de 2026-09-22) | `S/modules.prisma:8-14` |
| Prazo | Mensal 0%, Anual 12%, Bienal 20% | `2026-08-comercial.sql:102-107` |
| Add-on | SSO dedicado R$ 900/mês (exige roles custom); BPMN hospedado R$ 700/mês; SLA 99,9% R$ 1.500/mês; onboarding assistido R$ 6.500 uma vez | `2026-08-comercial.sql:109-116` |

Módulo sem linha de preço não entra em proposta: o gerador valida contra `PrecoDeModulo`
(`app/actions/proposta-escopo.ts:96-105`). A fórmula é uma função pura, a mesma no preview, no ACV do
pipeline e no servidor (`lib/comercial/precificar.ts:50-122`):

```
assentos faturados = max(assentos, mínimo do plano)              a tela diz quando o mínimo foi aplicado
bruto mensal       = assentos × preço + módulos + add-ons recorrentes + serviços RETAINER
líquido mensal     = bruto × (1 − desconto do prazo) × (1 − desconto comercial)
                     prazo primeiro, comercial depois; arredonda a cada etapa
uma vez            = add-ons não recorrentes + serviços não RETAINER   (fora do desconto)
ACV = líquido × 12                 TCV = líquido × meses do prazo + uma vez
```

Avisos que informam sem travar: assentos acima do teto do plano, add-on que exige roles custom,
pré-requisito fora do escopo e dependência do LAB (`lib/comercial/validacoes.ts:16-21`, `:49-99`).
Desconto acima de 15% (`lib/comercial.ts:20`) leva à fila (§5). ACV, TCV e total congelam na proposta.

---

## 4. O guard

Toda page e toda server action começam por `requirePlatformStaff`. O layout protege navegação; não
protege RPC.

```
 requisição ── sem sessão ─────────────▶ UNAUTHORIZED ──▶ /sign-in
     │ sessão
     ▼
   teto ────── acima ──────────────────▶ RATE_LIMITED ──▶ "Tente de novo em Ns."
     │ dentro
     ▼
 membership ── não é do `system` ──────▶ FORBIDDEN ─────▶ "Esta conta não é da equipe da Nebuloz."
     │ é staff
     ▼
 2º fator ──── sem TOTP cadastrado ────▶ FORBIDDEN ─────▶ /seguranca
     │
     ▼  PlatformStaff { canWrite = papel é ADMIN }
```
*FIGURA 3 — ORDEM DAS PERGUNTAS. O TETO VEM ANTES DO BANCO.*

| ID | REQUISITO DE GUARD | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| BG-01 | Toda page e toda server action chama `requirePlatformStaff` | parcial | 107 de 108 funções exportadas. `registrarAcesso` roda sem sessão por desenho (`app/actions/access.ts:28-65`); nenhum teste varre todas as actions [inferido] |
| BG-02 | O teto vem antes da consulta de membership | implementado | `lib/guard.ts:157-168` |
| BG-03 | A chave do teto é a pessoa, nunca o IP | implementado | `lib/rate-limit.ts:13-16`; `lib/guard.ts:163` |
| BG-04 | Com 2FA ligado, só existe sessão depois do TOTP; a sessão aberta antes do cadastro é encerrada | implementado | `lib/guard.ts:54-90`; `app/seguranca/actions.ts:6-25` |
| BG-05 | `assertCanWrite` roda no servidor; o botão desabilitado diz o motivo | implementado | `lib/guard.ts:191-198`; `components/write-button.tsx:26-27` |
| BG-06 | Capability não deriva de papel ([LAB SRD](./lab-srd.md)) | ausente | sem consumidor; só ADMIN e MEMBER (`lib/guard.ts:13-19`) |
| BG-07 | O guard resolve uma vez por requisição | implementado | `cache()` em `lib/guard.ts:121`, `:151` |
| BG-08 | Falha do limitador degrada aberta, com log | implementado | `lib/rate-limit.ts:60-87` |
| BG-09 | Só `/seguranca` usa a variante sem 2FA | implementado | `lib/guard.ts:109-149`; `app/seguranca/actions.ts:25` |
| BG-10 | Cada recusa tem saída própria: login, cadastro de TOTP ou espera | implementado | `app/(staff)/layout.tsx:19-85`; `lib/staff-access.ts:29-52` |

> **INVARIANTE CRÍTICA**
> A ordem das perguntas é a especificação. Consultar o banco antes do teto faz cada tentativa de quem não é
> staff custar uma query, e é justamente quem não é staff que tenta em laço.

---

## 5. Fila de aprovação

O BB §6 manda cinco operações para a fila. Uma chegou: enviar proposta com desconto acima de 15%. O pedido
nasce com motivo e impacto; decidir exige outra pessoa; aprovar despacha a ação original. Aprovador sem
contexto aprova no escuro ou trava a fila, e nenhum dos dois é decisão.

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| BA-01 | `solicitanteId ≠ decisorId`, verificado no servidor | implementado | `app/actions/approvals.ts:186-198` |
| BA-02 | Vale também para rejeitar: retirar o próprio pedido é o mesmo furo | implementado | `:191-192` |
| BA-03 | Pedido decidido recusa nova decisão | implementado | `:200-212` |
| BA-04 | A decisão entra na trilha, não só o pedido | implementado | `:225-237` |
| BA-05 | Motivo (10+ caracteres) e impacto obrigatórios na criação | implementado | `:102-111` |
| BA-06 | Pedir e decidir exigem ADMIN; ler é de todo staff | implementado | `:64-69`, `:117-119`, `:161-162` |
| BA-07 | Aprovar executa a operação original; falha do efeito não apaga a decisão | parcial | só `proposal`: aprovada vira ENVIADA, rejeitada volta a RASCUNHO (`:256-304`); outros alvos passam em silêncio (`:272-274`) |
| BA-08 | As cinco operações do BB §6 passam pela fila | parcial | uma de cinco (`app/actions/proposals.ts:246-271`); deleção, MCP e mudança de plano não existem; o export da trilha existe sem fila (PRD B-39) |
| BA-09 | Decidir notifica o solicitante (BB FR-8) | ausente | o app não tem cliente de e-mail nem de notificação [inferido: busca em `apps/backoffice`] |

---

## 6. Interfaces

| INTERFACE | DIREÇÃO | O QUE PASSA | ESTADO |
|---|---|---|---|
| `@repo/provisioning` | Out | Tenant, módulo, bootstrap e trilha | implementado |
| `platformDb` (ADR-0013) | In | Leitura cross-tenant; só `packages/provisioning` e este app importam | implementado; `apps/app/__tests__/scaffold/adr-0013-boundary.test.ts` barra o import no app do cliente |
| Charter do cliente (`withTenantDb`) | Out | `CharterMembership` COMPLIANCE, `CharterSettings`, política com 9 seções em DRAFT | implementado — **gap** M-02, M-03 |
| Meridian do cliente | Out | `MeridianMembership` CONSULTANT e template v3.2 | implementado — **gap** M-02 |
| Scaffold | In | Metadado de gate; a travessia devolve uma porta, não conteúdo | implementado (ADR-0017) |
| Meridian → back-office (ADR-0014) | In e Out | Lê a promoção pendente; grava `targetEntityId` de volta na linha do Meridian | parcial — actions sem tela (PRD B-23); **gap** M-05, M-06 |
| Cadastro do app (Cosmos) | — | `provisionTenant` com Cosmos em TRIAL de 14 dias | implementado — grava selo de staff (PRD B-38) |
| Signal | Out | Só `TenantModule` SIGNAL | implementado; nada é preparado |
| Charter da Nebuloz (tenant `nebuloz`) | Out | `CharterVendor`: DPA, região, retenção, renovação e teto de classe | implementado — **gap** M-03 |
| Evento de auditoria → Charter (costura 6 do Mapa) | Out | Ator, momento, entidade, antes e depois, motivo | implementado — registro único e diff `[campo, antes, depois]` (`P/audit.ts:1-46`); o `AccessLog` fica fora de propósito |
| `@repo/auth` | In | Sessão e TOTP; revogar vale em cerca de 60 s | implementado (`docs/runbooks/acesso-ao-backoffice.md:54-58`) |
| `@repo/rate-limit` | Out | Contador do teto, no Postgres | implementado |
| Upstash Redis | Out | Cache de módulo por 5 min; sem URL, consulta direta | implementado (`packages/rbac/src/modules.ts:36-67`) |
| Proposta → provisionamento | — | Escopo sem redigitar | ausente (PRD B-32) |
| E-mail, PDF, assinatura, gateway | — | — | ausente; gateway fora por decisão (BB §5) |
| `api/health` | Out, público | Host, porta, usuário e tamanho da senha do banco; presença das envs de auth | implementado — rever o que fica público (`app/api/health/route.ts:32-82`) |

---

## 7. Requisitos não-funcionais

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| BN-01 | Toda leitura e escrita escopada por `tenantId`; listagem de cliente filtra `isSystem` | parcial | regra em `P/platform-db.ts:12-16`; `tenantPorSlug` não filtra `isSystem` em `app/actions/tenant-members.ts:45-54` e `app/actions/tenant-observability.ts:15-24` |
| BN-02 | Leitura cross-tenant só por `platformDb`, para ficar greppável | parcial | Trilha, Observabilidade, Saúde e o CSV leem vários clientes pelo `database` direto (`app/actions/audit.ts`, `access.ts:103-145`, `accounts.ts`; `app/(staff)/audit/exportar/route.ts:35`) |
| BN-03 | Credencial de integração nunca entra em `select` | implementado | `app/actions/tenant-observability.ts:67-78`; `app/actions/access.ts:111-120` |
| BN-04 | Trilha append-only: nenhuma action faz update ou delete no `AuditLog` | implementado | trigger `20260603000002_audit_log_immutable_trigger`; FK RESTRICT em `20260608000002_audit_log_restrict_tenant_delete` |
| BN-05 | Leitura de dado de cliente pelo staff registrada em `AccessLog` | parcial | só a travessia (`app/actions/scaffold-supervision.ts:226-235`) |
| BN-06 | `AccessLog` escrito pelo servidor, com teto | ausente | `registrarAcesso` é chamada pelo navegador, sem sessão nem teto (`app/actions/access.ts:28-65`; `app/sign-in/form.tsx:24-53`); aceita linha forjada [inferido] |
| BN-07 | Coletor de erro de produção | ausente | `next.config.ts:1-7` usa só `withLogging` |
| BN-08 | Suíte do painel no CI, com cobertura medida à parte | ausente | `package.json:10` não tem `test:coverage`; o CI roda só `turbo test:coverage` (`.github/workflows/ci.yml:262-263`) [inferido]. Os testes de `packages/provisioning` rodam |
| BN-09 | Agregação no banco para leitura que cresce com o número de clientes | parcial | saúde e trilha filtram no banco; os KPIs de Propostas somam as 100 mais recentes (`app/(staff)/propostas/page.tsx:47-60`; `lib/paginacao.ts:24`) |
| BN-10 | Pool de conexão com `max` e timeout explícitos | implementado | `packages/database/index.ts:63-67` |
| BN-11 | Headers de segurança herdados | implementado | `packages/next-config/index.ts:7-25` |
| BN-12 | Confirmação nomeada antes de operação sem volta | implementado | `components/confirmar-acao.tsx:5-30` |
| BN-13 | Erro sai só com código, nunca com dado de cliente | implementado | `lib/safe-action.ts:19-30` |
| BN-14 | Escrita idempotente onde a semântica permite | implementado | `contractModule` é upsert (`P/modules.ts:50-78`); os bootstraps pulam o que já existe (`P/charter.ts:114-130`; `P/meridian.ts:273-289`) |
| BN-15 | RLS efetiva | ausente | a conexão é superuser (ADR-0012); o que isola é o filtro por `tenantId` |
| BN-16 | Contraste WCAG AA medido na tela real; tela estreita e movimento reduzido | implementado | 108 textos, zero reprovações (`docs/design/2026-08-laudo-backoffice.md:13`); `app/backoffice-theme.css:162`, `:201`, `:275`, `:301` |

> **CUIDADO COM LEITURA CRUZADA**
> Trilha de auditoria, Observabilidade, Saúde e renovação, Fila de gates, a busca da paleta e a Home leem
> vários clientes de uma vez. É intencional, e por isso a regra da ADR-0013 existe: `platformDb` e filtro
> `isSystem`. Onde uma das duas falta (BN-01, BN-02), cruzar tenant volta a ser acidente.

---

## 8. Restrições e premissas

- O painel escala com número de clientes e volume de trilha, não com número de staff. Hoje são 7 tenants
  de cliente, todos internos ou de teste (banco de produção, consulta de 2026-09-22).
- As páginas são dinâmicas por decisão: dado velho em painel de operação é pior que espera.
- Leitura que reduz em memória o que veio de uma amostra é defeito de correção, não de performance: a tela
  afirma o oposto da verdade sem erro, sem log e sem métrica (BN-09).
- Remover cliente, revogar staff e promover ADMIN ficam no banco por decisão (`components/nav.ts:243-245`;
  BB §6). A concessão de staff não é auditada (`docs/runbooks/acesso-ao-backoffice.md:60-64`).
- Toda troca de status de módulo pela tela passa por `contractModule`, que grava `expiresAt` e `seats`
  nulos (`P/modules.ts:72-77`). Enquanto isso valer, renovação e trial não têm prazo confiável.
- As migrations rodam no build da Vercel (`packages/database/scripts/deploy-migrations.mts`), e `/versao`
  confere o resultado (`lib/versao.ts:1-17`).
- O LAB não está no painel. Volta com schema e capability de verdade.
- Operação de emergência continua sendo SQL.

---

## 9. Critérios de aceite

| # | CRITÉRIO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| 1 | Um cliente é provisionado, tem módulo contratado e o dono loga, sem console | implementado | `P/tenant.ts:53-116`; o E2E não roda no CI (PRD B-14) |
| 2 | Nenhum caminho escreve sem passar por `requirePlatformStaff` | parcial | 107 de 108 funções; `registrarAcesso` grava `AccessLog` sem guard (BG-01, BN-06) |
| 3 | Nenhuma aprovação fecha com solicitante igual ao decisor, verificado por teste | implementado | `__tests__/approvals.test.ts`; a suíte não roda no CI (BN-08) |
| 4 | Suspender módulo exige dois atos, com o alvo escrito | implementado | `components/confirmar-acao.tsx:5-30` |
| 5 | Staff sem 2FA não entra | implementado | BG-04 |
| 6 | A saúde de um cliente com mil clientes na base é a mesma que com dez | implementado | `lib/health.ts:43-54`; os KPIs de Propostas não seguem a regra (BN-09) |
| 7 | Um tenant não lê dado de outro por nenhum caminho de API | parcial | filtro por `tenantId`; RLS inerte (BN-15); `tenantPorSlug` alcança o `system` (BN-01) |
| 8 | Trocar status de módulo preserva prazo e assentos | ausente | `P/modules.ts:72-77` |
| 9 | Proposta aceita provisiona o cliente sem redigitar escopo | ausente | PRD B-32 |
| 10 | Os testes do painel rodam no CI | ausente | BN-08 |
| M1 | Tenant e contrato emitidos pelo Charter (Mapa) | ausente | gap M-01 |
| M2 | Papel concedido por comando do Charter (Mapa) | ausente | gap M-02 |
| M3 | O painel não escreve em entidade de outro dono: política, fornecedor do Charter, promoção do Meridian (Mapa) | ausente | gaps M-03, M-05 |

Critérios 1 a 7 vêm da v1.0; 8 a 10 são novos; M1 a M3 vêm do Mapa.

---

*Engineering draft. Documento companheiro: Back-office PRD v2.0.*
