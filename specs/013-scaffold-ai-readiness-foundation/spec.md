# Feature Specification: Trilha "Fundação de Prontidão de IA" no Scaffold (D-24)

**Feature Branch**: `013-scaffold-ai-readiness-foundation`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: pedido do CEO via Morgana e Norte — trilha do Scaffold derivada do diagnóstico do Meridian (faixas por eixo, arquétipos, molde `ai-readiness-foundation`, overlay de entregável, cliente fictício Atlas). Decisão D-24, detalhada em `docs/produto/trilhas/framework-no-scaffold.md` §7 (commit `643532a2`) e no briefing `.maestri/briefings/2026-09-30-scaffold-ai-readiness-foundation.md`. Entra num PR único do Andaime (cherry-pick de `537d8da1` e `643532a2`), sem depender de outro PR não mergeado, com os testes junto.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Meridian traduz score em faixa e arquétipo (Priority: P1)

Uma consultora fecha um assessment do Meridian e quer saber, sem fazer conta, o que aquele conjunto de cinco scores significa: qual eixo está bem, qual está fraco, e que padrão isso forma — não como nota, como instrução de por onde começar.

**Why this priority**: Sem faixa e arquétipo, a trilha de framework (US2) não sabe qual trilha sugerir nem o que priorizar no A1. É o dado de entrada de tudo o mais nesta spec.

**Independent Test**: Rodar a função de faixas e arquétipos sobre um conjunto de cinco scores/confianças conhecido e conferir a faixa de cada eixo, a marca de confiança e o arquétipo dominante + traços.

**Acceptance Scenarios**:

1. **Given** um eixo com score 39, 40, 59, 60, 79 ou 80, **When** a faixa é calculada, **Then** o resultado é Inicial, Em formação, Em formação, Estruturado, Estruturado e Maduro, respectivamente — as fronteiras (0-39, 40-59, 60-79, 80-100) valem exatamente nos limites.
2. **Given** um eixo com confiança menor que 0,6, **When** exibido, **Then** o eixo aparece marcado "não confiável", mantendo a faixa que o score indicaria — a marca soma, não substitui.
3. **Given** os cinco eixos de um assessment, **When** mais de um arquétipo casa ao mesmo tempo, **Then** o dominante é o primeiro que casar nesta ordem: Pronto para escalar, Uniformemente baixo, Piloto sem chão, Dado sem uso, Cautela travada — e os demais que casarem (inclusive Governança de papel e Campeão isolado, que dependem de pergunta) entram como traço secundário, nesta ordem entre si: Campeão isolado antes de Governança de papel (Pessoas trava a adoção no PILOT; governança é do EMBED — os traços seguem a ordem da trilha).
4. **Given** a pergunta Q-G01 (política) normalizada ≥ 0,60 (alta) e as perguntas Q-G02 (comitê) e Q-G03 (controle de acesso) normalizadas < 0,40 (baixa), **When** os arquétipos são avaliados, **Then** "Governança de papel" casa.
5. **Given** a pergunta Q-E03 (distribuição) normalizada < 0,40, ou o eixo Pessoas com confiança < 0,6, **When** os arquétipos são avaliados, **Then** "Campeão isolado" casa.
6. **Given** nenhum dos sete arquétipos casar, **When** exibido, **Then** o resultado é "sem arquétipo dominante" — o sistema não aproxima nem inventa um.
7. **Given** o arquétipo dominante e os traços de um assessment, **When** o relatório é aberto, **Then** a faixa de cada eixo (com a marca de confiança, quando houver) e o arquétipo aparecem no relatório.

---

### User Story 2 - Molde global instancia a trilha completa, sem forma de trabalho (Priority: P1)

Uma consultora cria uma trilha a partir do molde "Fundação de Prontidão de IA" para um cliente cujo diagnóstico do Meridian já saiu. A trilha precisa nascer com as quatro fases, os entregáveis certos (alguns condicionais ao próprio diagnóstico) e continuar fechando gate normalmente — mesmo sem ter uma forma de trabalho como as outras trilhas do Scaffold.

