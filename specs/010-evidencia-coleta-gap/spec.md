# Feature Specification: Ver evidência a partir de Coleta e do gap (Meridian A3)

**Feature Branch**: `010-evidencia-coleta-gap`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "spec do Meridian A3 (decisão D-19 do Norte, confirmada pelo CEO em 29/09; detalhe em docs/produto/meridian-escopo-dogfood-a3-a5.md). Escopo mínimo: o botão Ver evidência (EvidenceButton; hoje em tab-scoring.tsx e no painel de divergência) aparece também onde a tela mostra 'N anexos' em Coleta e no gap; sem prévia nem download em lote; evidência eliminada pela retenção aparece sem botão. Mesma action requestEvidenceUrl (audita antes da URL), mesma permissão meridian.evidence.read. Critério de aceite testável, incluindo M8 provando evidence.read a partir de Coleta e do gap, e o caso sem permissão (403)."

## Nota de compliance — parecer do Lacre incorporado

`docs/produto/meridian-escopo-dogfood-a3-a5.md` (§ A3) previu que, se a spec passasse a mostrar o nome do arquivo em lugar novo como lista, isso passaria pelo Lacre antes de dev. FR-001 e FR-002 pedem exatamente essa lista em Coleta e no gap. O Lacre deu parecer; FR-006, FR-010 e o novo FR-011 abaixo incorporam as condições dele. Gate cumprido — segue para implementação.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultor abre evidência a partir da aba Coleta (Priority: P1)

Um consultor está na aba Coleta de um assessment e quer conferir o arquivo que um respondente anexou a uma resposta. Hoje só vê "N evidência(s) anexada(s)" — um número, sem caminho para o arquivo. Ele precisa abrir cada evidência anexada ao assessment, uma de cada vez, sem sair da aba Coleta.

**Why this priority**: É a metade do atrito original (A3) e a superfície onde o consultor passa a maior parte do tempo durante a coleta. Sem isto, o número de evidências é decorativo.

**Independent Test**: Num assessment com pelo menos duas evidências anexadas, abrir a aba Coleta, localizar a lista de evidências no lugar do número atual, e abrir cada uma pelo botão — cada clique deve levar ao arquivo correto.

**Acceptance Scenarios**:

1. **Given** um assessment com evidências anexadas em mais de um eixo, **When** o consultor (papel CONSULTANT ou REVIEWER) abre a aba Coleta, **Then** cada evidência aparece individualmente, com um botão para abrir, no lugar de só uma contagem.
2. **Given** a lista de evidências em Coleta, **When** o consultor clica no botão de uma evidência, **Then** o sistema audita o acesso e abre o arquivo numa aba nova, do mesmo jeito que já funciona na aba Scoring & Revisão.
3. **Given** um assessment sem nenhuma evidência anexada, **When** o consultor abre a aba Coleta, **Then** a tela não mostra nenhum botão de evidência nem lista vazia confusa — mostra que não há evidência, como hoje.

---

### User Story 2 - Consultor abre evidência a partir do gap (Priority: P1)

Um consultor está olhando um gap no registro e quer conferir a evidência do assessment de origem que sustenta aquele achado. Hoje só vê "N anexos" — mesmo problema de Coleta, telas diferentes.

**Why this priority**: É a outra metade do atrito original (A3); sem isto, "medido" vs. "declarado" na escala de confiança não é verificável a partir do gap.

**Independent Test**: Abrir um gap cujo assessment de origem tem evidência anexada, localizar a lista de evidências no lugar do número atual, e abrir cada uma pelo botão.

**Acceptance Scenarios**:

1. **Given** um gap cujo assessment de origem tem evidências anexadas, **When** o consultor (CONSULTANT ou REVIEWER) abre o detalhe do gap, **Then** cada evidência do assessment de origem aparece individualmente, com um botão para abrir, no lugar de só a contagem.
2. **Given** a lista de evidências no gap, **When** o consultor clica no botão de uma evidência, **Then** o sistema audita o acesso e abre o arquivo numa aba nova — mesma action, mesma permissão, mesmo comportamento de Coleta e de Scoring.
3. **Given** um gap cujo assessment de origem não tem evidência, **When** o consultor abre o detalhe, **Then** a tela mantém a mensagem atual ("achado vale como declaração, não como medição") sem nenhum botão de evidência.

---

### Edge Cases

