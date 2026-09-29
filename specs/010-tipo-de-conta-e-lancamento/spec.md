# Feature Specification: Tipo de conta e lançamento por coorte (Fase 1 do modelo de contas)

**Feature Branch**: `010-tipo-de-conta-e-lancamento`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: Fase 1 do modelo de contas
(`docs/produto/modelo-de-contas/proposta.md`, aprovada pelo CEO em
2026-09-27): `Tenant.type` (enum CLIENTE/INTERNA/TESTE/DEMO/SISTEMA,
ADR-0018) substitui `isInternalTenant` e `isSystem`; lista de produtos
lançados por coorte de tipo de conta, absorvendo a spec 008 pausada
(catálogo pós-login só libera clique pro produto lançado). Ver `intent.md`
(status: approved) para as 5 decisões de roast e a lacuna aberta.

## Clarifications

### Session 2026-09-27

- Q: Acesso direto por URL a um produto, para uma conta `CLIENTE`, `TESTE`
  ou `DEMO`, com módulo `ACTIVE` mas fora da lista geral de lançados —
  bloqueia ou permite? → A: bloqueia. Para `INTERNA` continua liberado
  (inalterado); para `CLIENTE`/`TESTE`/`DEMO`, produto não lançado bloqueia
  também a URL direta, não só o card do catálogo. Decisão do CEO,
  2026-09-27, registrada em `docs/produto/modelo-de-contas/proposta.md`
  (commit `ef39a747`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Catálogo interno respeita o lançamento (Priority: P1)

Uma pessoa da Nebuloz (conta `INTERNA`, hoje só o tenant "nebuloz") abre o
catálogo pós-login (`/produto`) e vê os 5 produtos contratados
(`TenantModule` `ACTIVE`), mas só consegue clicar nos que já estão na lista
de acesso antecipado — os demais aparecem com aviso "Em breve", sem link.

**Why this priority**: é a causa raiz que motivou a spec 008 e a Fase 1 —
hoje os 5 aparecem clicáveis simplesmente porque os 5 módulos estão
`ACTIVE` para dogfood, contradizendo a decisão de lançamento escalonado
(`docs/produto/prontidao-lancamento.md`).

**Independent Test**: logar na conta `INTERNA`, abrir `/produto`, confirmar
que só os produtos na lista de acesso antecipado têm link ativo; os demais
mostram "Em breve" e não têm `href`.

**Acceptance Scenarios**:

1. **Given** a conta `INTERNA` com um produto `ACTIVE` e na lista de acesso
   antecipado, **When** a pessoa abre `/produto`, **Then** o card desse
   produto tem link e é clicável.
2. **Given** a mesma conta, **When** ela olha um produto `ACTIVE` mas fora
   da lista de acesso antecipado, **Then** o card mostra "Em breve", sem
   link, sem o motivo de contrato (que seria enganoso — o produto está
   contratado, só não lançado).
3. **Given** um produto com `TenantModule` `SUSPENSO` ou `CANCELADO` (não
   simplesmente "não lançado"), **When** a pessoa olha o card, **Then**
   continua mostrando o motivo real de contrato, não "Em breve" — a conta
   sabe a diferença entre "não paguei" e "ainda não saiu".

---

### User Story 2 - Tipo de conta é um campo único (Priority: P1)

Qualquer parte do sistema que hoje pergunta "este tenant é interno?" ou
"este tenant é de sistema?" passa a fazer essa pergunta olhando um único
campo (`Tenant.type`), não dois booleanos independentes.

**Why this priority**: é a base de tudo que a Fase 1 constrói — sem um tipo
único e confiável, a lista de lançados (US1) não sabe se aplicar a regra da
`INTERNA` ou a regra geral, e o back-office (US3) não tem o que trocar.

**Independent Test**: para cada um dos tenants existentes hoje, ler
`Tenant.type` e confirmar que bate com o mapeamento decidido (nebuloz =
`INTERNA`, `__system__` = `SISTEMA`, `nebula`/`dev-teste`/`nebuloz-novo-cliente`
= `TESTE`, `medcore` = `DEMO`, os demais = `CLIENTE`); confirmar que nenhum
ponto de código (fora de teste) ainda lê `isSystem` ou `isInternalTenant`.

**Acceptance Scenarios**:

1. **Given** o tenant `__system__`, **When** qualquer parte do código
   pergunta se é um tenant de sistema, **Then** a resposta vem de
   `Tenant.type === "SISTEMA"`, não de `isSystem`.
2. **Given** o tenant `nebuloz`, **When** o destino pós-login/pós-troca de
   conta é decidido, **Then** a decisão usa `Tenant.type === "INTERNA"`, não
   `isInternalTenant`.
3. **Given** a base de código inteira (`apps/app`, `apps/backoffice`),
   **When** se busca por `isSystem` ou `isInternalTenant` fora de arquivo de
   teste, migration ou tipo gerado, **Then** zero ocorrências.

---

### User Story 3 - Back-office troca o tipo de uma conta (Priority: P2)

Uma pessoa do back-office (staff) muda o tipo de uma conta existente — por
exemplo, `nebuloz-novo-cliente` (hoje `TESTE`) vira `CLIENTE` quando o
contrato de verdade é fechado.

**Why this priority**: sem isso, o tipo nasce certo e fica errado para
sempre — qualquer conta de teste que vira cliente de verdade precisaria de
uma migration manual de banco, o que a Fase 1 existe para evitar.

**Independent Test**: como staff autenticado, trocar o tipo de uma conta de
teste para `CLIENTE`; confirmar que a leitura seguinte de `Tenant.type`
reflete a troca e que a ação fica registrada em auditoria.

**Acceptance Scenarios**:

1. **Given** uma conta `TESTE`, **When** o staff troca o tipo para
   `CLIENTE`, **Then** `Tenant.type` passa a `CLIENTE` e a troca gera um
   registro de auditoria com quem trocou e quando.
2. **Given** uma tentativa de troca por alguém sem papel de staff, **When**
   a ação é chamada, **Then** é recusada (`FORBIDDEN`), sem alterar o tipo.

---

### User Story 4 - Conta não interna não acessa produto não lançado, nem por URL (Priority: P2)

Uma conta `CLIENTE`, `TESTE` ou `DEMO` só entra num produto que está **(1)**
contratado (`TenantModule` `ACTIVE`/`TRIAL`) **e** **(2)** na lista geral de
lançados — tanto pelo card do catálogo (`/produto`, mesma regra visual de
US1) quanto por acesso direto por URL (`/cosmos`, `/charter` etc.). Produto
contratado mas não lançado bloqueia os dois caminhos para esse tipo de
conta — diferente da conta `INTERNA`, onde só o card bloqueia (US1).

**Why this priority**: fecha a mesma lacuna de US1 para o caso de uma conta
não interna ter um módulo `ACTIVE` ainda não lançado ao público (ex.: trial
antecipado vendido antes do GA) — sem isso, a distinção de duas listas de
US1 fica sem efeito prático fora da conta `INTERNA`, e a URL direta vira uma
porta dos fundos para contornar o catálogo.

**Independent Test**: logar numa conta `CLIENTE` de teste com um módulo
`ACTIVE` fora da lista geral; confirmar "Em breve" sem link no card de
`/produto` **e** que acessar a rota do produto direto pela URL é bloqueado
(recusado ou redirecionado, não a tela do produto).

**Acceptance Scenarios**:

1. **Given** uma conta `CLIENTE` com um módulo `ACTIVE` e na lista geral,
   **When** ela abre `/produto` ou acessa a rota do produto direto pela
   URL, **Then** em ambos os casos ela entra.
2. **Given** a mesma conta, **When** olha um módulo `ACTIVE` fora da lista
   geral no catálogo, **Then** o card mostra "Em breve", sem link.
3. **Given** a mesma conta e o mesmo módulo fora da lista geral, **When**
   ela acessa a rota do produto direto pela URL (contornando o catálogo),
   **Then** o acesso é bloqueado — mesma decisão de "não lançado", agora
   aplicada à URL, não só ao card.
4. **Given** uma conta `INTERNA` no mesmo cenário (módulo `ACTIVE` fora da
   lista de acesso antecipado), **When** ela acessa a rota direto pela URL,
   **Then** o acesso **não** é bloqueado — só o card do catálogo aplica a
   regra pra `INTERNA` (US1), URL direta continua isenta (FR-010).

---

### Edge Cases

- Tenant sem nenhum `TenantModule`: comportamento de "não contratado"
  inalterado — a lista de lançados não cria acesso, só restringe o que já
  está contratado.
- Produto fora da lista de lançados **e** com contrato `SUSPENSO` ou
  `CANCELADO`: mostra o motivo real de contrato — "não lançado" só se aplica
  quando o contrato por si só permitiria o acesso (Acceptance Scenario 3 de
  US1).
- Um produto pode estar na lista geral e não na de acesso antecipado
  simultaneamente? Não — a de acesso antecipado é estritamente "antes" da
  geral; um produto na lista geral está implicitamente liberado também para
  `INTERNA` (a lista de acesso antecipado existe só para os que ainda não
  chegaram na geral).
- Conta muda de tipo (US3) enquanto teria uma sessão ativa: a próxima leitura
  de `/produto` já reflete o tipo novo — não há necessidade de a pessoa
  deslogar (mesmo padrão de qualquer outro dado de `Tenant` lido por
  requisição, sem cache de tipo por sessão).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST expor `Tenant.type` como um enum de 5 valores
  (`CLIENTE`, `INTERNA`, `TESTE`, `DEMO`, `SISTEMA`), com `CLIENTE` como
  valor padrão para conta nova.
- **FR-002**: A migração de dado MUST mapear os tenants existentes conforme
  ADR-0018: `isSystem = true` → `SISTEMA`; a conta com `isInternalTenant = true`
  → `INTERNA`; os slugs `nebula`, `dev-teste`, `nebuloz-novo-cliente` →
  `TESTE`; o slug `medcore` → `DEMO`; os demais → `CLIENTE`.
- **FR-003**: Todo ponto de código hoje lendo `isSystem` ou
  `isInternalTenant` (inventário: ao menos 15 arquivos fora de teste, em
  `apps/app` e `apps/backoffice`) MUST migrar para ler `Tenant.type` — sem
  exceção deixada para depois.
- **FR-004**: O back-office MUST oferecer uma ação para trocar o `type` de
  uma conta existente, restrita a papel de staff, e MUST registrar a troca
  em auditoria (quem, quando, tipo anterior, tipo novo).
- **FR-005**: O sistema MUST manter duas listas de produtos lançados,
  mantidas manualmente em código/configuração (sem UI de gestão nesta
  fase): uma de **acesso antecipado** (aplicável só a contas `INTERNA`) e
  uma **geral** (aplicável a `CLIENTE`, `TESTE`, `DEMO`).
- **FR-006**: Nenhuma das duas listas MUST ser derivada automaticamente do
  resultado do gate de maturidade (spec 007) — o gate é só um sinal de
  apoio à decisão manual de quem mantém as listas.
- **FR-007**: No catálogo pós-login (`/produto`), um card só MUST ser
  clicável quando o módulo está `ACTIVE`/`TRIAL` em `TenantModule` **e**
  está na lista aplicável ao tipo da conta (antecipada para `INTERNA`,
  geral para as demais). Módulo `ACTIVE`/`TRIAL` fora da lista aplicável
  MUST mostrar "Em breve", sem link e sem o motivo de contrato.
- **FR-008**: Quando o estado do módulo não é `DISPONIVEL` por um motivo de
  contrato (`SUSPENSO`, `CANCELADO`, `EXPIRADO`, `SEM_CONTRATO`), o card
  MUST continuar mostrando esse motivo real — "Em breve" só se aplica ao
  caso de módulo contratado e vigente, mas ainda não lançado.
- **FR-009**: A regra de acesso por contrato (`TenantModule` via
  `listModules`/`hasModule`, `@repo/rbac`) MUST continuar sendo a única
  fonte de verdade sobre "abre ou não" — a lista de lançados é um filtro
  adicional só sobre o *card do catálogo*, nunca uma segunda checagem de
  contrato.
- **FR-010**: Acesso direto por URL a um produto (`/cosmos`, `/charter`
  etc., fora do catálogo) para uma conta `INTERNA` MUST continuar sem
  bloqueio por nenhuma das duas listas — inalterado em relação a hoje.
- **FR-011**: Acesso direto por URL a um produto (`/cosmos`, `/charter`
  etc., fora do catálogo), para uma conta `CLIENTE`, `TESTE` ou `DEMO`, com
  módulo `ACTIVE`/`TRIAL` mas fora da lista geral de lançados, MUST ser
  bloqueado — diferente de FR-010 (`INTERNA`, onde a URL direta continua
  liberada). É a mesma condição de "não lançado" de FR-007, agora aplicada
  também à rota do produto, não só ao card do catálogo.

### Key Entities *(include if feature involves data)*

- **Tenant**: ganha o campo `type` (enum), substituindo `isSystem` e
  `isInternalTenant`. Sem outra mudança de schema.
- **Lista de acesso antecipado / Lista geral de lançados**: não são tabela
  nova — são constantes de código/configuração, mantidas manualmente, uma
  por `ProductModule`. Não persistem estado por tenant, só a associação
  produto→lançado (mesma forma de `SELF_SERVICE_MODULES`,
  `apps/app/app/actions/onboarding-modules.ts`).
- **AccessLog (ou auditoria equivalente já existente)**: recebe uma entrada
  a cada troca de `Tenant.type` pelo back-office (FR-004) — reusa o
  mecanismo de auditoria já existente (`AccessLog`/trilha do back-office),
  não cria um novo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Numa conta `INTERNA` com todos os módulos contratados, apenas
  os módulos na lista de acesso antecipado aparecem clicáveis no catálogo —
  0% dos módulos fora da lista aparecem com link, em 100% das visitas
  testadas.
- **SC-002**: Depois da migração, uma busca por `isSystem`/`isInternalTenant`
  fora de teste, migration ou tipo gerado retorna 0 ocorrências no
  repositório.
- **SC-003**: Todo tenant existente no banco recebe exatamente um `type`
  não nulo depois da migração de dado — 0 tenants com tipo ambíguo ou
  ausente.
- **SC-004**: Uma troca de tipo pelo back-office aparece na próxima
  carga do catálogo da conta afetada, sem exigir logout, novo login ou
  deploy.
- **SC-005**: Toda troca de tipo feita pelo back-office tem um registro de
  auditoria localizável (quem, quando, de/para) — 100% das trocas
  cobertas, 0 trocas silenciosas.

## Assumptions

- As duas listas (acesso antecipado e geral) são código/configuração, sem
  tabela de banco nem tela administrativa nesta fase — decisão explícita do
  intent (Fora de escopo).
- O comportamento de FR-007/FR-008 (card do catálogo) para contas
  `CLIENTE`/`TESTE`/`DEMO` segue a mesma regra visual de US1 (`INTERNA`),
  aplicada contra a lista geral — isso não mudou com o Clarifications acima,
  que resolveu especificamente o comportamento de **URL direta** (FR-011),
  não o do card.
- A ação de trocar `Tenant.type` (US3/FR-004) reusa o padrão de guard já
  existente do back-office (`requirePlatformStaff`/`assertCanWrite`) e o
  mecanismo de auditoria administrativa já existente (`AuditLog` via
  `logPlatformAudit`, `@repo/provisioning` — não `AccessLog`, que é só
  eventos de sessão) — não introduz um sistema de auditoria novo.
- Migration de schema e de dado é responsabilidade do Alicerce; esta spec
  não prescreve o SQL/Prisma da migration, só o resultado observável.
