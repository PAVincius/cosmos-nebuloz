# Feature Specification: Conta ativa sempre visível (Fase 0 do modelo de contas)

**Feature Branch**: `009-conta-ativa-visivel`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: pedido do CEO, via Morgana — Fase 0 do modelo de contas (`docs/produto/modelo-de-contas/proposta.md`, commit `e0f8a647`; base técnica `as-is.md`). Escopo fechado, sem schema: nome+seletor da conta ativa visíveis no topo dos 5 produtos (componente comum), confirmação explícita ao trocar de conta com feedback visível, fallback determinístico em `requireTenantSession` quando não há `activeTenantId`, confirmação de que a troca limpa o cache de sessão, e — adendo do achado do Alicerce — aceitar convite/completar onboarding devem trocar a conta ativa só da sessão atual, não de todas as sessões da pessoa. Ver `intent.md` (status: approved).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber sempre qual conta está ativa (Priority: P1)

Uma pessoa com acesso a mais de uma conta (ex.: o CEO, `ADMIN` em 6 tenants,
incluindo contas chamadas "Nebula" e "Nebuloz") entra em qualquer um dos 5
produtos (Meridian, Scaffold, Charter, Cosmos, Signal) e vê, sem precisar
passar o mouse em nada, o nome da conta em que está — o mesmo componente
visual em todos os 5, não uma implementação por produto.

**Why this priority**: É a causa direta do incidente do dogfood
(`proposta.md:10`) — um diagnóstico criado na conta errada porque o Meridian
só mostrava o nome num tooltip. Sem isso, nenhuma outra parte desta spec evita
o mesmo erro de novo.

**Independent Test**: Logar como uma pessoa com 2+ contas, abrir cada um dos 5
produtos e confirmar, em cada um, que o nome da conta ativa aparece como texto
na tela (não só em `title`/tooltip), sem precisar de interação do mouse.

**Acceptance Scenarios**:

1. **Given** uma pessoa `ADMIN` em 6 contas, **When** ela abre o Meridian,
   **Then** o nome da conta ativa aparece como texto visível no topo da tela,
   sem precisar de hover.
2. **Given** a mesma pessoa, **When** ela abre Scaffold, Charter, Cosmos e
   Signal, um de cada vez, **Then** o mesmo componente de nome da conta
   aparece nos 4, com o mesmo comportamento do Meridian.
3. **Given** o componente de conta ativa em qualquer dos 5 produtos, **When**
   inspecionado, **Then** é a mesma implementação de componente reusada, não
   uma cópia por produto.

---

### User Story 2 - Trocar de conta com confirmação e feedback (Priority: P1)

A mesma pessoa, precisando sair da conta "Nebula" e entrar na "Nebuloz",
aciona o seletor, confirma explicitamente a troca antes dela acontecer, e
depois de confirmar é levada ao catálogo (ou produto de origem) da conta
nova, com um sinal visível confirmando qual conta ficou ativa.

**Why this priority**: Sem confirmação explícita, um clique acidental no
seletor reproduz o mesmo tipo de erro do incidente — trocar de conta sem
perceber. Sem feedback pós-troca, a pessoa continua sem certeza de que a
troca realmente aconteceu.

**Independent Test**: Acionar o seletor de conta em qualquer produto, iniciar
uma troca, confirmar que existe um passo de confirmação explícito antes da
troca efetivar, e que depois de confirmar a tela muda mostrando a conta nova
ativa.

**Acceptance Scenarios**:

1. **Given** uma pessoa em qualquer produto com o seletor de conta, **When**
   ela escolhe outra conta no seletor, **Then** o sistema pede confirmação
   explícita antes de trocar — a troca não efetiva com a mera escolha.
2. **Given** o passo de confirmação, **When** a pessoa cancela, **Then**
   nenhuma troca acontece e a conta ativa continua a mesma.
3. **Given** o passo de confirmação, **When** a pessoa confirma, **Then** ela
   é levada ao catálogo (tenant interno) ou ao produto contratado (demais
   tenants) da conta nova, e a tela mostra de forma visível qual conta está
   ativa agora.

---

### User Story 3 - Fallback determinístico quando não há conta ativa definida (Priority: P2)

Uma pessoa com várias contas faz login numa sessão nova (sem
`activeTenantId` gravado, ex.: primeiro login após limpar cookies) e o
sistema escolhe uma conta ativa por uma regra fixa e repetível, não por uma
ordem arbitrária de banco.

**Why this priority**: É a segunda causa técnica confirmada do incidente
(`as-is.md` §2.1, §10.2) — sem isso, mesmo com o componente de visibilidade
da US1, a pessoa pode começar a sessão já na conta errada.

