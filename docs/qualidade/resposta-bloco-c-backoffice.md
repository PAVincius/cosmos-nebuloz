# Bloco C respondido — back office (`apps/backoffice`)

Auditado contra **`origin/main`**, não contra branch de trabalho. É o que roda.

**Aviso de escopo:** o LAB (`/lab/*`, capability `lab`, `assertLabAccess`) está em
`feat/bigbang-onda-1-fundacao`, **não mergeado**. Onde a resposta muda com o
merge, está anotado. Responder pela branch inflaria a nota com código que
ninguém usa.

Legenda: **X** não · **Y** parcial · **Z** sim

---

## C.1 Acesso e superfície

| # | Resp | Evidência |
|---|---|---|
| C1.1 | **Z** | `app/(staff)/layout.tsx` → `resolveStaffAccess` → `requirePlatformStaff`: sessão + membership no tenant `system`. |
| C1.2 | **Z** | 15 de 15 arquivos em `app/actions/` chamam `requirePlatformStaff`. Não há action sem guard. |
| C1.3 | **X** | `requireMfaForPrivilegedRoles` existe em `packages/auth/server.ts`, marcada SOC2 CC6.2 — e **o painel não a chama**. O `sign-in/form.tsx` só responde ao desafio se o better-auth emitir. Staff sem 2FA habilitado entra normalmente. |
| C1.4 | **X** | Zero teste de login, expiração ou logout em `apps/backoffice/__tests__`. |
| C1.5 | **Y** | `assertCanWrite` roda no servidor; 9 dos 21 arquivos de teste exercem a negativa. Não é toda action de escrita. |
| C1.6 | **X** hoje · Z com o LAB | Não existe capability separada na main. |
| C1.7 | **X** hoje · Z com o LAB | O teste que impede derivar a capability de "é admin" está na branch. |
| C1.8 | **Z** | `assertDentroDoLimite("staff", session.user.id)` dentro do guard — chave é a identidade, não o IP. |
| C1.9 | **Z** | Degrada aberto por decisão escrita, com `log.warn` nos dois casos (sem Redis, Redis fora do ar) e teste fixando cada um. |

## C.2 Operações de alto impacto

| # | Resp | Evidência |
|---|---|---|
| C2.1 | **X** | Zero ocorrência de `confirm(`, `AlertDialog` ou "Tem certeza" em todo o `apps/backoffice`. Provisionar tenant e suspender módulo são um clique. |
| C2.2 | **Z** | Provisionamento audita via pacote: `packages/provisioning/src/tenant.ts:100`, `modules.ts:84` e `:140`, `charter.ts:120` e `:147`. Mais 8 actions chamando `logPlatformAudit` direto. |
| C2.3 | **Y** | Nenhuma action chama `auditLog.update` ou `delete`, mas nada impede — há `TODO(NEB-115)` em `packages/database/index.ts:69` para bloquear na camada do Prisma. É convenção, não garantia. |
| C2.4 | **Y** | 9 de 21 arquivos de teste cobrem a negativa de autorização. |
| C2.5 | **Y** | Alguns testes afirmam que o log foi gravado (`services`, `proposals`, `tenant-members`); não é padrão da suíte. |
| C2.6 | **Y** | `PlatformApproval` grava `solicitanteId`, mas **a decisão não compara solicitante com aprovador**. Quem pede pode aprovar o próprio pedido. |
| C2.7 | **Z** | Cota própria de 10/hora para provisionamento, separada do teto de navegação. |
| C2.8 | **X** | Não há reversão de provisionamento pela aplicação. |

**Achado extra, fora do checklist:** `app/actions/approvals.ts` **não grava
auditoria da decisão**. O pedido fica registrado; quem aprovou e quando, não.
É a única operação do painel cujo propósito é ser rastreável e que não deixa
rastro.

## C.3 Isolamento de dados de cliente

| # | Resp | Evidência |
|---|---|---|
| C3.1 | **Y** | O audit explorer documenta o escopo cruzado ("única tela que lê dado de vários clientes"). Benchmark e health cruzam tenants sem a mesma nota. |
| C3.2 | **Z** | `__tests__/tenant-observability.test.ts` afirma que o payload serializado não contém `config`, `token` nem `apiKey`. |
| C3.3 | **Y** | Não há recorte por necessidade — quem entra no painel vê o detalhe inteiro do cliente. |
| C3.4 | **Z** | `AccessLog` é modelo próprio, gravado em `app/actions/access.ts:46`, separado do `AuditLog` de propósito. |

