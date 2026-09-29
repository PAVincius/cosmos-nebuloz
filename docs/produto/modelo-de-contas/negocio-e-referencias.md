# Modelo de contas: negócio e referências

**Autor:** Norte (CPO) · **Data:** 2026-09-27 · **Pedido:** Morgana, a partir do modelo-alvo do CEO de 27/set, com o adendo do CEO sobre o seletor de organização em todos os produtos · **Status:** pesquisa. Recomenda, não decide.

Escopo desta parte: negócio e referência. Não altera código nem produção. Cada afirmação sobre o repositório cita arquivo e linha. O que não verifiquei vem marcado como **hipótese**.

---

## 0. Resumo e recomendação

O modelo-alvo do CEO é **Pessoa → Conta → Contrato → Produto → Papel no produto**. O código já tem quase todas essas peças, mas com outros nomes e sem uma regra que as ligue:

| Modelo-alvo (CEO) | Hoje no código | Situação |
|---|---|---|
| Pessoa (um e-mail) | `User`, com `email @unique` (`schema/tenant.prisma:301-303`) | ok |
| Conta (cliente da Nebuloz) | `Tenant` (`schema/tenant.prisma:25`) | ok, mas contas internas, de teste e técnicas ficam misturadas com contas de cliente (§4.1) |
| Membro da conta | `TenantMember.role`, que usa o enum SAFe `MemberRole` (ADMIN, STE, RTE, SM, PO, DEV, MEMBER) (`tenant.prisma:8-16`, `:418-431`) | **misturado**: o papel na conta e o papel no Cosmos são o mesmo campo |
| Contrato | `Proposal` (escopo congelado, `platform-ops.prisma:276-357`) → `AssinaturaDoTenant` (o que se cobra hoje, `empresa.prisma:270-325`) | **sem elo**: a proposta aceita não vira assinatura nem provisionamento (B-32 ausente, `backoffice-prd.md:159`) |
| Produto contratado (entitlement) | `TenantModule` (status ACTIVE, TRIAL, SUSPENDED, CANCELED; `seats`; `expiresAt`) (`schema/modules.prisma:30-47`) | ok. O schema já diz que "não é feature flag" (`modules.prisma:1-6`) |
| Papel por produto | `MeridianMembership`, `CharterMembership`, `ScaffoldMembership`, `SignalMember`. O Cosmos usa o próprio `TenantMember.role` e `ARTMembership` | ok nos quatro. O Cosmos não tem tabela própria |
| Produto lançado (feature flag) | Lista de lançados da spec 008 (hoje só `MERIDIAN`) + `isInternalTenant` | está em código e numa coluna do tenant, não num sistema de flags. `FeatureFlag`/`FeatureFlagOverride` existem (`schema/platform.prisma`) e têm resolvedor (`apps/app/lib/feature-flags/resolve.ts`), mas não entram nessa decisão |
| Seletor de conta | `Session.activeTenantId` + `WorkspaceSwitcher` só na sidebar do grupo `(authenticated)` (`components/sidebar.tsx:27,80`) | **gap P1**: não aparece no Meridian, e o fallback escolhe uma conta sem ordem definida (§3) |

**Recomendação em cinco linhas:**
1. Uma pessoa entra em um produto só quando três condições são verdadeiras: **a conta contratou o produto** (`TenantModule` ACTIVE ou TRIAL) **E a Nebuloz o lançou para o público daquela conta** (flag) **E a pessoa tem papel naquele produto** (membership). São três donos diferentes: o comercial, o produto e o admin do cliente.
2. A organização ativa vai para a **URL** (`app.nebuloz.ai/<conta>/meridian/...`), como fazem Linear, Vercel e Atlassian. A sessão guarda só "a última usada". Toda escrita confere a conta da URL contra a membership. Isso fecha a classe de erro do dogfood (diagnóstico criado no tenant errado).
3. **Um seletor só**, no cabeçalho comum do portal, igual nos cinco produtos, sempre mostrando o nome da conta e um distintivo visual. Trocar de conta leva ao catálogo da conta nova, não à mesma URL.
4. O papel na conta (dono, admin, membro) sai do enum SAFe. O papel SAFe vira o papel do Cosmos, como os outros produtos já fazem.
5. Casos especiais ficam **fora** da membership comum: o staff entra por acesso de suporte temporário e auditado; o respondente do Meridian continua como convidado por token, sem conta; e o tenant interno da Nebuloz é uma conta normal que pertence a uma coorte "interna" para fins de flag.