- **Evidência eliminada pela retenção.** Em Coleta e no gap, uma evidência que já foi eliminada pela política de retenção (90 dias após o fechamento do assessment) aparece marcada como eliminada, sem botão ativo — o consultor nunca chega a clicar em algo que só vai falhar.
- **Usuário sem a permissão `evidence.read` (papel VIEWER).** Em nenhuma das duas telas o botão de abrir evidência aparece para quem não tem a permissão — não é uma questão de o clique falhar depois, é o botão nunca existir na tela dessa pessoa.
- **Chamada direta à action sem permissão.** Mesmo que alguém contorne a tela e chame a leitura de evidência diretamente sem ter `evidence.read`, o servidor recusa com 403 — a tela é a segunda linha de defesa, não a primeira.
- **Assessment com muitas evidências.** A lista em Coleta ou no gap não faz prévia nem paginação especial fora do que a tela já usa para outras listas — só abre um arquivo por vez, nunca todos de uma vez.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A aba Coleta MUST listar as evidências anexadas ao assessment individualmente (não apenas uma contagem agregada), de forma que cada uma seja identificável e abrível separadamente.
- **FR-002**: O registro de gap MUST listar as evidências do assessment de origem individualmente (mesmo escopo da contagem já existente — o assessment inteiro, sem filtrar por eixo), de forma que cada uma seja identificável e abrível separadamente.
- **FR-003**: Cada evidência listada em Coleta e no gap MUST ter um controle que, ao ser ativado, solicita a mesma leitura auditada já usada na aba Scoring & Revisão (URL assinada de curta duração) e abre o arquivo.
- **FR-004**: O sistema MUST continuar registrando a trilha de auditoria de leitura de evidência antes de emitir a URL, sem alterar esse comportamento já existente.
- **FR-005**: O sistema MUST recusar a emissão de URL para evidência eliminada pela política de retenção, como já faz hoje, e a tela MUST refletir esse estado (evidência eliminada, sem controle ativo) tanto em Coleta quanto no gap.
- **FR-006**: O sistema MUST ocultar o controle de abrir evidência, em Coleta e no gap, para qualquer usuário sem a permissão de leitura de evidência; para esse usuário, a lista MUST mostrar apenas a contagem de evidências, sem exibir nome de arquivo algum (parecer do Lacre).
- **FR-007**: O servidor MUST continuar recusando qualquer solicitação de leitura de evidência de um usuário sem a permissão correspondente, independentemente do que a tela exibir.
- **FR-008**: O sistema MUST NOT oferecer prévia do conteúdo da evidência em nenhuma tela — a leitura sempre abre o arquivo original, nunca renderiza o conteúdo inline.
- **FR-009**: O sistema MUST NOT oferecer download em lote de mais de uma evidência por vez.
- **FR-010**: O sistema MUST NOT introduzir nenhum registro (auditoria, exportação ou outra superfície) que grave o nome do arquivo da evidência além do que já é gravado hoje. O nome exibido na lista MUST NOT ser usado como alvo, diff ou metadado do evento de leitura de evidência — que continua identificando a evidência pelo id — nem aparecer em parâmetro de URL, log ou exportação (parecer do Lacre).
- **FR-011**: O nome do arquivo exibido em Coleta e no gap MUST ser renderizado como texto escapado (nunca interpretado como HTML/markup) e com truncamento visual quando exceder o espaço disponível na tela (parecer do Lacre).

### Key Entities

Nenhuma entidade nova. Reaproveita a evidência já modelada no Meridian (identificador, arquivo, estado de retenção) e a permissão de leitura já existente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um consultor com a permissão de leitura de evidência abre qualquer evidência anexada a partir da aba Coleta em até dois cliques, sem sair da tela.
- **SC-002**: Um consultor com a permissão de leitura de evidência abre qualquer evidência anexada a partir de um gap em até dois cliques, sem sair da tela.
- **SC-003**: 100% dos acessos a evidência originados em Coleta e no gap aparecem na trilha de auditoria como leitura de evidência, verificável por amostragem.
- **SC-004**: Nenhum usuário sem a permissão de leitura de evidência vê o controle de abrir evidência, em nenhuma das duas telas — verificável para o papel sem essa permissão.
- **SC-005**: Nenhuma evidência eliminada pela política de retenção oferece, em Coleta ou no gap, um controle que leve a um erro — o estado eliminado é visível antes do clique, em 100% dos casos amostrados.

## Assumptions

- A lista de evidências em Coleta substitui a contagem agregada atual ("N evidência(s) anexada(s)") no mesmo lugar da tela, seguindo o mesmo padrão visual já usado no painel de divergência da aba Scoring & Revisão (um controle por evidência, com o nome do arquivo como rótulo).
- No gap, a lista de evidências mantém o mesmo escopo da contagem atual — todas as evidências do assessment de origem, sem filtrar por eixo ou por pergunta — porque estreitar esse escopo não foi pedido e mudaria o que "N anexos" já significa hoje.
- Ocultar o controle por falta de permissão é requisito só para as duas telas desta spec (Coleta e gap). O painel de divergência da aba Scoring & Revisão, que já expõe o mesmo controle sem checar permissão no cliente, não é alterado por esta spec — fica registrado como achado relacionado, não como requisito.
- A dependência entre gaps e o ajuste de severidade/esforço sem tela (atrito A5, decisão D-20) é item separado, adiado, e não faz parte desta spec.
