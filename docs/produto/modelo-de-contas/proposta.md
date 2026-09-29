# Modelo de contas: proposta para decisão

**Status:** proposta, aguardando o CEO · **Autora:** Morgana · **Data:** 2026-09-27
**Base:** [`as-is.md`](as-is.md) (Alicerce, e8531a15) e [`negocio-e-referencias.md`](negocio-e-referencias.md) (Norte, 0f54a76a).

## O problema, em uma frase

A Nebuloz vende produtos para **contas** (clientes), mas o sistema só conhece **tenants** soltos. Não existe regra única para dizer em qual conta a pessoa está, o que a conta contratou, o que a Nebuloz já lançou e o que a pessoa pode fazer em cada produto.

**O que aconteceu no dogfood de 2026-09-27:** o CEO é ADMIN em 6 tenants. A sessão dele caiu no "Nebula" enquanto ele achava que estava no "Nebuloz". O Meridian só mostra a organização num tooltip (`components/meridian/shell.tsx:520`), e o seletor existe apenas no layout do Cosmos. Resultado: um diagnóstico criado no tenant errado e duas decisões de produção tomadas em cima de identificação errada.

## O modelo-alvo

| Camada | O que é | Onde mora hoje | Alvo |
|---|---|---|---|
| **Pessoa** | um e-mail, um login | `User` (Better Auth) | igual |
| **Conta** | o cliente que contrata | `Tenant`, sem tipo | `Tenant` com **tipo**: CLIENTE, INTERNA, TESTE, DEMO, SISTEMA. Substitui `isInternalTenant` e `isSystem` |
| **Contrato** | produtos comprados | `TenantModule` (ACTIVE) | igual, mas **nascendo da proposta aceita** no back-office. Hoje `proposals.ts` nunca chama `provisionTenant` |
| **Lançamento** | o que a Nebuloz liberou, por tipo de conta | lista solta da spec 008 | **feature flag por coorte** (tipo de conta). A INTERNA vê antes, a CLIENTE vê o lançado |
| **Acesso** | papel da pessoa na conta e em cada produto | `TenantMember.role` (enum SAFe) + 4 memberships por produto | papel de conta **dono, admin ou membro**; papel por produto nas memberships; papel SAFe só no Cosmos |

**Regra de acesso a um produto:** contratado **E** lançado para o tipo da conta **E** papel da pessoa no produto.

**A conta ativa fica sempre explícita:** um seletor único no topo comum dos 5 produtos, com nome, distintivo e selo do tipo de conta. Trocar de conta leva ao catálogo da conta nova, que é para onde a pessoa vai depois de escolher. Uma pessoa em várias contas (o terceirizado) escolhe qual é a ativa, e o sistema nunca escolhe por ela em silêncio.

**Casos especiais:**
- **Staff da Nebuloz** entra por acesso de suporte temporário e auditado, e não como membro da conta.
- **O respondente do Meridian** continua com token, sem conta.

## Fases propostas

A ordem é do mais barato e que mais reduz risco para o mais estrutural. Cada fase vira spec e depois PR, pela esteira normal.

| Fase | O que entrega | Schema? | Fecha |
|---|---|---|---|
| **0 — Conta visível** | Seletor e nome da conta ativa no topo dos 5 produtos. Confirmação ao trocar. Fallback determinístico em `requireTenantSession` (hoje `findFirst` sem `orderBy`, `packages/auth/server.ts`). | não | o incidente Nebula/Nebuloz |
| **1 — Tipo de conta e lançamento** | Enum de tipo de conta, que absorve `isInternalTenant` e `isSystem`. Lista de lançados por coorte, que absorve a spec 008. | sim (Alicerce) | 3 mecanismos soltos viram 1 |
| **2 — Conta na URL** | `/<conta>/<produto>`. Toda escrita recusa conta divergente da URL. A sessão só lembra a última conta. | não (rotas) | tenant errado na raiz, com várias abas |
| **3 — Papéis** | Papel de conta (dono, admin, membro) separado do SAFe. Convite com papéis por produto e para e-mail que já existe. Charter como dono de usuário e permissão, segundo o mapa de fronteiras. | sim | o terceirizado em várias contas |
| **4 — Contrato e suporte** | Proposta aceita provisiona a conta e os módulos. Acesso de suporte do staff, temporário e auditado. | sim | venda sem passo manual; staff sem membership |