---

## 1. O que é "cliente" para a Nebuloz hoje

### 1.1 No back-office (o que se vende)

| Entidade | O que diz sobre o cliente | Onde |
|---|---|---|
| `Lead` | prospect no funil | `platform-ops.prisma:98` |
| `Proposal` | escopo vendido e congelado: `planoSlug`, `assentos`, `modulos ProductModule[]`, `addOnSlugs`, `termoSlug`, ACV e TCV. Aponta para o cliente por `clienteTenantId` (opcional, porque a proposta nasce antes do tenant) ou por `clienteNome`, e para o tenant que nasceu dela por `tenantProvisionadoSlug` | `platform-ops.prisma:276-357` |
| `PlanoComercial` | degrau vendável: preço por assento, mínimo, teto de usuários, `permiteRolesCustom`. É **por conta**, não por produto | `comercial.prisma:14-43` |
| `PrecoDeModulo` | adicional mensal por produto (o Scaffold fica fora, porque é vendido por projeto) | `comercial.prisma:49-61`; `modules.prisma:8-14` |
| `AssinaturaDoTenant` | o que o cliente paga **agora**: `clienteSlug` (slug, não FK), `planoSlug`, valor, franquia de créditos de IA. **Não lista produtos** | `empresa.prisma:270-325` |
| `Engagement` | serviço de consultoria prestado ao cliente (`clienteTenantId`, com Restrict) | `platform-ops.prisma:385-430` |

### 1.2 No portal (o que se usa)

- **A conta é o `Tenant`.** Ele nasce em `provisionTenant`, com dono ADMIN ou com um convite de 14 dias, e com os módulos contratados (`packages/provisioning/src/tenant.ts:53-116`). Os chamadores são o back-office e o autocadastro do app (`mapa-de-fronteiras.md:61`).
- **O entitlement é o `TenantModule`.** A regra fica em `packages/rbac/src/modules.ts`: default deny, e só ACTIVE e TRIAL dão acesso.
- **O papel é o membership de cada produto.** No Meridian, a ausência de membership nega o acesso "mesmo sendo ADMIN do tenant" (`packages/rbac/src/meridian-resolve.ts:9-11`).

### 1.3 Onde o elo se quebra

1. **A proposta aceita não chega ao portal.** Nenhuma action grava `ACEITA` e `tenantProvisionadoSlug` só é lido (`backoffice-prd.md:159`, B-32). Os módulos que o comercial escolhe (`Proposal.modulos`) e os que a operação ativa (`TenantModule`) são digitados duas vezes.
2. **A assinatura não sabe quais produtos a conta tem.** `AssinaturaDoTenant` guarda plano e valor, e `TenantModule` guarda os produtos. Nada garante que batam. Um cancelamento pode encerrar a assinatura (`encerradaEm`) e deixar os módulos ACTIVE.
3. **Há três fontes para "assentos":** `Proposal.assentos`, `TenantModule.seats` e `PlanoComercial.limiteUsuarios`. Nenhuma é lida na hora de conceder acesso. **Hipótese:** hoje nenhum limite de assento é aplicado no portal. Não achei esse enforcement, mas também não fiz uma busca exaustiva.
4. **Há dois nomes de plano.** `Tenant.plan` usa o enum `SubscriptionPlan` (ORBIT, GALAXY, **NEBULA**, UNIVERSE; `tenant.prisma:1-6`), e o comercial usa `PlanoComercial.slug`. Um plano chamado "NEBULA" soma mais um "Nebula" à confusão Nebula/Nebuloz registrada no dogfood (`atrito.md:156`). **Hipótese:** o enum é legado. Vale confirmar antes de exibi-lo em qualquer tela.

### 1.4 Mapeamento proposto

