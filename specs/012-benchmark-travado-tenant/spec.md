# Feature Specification: Benchmark do Meridian travado por tenant

**Feature Branch**: `012-benchmark-travado-tenant`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Decisão do CEO de 29/09: benchmark do Meridian desligado no 1º contrato E travado no produto. Regra completa no PR #294, PRD §10 'Benchmark travado por tenant' (d9062595). (1) habilitação de benchmark por tenant, default desligada; (2) só staff Nebuloz liga, no back-office (ficha do cliente), com a referência do aditivo (DPA §2.1) obrigatória e auditoria; nenhum papel do tenant cliente mexe; (3) ligada, o opt-in continua por assessment como hoje; (4) o servidor recusa: createAssessment com benchmarkOptIn=true e habilitação off volta erro, e runScoring/contributeToBenchmark não contribui com a habilitação off, mesmo com opt-in antigo; (5) tenant interno segue a regra, sem exigir aditivo. Critério de pronto: caixa escondida com a habilitação off; action direta recusa; opt-in antigo não contribui."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff Nebuloz liga a habilitação de benchmark de um cliente (Priority: P1)

Um cliente assina o aditivo contratual que autoriza sua organização a contribuir para o benchmark anônimo do Meridian. Um membro da equipe Nebuloz, no back-office, abre a ficha desse cliente e liga a habilitação de benchmark, informando a referência do aditivo assinado.

**Why this priority**: É a única porta de entrada para qualquer contribuição de benchmark passar a ser possível para um tenant cliente. Sem esta tela, a trava do lado do produto (US2) não tem como ser desfeita de forma legítima nunca.

**Independent Test**: Com um tenant cliente sem habilitação, um usuário staff Nebuloz abre a ficha do cliente no back-office, liga a habilitação informando uma referência de aditivo, e confirma que a mudança fica registrada com autor, data e a referência informada.

**Acceptance Scenarios**:

1. **Given** um tenant cliente sem habilitação de benchmark, **When** um staff Nebuloz liga a habilitação na ficha do cliente informando a referência do aditivo, **Then** a habilitação passa a ligada e a mudança fica auditada com ator, data/hora e a referência.
2. **Given** a tela de ligar habilitação para um tenant cliente (externo), **When** o staff tenta confirmar sem informar a referência do aditivo, **Then** o sistema recusa e explica que a referência é obrigatória.
3. **Given** um tenant marcado como interno (`isInternalTenant`), **When** um staff Nebuloz liga a habilitação desse tenant, **Then** o sistema liga sem exigir referência de aditivo.
4. **Given** uma habilitação já ligada, **When** um staff Nebuloz desliga a habilitação na mesma ficha, **Then** a mudança também fica auditada, com ator e data/hora.

---

### User Story 2 - Nenhuma contribuição acontece sem a habilitação ligada (Priority: P1)

Um consultor de um tenant cliente sem habilitação de benchmark está criando ou já tem assessments em andamento. Em nenhum momento — nem na criação, nem no fechamento da coleta, nem por um registro antigo — uma contribuição chega a entrar na coorte anônima.

**Why this priority**: É a trava em si. Sem isto, a habilitação da User Story 1 é só decoração — o produto continuaria a deixar qualquer consultor ligar o opt-in e contribuir, exatamente como hoje.

**Independent Test**: Com um tenant sem habilitação, tentar criar um assessment com opt-in de benchmark marcado (pela tela e por chamada direta) e confirmar que os dois caminhos recusam; separadamente, rodar o scoring de um assessment antigo que já tinha opt-in marcado antes da habilitação existir, e confirmar que nenhuma contribuição é gravada.

**Acceptance Scenarios**:

1. **Given** um tenant sem habilitação de benchmark, **When** a tela de criar assessment é aberta, **Then** a opção de opt-in de benchmark não aparece.
2. **Given** um tenant sem habilitação de benchmark, **When** alguém solicita a criação de um assessment com o opt-in de benchmark marcado, diretamente e não pela tela, **Then** o sistema recusa a criação.
3. **Given** um assessment com opt-in de benchmark marcado, pertencente a um tenant cuja habilitação está desligada no momento do fechamento da coleta, **When** o scoring é executado, **Then** nenhuma contribuição desse assessment entra na coorte.
4. **Given** um tenant cuja habilitação foi desligada depois de ter estado ligada, **When** um assessment desse tenant com opt-in antigo tem seu scoring recalculado, **Then** nenhuma contribuição nova é gravada — desligar a habilitação bloqueia contribuição futura, independentemente do opt-in gravado no assessment.