**Why this priority**: É a trilha em si — sem ela instanciar e fechar gate, o resto (US1, US3, US4) não tem onde acontecer.

**Independent Test**: Criar uma trilha a partir do molde `ai-readiness-foundation` para um assessment de origem conhecido, e conferir que as quatro fases, os 16 entregáveis e os critérios de gate nascem certos, incluindo a condição do A2 e o gate novo do A4.

**Acceptance Scenarios**:

1. **Given** o molde global `ai-readiness-foundation` (key minúscula com hífen, versão `v1.0`, autor "método Nebuloz", sem forma de trabalho), **When** uma trilha nasce dele a partir de um assessment do Meridian, **Then** as quatro fases (ASSESS, PILOT, SCALE, EMBED) instanciam com os passos e os dezesseis entregáveis do molde, sem exigir nenhum módulo contratado.
2. **Given** essa trilha é de prontidão (molde sem forma de trabalho), **When** criada sem um assessment de origem, **Then** a criação é recusada — trilha de prontidão exige assessment de origem; trilha por forma de trabalho continua podendo ser criada sem ele.
3. **Given** um assessment de origem pertencente a outro tenant, **When** alguém tenta criar a trilha apontando para ele, **Then** a criação é recusada.
4. **Given** um assessment de origem em que nenhum eixo tem confiança menor que 0,6, **When** a trilha nasce, **Then** o entregável A2 (ata do workshop liderança-operação) nasce dispensado, com motivo do sistema.
5. **Given** um assessment de origem em que algum eixo tem confiança menor que 0,6, **When** a trilha nasce, **Then** o entregável A2 nasce obrigatório.
6. **Given** a fase ASSESS dessa trilha, **When** o consultor tenta fechá-la sem caso de negócio assinado, **Then** o gate recusa (SG-04 vale para esta trilha como vale para qualquer outra) — o baseline assinado são os scores por eixo do assessment de origem, com meta de faixa do EMBED.
7. **Given** a mesma fase ASSESS, **When** o consultor tenta fechá-la sem o entregável A4 (política mínima de uso de IA para o piloto) aprovado pelo dono do processo, **Then** o gate recusa — a ASSESS exige SG-04 **e** A4; sem os dois, o PILOT não abre.
8. **Given** a fase PILOT, **When** os baselines operacionais (qualidade de dado, tempo/custo do processo piloto, custo de inferência, participação em capacitação) são registrados, **Then** eles entram como nova versão do caso de negócio — a versão assinada anterior continua imutável.
9. **Given** os critérios de gate da SCALE e do EMBED que citam o Meridian, **When** avaliados, **Then** são de avaliação manual e citam, no próprio texto do critério, o código do reassessment de referência e a faixa exigida — a reavaliação em si é o entregável S3 (SCALE: Dados e Infraestrutura) e o entregável E3 (EMBED: Dados, Governança e Infraestrutura), cada um dentro da fase cujo gate lê aquele score.
10. **Given** os entregáveis E1.1 (carta de governança), E2.1 (inventário) e E2.2 (declaração de aplicabilidade), **When** eles referenciam exigências do catálogo do Charter, **Then** a referência só é aceita se o código já existir num conjunto global do catálogo — publicar a versão do template recusa qualquer referência que não exista.
11. **Given** a tela de criar trilha para o molde de prontidão, **When** o tenant tem um ou mais assessments do Meridian com scoring, **Then** a tela oferece um seletor desses assessments; **When** nenhum assessment do tenant tem scoring ainda, **Then** a tela explica que não há diagnóstico pronto, em vez de recusar com erro genérico.

---

### User Story 3 - Overlay de entregável sem enfraquecer gate em silêncio (Priority: P1)