**Independent Test**: Com a mesma pessoa e a mesma lista de memberships,
zerar `activeTenantId` da sessão e repetir o login (ou o primeiro acesso
pós-login) várias vezes, confirmando que a conta escolhida é sempre a mesma.

**Acceptance Scenarios**:

1. **Given** uma pessoa com 6 memberships e nenhum `activeTenantId` na
   sessão, **When** ela acessa qualquer produto, **Then** o sistema escolhe
   a conta cuja membership (`TenantMember`) é a mais antiga por data de
   criação, e grava essa escolha na sessão.
2. **Given** a mesma pessoa e a mesma lista de memberships, **When** o
   cenário do item 1 se repete em sessões diferentes, **Then** a conta
   escolhida é sempre a mesma.
3. **Given** uma pessoa com uma única membership, **When** ela acessa sem
   `activeTenantId` na sessão, **Then** essa única conta é escolhida — sem
   ambiguidade possível.

---

### User Story 4 - Convite e onboarding não trocam a conta de outras sessões (Priority: P2)

A mesma pessoa está com o produto aberto num navegador (sessão A). Em outro
navegador ou dispositivo (sessão B), ela aceita um convite para uma nova
conta, ou completa o onboarding de um workspace novo. A sessão A continua na
conta que já estava, sem pular sozinha para a conta nova.