---

### User Story 3 - Com a habilitação ligada, nada muda para o consultor (Priority: P2)

Um consultor de um tenant cliente cuja habilitação de benchmark já está ligada continua decidindo, assessment a assessment, se aquele diagnóstico específico contribui para a coorte — exatamente como faz hoje.

**Why this priority**: Garante que a trava por tenant não vira uma segunda camada de trabalho manual para quem já usa o opt-in corretamente. É o "nada muda" que prova que a mudança é aditiva, não uma regressão.

**Independent Test**: Com um tenant cuja habilitação está ligada, abrir a tela de criar assessment e confirmar que a opção de opt-in aparece e funciona como hoje — marcar, desmarcar, e o scoring respeita a escolha.

**Acceptance Scenarios**:

1. **Given** um tenant com habilitação de benchmark ligada, **When** o consultor abre a tela de criar assessment, **Then** a opção de opt-in aparece, desmarcada por padrão, e o consultor decide livremente.
2. **Given** um assessment com opt-in marcado, de um tenant com habilitação ligada, **When** o scoring é executado, **Then** a contribuição é gravada, sem diferença de comportamento em relação a hoje.

---

### User Story 4 - A leitura do benchmark também respeita a habilitação (Priority: P1)

Um consultor de um tenant sem habilitação de benchmark abre o relatório de um assessment, ou tenta consultar a lista de coortes. Em nenhum lugar aparece qualquer dado do pool anônimo — a trava não é só sobre contribuir, é também sobre ver o que outros contribuíram.

**Why this priority**: Sem isto, a trava de contribuição (US2) protegeria a entrada do pool mas deixaria a saída aberta — um tenant sem habilitação ainda enxergaria a coorte alimentada por quem tem. É a mesma decisão do CEO, só que do outro lado da leitura.

**Independent Test**: Com um tenant sem habilitação, abrir o relatório de um assessment desse tenant e confirmar que o bloco de benchmark não aparece; separadamente, chamar a listagem de coortes e a leitura de uma coorte específica diretamente, e confirmar que as duas recusam.

**Acceptance Scenarios**:

1. **Given** um tenant sem habilitação de benchmark, **When** o relatório de um assessment desse tenant é aberto, **Then** o relatório não mostra o bloco de comparação com benchmark — nem retido, nem com percentil — o bloco inteiro fica ausente, não apenas vazio.
2. **Given** um tenant sem habilitação de benchmark, **When** alguém solicita a lista de coortes ou a leitura de uma coorte específica, diretamente e não pela tela, **Then** o sistema recusa, com o mesmo motivo usado para recusar contribuição.
3. **Given** um tenant interno com a habilitação ligada, **When** o relatório é aberto ou a lista de coortes é consultada, **Then** a leitura funciona normalmente, sem diferença de comportamento em relação a hoje.
4. **Given** staff Nebuloz operando pelo back-office, **When** consulta dado de benchmark por essa via, **Then** a trava de habilitação por tenant não se aplica — a regra é sobre a leitura feita a partir de um tenant, não sobre a operação da equipe Nebuloz.

---

### Edge Cases