```
Proposta (ACEITA) ──gera──▶ Contrato ──materializa──▶ Conta (Tenant)
   planoSlug, modulos[],        (AssinaturaDoTenant        ├─ Produtos contratados (TenantModule: status, seats, expiresAt)
   assentos, termo               + linhas por produto)     ├─ Membros (TenantMember: papel NA CONTA: OWNER | ADMIN | MEMBER)
                                                           └─ Papéis por produto (MeridianMembership, CharterMembership,
                                                              ScaffoldMembership, SignalMember, CosmosMembership*)
Pessoa (User, 1 e-mail) ── membro de N contas ──▶ seletor
```
\* O `CosmosMembership` não existe. Hoje o papel SAFe mora em `TenantMember.role`. A recomendação é separá-los (§0, item 4).

Regra de negócio sugerida: **o contrato é a fonte e o `TenantModule` é a projeção.** Aceitar, renovar, fazer upgrade ou cancelar mexe no contrato, e o contrato escreve em `TenantModule` pela porta `@repo/provisioning`, que já é a única escrita de plataforma (ADR-0013, `backoffice-prd.md:225`). Isso não depende de quem emite o tenant. O mapa de fronteiras quer passar essa emissão para o Charter (`mapa-de-fronteiras.md:61`), e o modelo continua válido nos dois casos.

---

## 2. Como SaaS multi-produto de referência modelam isso