A **Fase 0** pode começar já e é a que protege o laboratório. As fases 1 a 4 dependem das suas respostas abaixo.

## Decisões do CEO

**Registro (2026-09-27):** as decisões 1 e 4 foram respondidas pelo CEO no terminal da PO (Regua), via AskUserQuestion. O ADR correspondente é o `docs/adr/0018-tipo-de-conta-enum.md` (Accepted). A Fase 0 recebeu "vai" do CEO no mesmo dia (spec 009). As decisões 2, 3, 5 e 6 seguem abertas.

1. **Aprova o modelo e a ordem das fases?** → **DECIDIDO: "Aprovo como está".**
2. **A conta vai para a URL (Fase 2)?** Recomendação: sim. É o único jeito de eliminar a confusão entre abas e links compartilhados.
3. **O lançado bloqueia a URL direta para contas CLIENTE?** Recomendação: sim, com a INTERNA isenta.
   → **DECIDIDO EM PARTE (2026-09-27, CEO no terminal da PO, intent da spec 010):** para a conta INTERNA, o lançado bloqueia só o card do catálogo e a URL direta continua liberada. **Decidido pelo CEO aqui na sessão da Morgana, em 2026-09-27:** para CLIENTE, TESTE e DEMO, o produto não lançado **também bloqueia a URL direta**, e não só o card. Com isso a decisão 3 está fechada.
   Outras decisões do mesmo intent:
   - a lista de lançados é **manual**, e o gate de maturidade só sinaliza, sem bloquear automaticamente;
   - são **duas listas**: acesso antecipado (só INTERNA) e geral (CLIENTE, TESTE, DEMO);
   - `Tenant.type` é **mutável**, e o back-office troca o tipo depois de criado;
   - a migração de `isSystem` e `isInternalTenant` cobre **todos** os call sites em `apps/app` e `apps/backoffice`.
4. **Qual é a conta oficial da Nebuloz**, e que tipo recebem as outras 5? → **DECIDIDO: "Confirmo a sugestão".** A tabela abaixo vale como decidida:

   | Slug | Tipo |
   |---|---|
   | `nebuloz` | INTERNA (oficial) |
   | `nebula` | TESTE (laboratório atual) |
   | `dev-teste` | TESTE |
   | `nebuloz-novo-cliente` | TESTE ou apagar |
   | `medcore` | DEMO |
   | `__system__` | SISTEMA |

5. **O terceirizado conta como assento em cada conta?** Decisão comercial (Caixa/Ponte).
   → **DECIDIDO (CEO, sessão da Morgana, 2026-09-27):** o terceirizado conta como **usuário padrão** e ocupa assento em cada conta onde é membro. O fluxo de negócio fica assim:
   - o cliente contrata produtos da Nebuloz;
   - a conta (tenant) é registrada no back-office;
   - cada produto comprado é liberado para a conta;
   - o **admin do cliente**, com o próprio login, cadastra os demais usuários **até o limite de assentos da assinatura**.

   Isso amplia a Fase 3 (convite pelo admin da conta, com limite de assentos) e a Fase 4 (assinatura com assentos, vinda da proposta).
   **Em aberto:** os assentos são por conta ou por produto?
6. **O papel de conta sai do enum SAFe (Fase 3)?** Mexe em todas as telas que leem `TenantMember.role`.

## Invariantes que nenhuma fase pode quebrar

Estão em `as-is.md` §invariantes (ADR-0012 e ADR-0013):
- toda query filtra `tenantId` vindo da sessão, nunca do cliente;
- acesso entre contas só pela porta única;
- não confiar em RLS com conexão superuser;
- mutação passa por papel e auditoria.