- **Nenhum papel do tenant cliente liga ou desliga a habilitação** — nem ADMIN, nem CONSULTANT do Meridian, nem qualquer outro papel do tenant. Só staff Nebuloz, e só pelo back-office.
- **Retirar uma contribuição já feita** continua seguindo o fluxo já existente hoje — esta trava não interfere em pedidos de retirada de contribuição.
- **Habilitação desligada com contribuições históricas já gravadas** — as contribuições já feitas antes de desligar não são apagadas automaticamente; só contribuições futuras ficam bloqueadas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST manter uma habilitação de benchmark por tenant, independente do opt-in de cada assessment, desligada por padrão para todo tenant novo.
- **FR-002**: O sistema MUST restringir quem liga ou desliga a habilitação de um tenant a staff da Nebuloz, pelo back-office — nenhum papel do tenant cliente pode alterá-la.
- **FR-003**: Para um tenant que não seja o tenant interno, o sistema MUST exigir a referência de um aditivo contratual antes de aceitar ligar a habilitação.
- **FR-004**: O sistema MUST registrar, para toda mudança de habilitação (ligar ou desligar), o autor, o momento e, quando aplicável, a referência do aditivo informada.
- **FR-005**: O sistema MUST recusar a criação de um assessment com opt-in de benchmark marcado quando a habilitação do tenant estiver desligada.
- **FR-006**: A tela de criar assessment MUST NOT oferecer a opção de opt-in de benchmark quando a habilitação do tenant estiver desligada.
- **FR-007**: O sistema MUST impedir que qualquer assessment contribua para a coorte de benchmark, no momento do cálculo do score, enquanto a habilitação do tenant estiver desligada — mesmo que o assessment tenha o opt-in marcado de um momento em que a habilitação estava ligada.
- **FR-008**: Desligar a habilitação de um tenant MUST bloquear contribuições futuras imediatamente, sem alterar o comportamento já existente de retirada de contribuições já gravadas.
- **FR-009**: Para o tenant interno da Nebuloz, o sistema MUST aplicar a mesma trava de habilitação, mas MUST NOT exigir referência de aditivo para ligá-la.
- **FR-010**: Quando a habilitação de um tenant estiver ligada, a decisão de opt-in MUST continuar sendo tomada por assessment, sem nenhuma mudança no comportamento atual dessa escolha.
- **FR-011**: O relatório de um assessment MUST NOT exibir o bloco de comparação com benchmark quando a habilitação do tenant estiver desligada — o bloco fica ausente, não apenas sem percentil.
- **FR-012**: A listagem de coortes e a leitura de uma coorte específica MUST recusar, no servidor, quando a habilitação do tenant que faz a solicitação estiver desligada, com o mesmo motivo usado para recusar contribuição.
- **FR-013**: A trava de leitura por habilitação (FR-011, FR-012) aplica-se à leitura feita a partir de um tenant do Meridian; MUST NOT restringir o acesso de staff Nebuloz operando pelo back-office.

### Key Entities

- **Habilitação de benchmark do tenant** (nova): estado ligado/desligado por tenant, referência do aditivo contratual (quando o tenant não é interno), e histórico de quem ligou ou desligou e quando. É a porta de fora; o opt-in por assessment (já existente) continua sendo a porta de dentro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Todo tenant cliente novo nasce sem nenhuma superfície que ofereça contribuir para o benchmark, verificável em 100% dos tenants sem habilitação ligada.
- **SC-002**: Toda tentativa de criar um assessment com opt-in de benchmark marcado, num tenant sem habilitação, é recusada pelo sistema — mesmo quando a solicitação não passa pela tela.
- **SC-003**: Nenhuma contribuição de benchmark é gravada para um tenant sem habilitação, mesmo para um assessment com opt-in marcado antes de a habilitação ser desligada — verificável rodando o cálculo do score sobre esse caso.
- **SC-004**: Toda mudança de habilitação (ligar ou desligar) fica registrada com autor e data, verificável por amostragem.
- **SC-005**: Nenhum usuário de um tenant cliente, em qualquer papel, consegue ligar ou desligar a habilitação desse tenant — verificável tentando com o papel mais privilegiado disponível no tenant.
- **SC-006**: Nenhum relatório de um tenant sem habilitação mostra o bloco de comparação com benchmark, em 100% dos casos amostrados.
- **SC-007**: Toda solicitação de listagem ou leitura de coorte, feita por um tenant sem habilitação, é recusada pelo servidor — mesmo quando não passa pela tela.

## Assumptions

- Onde a habilitação é armazenada (no cadastro do tenant, no registro de módulos, ou num modelo novo) fica a critério de quem implementar — esta spec não prescreve.
- Linha no RoPA e aviso ao respondente são pré-requisito de negócio para ligar de verdade a habilitação de um cliente externo, mas são responsabilidade separada (compliance) e não bloqueiam a trava mecânica descrita aqui.
- O cálculo de coorte, percentis e o limiar mínimo de leitura do benchmark (a lógica em si) não muda nesta spec — o que muda é quem tem acesso a ler o resultado desse cálculo.
- Retirar uma contribuição já feita (fluxo já existente) não muda nesta spec.
