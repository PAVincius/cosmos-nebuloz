# Feature Specification: Login genérico + seleção de produto pós-login

**Feature Branch**: `004-login-generico-produto`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Login genérico da Nebuloz + tela de seleção de produto pós-login, para o laboratório de usabilidade do Meridian com o CEO. Pedido do CEO: (a) tela de login genérica da Nebuloz, sem marca do Cosmos como padrão; (b) depois do login, tela de seleção de produto — catálogo dos 5 produtos da suíte (Meridian, Scaffold, Charter, Cosmos, Signal) com os perfis possíveis de cada um; (c) só o Meridian habilitado/clicável agora, os demais visíveis mas desabilitados (ex.: 'em breve'); (d) escolher um produto habilitado leva a ele. Adendo: troca de senha — (1) tela 'alterar senha' para usuário logado (senha atual + nova); (2) 'esqueci a senha' funcionando de ponta a ponta em produção."

## Clarifications

### Session 2026-09-26

- Q: Como o sistema deve reconhecer o tenant Nebuloz pra decidir se mostra o catálogo pós-login? → A (primeira resposta, via Morgana): catálogo universal pra todos os tenants, habilitação só pelo contrato real (`TenantModule`), sem flag nova. **A (correção, via Norte/CPO, mesma sessão): revertida.** O CEO decidiu **flag dedicada no tenant** (`Tenant.isInternalTenant`), não ID/slug fixo nem env — o catálogo pós-login volta a ser exclusivo do tenant com essa flag (hoje, só Nebuloz); demais tenants mantêm o comportamento atual (vão direto pro produto contratado). As duas respostas chegaram atribuídas ao CEO por canais diferentes; a segunda é a que vale — ver decisão registrada em `intent.md`.
- Q: Qual remetente usar no e-mail de redefinição de senha? → A: `no-reply@nebuloz.ai`, via Resend (mesmo transporte de `packages/email/index.ts`). Depende de o domínio `nebuloz.ai` estar verificado no Resend (SPF/DKIM) — passo manual do CEO, registrado como dependência.
- Q: Renomear o issuer do 2FA (hoje "Cosmos" em `packages/auth/server.ts:78`) dentro deste escopo? → A: Sim, para "Nebuloz". Critério: 2FA já cadastrado antes da mudança continua funcionando (o issuer é só um rótulo de exibição no app autenticador, não faz parte do segredo TOTP).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Login sem marca de produto específico (Priority: P1)

Qualquer pessoa que acesse `app.nebuloz.ai` para autenticar vê uma tela de login com identidade da Nebuloz, sem wordmark, headline ou ilustração de nenhum produto específico da suíte (hoje é sempre Cosmos).

**Why this priority**: É a porta de entrada de todo mundo, inclusive dos clientes reais de outros produtos — hoje mente sobre qual produto a pessoa está prestes a usar. Sem isso, qualquer sessão de laboratório do Meridian começa com uma marca errada.

**Independent Test**: Acessar `app.nebuloz.ai` deslogado, de qualquer tenant, e confirmar que a tela de login não exibe nenhuma marca/copy de produto específico.

**Acceptance Scenarios**:

1. **Given** um usuário deslogado de qualquer tenant, **When** ele acessa a tela de login, **Then** não vê wordmark, headline nem ilustração de nenhum produto específico da suíte — só identidade Nebuloz.
2. **Given** o app autenticador de um usuário (2FA) qualquer, **When** ele identifica a origem do código, **Then** o nome exibido não é o de um produto específico da suíte (achado registrado; mudança concreta é pergunta de clarificação, ver Assumptions).

---

### User Story 2 - Catálogo de produtos pós-login (tenant interno, via flag dedicada) (Priority: P1)

Uma pessoa de um tenant marcado como interno (`Tenant.isInternalTenant = true`; hoje, só o tenant Nebuloz) vê, ao autenticar, um catálogo com os 5 produtos da suíte (Meridian, Scaffold, Charter, Cosmos, Signal) e os perfis possíveis de cada um. Só o Meridian está habilitado; os demais aparecem visíveis mas desabilitados, com indicação clara de "em breve". Escolher o Meridian leva direto para dentro dele. Um usuário de qualquer outro tenant (flag ausente ou `false`) não vê o catálogo — segue direto pro produto que seu tenant tem contratado, como hoje.

**Why this priority**: É o núcleo do pedido — resolve o problema concreto do laboratório de usabilidade (cair no Cosmos em vez do Meridian) sem alterar o fluxo pós-login de nenhum tenant cliente real.