Um consultor customiza a trilha de um cliente específico: substitui o enunciado de um passo pra bater com o jeito que o cliente trabalha, renomeia um entregável, e remove um entregável que não se aplica àquele cliente ("já temos papéis de dado formais"). Nada disso pode fazer um entregável obrigatório de gate sumir sem deixar rastro.

**Why this priority**: É a diferença entre uma trilha customizável de verdade e um gate que vira formalidade — risco já registrado na spec 002 do Scaffold. Sem esta trava, qualquer overlay poderia esvaziar um gate sem ninguém perceber.

**Independent Test**: Aplicar, sobre a trilha do Atlas, um overlay que substitui um passo, substitui o título de um entregável, e remove um entregável obrigatório — conferir que a remoção só é aceita vinda de um consultor, com motivo, e que a instância fica visível como dispensada.

**Acceptance Scenarios**:

1. **Given** um overlay que substitui (REPLACE) um passo ou o título de um entregável, **When** aplicado, **Then** funciona livremente, do mesmo jeito que já funciona hoje para passo e critério.
2. **Given** um overlay que remove (REMOVE) um entregável NÃO obrigatório, **When** aplicado com motivo, **Then** é aceito livremente.
3. **Given** um overlay que remove um entregável obrigatório, **When** aplicado por alguém que não é consultor, **Then** é recusado.
4. **Given** um overlay que remove um entregável obrigatório, **When** aplicado por um consultor com motivo, **Then** é aceito, e a instância correspondente nasce dispensada — nunca deixa de existir — com o motivo visível na trilha e na fila de supervisão.
5. **Given** um overlay que remove um passo que é o único produtor de um entregável obrigatório, **When** esse mesmo overlay NÃO dispensa esse entregável, **Then** é recusado.
6. **Given** o mesmo caso do item 5, **When** o overlay TAMBÉM dispensa o entregável obrigatório (pela regra do item 4), **Then** a remoção do passo é aceita.
7. **Given** um overlay já salvo contra uma trilha, **When** a trilha é criada a partir de uma versão que tem overlay associado, **Then** o overlay é efetivamente aplicado aos passos e aos entregáveis da trilha nascente — hoje a trilha guarda a referência ao overlay sem aplicá-lo, e esta entrega corrige isso.
8. **Given** uma operação de overlay com alvo "critério de gate", **When** alguém tenta criar ou editar essa operação, **Then** é recusada, com mensagem explicando que overlay de critério ainda não tem efeito no gate — o gate continua lendo os critérios direto da versão, sem passar pelo overlay.
9. **Given** um overlay já existente que tenha uma operação de critério (de antes desta regra), **When** exibido, **Then** aparece marcado como "sem efeito no gate".

---

### User Story 4 - Cliente fictício Atlas prova o mecanismo de ponta a ponta (Priority: P2)

Para demo e para os testes automatizados, existe um cliente fictício (Atlas) cujos scores do Meridian já são conhecidos, para que qualquer pessoa consiga verificar o mecanismo inteiro sem depender de dado real de cliente.

**Why this priority**: Sem um caso de ponta a ponta conhecido, cada revisão (Crivo, Vigia) precisaria recriar cenário do zero. Prioridade P2 porque depende de US1-US3 já existirem.

**Independent Test**: Rodar a função de faixas/arquétipos sobre os scores do Atlas e criar a trilha a partir deles; conferir o arquétipo, a marca de confiança e o overlay descritos.

**Acceptance Scenarios**:

1. **Given** o Atlas com Dados 32 (confiança 0,72), Processo 58 (0,65), Pessoas 47 (0,55), Governança 41 (0,61), Infra 36 (0,80), **When** a faixa e o arquétipo são calculados, **Then** o resultado é arquétipo dominante "Piloto sem chão" com traço secundário "Campeão isolado".
2. **Given** os mesmos scores, **When** exibidos, **Then** o eixo Pessoas aparece marcado "não confiável" (confiança 0,55 < 0,6); nenhum outro eixo recebe essa marca (as demais confianças são ≥ 0,6).
3. **Given** o assessment de origem do Atlas, **When** a trilha nasce, **Then** o entregável A2 nasce obrigatório (Pessoas tem confiança abaixo de 0,6).
4. **Given** o overlay do Atlas (substituir um passo, substituir o título de um entregável, e dispensar "Papéis formais de IA e dados" com o motivo "papéis de dado já existem"), **When** aplicado, **Then** a trilha reflete as três mudanças sem que nenhum gate perca condição de fechar.

