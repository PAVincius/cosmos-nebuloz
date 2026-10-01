# Feature Specification: Overlay do cliente pela tela (D-28, PR 2)

**Feature Branch**: `016-scaffold-overlay-cliente`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: segundo de três PRs do Scaffold (D-28, `docs/produto/scaffold-prd.md` §10, commit `7fdcdadd`). Tela da consultora para criar e editar overlay (passo, entregável, critério), aplicando as regras da D-24 §7.7; paga o débito do overlay de critério, que passa a ter efeito real no gate. Prazo: `github/main` até 2026-10-31.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultora customiza a trilha de um cliente pela tela (Priority: P1)

Uma consultora abre a trilha de um cliente e, sem chamar nenhuma action diretamente, substitui o enunciado de um passo, renomeia o título de um entregável, e remove um entregável que não se aplica àquele cliente — tudo pela interface, com as mesmas regras que o servidor já aplica.

**Why this priority**: É o mecanismo em si. Sem tela, overlay só existe para quem sabe chamar a action — não é uma capacidade do produto, é uma capacidade do banco.

**Independent Test**: Recriar, pela tela, o overlay completo do caso Atlas (REPLACE de passo, REPLACE de título de entregável, REMOVE de um entregável obrigatório com motivo) e conferir que o resultado bate com o que a action produziria.

**Acceptance Scenarios**:

1. **Given** a trilha de um cliente, **When** a consultora substitui (REPLACE) o enunciado de um passo ou o título de um entregável pela tela, **Then** a mudança é salva e passa a valer para essa trilha.
2. **Given** um entregável não obrigatório, **When** a consultora o remove pela tela com um motivo, **Then** a remoção é aceita.
3. **Given** um entregável obrigatório, **When** um usuário sem o papel consultor tenta removê-lo pela tela, **Then** a opção não é oferecida, ou a tentativa é recusada — nunca só o clique falhando depois sem explicação.
4. **Given** o mesmo entregável obrigatório, **When** a consultora o remove pela tela com motivo, **Then** a remoção é aceita e a instância correspondente aparece como dispensada, nunca como inexistente.
5. **Given** um overlay que tentaria remover o único passo produtor de um entregável obrigatório sem dispensar esse entregável, **When** salvo pela tela, **Then** a tela mostra a mesma recusa que o servidor já produz, com o motivo.
6. **Given** um overlay salvo com sucesso, **When** reaberto na tela, **Then** mostra as operações já aplicadas, editáveis.

---

### User Story 2 - Overlay de critério passa a valer no gate (Priority: P1)

Uma consultora ajusta, pela tela, um critério de gate de uma fase para um cliente específico. A partir dali, fechar aquela fase exige o critério como a consultora definiu — não mais o critério padrão da versão, ignorando a customização.

**Why this priority**: É o débito registrado desde a spec da Fundação (`specs/013-scaffold-ai-readiness-foundation`, FR-021b): aceitar a operação calado faria o cliente achar que ajustou o gate enquanto o gate continuava o da versão. Pagar isso junto com a tela evita construir a tela recusando e refazê-la depois.

**Independent Test**: Criar um overlay de critério numa trilha, fechar a fase correspondente, e conferir que a avaliação usa o critério customizado, não o da versão.

**Acceptance Scenarios**:

1. **Given** uma trilha com overlay que substitui o enunciado de um critério de gate, **When** a fase correspondente é avaliada para fechar, **Then** a lista de critérios usada é a da versão **com o overlay aplicado**, não a versão crua.
2. **Given** o mesmo overlay, **When** criado ou editado pela tela, **Then** a operação de critério é aceita — a recusa provisória que existia (spec 013, FR-021b) deixa de valer.
3. **Given** uma trilha sem overlay, **When** a fase é avaliada, **Then** o comportamento é idêntico ao de hoje — a mudança só afeta quem tem overlay.

---

### Edge Cases

- **Overlay existente de antes desta entrega, com operação de critério já salva** (aceita na época, mas sem efeito): passa a ter efeito assim que este PR entra — nenhuma migração de dado é necessária, porque a operação já estava salva, só não era lida.
- **Conflito entre overlay de critério e uma versão nova do template**: segue o mesmo fluxo de conflito que já existe para passo e entregável — aparece para resolução, não falha silenciosamente.
- **Mais de uma operação sobre o mesmo entregável ou critério no mesmo overlay**: a tela reflete o resultado final já mesclado, não cada operação isolada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A tela de overlay MUST permitir criar e editar operações dos três alvos já suportados pelo mecanismo (passo, entregável, critério) para a trilha de um cliente.
- **FR-002**: A tela MUST aplicar exatamente as regras já decididas (D-24 §7.7): REPLACE de passo ou de título de entregável livre; REMOVE de entregável não obrigatório com motivo; REMOVE de entregável obrigatório restrito ao papel consultor, sempre com motivo.
- **FR-003**: A tela MUST usar a validação já existente (`validateOverlay`) para recusar ou sinalizar uma operação inválida, sem duplicar essa regra no cliente.
- **FR-004**: A opção de remover um entregável obrigatório MUST não aparecer, ou ser claramente recusada, para quem não tem o papel consultor — não apenas falhar no servidor sem explicação na tela.
- **FR-005**: O fechamento de uma fase MUST ler os critérios de gate da versão com o overlay da trilha aplicado, quando houver overlay associado — substituindo a leitura direta da versão crua que existe hoje.
- **FR-006**: Criar ou editar uma operação de overlay com alvo "critério de gate" MUST deixar de ser recusado — a restrição provisória (spec 013, FR-021b) é removida por esta entrega.
- **FR-007**: Uma trilha sem overlay associado MUST continuar avaliando o gate exatamente como hoje — a mudança é aditiva, não altera o caminho sem overlay.

### Key Entities

Nenhuma entidade nova. A tela opera sobre `ScaffoldTemplateOverlay` (já existente) e o motor `validateOverlay`/`applyOverlay` (já existente, já com os três alvos). O único código novo além da tela é o fechamento de fase passar a aplicar o overlay antes de avaliar os critérios.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma consultora recria, só pela tela, o overlay completo do caso Atlas (substituir passo, substituir título, dispensar entregável obrigatório com motivo).
- **SC-002**: Um overlay de critério de gate muda, de fato, o que o gate exige para fechar — verificável comparando o resultado da avaliação com e sem o overlay.
- **SC-003**: Toda tentativa de remover um entregável obrigatório por quem não é consultor é recusada ou indisponível na tela, em 100% dos casos testados.
- **SC-004**: Nenhum teste pré-existente do Scaffold fica vermelho depois desta entrega.

## Assumptions

- Esta entrega depende do PR 1 (`specs/015-scaffold-operar-trilha`) estar em `github/main` antes de abrir, por sequência de produto — não por dependência técnica de PR aberto.
- O mecanismo de overlay em si (três alvos, validação, aplicação) já existe; esta spec é sobre expor esse mecanismo numa tela e sobre o gate passar a respeitar o alvo "critério".