| Referência | Organização / conta | O que o cliente comprou (entitlement) | Membro com papel por produto | Várias organizações + seletor |
|---|---|---|---|---|
| **Atlassian Cloud** | Organização com um ou mais sites | cada app (Jira, Confluence…) é assinado por site | o acesso ao app é dado por **papel de app**, direto ou por grupo. O acesso ao app e a permissão dentro dele são geridos separadamente. Há admin de organização, admin de site, *user access admin* e *app admin* ([Give users access to apps](https://support.atlassian.com/user-management/docs/give-users-access-to-products/); [How does app access work?](https://support.atlassian.com/user-management/docs/how-does-product-access-work/); [Manage role and app permissions](https://support.atlassian.com/user-management/docs/manage-role-and-product-permissions/)) | uma conta Atlassian (um e-mail) entra em vários sites. O site fica no subdomínio da URL |
| **Microsoft 365 / Entra** | Tenant (diretório) | licença por usuário e por produto | papéis de diretório separados dos papéis de cada app | o usuário convidado (B2B) mantém a identidade de casa e troca de diretório em *Directories + subscriptions* ([What is B2B collaboration](https://learn.microsoft.com/en-us/entra/external-id/what-is-b2b); [Multitenant user management](https://learn.microsoft.com/en-us/entra/architecture/multi-tenant-user-management-introduction)) |
| **Linear** | Workspace | plano por workspace | papel no workspace e, por baixo, por time | um e-mail pertence a vários workspaces. O seletor fica no nome do workspace, no canto superior esquerdo (atalho O W), e o workspace fica na URL (`linear.app/<workspace>/…`) ([Workspaces](https://linear.app/docs/workspaces); [Login methods](https://linear.app/docs/login-methods)) |
| **Vercel** | Team (escopo) | plano por team | papel no team + papel por projeto para o *contributor* ([RBAC](https://vercel.com/docs/accounts/team-members-and-roles); [Managing team members](https://vercel.com/docs/rbac/managing-team-members)) | *scope selector* no topo, `vercel switch` na CLI e o team na URL ([vercel switch](https://vercel.com/docs/cli/switch)) |
| **Stripe** | Conta. *Organizations* agrupam contas da mesma empresa | produtos → *features* → **Entitlements** por cliente ([Entitlements](https://docs.stripe.com/billing/entitlements)) | papel por conta, com papéis de organização acima ([Organizations](https://docs.stripe.com/get-started/account/orgs)) | um e-mail acessa várias contas. O seletor fica no nome da conta, no canto superior esquerdo ([Multiple accounts](https://docs.stripe.com/get-started/account/multiple-accounts)) |

**Padrões que se repetem nas cinco:**
1. **A identidade é global e a membership é local.** Um e-mail, N organizações, e um papel por organização. A Nebuloz já é assim (`User.email @unique` + `TenantMember @@unique([tenantId, userId])`).
2. **O acesso ao produto é separado da permissão dentro dele.** A Atlassian diz isso de forma explícita. Na Nebuloz, o equivalente é `TenantModule` + membership por produto. Está certo; falta só separar o papel de conta.
3. **A organização ativa é visível e fica no canto superior esquerdo.** Linear, Vercel, Atlassian e Stripe fazem assim. Em Linear, Vercel e Atlassian, ela também está **na URL**. Dá para favoritar, e duas abas podem estar em organizações diferentes sem se contaminarem.
4. **Existe um papel de admin "de acesso",** separado do admin do produto (o *user access admin* da Atlassian). Para a Nebuloz, isso sugere que o dono da conta do cliente decide quem entra em qual produto, sem precisar ser admin de nenhum deles.

### 2.1 Entitlement ≠ feature flag

| | Entitlement | Feature flag |
|---|---|---|
| Pergunta | "O cliente **pagou** por isso?" | "É **seguro/lançado** ligar isso para este público?" |
| Dono | comercial / back-office (contrato) | produto / engenharia |
| Vida útil | enquanto durar o contrato | temporária: some quando o lançamento termina |
| Muda quando | venda, renovação, upgrade, cancelamento, inadimplência | gate de maturidade, rollout, incidente |
| Na Nebuloz | `TenantModule` (`modules.prisma:1-6`: "Isto não é feature flag") | lista de lançados (spec 008), `FeatureFlag`/`FeatureFlagOverride` (`platform.prisma`) |

Fontes: LaunchDarkly separa as duas coisas. Flags de release são temporárias, e entitlements são regras de acesso permanentes por tipo de cliente ([Using entitlements to manage customer experience](https://launchdarkly.com/docs/guides/flags/entitlements/); [Managing entitlements in LaunchDarkly](https://launchdarkly.com/blog/managing-entitlements-in-launchdarkly/)). A Stripe trata o entitlement como consequência do produto comprado, avisando quando provisionar e quando desprovisionar ([Stripe Entitlements](https://docs.stripe.com/billing/entitlements)). Glossário com a mesma distinção: [Flexprice: Feature flag vs entitlement](https://flexprice.io/glossary/feature-flag-vs-entitlement).

**Como aplicar na Nebuloz:**
- A **lista de lançados** da spec 008 é uma **flag de release por produto**, com público definido. Hoje ela está como constante em código (`apps/app/app/actions/produtos/index.ts:105`). Tudo bem para uma v1, desde que siga a regra "cresce quando o produto passa no gate" (`prontidao-lancamento.md`, spec 007).
- **`isInternalTenant` não é entitlement nem permissão.** É uma **coorte**, um público de flag ("contas internas veem não-lançados como 'Em breve'"). Como coluna, resolve o caso de hoje. Se aparecer um segundo público (cliente piloto de Scaffold, por exemplo), vira `FeatureFlagOverride` por tenant, que já existe e tem resolvedor (`apps/app/lib/feature-flags/resolve.ts:16-33`), em vez de uma segunda coluna booleana. Não verifiquei quem chama esse resolvedor hoje.
- **Nunca usar flag para negar o que foi pago, nem entitlement para esconder o que não foi lançado.** Produto contratado e não lançado aparece "Em breve" e é um problema de promessa comercial. Não pode ser vendido antes do lançamento. É o que a decisão de lançamento escalonado já diz (`prontidao-lancamento.md`, commit `994dd36b`).
- A pergunta aberta da spec 008 (a lista de lançados bloqueia a URL direta?) tem resposta natural neste modelo: **sim para contas externas, não para a coorte interna.** Uma flag vale para a rota inteira, não só para o card. Senão o card vira decoração. Quem decide é o CEO.

---

## 3. Seletor de organização em todos os produtos (adendo do CEO)

**Requisito do CEO (27/set):** seleção de organização em Meridian, Scaffold, Charter, Cosmos e Signal. Uma pessoa (um e-mail) em várias contas, por exemplo um terceirizado que atende vários clientes, escolhe com qual está trabalhando e **sempre sabe qual é a ativa**. Caso real: o CEO é ADMIN em 6 tenants, criou um diagnóstico "no tenant errado" e tomou duas decisões de produção em cima de uma identificação errada (`diario.md`, correção de 2026-09-27; `atrito.md:156`).

### 3.1 Estado atual (código)

| Ponto | O que acontece | Onde | Risco |
|---|---|---|---|
| Onde a conta ativa mora | `Session.activeTenantId`, um valor por sessão e não por aba | `tenant.prisma:371-388` | duas abas nunca podem estar em contas diferentes. Uma aba antiga mostra a conta A e escreve na conta B |
| Fallback quando a sessão não tem conta | `tenantMember.findFirst` **sem `orderBy`**, e o resultado é gravado na sessão | `packages/auth/server.ts:209-220` | a conta "padrão" é arbitrária (ordem física do Postgres). **Hipótese:** foi assim que a sessão do CEO abriu em `nebuloz` sem ele escolher |
| O layout usa outro fallback | `memberships[0]` de um `findMany`, também sem ordem | `(authenticated)/layout.tsx:31,66` | o layout e o guard podem escolher contas diferentes na mesma requisição |
| Onde o seletor aparece | `WorkspaceSwitcher` na `GlobalSidebar` do grupo `(authenticated)` | `components/sidebar.tsx:27,80` | o Meridian tem layout próprio (`app/(meridian)/layout.tsx`), sem seletor e sem o nome da conta (`atrito.md:156`) |
| Troca pela sidebar | `POST /api/auth/switch-tenant`: confere a membership, grava na sessão, **apaga o cookie de cache** e faz `router.refresh()` | `api/auth/switch-tenant/route.ts:42-53`; `workspace-switcher.tsx:70-76` | ok para a aba atual. As outras abas não ficam sabendo |
| Troca pela server action | `switchOrg`: grava na sessão e invalida o cache de permissão, **mas não apaga o cookie de cache** | `actions/auth/switch-org.ts:39-46` | por até 60 s (`cookieCache.maxAge`, `packages/auth/server.ts:84-89`), o servidor ainda pode ler a conta antiga. Dois caminhos para a mesma troca, com efeitos diferentes |
| Caches por tenant no servidor | chaves `modules:<tenant>`, `meridian-role:<tenant>:<user>`, papel SAFe por `<tenant>:<user>` | `rbac/src/modules.ts:18-20`; `meridian-resolve.ts:15-17`; `lib/rbac/resolve.ts:7` | **seguros**: a chave inclui o tenant, então trocar de conta não lê papel da conta errada |
| Aceite de convite | cria a `TenantMember` e **troca a conta ativa de todas as sessões** da pessoa (`session.updateMany`) | `invite/[token]/complete/page.tsx:53` | aceitar um convite no celular muda a conta que está aberta no notebook, sem aviso |

### 3.2 Recomendação

**a) Onde o seletor mora.** Num **cabeçalho comum do portal**, o mesmo componente e a mesma posição (canto superior esquerdo) nos cinco produtos e no catálogo. Não vale um seletor por produto: cinco seletores divergem na primeira mudança, como já aconteceu, com um produto que tem seletor e outros que não têm. Quem implementa é o Maestro. O produto pede **um componente de shell compartilhado** que os cinco layouts consomem.

**b) Como a conta ativa fica visível.** Sempre, em toda tela: **nome da conta + distintivo** (iniciais com cor derivada do slug) + um **selo de tipo** quando a conta não é de cliente ("Interna", "Teste"; ver §4.1). No Meridian, o formulário "Novo assessment" e as confirmações de escrita repetem o nome da conta ("Criar assessment em **Nebuloz**"). É barato e teria evitado o AS-114.

**c) A conta vai para a URL.** `app.nebuloz.ai/<slug-da-conta>/<produto>/...`, como Linear, Vercel e Atlassian (§2). Efeitos:
- cada aba tem a sua conta e uma aba antiga não escreve em outra conta;
- um link colado no chat abre na conta certa, ou nega o acesso com clareza;
- `Session.activeTenantId` vira só "a última conta usada", o ponto de partida depois do login.

Enquanto a URL não muda, há uma mitigação mínima: toda action de escrita recebe o `tenantId` que a tela exibiu e **recusa** quando ele diverge do da sessão ("Você trocou de organização em outra aba. Recarregue."). É o mesmo princípio do `requireTenantSession`, aplicado à intenção do usuário.

**d) O que acontece ao trocar.**
1. Uma porta única de troca: remover o caminho duplicado (`switchOrg` sem limpeza de cookie vs. a rota com limpeza). A troca confere a membership, grava "última usada", limpa o cookie de cache da sessão e manda para o **catálogo da conta nova**, não para a mesma URL, porque o produto pode não estar contratado ali.
2. Os caches de servidor não precisam de ação, porque as chaves já incluem o tenant (§3.1). O cache de cliente (dados do React e router cache) é descartado pela navegação para outra rota raiz. Com a conta na URL, isso sai de graça.
3. As outras abas: com a conta na URL, não são afetadas, e é esse o comportamento desejado. Sem a URL, a mitigação (c) as bloqueia na próxima escrita.
4. Fallback determinístico: sem "última usada" válida, usar a conta de membership mais recente. Com mais de uma conta, **mostrar o seletor em vez de escolher** (é o que a spec 004 chama de catálogo pós-login, com um passo antes: escolher a conta).
5. A troca entra na trilha de auditoria, com conta de origem, conta de destino e horário. Serve para reconstruir casos como o do dogfood sem depender de memória.

**e) Como o convite põe um e-mail existente numa segunda conta.** O fluxo atual funciona, em linhas gerais: `TenantInvitation` por e-mail → `/invite/[token]` → login → conferência de e-mail (`complete/page.tsx:32`) → cria a `TenantMember`. Faltam quatro coisas:
1. **O convite carrega os papéis por produto,** não só o `MemberRole`. Hoje a pessoa aceita, cai na conta e o Meridian nega o acesso, porque não existe `MeridianMembership` (`meridian-resolve.ts:9-11`). O convite deveria dizer "Conta X · Meridian: Consultor · Charter: Leitor".
2. **Aceitar muda só a sessão atual,** não `updateMany` em todas.
3. **Quem já tem conta vê o convite pendente no seletor** ("Convites: Medcore"), além do e-mail. É o padrão de Linear e Vercel para quem já está logado. **Hipótese:** hoje o convite só chega por e-mail/link.
4. **O provisionamento pelo back-office não adiciona o dono em silêncio.** Quando o e-mail do dono já existe, `provisionTenant` cria a membership direto, sem convite (`packages/provisioning/src/tenant.ts:74`). Para um terceirizado que já é membro de outra conta, isso é exatamente a "segunda conta sem saber". Sugestão: sempre convite. Pelo menos um aviso, e ver também §4.1.

---

## 4. Casos especiais

### 4.1 O tenant interno da Nebuloz

Hoje há **dois conceitos e seis contas** para o mesmo e-mail do CEO:
- `isSystem` marca o tenant técnico `system`, dono de auditoria e do catálogo comercial. **Ser membro dele é o que define staff** do back-office (`apps/backoffice/lib/guard.ts:9-11`). Ele "não é cliente" e deve sair de toda listagem de cliente (`tenant.prisma:29-33`).
- `isInternalTenant` marca a conta de dogfood (`tenant.prisma:34-39`). Hoje é `nebuloz`, depois de ter ido e voltado de `nebula` em 27/set (`diario.md`).
- Além disso: `dev-teste`, `nebuloz-novo-cliente` e `medcore` em produção. **Hipótese:** as três são contas de teste ou de demonstração, não clientes pagantes. O CEO precisa confirmar, especialmente `medcore`.

Recomendação:
1. **A Nebuloz é uma conta cliente como as outras** (`nebuloz`), com os mesmos contratos e papéis. É o que torna o dogfood válido. O que a distingue é a **coorte de flag** "interna" (§2.1), não uma permissão especial.
2. **Tipo de conta explícito:** `CLIENTE | INTERNA | TESTE | DEMO` (e `SISTEMA` para `system`). O seletor mostra o selo, o MRR e o CAC só contam `CLIENTE`, e o seletor do portal **nunca** lista `SISTEMA`. Isso substitui a necessidade de lembrar qual slug é qual.
3. **Consolidar `nebula` e `nebuloz`** é decisão do CEO. Com os nomes quase iguais e o plano "NEBULA" no enum (§1.3), a chance de repetir o erro é alta mesmo com o seletor. Sugestão: renomear a conta que não for a oficial para algo inconfundível ("Nebula (arquivo)") ou encerrá-la.

### 4.2 Staff da plataforma

Hoje o staff é quem é membro do tenant `system`; ADMIN escreve e MEMBER lê (`guard.ts:13-19`, `:187-198`). É um bom modelo para o back-office. O risco está do lado do portal: para dar suporte, o staff vira membro da conta do cliente (é o caso do CEO nas seis contas). Isso polui o seletor, conta assento e não deixa trilha de "por que entrei".

Referência: Atlassian e Microsoft separam o admin da plataforma do membro da organização do cliente, e o acesso entre organizações é configurado de forma explícita, com trilha (§2; [Entra cross-tenant access](https://learn.microsoft.com/en-us/entra/external-id/cross-tenant-access-overview)).

Recomendação: **acesso de suporte temporário,** pedido e concedido com motivo e prazo, registrado em trilha, visível para o admin do cliente e sem virar `TenantMember`. `AccessLog` (`platform-ops.prisma:641`) registra login, logout e recusa. **Hipótese:** ele não cobre esse caso, e seria preciso um registro próprio.

### 4.3 Consultor que atende vários clientes

São dois casos diferentes, e vale não misturá-los:
- **(a) O consultor Nebuloz (ou de um parceiro) rodando o Meridian.** Por decisão do dono em 2026-09-22, o assessment vive **no tenant da consultoria**, e a organização avaliada é texto (`mapa-de-fronteiras.md:61`, `:291-295`). O consultor escolhe a conta **da consultoria**, não a do cliente. O seletor não resolve "qual cliente estou avaliando": isso é a carteira do Meridian, e ela precisa deixar o cliente avaliado evidente em cada tela. O custo conhecido é que a lacuna promovida não atravessa tenants (`mapa-de-fronteiras.md:291`).
- **(b) O terceirizado ou dev que trabalha dentro de várias contas clientes** (o caso do adendo). É exatamente o padrão "um e-mail, N memberships, seletor" (§3). Cada conta cliente o convida, e cada uma decide o papel dele em cada produto. Referência: o convidado B2B da Microsoft e o membro de vários workspaces do Linear (§2).
- **Futuro, sem pressa:** "conta parceira" com acesso delegado a várias contas clientes (o modelo de parceiro da Microsoft). Só faz sentido quando houver um canal de revenda. Não recomendo construir agora.
- **Pergunta de negócio:** o terceirizado ocupa assento em cada conta? Pelo padrão das referências, sim: o assento é por organização. É preciso decidir antes que o limite de assento seja aplicado (§1.3, item 3).

### 4.4 Respondente do Meridian sem conta

`MeridianRespondent` tem nome, e-mail, eixo e `tokenHash` (SHA-256), com validade própria e sem `User` (`schema/meridian.prisma:249-275`). É um **convidado de uma tarefa,** como o link de um formulário, e está certo continuar assim:
- não é Pessoa da conta, não aparece no seletor e não ocupa assento;
- se o e-mail do respondente for o mesmo de um `User`, **não unificar**. O acesso dele é ao questionário, não à conta. Unificar daria a um respondente visão da conta do consultor;
- o risco conhecido é de retenção de evidência sem prazo, não de modelo (`atrito.md:60`).

---

## 5. Perguntas para o CEO

1. **A conta vai para a URL** (`/<conta>/<produto>`)? É a mudança que resolve na raiz a confusão de conta. As alternativas mais baratas (mostrar a conta em toda tela, recusar escrita com conta divergente) reduzem o problema, mas não o eliminam.
2. **A lista de lançados bloqueia a URL direta para contas externas?** (pergunta aberta da spec 008). Recomendação: sim, e a coorte interna fica isenta.
3. **Qual é a conta oficial da Nebuloz,** e o que fazer com `nebula`, `dev-teste`, `nebuloz-novo-cliente` e `medcore`?
4. **O terceirizado conta assento** em cada conta onde é membro?
5. **O papel de conta sai do enum SAFe** (dono, admin ou membro na conta; papel SAFe só no Cosmos)? Isso mexe em todas as telas que leem `TenantMember.role`, então precisa de spec própria.

## 6. Próximo passo sugerido

Se o CEO aprovar as respostas 1, 2 e 5, levar ao PO como spec "Conta ativa visível e seletor único no portal" (§3). Fatias, em ordem:
1. nome da conta visível em todo produto + fallback determinístico;
2. uma única porta de troca;
3. o convite carrega os papéis por produto;
4. a conta na URL.

A ligação proposta → contrato → `TenantModule` (§1.4) é outra spec, do back-office (B-32).