---

### Edge Cases

- **Confiança exatamente 0,6** não recebe a marca "não confiável" — o limiar é estritamente menor que 0,6.
- **Pergunta normalizada exatamente 0,40 ou 0,60** segue a mesma convenção das faixas: "baixa" é estritamente menor que 0,40, "alta" é maior ou igual a 0,60.
- **Nenhum arquétipo casa**: "sem arquétipo dominante", e não há traço secundário para exibir.
- **Leitura de confiança do assessment de origem indisponível no momento de criar a trilha**: o entregável A2 nasce obrigatório por padrão (lado mais seguro), e o consultor dispensa manualmente se for o caso — nunca o contrário (nascer dispensado por omissão).
- **Mudança dos códigos de pergunta no template do Meridian** (`Q-G01/02/03`, `Q-E03`): os dois arquétipos que dependem de pergunta (Governança de papel, Campeão isolado) mudam junto, e o teste correspondente precisa mudar também — não é comportamento silencioso.

## Requirements *(mandatory)*

### Functional Requirements — Meridian (faixas e arquétipos)

- **FR-001**: O sistema MUST computar, para cada eixo de um assessment, uma faixa entre Inicial (0-39), Em formação (40-59), Estruturado (60-79) e Maduro (80-100), a partir do score final do eixo (pós-override, quando houver).
- **FR-002**: Quando a confiança de um eixo for menor que 0,6, o sistema MUST marcar esse eixo como "não confiável", em adição à faixa calculada pelo score — a marca não substitui a faixa.
- **FR-003**: O sistema MUST avaliar sete arquétipos nomeados (Uniformemente baixo, Piloto sem chão, Dado sem uso, Governança de papel, Cautela travada, Campeão isolado, Pronto para escalar) contra os cinco eixos de um assessment, usando os limiares "alta" (≥ 0,60) e "baixa" (< 0,40) para score de eixo e, nos dois arquétipos que dependem de pergunta, para o valor normalizado da pergunta.
- **FR-004**: "Piloto sem chão" MUST casar quando Pessoas e Processo tiverem score ≥ 40 e Dados e Infraestrutura tiverem score < 40.
- **FR-005**: "Governança de papel" MUST casar quando a pergunta Q-G01 (política) for alta e as perguntas Q-G02 (comitê) e Q-G03 (controle de acesso) forem baixas.
- **FR-006**: "Campeão isolado" MUST casar quando a pergunta Q-E03 (distribuição) for baixa, ou quando o eixo Pessoas tiver confiança menor que 0,6.
- **FR-007**: Entre os arquétipos que casarem, o dominante MUST ser o primeiro nesta ordem fixa: Pronto para escalar, Uniformemente baixo, Piloto sem chão, Dado sem uso, Cautela travada. Os demais que casarem — incluindo Governança de papel e Campeão isolado — MUST entrar como traço secundário, nesta ordem entre si: Campeão isolado antes de Governança de papel.
- **FR-008**: Quando nenhum arquétipo casar, o sistema MUST indicar "sem arquétipo dominante", sem atribuir um por aproximação.
- **FR-009**: O relatório do assessment MUST exibir a faixa de cada eixo (com a marca "não confiável", quando houver) e o arquétipo dominante com seus traços secundários.

### Functional Requirements — Scaffold (molde da trilha)

