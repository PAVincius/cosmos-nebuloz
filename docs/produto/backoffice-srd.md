# Back-office — Software Requirements Document

> **PRODUCT** Back-office (BigBang) · **COMPANION** [Back-office PRD v1.0](./backoffice-prd.md)
> **STATUS** Engineering draft · **VERSION** 1.0 · **AUDIENCE** Engenharia, Segurança

Especificação do painel interno: guard único, trilha de auditoria, fila de
aprovação, saúde derivada e as fronteiras com o produto.

---

## 1. Escopo

Especifica o software do `apps/backoffice`: autenticação e autorização de staff,
provisionamento de tenant, ciclo de vida de módulo, fila de aprovação, trilha de
auditoria, health de carteira, e as interfaces com `@repo/provisioning`,
`@repo/auth` e o Cosmos.

**Fora de escopo:** funcionalidade entregue ao cliente (Cosmos), o registro de
modelo próprio (LAB — documento próprio, [LAB SRD v1.0](./lab-srd.md)), e
operação de emergência — o painel cobre o caminho normal, não substitui acesso
ao banco.

### Definições

| TERMO | SIGNIFICADO |
|---|---|
| Staff | Membro do tenant interno `system` |
| Tenant | Cliente da Nebuloz, com módulos contratados |
| Módulo | COSMOS, CHARTER ou SIGNAL, com status próprio por tenant |
| Provisionar | Criar tenant e semear o mínimo para ele funcionar |
| Aprovação | Pedido enfileirado para operação que não executa no clique |
| Saúde | Veredito **derivado** sobre um cliente — nunca campo gravado |
| Capability | Permissão concedida à parte do papel — nenhuma existe hoje; a primeira será `lab` |

---

## 2. Arquitetura

```
┌──────────────┐  ┌───────────────┐  ┌────────────────┐
│  Operação    │  │  Comercial /  │  │  Segurança     │
│  plataforma  │  │  Delivery     │  │  (só leitura)  │
└──────┬───────┘  └───────┬───────┘  └───────┬────────┘
       └──────────────────┼──────────────────┘
                          ▼
              ┌───────────────────────┐
              │  requirePlatformStaff │  sessão · 2FA · papel · teto
              └───────────┬───────────┘
     ┌──────────┬─────────┼─────────┬──────────┐
     ▼          ▼         ▼         ▼          ▼
┌─────────┐ ┌────────┐ ┌──────┐ ┌───────┐ ┌──────────┐
│ Tenants │ │Aprova- │ │Health│ │ Audit │ │Delivery e│
│ e módu- │ │ ções   │ │ deri-│ │ Explo-│ │ Comercial│
│  los    │ │        │ │ vada │ │  rer  │ │          │
└────┬────┘ └───┬────┘ └──┬───┘ └───┬───┘ └────┬─────┘
     └──────────┴─────────┼─────────┴──────────┘
                          ▼
            ┌─────────────────────────┐
            │  @repo/provisioning     │  porta única de escrita
            │  (audita toda operação) │
            └────────────┬────────────┘
                         ▼
            ┌─────────────────────────┐
            │  PostgreSQL · Prisma    │
            └────────────┬────────────┘
                         ▼
              ┌──────────┬──────────┐
              ▼          ▼          ▼
           Cosmos    Charter    Upstash
          (tenants) (bootstrap) (teto)
```
*FIGURA 1 — TOPOLOGIA. TODO CAMINHO PASSA PELO GUARD; TODA ESCRITA PASSA PELO PACOTE.*

| COMPONENTE | RESPONSABILIDADE |
|---|---|
| `lib/guard.ts` | Sessão, segundo fator, papel, capability, teto de requisição |
| `@repo/provisioning` | Criação de tenant, módulo, bootstrap — e a auditoria de cada um |
| `app/actions/*` | 15 módulos de server action, um por área do painel |
| `lib/health.ts` | Derivação de saúde a partir de sinais que a plataforma já grava |
| `lib/comercial.ts`, `lib/delivery.ts` | Derivações de carteira e de alocação |
| `lib/rate-limit.ts` | Teto por identidade, com escopos separados |