**Independent Test**: Logar como usuário do tenant Nebuloz (`isInternalTenant = true`) e confirmar que a tela pós-login é o catálogo, com Meridian clicável e os demais desabilitados; clicar em Meridian e confirmar que entra nele. Logar como usuário de outro tenant e confirmar que vai direto pro produto contratado, sem ver o catálogo.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado de um tenant com `isInternalTenant = true`, **When** o login é concluído, **Then** ele vê o catálogo dos 5 produtos com os perfis possíveis de cada um.
2. **Given** o catálogo exibido, **When** o usuário observa Scaffold, Charter, Cosmos ou Signal, **Then** eles aparecem visíveis mas não clicáveis, com indicação de "em breve" (ou equivalente).
3. **Given** o catálogo exibido, **When** o usuário seleciona Meridian, **Then** ele é levado para dentro do Meridian.
4. **Given** um usuário de um tenant sem `isInternalTenant` (cliente real), **When** o login é concluído, **Then** ele vai direto para o produto que seu tenant tem contratado, sem ver o catálogo — comportamento idêntico ao atual.

---

### User Story 3 - Trocar senha logado (Priority: P2)

Um usuário autenticado consegue trocar a própria senha informando a senha atual e a nova senha, sem sair do produto em que está.

**Why this priority**: Fecha um buraco de autoatendimento hoje inexistente; não bloqueia o laboratório de usabilidade em si, mas é parte do mesmo pedido de superfície de autenticação.

**Independent Test**: Logado, acessar a tela de alterar senha, informar senha atual + nova senha, e confirmar que o próximo login usa a nova senha.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele informa a senha atual correta e uma nova senha, **Then** a senha é alterada e ele consegue logar com a nova senha no próximo acesso.
2. **Given** um usuário autenticado, **When** ele informa a senha atual incorretamente, **Then** o sistema rejeita a troca com uma mensagem clara, e a senha não muda.

---

### User Story 4 - Esqueci a senha, ponta a ponta (Priority: P2)

Um usuário deslogado que esqueceu a senha pede redefinição informando o e-mail, recebe um e-mail real, e o link leva a uma tela funcional (não erro) onde define a nova senha e consegue logar com ela.

**Why this priority**: Hoje o fluxo existe só como UI — não envia e-mail e não tem rota de destino. Sem isso, qualquer pessoa (CEO incluso) que esquecer a senha fica sem saída limpa, e o runbook proíbe explicitamente o atalho de gravar senha por SQL.

**Independent Test**: Deslogado, solicitar redefinição para um e-mail válido, confirmar recebimento do e-mail, abrir o link, definir nova senha, e logar com ela.

**Acceptance Scenarios**:

1. **Given** um usuário deslogado que esqueceu a senha, **When** ele informa seu e-mail na tela de "esqueci a senha", **Then** um e-mail real de redefinição é enviado para esse endereço.
2. **Given** o e-mail de redefinição recebido, **When** o usuário abre o link, **Then** ele chega a uma tela real de definir nova senha (não um erro 404).
3. **Given** a nova senha definida, **When** o usuário tenta logar com ela, **Then** o login é bem-sucedido.
4. **Given** um e-mail que não existe na base, **When** alguém solicita redefinição para ele, **Then** o sistema responde da mesma forma que para um e-mail existente (não revela se a conta existe).

---

### Edge Cases