- **FR-010**: MUST existir um template global de key `ai-readiness-foundation`, nome "Fundação de Prontidão de IA", versão `v1.0`, autor "método Nebuloz", sem forma de trabalho — o que exige que a forma de trabalho do template deixe de ser obrigatória.
- **FR-011**: Os passos do template MUST guardar a estimativa em minutos como a mediana, em minutos, da faixa de semanas indicada (uma semana equivale a 2.400 minutos), preservando a faixa original em semanas no texto do passo.
- **FR-012**: O template MUST cobrir as quatro fases (ASSESS, PILOT, SCALE, EMBED) com os passos e os dezesseis entregáveis definidos (tipo e quem produz — A1 relatório/CONSULTANT, A2 ata/CONSULTANT condicional, A3 mapa/CONSULTANT, A4 política mínima/OWNER, P1 catálogo de dados/OWNER, P2 ambiente segregado/TECHNICAL, P3 trilhas de capacitação/CONSULTANT, P3 papéis formais/OWNER, S1 portfólio/OWNER, S2 atas de comitê/OWNER, S2 painel de métricas/TECHNICAL, S3 reavaliação do Meridian/CONSULTANT, E1 carta de governança/LEGAL, E2 inventário/TECHNICAL, E2 declaração de aplicabilidade/LEGAL, E3 reavaliação do Meridian/CONSULTANT), nenhum deles exigindo módulo contratado.
- **FR-013**: Na criação da trilha, o entregável A2 (ata do workshop) MUST nascer dispensado automaticamente, com motivo do sistema citando o código do assessment de origem, quando nenhum eixo desse assessment tiver confiança menor que 0,6; caso algum eixo tenha, A2 MUST nascer obrigatório. A dispensa manual de A2 por instância, independente dessa condição, fica para entrega seguinte.
- **FR-013a**: O entregável A4 (política mínima de uso de IA para o piloto, aprovada pelo dono do processo) MUST ser condição do gate da fase ASSESS — sem A4 aprovado, a ASSESS não fecha e o PILOT não abre, em adição à exigência de caso de negócio assinado (FR-015). A4 não substitui o E1 (governança completa do EMBED).
- **FR-014**: Todo critério de gate desta trilha, na primeira versão, MUST ser de avaliação manual; os critérios que dependem do Meridian (SCALE: Dados e Infraestrutura pelo menos Em formação; EMBED: pelo menos Estruturado em Dados, Governança e Infraestrutura) MUST citar, no texto do critério, o código do reassessment de referência.
- **FR-014a**: A reavaliação do Meridian que sustenta esses dois critérios MUST existir como entregável dentro da própria fase cujo gate a lê — S3 na SCALE (eixos Dados e Infraestrutura) e E3 no EMBED (Dados, Governança e Infraestrutura) — usando o vínculo de reavaliação que o Meridian já expõe entre assessments.
- **FR-015**: O fechamento da fase ASSESS desta trilha MUST continuar exigindo caso de negócio assinado, sem exceção; o baseline assinado é os scores por eixo do assessment de origem, com meta de faixa do EMBED.
- **FR-016**: O baseline operacional da fase PILOT (qualidade de dado, tempo/custo do processo piloto, custo de inferência, participação em capacitação) MUST entrar como nova versão do caso de negócio, preservando a versão assinada anterior imutável.
- **FR-017**: Os entregáveis do EMBED MUST poder referenciar exigências do catálogo do Charter por conjunto, versão e código; a publicação da versão do template MUST recusar qualquer referência que não exista, dentro de um conjunto global de origem regulação — sem ampliar esse catálogo nesta entrega. As referências desta versão são: E1.1 (carta de governança) com CL05, CL06, NIST-GOVERN-1 e NIST-MANAGE-1; E2.1 (inventário) com CL04, NIST-MAP-1, NIST-MAP-2 e LGPD-ART37; E2.2 (declaração de aplicabilidade) com CL06. `AIA-09` (dever de fornecedor de IA de alto risco) e `ISO-CL08` (controle operacional, não tratamento de risco) MUST NOT entrar nesta versão — afirmariam obrigação que a trilha, sem distinguir perfil de cliente (F2 fora), não sustenta; voltam com a trilha AI Governance, que tem perfil.
- **FR-017a**: Uma trilha deste molde (sem forma de trabalho — trilha de prontidão) MUST exigir, na criação, um assessment de origem do Meridian; a criação MUST ser recusada sem esse vínculo, e também quando o assessment indicado pertencer a outro tenant. Trilhas por forma de trabalho (com arquétipo) continuam podendo ser criadas sem esse vínculo.
- **FR-017b**: A tela de criar trilha ("Nova trilha") MUST oferecer, para um molde de trilha de prontidão, um seletor dos assessments do Meridian do tenant que já têm scoring (fechados, com score calculado) — nunca um assessment ainda em coleta. Quando o tenant não tiver nenhum assessment elegível, a tela MUST explicar o motivo (não há diagnóstico do Meridian pronto para originar a trilha), em vez de recusar com um erro genérico.