---

## 3. Modelo de dados

```
Tenant ──1:N── TenantModule
  │
  ├──1:N── TenantMember ──(role)── User
  ├──1:N── Integration
  └──1:N── AuditLog

PlatformApproval ──(solicitanteId ≠ decisorId)

Service ──1:N── ProposalItem ──N:1── Proposal ──N:1── Tenant
Engagement ──N:1── Tenant
StaffPerson ──1:N── StaffAllocation ──N:1── Engagement
IpAsset ──1:N── IpAssetVersion
AccessLog   (quem do staff olhou o quê)
```
*FIGURA 2 — ENTIDADES PRINCIPAIS.*

| ENTIDADE | CAMPOS-CHAVE |
|---|---|
| `TenantMember` | `id`, `tenantId`, `userId`, `role` |
| `PlatformApproval` | `id`, `acao`, `alvoTipo`, `alvoId`, `motivo`, `impacto`, `status`, `solicitanteId`, `decisorId`, `decididoEm` |
| `AuditLog` | `id`, `tenantId`, `actorUserId`, `action`, `entityType`, `entityId`, `target`, `diff`, `createdAt` |
| `AccessLog` | separado do `AuditLog` de propósito: registra **leitura**, não escrita |
| `TenantModule` | `tenantId`, `module`, `status`, `expiresAt` |

**Não existe campo `health` nem `status` de treino.** Os dois são derivados, e a
ausência é a especificação: campo marcado à mão envelhece no dia em que alguém
esquece de atualizar, e um painel afirmando "saudável" sobre dado velho é pior
que um painel vazio — dá confiança onde não há informação.

---

## 4. O guard

Todo caminho — página e server action — começa por `requirePlatformStaff`. O
layout protege navegação; não protege RPC.

```
        ┌──────────┐  sem sessão   ┌──────────────┐
        │ requisição│──────────────▶│ UNAUTHORIZED │──▶ /sign-in
        └────┬─────┘               └──────────────┘
             │ sessão
             ▼
        ┌──────────┐  acima do teto ┌─────────────┐
        │   teto   │───────────────▶│ RATE_LIMITED│──▶ "tente em Ns"
        └────┬─────┘                └─────────────┘
             │ dentro
             ▼
        ┌──────────┐  não é staff   ┌───────────┐
        │membership│───────────────▶│ FORBIDDEN │
        └────┬─────┘                └───────────┘
             │ é staff
             ▼
        ┌──────────┐  sem 2FA       ┌───────────┐
        │ 2º fator │───────────────▶│ FORBIDDEN │──▶ "habilite 2FA"
        └────┬─────┘                └───────────┘
             ▼  PlatformStaff { canWrite }
```
*FIGURA 3 — ORDEM DAS PERGUNTAS. O TETO VEM ANTES DO BANCO.*

| ID | REQUISITO DE GUARD |
|---|---|
| BG-01 | Toda server action chama `requirePlatformStaff`, sem exceção |
| BG-02 | O teto é avaliado **antes** da consulta de membership |
| BG-03 | A chave do teto é a identidade, nunca o IP |
| BG-04 | Segundo fator exige **cadastrado E verificado nesta sessão** |
| BG-05 | `assertCanWrite` roda no servidor; UI escondida não é controle |
| BG-06 | Capability não deriva de `role` — regra do [LAB SRD](./lab-srd.md), sem consumidor aqui hoje |
| BG-07 | O guard resolve uma vez por requisição (`cache` do React) |
| BG-08 | Sem Redis, o teto degrada **aberto** e grava aviso |

> **INVARIANTE CRÍTICA**
> A ordem das perguntas é a especificação. Consultar o banco antes do teto faz
> cada tentativa de quem não é staff custar uma query — e é justamente quem não
> é staff que tenta em laço.

---

## 5. Fila de aprovação