- Usuário de tenant sem `isInternalTenant` que tenta acessar a URL do catálogo diretamente (sem passar pelo redirect): mantém o comportamento de habilitação por contrato já existente (`TenantModule`), sem regressão.
- Usuário do tenant Nebuloz tenta acessar Scaffold/Charter/Signal por URL direta, contornando o catálogo: comportamento atual de bloqueio por falta de contrato/prontidão é preservado (não é objetivo desta feature abrir esses produtos).
- Link de redefinição de senha expirado ou já usado: sistema informa que o link não é mais válido e oferece solicitar um novo, sem expor detalhes internos.
- Usuário solicita redefinição de senha múltiplas vezes seguidas: cada solicitação gera um novo link válido; links anteriores deixam de ser aceitos.
- Troca do issuer do 2FA de "Cosmos" para "Nebuloz": usuários que já têm 2FA cadastrado continuam autenticando normalmente (o issuer é só o rótulo exibido no app autenticador, a mudança não deve invalidar segredos TOTP existentes).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A tela de login em `app.nebuloz.ai` MUST NOT exibir wordmark, headline ou ilustração específica de nenhum produto da suíte (ex.: Cosmos) — apenas identidade Nebuloz, para qualquer tenant.
- **FR-002**: Após autenticação bem-sucedida, o sistema MUST determinar o destino por tenant: usuários de um tenant com `isInternalTenant = true` veem o catálogo de produtos; usuários de qualquer outro tenant seguem direto para o produto que seu tenant tem contratado, como hoje.
- **FR-003**: O catálogo pós-login MUST listar os 5 produtos da suíte (Meridian, Scaffold, Charter, Cosmos, Signal), com os perfis possíveis de cada um.
- **FR-004**: No catálogo, apenas o Meridian MUST estar habilitado/clicável; os demais produtos MUST aparecer visíveis e desabilitados, com indicação clara de "em breve" (ou equivalente).
- **FR-005**: Selecionar o Meridian no catálogo MUST levar o usuário para dentro do Meridian.
- **FR-006**: O model `Tenant` MUST ganhar um campo booleano `isInternalTenant` (default `false`), via migration Prisma — não por config/env nem checagem de ID/slug fixo no código.
- **FR-007**: Um usuário autenticado MUST conseguir trocar a própria senha informando senha atual e nova senha, sem sair do produto em que está.
- **FR-008**: O sistema MUST rejeitar a troca de senha quando a senha atual informada estiver incorreta, com mensagem de erro clara, sem alterar a senha existente.
- **FR-009**: Um usuário deslogado MUST conseguir solicitar redefinição de senha informando um e-mail, e o sistema MUST enviar um e-mail real com um link de redefinição (não apenas exibir uma tela sem envio efetivo).
- **FR-010**: O link do e-mail de redefinição MUST levar a uma tela funcional (não erro) onde o usuário define a nova senha.
- **FR-011**: Após definir a nova senha via redefinição, o usuário MUST conseguir logar com ela.
- **FR-012**: Ao solicitar redefinição de senha, o sistema MUST responder de forma equivalente independentemente de o e-mail existir ou não na base (não revelar existência de conta).
- **FR-013**: Nenhuma escrita ou alteração de senha MUST ocorrer fora do fluxo padrão de autenticação (proibido gravar/alterar senha por SQL direto, script ou qualquer atalho, em qualquer hipótese).
- **FR-014**: O e-mail de redefinição de senha MUST ser enviado a partir de `no-reply@nebuloz.ai` via Resend, reaproveitando o transporte já usado em `packages/email/index.ts`.
- **FR-015**: A troca do issuer do 2FA (de "Cosmos" para "Nebuloz") MUST preservar o funcionamento do 2FA já cadastrado por usuários existentes antes da mudança.

### Key Entities *(include if feature involves data)*

- **Catálogo de Produto**: item exibido no catálogo pós-login — nome do produto, perfis possíveis associados, estado de habilitação (habilitado / em breve).
- **Tenant**: ganha o campo `isInternalTenant` (booleano, default `false`) — diferencia o(s) tenant(s) que veem o catálogo pós-login (hoje, só Nebuloz) dos demais, que seguem direto pro produto contratado. Entidade com dono único (`docs/produto/mapa-de-fronteiras.md:61`): alvo é Charter, hoje tecnicamente criada em `packages/provisioning/src/tenant.ts:53-116` (gap registrado no mapa).
- **Solicitação de redefinição de senha**: token de redefinição vinculado a um e-mail, com validade limitada e uso único.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário do tenant Nebuloz completa o caminho login → catálogo → dentro do Meridian em uma única sessão, sem passar pelo Cosmos.
- **SC-002**: 100% das telas de login em `app.nebuloz.ai`, para qualquer tenant, não exibem identidade visual de nenhum produto específico da suíte.
- **SC-003**: Usuários de tenants clientes reais (sem `isInternalTenant`) não percebem nenhuma mudança no fluxo pós-login em relação ao comportamento atual.
- **SC-004**: Um usuário autenticado completa a troca de senha (atual + nova) em menos de 1 minuto, sem sair do produto.
- **SC-005**: Um usuário que esqueceu a senha consegue, sem qualquer intervenção manual ou acesso a banco de dados, ir de "esqueci a senha" até logar com a nova senha.

## Assumptions

- Os perfis de cada produto continuam vindo dos enums de papel já existentes por produto (`MeridianRole`, `CharterRole`, `ScaffoldRole`, `SignalRole`, `MemberRole` para o Cosmos) — não se cria um vocabulário único de "perfil de suíte" nesta feature (fora de escopo, conforme intent).
- O envio do e-mail de redefinição de senha reaproveita a infraestrutura de e-mail já em produção (`packages/email`, transporte Resend) em vez de introduzir um novo provedor.
- `isInternalTenant` é um campo novo, distinto de `Tenant.isSystem` (já existente, `tenant.prisma:31-36`, reservado ao tenant técnico de auditoria) — propósitos diferentes: dogfood real de cliente vs. tenant de sistema.
- Marcar o tenant Nebuloz com `isInternalTenant = true` é uma operação manual pontual (via migration de dado ou ação administrativa), fora do escopo desta spec definir a UI de gerenciar essa flag.

## Dependencies

- **Domínio `nebuloz.ai` verificado no Resend (SPF/DKIM)**: passo manual, responsabilidade do CEO, necessário para o e-mail de redefinição de senha (`no-reply@nebuloz.ai`) ser entregue de forma confiável. Bloqueia FR-014 até ser concluído.