### Functional Requirements — Overlay de entregável

- **FR-018**: O mecanismo de overlay de template MUST passar a suportar um terceiro alvo, "entregável", com a mesma operação de substituição (passo ou título) já disponível para os alvos existentes.
- **FR-019**: Remover, por overlay, um entregável não obrigatório MUST exigir motivo e ser permitido livremente.
- **FR-020**: Remover, por overlay, um entregável obrigatório MUST ser permitido só para o papel consultor, sempre com motivo; a instância correspondente nasce dispensada — nunca deixa de existir — e o motivo MUST ficar visível na trilha e na fila de supervisão.
- **FR-021**: Remover, por overlay, um passo que é o único produtor de um entregável obrigatório MUST ser recusado, a menos que o mesmo overlay também dispense esse entregável pela regra do FR-020.
- **FR-021a**: Ao criar uma trilha a partir de uma versão que tem overlay associado, o overlay MUST ser efetivamente aplicado aos passos e aos entregáveis da trilha nascente — hoje a referência ao overlay é guardada mas não aplicada; esta entrega corrige essa lacuna.
- **FR-021b**: Criar ou editar uma operação de overlay com alvo "critério de gate" MUST ser recusado, com mensagem explicando que overlay de critério ainda não tem efeito no gate (o gate continua lendo os critérios direto da versão). Um overlay já existente com operação de critério MUST ser exibido com uma marca indicando que não tem efeito no gate. Essa restrição é débito técnico com prazo e dono declarados (ver Assumptions) — não é escopo permanente desta spec.

### Functional Requirements — Seed e validação

- **FR-022**: MUST existir um cliente fictício (Atlas) com os cinco scores e confianças descritos, usado para seed de demonstração e para os testes de ponta a ponta desta trilha.
- **FR-023**: Esta entrega MUST NOT derrubar nenhum teste já existente do Scaffold ou do Meridian.

### Key Entities