Cinco operações não executam no clique. O pedido grava motivo e impacto na
criação, não depois — aprovador sem contexto ou aprova no escuro ou trava a
fila, e nenhum dos dois é decisão.

| ID | REQUISITO |
|---|---|
| BA-01 | `solicitanteId ≠ decisorId`, verificado no servidor |
| BA-02 | Vale também para rejeitar — retirar o próprio pedido é o mesmo furo |
| BA-03 | Pedido já decidido recusa nova decisão |
| BA-04 | A **decisão** entra na trilha, não só o pedido |
| BA-05 | Motivo e impacto obrigatórios na criação |
| BA-06 | Aprovar deve executar a operação original *(P1 — hoje só muda status)* |

---

## 6. Interfaces

| INTERFACE | DIREÇÃO | PROPÓSITO |
|---|---|---|
| `@repo/provisioning` | Out | Porta única de escrita de plataforma, com auditoria embutida |
| Cosmos (tenant) | Out | Cria o tenant e os módulos que o cliente usa |
| Charter (bootstrap) | Out | Semeia conformidade no onboarding |
| `@repo/auth` | In | Sessão, papel, segundo fator |
| Upstash Redis | Out | Teto por identidade — degrada aberto |
| Signal | Out | Futuro: métrica de carteira que exige pipeline |

---

## 7. Requisitos não-funcionais

| ID | REQUISITO |
|---|---|
| BN-01 | Toda leitura e escrita escopada por `tenantId` no `where` |
| BN-02 | Credencial de integração (`config`, `mapping`) nunca entra em `select` |
| BN-03 | Trilha append-only; nenhuma action chama `update`/`delete` no `AuditLog` |
| BN-04 | Leitura de dado de cliente pelo staff registrada em `AccessLog` |
| BN-05 | Coletor de erro de produção *(P1 — hoje ausente)* |
| BN-06 | Cobertura medida separadamente do resto do monorepo *(P1 — hoje não)* |
| BN-07 | Agregação no banco para leitura que cresce com nº de clientes |
| BN-08 | Pool de conexão com `max` e timeout explícitos |
| BN-09 | Headers de segurança herdados de `@repo/next-config` |
| BN-10 | Confirmação nomeada antes de operação irreversível |

> **CUIDADO COM LEITURA CRUZADA**
> O Audit Explorer é a única tela que lê vários clientes de uma vez, e isso é
> intencional e documentado no código. Benchmark e health também cruzam tenants
> — devem receber a mesma nota explícita, para que cruzar deixe de ser acidente.

---

## 8. Restrições e premissas

- O painel tem dezenas de usuários e centenas a milhares de clientes. **Escala
  com número de clientes e volume de auditoria, não com número de staff** — e a
  otimização segue esse eixo.
- 14 das 18 rotas são `force-dynamic` por decisão: dado velho em painel de
  operação é pior que espera. Cache entra por tela, se entrar.
- Toda leitura que reduz em memória o que veio de uma amostra é defeito de
  correção, não de performance: a tela passa a afirmar o oposto da verdade sem
  erro, sem log e sem métrica.
- O LAB não está no painel. Uma seção inteira em que nenhuma das seis rotas abre
  não é limite anotado, é promessa — e ocupava um quarto do menu. Volta quando
  tiver schema, atrás de capability de verdade.
- Operação de emergência continua sendo SQL. O painel não promete cobrir tudo.

---

## 9. Critérios de aceite

- Um tenant é criado, tem módulo contratado e o cliente loga — sem console.
- Nenhum caminho de código escreve sem passar por `requirePlatformStaff`,
  verificado por teste.
- Nenhum caminho fecha uma aprovação com solicitante igual ao decisor,
  verificado por teste.
- Suspender módulo de cliente exige dois atos distintos, e o alvo aparece escrito.
- Um staff sem 2FA não entra no painel.
- A saúde de um cliente com base de mil clientes é a mesma que com base de dez —
  a leitura não depende de amostra.
- Um tenant não lê dado de outro por nenhum caminho de API.

---

*Engineering draft. Documento companheiro: Back-office PRD v1.0.*