**Why this priority**: Achado confirmado em código durante esta spec
(`invite/[token]/complete/page.tsx`, `actions/onboarding.ts`): hoje os dois
fluxos trocam `activeTenantId` de **todas** as sessões da pessoa via
`session.updateMany`. É o oposto do que a Fase 0 promete ("a pessoa sempre
sabe qual conta está ativa") — uma sessão pode pular de conta sem que a
pessoa tenha feito nada nela.

**Independent Test**: Abrir duas sessões autenticadas da mesma pessoa (dois
navegadores/perfis). Na sessão A, anotar a conta ativa. Na sessão B, aceitar
um convite para uma conta nova. Confirmar que a sessão A, ao ser consultada
de novo, continua na mesma conta de antes.

**Acceptance Scenarios**:

1. **Given** duas sessões abertas da mesma pessoa, cada uma numa conta
   diferente, **When** a sessão B aceita um convite para uma terceira conta,
   **Then** a sessão A mantém a conta ativa que já tinha — não muda.
2. **Given** o mesmo cenário, **When** a sessão B completa o onboarding de um
   workspace novo, **Then** a sessão A mantém a conta ativa que já tinha.
3. **Given** o convite aceito na sessão B, **When** a própria sessão B é
   consultada em seguida, **Then** ela está na conta nova (a troca continua
   valendo — só deixa de vazar para as outras sessões).

---

### Edge Cases

- Pessoa com uma única conta: o componente mostra o nome da conta, sem exigir
  escolha nem confirmação de troca (não há para onde trocar).
- Pessoa sem nenhuma membership (usuário novo, pré-onboarding): fora desta
  fase — segue o fluxo de onboarding/criação de conta já existente,
  inalterado.
- Tentativa de trocar para uma conta da qual a pessoa não é membro: continua
  recusada (`FORBIDDEN`), como hoje — esta spec não muda quem pode trocar
  para onde, só a experiência de quem já pode.
- Cancelar o passo de confirmação de troca: nenhuma escrita acontece, conta
  ativa permanece a mesma, sem estado intermediário visível.
- Duas trocas em rápida sucessão na mesma sessão: a última confirmada é a que
  vale; nenhuma condição de corrida deixa a UI mostrando uma conta diferente
  da realmente ativa no servidor.
- `switchOrg` (mecanismo de troca existente, sem tela que o chame hoje):
  permanece sem call site nesta fase — não é wireado, não é corrigido. Fica
  registrado como risco conhecido (não limpa o cache do cookie, não escopa a
  troca a uma sessão), para quem for wireá-lo depois não repetir o problema
  que esta spec resolve nos outros dois caminhos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST exibir o nome da conta ativa como texto sempre
  visível (nunca só em tooltip/`title`) no topo da tela, nos 5 produtos
  (Meridian, Scaffold, Charter, Cosmos, Signal).
- **FR-002**: O sistema MUST usar o mesmo componente para essa exibição nos 5
  produtos — não uma implementação separada por produto.
- **FR-003**: O componente MUST incluir um seletor para trocar de conta,
  visível quando a pessoa tem mais de uma membership.
- **FR-004**: Trocar de conta pelo seletor MUST exigir confirmação explícita
  da pessoa antes de a troca ser efetivada.
- **FR-005**: Cancelar a confirmação MUST deixar a conta ativa inalterada,
  sem efeito colateral.
- **FR-006**: Após confirmar a troca, o sistema MUST levar a pessoa ao
  destino correspondente à conta nova (catálogo para tenant interno, produto
  contratado para os demais) e MUST mostrar de forma visível qual conta está
  ativa depois da troca.
- **FR-007**: Quando a sessão não tem `activeTenantId` e a pessoa tem mais de
  uma membership, o sistema MUST escolher a conta cuja `TenantMember` é a
  mais antiga por data de criação (`createdAt` ascendente) — nunca depender
  de ordem não determinística de banco.
- **FR-008**: A escolha do FR-007 MUST ser reproduzível: para a mesma pessoa
  e a mesma lista de memberships, repetir o cenário (sessão nova sem
  `activeTenantId`) MUST sempre resultar na mesma conta escolhida.
- **FR-009**: Toda troca de conta pelo caminho já usado hoje
  (`/api/auth/switch-tenant`) MUST continuar limpando o cache da sessão no
  navegador (cookie `better-auth.session_data`), e isso MUST estar coberto
  por um teste que comprove que a conta nova aparece imediatamente, não só
  depois da janela de revalidação do cache (60s).
- **FR-010**: Aceitar um convite MUST alterar a conta ativa só da sessão que
  executou a ação — sessões diferentes abertas pela mesma pessoa MUST manter
  a conta que já tinham.
- **FR-011**: Completar o onboarding de um workspace novo MUST alterar a
  conta ativa só da sessão que executou a ação — mesma regra do FR-010.
- **FR-012**: Qualquer novo ponto de entrada para trocar de conta introduzido
  nesta fase (ex.: o seletor dentro de um produto) MUST reusar o mecanismo já
  existente que confere membership, grava a troca e limpa o cache — não MUST
  duplicar essa lógica.
- **FR-013**: O mecanismo de troca hoje sem nenhuma tela que o chame
  (`switchOrg`) MUST permanecer sem call site nesta fase; sua limitação
  conhecida (não limpa o cache do cookie, não escopa a troca a uma sessão)
  MUST ficar documentada como risco, não corrigida.
- **FR-014**: Nenhuma mudança desta fase MUST alterar a regra de acesso a um
  produto por contrato (`TenantModule`) nem introduzir leitura de dado de
  mais de uma conta fora do padrão já existente (listar as contas da própria
  pessoa via `TenantMember`, sem leitura cross-tenant).

### Key Entities *(include if feature involves data)*

- **Conta (`Tenant`)**: o cliente/workspace contratante. Esta fase não cria
  campo novo nele (sem schema); só passa a ser exibido e trocável de forma
  consistente nos 5 produtos.
- **Membership (`TenantMember`)**: liga uma pessoa a uma conta, com papel e
  `createdAt`. `createdAt` passa a ser usado como critério do fallback
  determinístico (FR-007).
- **Sessão**: guarda qual conta está ativa (`activeTenantId`) para aquele
  navegador/dispositivo específico. Esta fase reforça que cada sessão é
  independente — uma troca numa sessão não deve mudar a conta ativa de outra
  sessão da mesma pessoa (FR-010, FR-011).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma pessoa com acesso a 6 contas identifica qual conta está
  ativa em qualquer um dos 5 produtos sem precisar de nenhuma interação
  (hover, clique) — o nome está na tela assim que a página carrega.
- **SC-002**: 100% das trocas de conta iniciadas pelo seletor passam por um
  passo de confirmação explícita antes de efetivar.
- **SC-003**: Repetir o cenário de login sem conta ativa definida, para a
  mesma pessoa e a mesma lista de contas, resulta na mesma conta escolhida em
  100% das repetições.
- **SC-004**: Depois de confirmar uma troca de conta, a conta nova aparece
  corretamente em qualquer produto acessado em seguida, sem esperar a janela
  de até 60 segundos do cache de sessão.
- **SC-005**: Aceitar um convite ou completar um onboarding numa sessão não
  altera a conta visível em nenhuma outra sessão aberta da mesma pessoa — 0
  ocorrências de vazamento cross-sessão nos cenários de teste.

## Assumptions

- O componente comum de conta ativa é implementado uma única vez e consumido
  pelos 5 shells de produto — não uma cópia por produto (decisão do intent,
  reflete a restrição de "sem 5 implementações").
- O fallback determinístico usa `TenantMember.createdAt` ascendente (a
  membership mais antiga), não "a última conta usada de fato" — essa segunda
  regra exigiria um campo novo de schema, fora do escopo desta fase (decisão
  registrada no intent).
- O destino pós-troca de conta segue a mesma lógica já existente de
  destino pós-login (catálogo para tenant interno, produto contratado para os
  demais) — esta spec não cria um destino novo, reusa o que
  `resolve-post-login-destination` já decide.
- `switchOrg` permanece sem call site e sem correção nesta fase — documentado
  como risco conhecido, não resolvido aqui.
- Nenhuma migration de schema é necessária ou permitida nesta fase.