- **Faixa de eixo** e **arquétipo dominante + traços secundários**: conceitos novos, calculados por função pura sobre os scores e confianças que o Meridian já produz — não são entidades de banco novas.
- **Molde `ai-readiness-foundation`**: instância dos modelos já existentes do Scaffold (template, versão, passo, entregável, critério de gate) — nenhuma tabela nova.
- **Referência a exigência do Charter no entregável**: reaproveita o mecanismo de referência sem chave estrangeira já decidido para o Scaffold (conjunto, versão, código), restrito ao entregável E1 e a códigos já existentes no catálogo.
- **Vínculo da trilha com o assessment de origem** (novo): referência sem chave estrangeira do Meridian, do mesmo jeito que a trilha já referencia um gap de origem — obrigatória para trilha de prontidão, opcional para trilha por forma de trabalho.
- **Cliente fictício Atlas**: dado de seed, não entidade de produto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: As faixas calculadas nas fronteiras exatas (39/40, 59/60, 79/80) caem sempre no lado correto, em 100% das execuções.
- **SC-002**: O eixo Pessoas do Atlas (confiança 0,55) aparece marcado "não confiável" no relatório, mantendo a faixa correspondente ao seu score.
- **SC-003**: O Atlas classifica com arquétipo dominante "Piloto sem chão" e traço secundário "Campeão isolado", de forma determinística — mesmo resultado em repetições sobre os mesmos dados.
- **SC-004**: Uma trilha criada a partir do molde `ai-readiness-foundation` fecha as quatro fases, incluindo os dois gates que citam o Meridian e o gate novo do A4 na ASSESS, sem exigir nenhuma forma de trabalho declarada.
- **SC-005**: Toda tentativa de remover, por overlay, um entregável obrigatório por alguém que não é consultor é recusada, em 100% das tentativas testadas.
- **SC-006**: Toda referência de exigência do Charter que não existe no catálogo é recusada na publicação da versão, em 100% das tentativas.
- **SC-007**: Nenhum teste pré-existente do Scaffold ou do Meridian fica vermelho depois desta entrega.
- **SC-008**: Toda tentativa de criar uma trilha de prontidão sem assessment de origem, ou com assessment de outro tenant, é recusada, em 100% das tentativas testadas; uma trilha por forma de trabalho continua sendo criada sem esse vínculo.
- **SC-009**: Um overlay associado a uma versão é efetivamente aplicado em 100% das trilhas criadas a partir dela — nenhuma trilha nasce com overlay "guardado mas não aplicado".
- **SC-010**: Um tenant sem assessment do Meridian com scoring recebe, ao tentar criar a trilha de prontidão, uma explicação do motivo — nunca um erro genérico — em 100% dos casos testados.

## Assumptions

- F2 (perfil de organização, da decisão D-23) não entra nesta trilha — a variação por cliente é só por overlay, como no caso do Atlas.
- Ampliação do catálogo do Charter (PL 2338, artigos específicos do AI Act, Anexo A da ISO) fica para a trilha de apoio "AI Governance", sob responsabilidade do Lacre — fora desta entrega.
- Avaliação automática (derivada do score do Meridian) de critério de gate fica para quando existir a costura Meridian → Scaffold de leitura do reassessment ligado à trilha — revisão programada para quando três trilhas deste molde chegarem à fase SCALE, ou em 2026-12-15, o que vier primeiro.
- Se os códigos de pergunta do template do Meridian mudarem, a regra dos dois arquétipos que dependem de pergunta (Governança de papel, Campeão isolado) muda junto, com teste correspondente atualizado.
- Esta entrega vai num único PR, com migration, seed, overlay, função de faixas/arquétipos e testes juntos — sem depender de nenhum outro PR aberto.
- **Catálogo de moldes do Scaffold limitado a 9** (D-25) — decisão de produto/governança, não requisito técnico desta spec: um décimo molde passa pelo CEO antes de existir. Esta trilha é um dos moldes do grupo "Prontidão"; variação por arquétipo que não está no §7.6 (ex.: arranque executivo para Uniformemente baixo) fica para versão seguinte do template, não entra nesta entrega.
- **Meridian assistido e item de `Service` para operação assistida** (D-27, itens a e c) ficam fora desta spec — entram sem schema novo (habilitação de módulo + papel) e num PR próprio do back-office, depois deste. Só o vínculo `sourceAssessmentId` (item b) entra aqui.
- **Débito do overlay de critério de gate** (FR-021b) tem prazo para ser pago: até 2026-10-31, dono Andaime/Bussola com a Regua para a spec correspondente. Até lá, a recusa de criar/editar operação de critério por overlay é o comportamento correto, não um bug.
- **Estimativas de A4 (1 semana), S3 e E3 (2 semanas cada)** são hipótese do CPO, sem medição — o proposta original do CEO não cobre esses passos. O texto do passo precisa dizer isso, e os valores se calibram no primeiro uso real.