## C.4 Testes

| # | Resp | Evidência |
|---|---|---|
| C4.1 | **Y** | 20 arquivos de teste de action cobrem efeito e validação; autorização em 9. |
| C4.2 | **X** | Um único teste de componente (`write-button.test.tsx`) para ~20 telas. Tabela de tenants, detalhe do cliente e aprovações não têm nenhum. |
| C4.3 | **X** | Sem teste de componente, não há cobertura de carregamento, vazio ou erro. |
| C4.4 | **X** | Nenhum teste de escrita concorrente. |
| C4.5 | **X** | `apps/backoffice/e2e/` contém só `fixtures/staff.ts` — zero spec. O caminho entrar → criar → contratar → provisionar não é exercido de ponta a ponta. |
| C4.6 | **X** | Sem E2E, os papéis não são exercidos com usuários distintos. |
| C4.7 | **Z** | `Pendente` marca a tela com título e motivo; não passa por funcional. |

## C.5 Cobertura e monitoração

| # | Resp | Evidência |
|---|---|---|
| C5.1 | **X** | O CI sobe coverage de `apps/app`, `apps/api` e `packages/safe-engine`. `backoffice` não aparece no `ci.yml`. Os testes rodam (via `turbo test`), a cobertura não é medida. |
| C5.2 | **X** | Sem medição, não há comparação entre releases. |
| C5.3 | **X** | Nenhum `instrumentation.ts` nem `withSentry` em `apps/backoffice`. `apps/app` tem. Exceção de produção no painel não chega a lugar nenhum. |
| C5.4 | **X** | Falha de permissão devolve mensagem e morre ali. |
| C5.5 | **X** | Sem coletor de erro, não há de onde mapear. |

## C.6 Go / no-go

Estas são de processo — não dá para responder pelo código, e chutar seria pior
que deixar em branco. O que o repositório mostra:

| # | O que o código diz | Falta você responder |
|---|---|---|
| C6.1 | — | Existe aprovação explícita para mudança em billing e governança? |
| C6.2 | — | Alguém de negócio/ops participa? |
| C6.3 | Sem `CODEOWNERS`; template de PR tem checklist genérico | Existe critério escrito, ou vale o merge? |
| C6.4 | — | Há janela e plano de rollback? |
| C6.5 | Sem flag no `apps/backoffice` | Feature nova vai direto para todos? |

---

## Contagem

| Seção | X | Y | Z |
|---|---|---|---|
| C.1 Acesso | 4 | 1 | 4 |
| C.2 Alto impacto | 2 | 4 | 2 |
| C.3 Isolamento | 0 | 2 | 2 |
| C.4 Testes | 5 | 1 | 1 |
| C.5 Cobertura e monitoração | 5 | 0 | 0 |
| **Total (sem C.6)** | **16** | **8** | **9** |

## Leitura

Duas seções inteiras em X, e elas se explicam uma pela outra.

**C.5 zerado é o achado que muda os outros.** Sem Sentry, o painel não tem como
contar o que dá errado nele. Isso não é só um item vermelho: é o motivo de C5.5
ser impossível de responder e de qualquer lacuna de teste só aparecer quando
alguém reclamar. Ligar o coletor de erros é o item que destrava a seção.

**C.4 em X não é falta de teste, é tipo errado de teste.** Há 21 arquivos e
2 mil linhas cobrindo action — o que falta é tudo que é tela. Um `assertCanWrite`
testado não impede um botão de provisionar disparando sem confirmação, que é
exatamente o C2.1.

**Os três de maior alcance, na ordem em que eu atacaria:**

1. **C2.6 — quem pede pode aprovar o próprio pedido.** A fila de aprovação
   existe para separar as duas pessoas, e hoje não separa. O controle parece
   estar lá.
2. **C1.3 — 2FA existe e o painel não exige.** A função está escrita, marcada
   SOC2, e o app que mais precisa dela não a chama. Uma linha no guard.
3. **C2.1 — nenhuma confirmação em operação destrutiva.** Provisionar tenant e
   suspender módulo de cliente são um clique sem volta.

Os três têm em comum não serem "falta implementar": são controles que existem e
não estão ligados no lugar certo. É a categoria que mais engana em auditoria,
porque a busca por palavra encontra o controle e dá o item por atendido.
