# Feature Specification: Meridian V1 · Diagnose

**Feature Branch**: `claude/meridian-design-impl-70bdd2`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: "Meridian V1 (Diagnose) — módulo de assessment de prontidão para IA da suíte Nebuloz, implementado a partir do design meridian.html (Claude Design). Sete telas: Assessments (carteira), Assessment detail com 5 abas (Coleta, Scoring & Revisão, Gap register, Plano 12 meses, Relatório & Benchmark), Fila de revisão global, Benchmark pool, Gap register canônico, Escala de confiança, Visão do respondente. Domínio: 5 eixos (Data, Process, People, Governance, Infrastructure), coleta multi-respondente com link seguro por eixo, scoring determinístico por template imutável, confidence 0-1, status computed|contested|overridden, overrides append-only com rationale >= 20 chars, gap register canônico com cost of delay e DAG de dependências, plano 12 meses por ordenação topológica, benchmark pool anônimo com threshold n>=5 (withheld abaixo), escala de confiança measured|estimated|declared compartilhada com Signal/Scaffold/Cosmos, promoção de gap para outro produto carregando origin_gap_id sem transferir posse, trilha de auditoria em todo acesso a evidência."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultor conduz a carteira de diagnósticos (Priority: P1)

A consultora abre o Meridian e vê toda a carteira de assessments da organização: quantos estão em coleta, quantos eixos ficaram contestados aguardando julgamento dela, quantas evidências foram anexadas. Ela filtra por status, abre um assessment e navega pelas cinco etapas do diagnóstico (coleta, scoring, gaps, plano, relatório) sem sair da tela.

**Why this priority**: Sem a carteira e o detalhe navegável não existe produto — é a superfície onde toda a operação de diagnóstico acontece. Entregar só isto já permite conduzir um assessment de ponta a ponta com dado real.

**Independent Test**: Criar dois assessments em estados diferentes (coletando e em revisão), abrir a lista, conferir os quatro indicadores do topo, filtrar por status e abrir o detalhe de cada um verificando que as cinco abas carregam o conteúdo correspondente ao estado.

**Acceptance Scenarios**:

1. **Given** a organização tem assessments em rascunho, coleta, revisão e finalizado, **When** a consultora abre a carteira, **Then** vê todos com organização, versão de template, progresso de respostas, composite por eixo, prazo e status.
2. **Given** um assessment sem scoring executado, **When** a consultora abre o detalhe, **Then** a aba inicial é Coleta e as abas de scoring, gaps, plano e relatório explicam o que falta em vez de mostrar zeros.
3. **Given** um assessment com eixo contestado, **When** a consultora olha a carteira, **Then** o indicador "eixos contestados" contabiliza esse eixo.
4. **Given** um filtro de status sem resultados, **When** aplicado, **Then** a tela oferece limpar o filtro em vez de mostrar tabela vazia sem saída.

---

### User Story 2 - Coleta multi-respondente por eixo (Priority: P1)

A consultora atribui respondentes aos cinco eixos, cada um recebe um link seguro e só enxerga a bateria de perguntas do seu eixo. Respondentes respondem, anexam evidência e enviam. Lembretes automáticos rodam até a conclusão ou o prazo. A consultora fecha a coleta quando a cobertura é suficiente.

**Why this priority**: Sem coleta não há resposta, e sem resposta não há score. É a entrada de dado do produto inteiro.

**Independent Test**: Atribuir respondentes a três dos cinco eixos, abrir a visão do respondente para um deles, responder a bateria com uma evidência anexada, enviar, e verificar que o progresso da coleta subiu e que os dois eixos sem dono bloqueiam o fechamento.

**Acceptance Scenarios**:

1. **Given** um eixo sem respondente atribuído, **When** a consultora tenta fechar a coleta, **Then** o sistema avisa quais eixos estão sem dono e não fecha.
2. **Given** um respondente com respostas pendentes e prazo vencido, **When** a consultora vê a lista, **Then** ele aparece marcado como atrasado com ação de lembrete.
3. **Given** um respondente do eixo Data, **When** ele abre o link seguro, **Then** vê somente as perguntas do eixo Data e nenhum dado de outro respondente.
4. **Given** um respondente que anexa evidência a uma pergunta, **When** o anexo é salvo, **Then** o arquivo vai para armazenamento segregado por organização e a contagem de evidências do assessment aumenta.
5. **Given** a consultora fecha a coleta com respostas pendentes, **When** confirma, **Then** o sistema registra que a confiança dos eixos afetados cai e prossegue.

---

### User Story 3 - Scoring determinístico e revisão humana com rastro (Priority: P1)

Fechada a coleta, o sistema computa um score 0–100 por eixo com uma confiança 0–1. Eixos com discordância acima do limiar entram como contestados. A consultora abre a divergência lado a lado (quem respondeu o quê, com quais evidências) e, quando o número computado não reflete a prática, registra um override com rationale obrigatório. O score computado nunca é apagado.

**Why this priority**: É a promessa central do produto — número defensável, não opinião. Sem override auditável o relatório não sobrevive à pergunta do patrocinador.

**Independent Test**: Rodar scoring sobre respostas divergentes num eixo, verificar que ele nasce contestado, aplicar override com rationale de 25 caracteres e conferir que o histórico mostra origem, destino, autor e horário, com o computado preservado.

**Acceptance Scenarios**:

1. **Given** as mesmas respostas e a mesma versão de template, **When** o scoring roda duas vezes, **Then** produz exatamente os mesmos scores e as mesmas confianças.
2. **Given** um eixo com dispersão acima do limiar entre respondentes, **When** o scoring termina, **Then** o eixo fica com status contestado e entra na fila de revisão.
3. **Given** um override com rationale de menos de 20 caracteres, **When** a consultora tenta registrar, **Then** o sistema recusa e explica o mínimo.
4. **Given** um override com novo score igual ao computado, **When** a consultora tenta registrar, **Then** o sistema recusa — override sem mudança não é decisão.
5. **Given** um eixo já com override, **When** um novo override é registrado, **Then** ambos aparecem no histórico em ordem, nenhum é sobrescrito.
6. **Given** um eixo com confiança abaixo de 50%, **When** a consultora abre a revisão, **Then** o eixo aparece sinalizado com o motivo e uma ação de cobrar respostas.
7. **Given** um eixo contestado cujo computado a consultora julga correto, **When** ela "confirma o computado" (justificativa de 20+ caracteres), **Then** o eixo sai da fila sem o score mudar, o registro append-only mostra antes e depois iguais, e o relatório passa a mostrar esse eixo como "confirmado pelo revisor" — nunca como "computado" nem como "override".

---

### User Story 4 - Gap register canônico e plano de 12 meses (Priority: P2)

Do scoring nascem gaps: lacunas de capacidade com eixo, severidade, esforço, dono sugerido e custo de atraso. Gaps se ligam entre si num grafo acíclico de dependências. A ordenação topológica desse grafo, bucketizada por trimestre, é o plano de 12 meses. O registro é canônico: atravessa assessments e organizações, e continua sendo do Meridian mesmo quando um gap vira trabalho em outro produto.

**Why this priority**: É o que o cliente leva embora. Depende do scoring existir, por isso vem depois — mas é a entrega de valor visível.

**Independent Test**: Derivar gaps de um assessment com scoring, criar uma dependência entre dois gaps, tentar criar um ciclo (deve ser recusado), gerar o plano e conferir que nenhum item aparece antes de um pré-requisito.

**Acceptance Scenarios**:

1. **Given** dois gaps A e B com A dependendo de B, **When** alguém tenta fazer B depender de A, **Then** o sistema recusa a escrita nomeando o ciclo.
2. **Given** um grafo de gaps sem ciclo, **When** o plano é gerado, **Then** cada gap cai num trimestre igual ou posterior ao de todos os seus pré-requisitos.
3. **Given** o registro canônico com gaps de várias organizações, **When** a consultora filtra por eixo, severidade e estado, **Then** vê apenas os gaps do recorte, ordenados por custo de atraso decrescente.
4. **Given** um gap promovido para outro produto, **When** a consultora o abre, **Then** vê o destino (produto, identificador, rótulo) e a informação de que o enunciado não é editável de lá.
5. **Given** um gap sem destino e sem plano, **When** listado, **Then** aparece como aberto e soma ao indicador de custo de atraso parado.
6. **Given** um gap promovido, **When** o trabalho é criado no produto de destino, **Then** esse trabalho carrega a referência ao gap de origem e o gap permanece no Meridian.

---

### User Story 5 - Relatório, benchmark e diff de reavaliação (Priority: P2)

A consultora entrega ao patrocinador o shape de prontidão (radar dos cinco eixos), a comparação com a coorte de mercado e a narrativa dos gaps de maior custo de atraso. Se a coorte tem menos organizações que o mínimo, a comparação é declarada retida em vez de desenhada. Quando o assessment é uma reavaliação, o relatório mostra o diff contra o run anterior.

**Why this priority**: É a peça de saída que justifica a renovação do engajamento, mas depende de scoring e gaps já existirem.

**Independent Test**: Gerar o relatório de um assessment finalizado cujo setor tem coorte acima do mínimo, conferir radar, bandas de percentil e narrativa; repetir para um setor com coorte abaixo do mínimo e conferir a declaração de retenção.

**Acceptance Scenarios**:

1. **Given** uma coorte com menos organizações que o mínimo de leitura, **When** o relatório é aberto, **Then** a comparação é declarada retida com o motivo, e nenhum percentil é exibido.
2. **Given** uma coorte acima do mínimo, **When** o relatório é aberto, **Then** cada eixo mostra a banda entre o primeiro e o terceiro quartil, a mediana e a posição da organização.
3. **Given** um eixo com override, **When** o relatório é gerado, **Then** o override aparece marcado como decisão do consultor, com o rationale — nunca escondido.
4. **Given** um assessment que é reavaliação de outro, **When** a consultora pede o diff, **Then** vê a variação por eixo, os gaps resolvidos, os persistentes e o saldo de itens do plano.
5. **Given** um assessment que não é reavaliação, **When** a consultora pede o diff, **Then** o sistema explica que não há run anterior.

---

### User Story 6 - Benchmark pool com opt-in e limiar de leitura (Priority: P3)

Organizações que aceitaram contribuir alimentam coortes anônimas formadas por setor e faixa de tamanho. A leitura só é liberada quando a coorte tem pelo menos o número mínimo de organizações. Nenhuma organização é identificável no pool.

**Why this priority**: É o diferencial de longo prazo, mas o produto funciona sem ele no primeiro cliente.

**Independent Test**: Marcar duas organizações com opt-in e uma sem, rodar scoring nas três, e conferir que só as duas primeiras contribuem e que a coorte permanece retida enquanto estiver abaixo do mínimo.

**Acceptance Scenarios**:

1. **Given** uma organização sem opt-in, **When** seu scoring é finalizado, **Then** os scores não entram em nenhuma coorte.
2. **Given** uma coorte abaixo do mínimo, **When** listada no pool, **Then** aparece como retida com o número de contribuições, e os percentis não são expostos por nenhuma superfície.
3. **Given** uma coorte que cruza o mínimo com uma nova contribuição, **When** recalculada, **Then** passa a estar disponível para leitura.

---

### User Story 7 - Escala de confiança compartilhada (Priority: P3)

Meridian é dono da escala de confiança de achados (medido, estimado, declarado). Cada gap carrega um dos três selos. Os demais produtos da suíte aplicam a mesma escala sem redefinir.

**Why this priority**: Baixo custo, alto valor de coerência — mas não bloqueia nenhum fluxo operacional.

**Independent Test**: Abrir a tela da escala, conferir os três níveis com definição e contagem de gaps em cada um, e conferir que um gap detalhado exibe o selo com a mesma definição.

**Acceptance Scenarios**:

1. **Given** o registro de gaps, **When** a tela da escala é aberta, **Then** mostra os três níveis com definição e a distribuição de gaps por nível.
2. **Given** um gap sem evidência anexada, **When** aberto, **Then** o sistema explica que o achado vale como declaração, não como medição.

---

### User Story 8 - Consultora finaliza o assessment, com travas por estado, e reabre quando precisa (Priority: P1)

A consultora termina a revisão: todo eixo tem score computado, e todo eixo que ficou contestado foi resolvido — por override ou por confirmação do computado. Ela finaliza o assessment. A partir daí, o relatório final e os gaps daquele diagnóstico ficam liberados para o ranking, e o assessment entra num estado protegido: não se decide score de novo, não se mexe em gap nem em plano. Se um erro aparecer depois, ela reabre, corrige, e finaliza de novo.

**Why this priority**: Sem a transição para finalizado, o ranking de gaps nunca tem o que mostrar em produção — nenhum assessment real chega lá hoje. E sem as travas por estado, "finalizado" não impede nada: a mesma lacuna que deixa resposta mudar depois do fechamento da coleta (SC-003) continua aberta.

**Independent Test**: Com um assessment em REVIEW, scoring completo e fila de contestados vazia (por override ou confirmação), finalizar e conferir que override, confirmação, escrita de gap e de plano passam a ser recusados; tentar escrever uma resposta pelo link do respondente depois do fechamento da coleta e conferir que é recusado mesmo com token válido; reabrir com motivo e conferir que volta a REVIEW, não a COLLECTING.

**Acceptance Scenarios**:

1. **Given** um assessment em REVIEW com todos os eixos com score computado e nenhum contestado pendente (resolvido por override ou por confirmação), **When** um consultor finaliza, **Then** o status muda para finalizado e a ação é auditada.
2. **Given** um assessment com algum eixo ainda contestado sem decisão, **When** alguém tenta finalizar, **Then** o sistema recusa, nomeando o eixo pendente — só override ou confirmação tiram um eixo da fila.
3. **Given** a coleta de um assessment acabou de fechar (status REVIEW), **When** o respondente tenta gravar uma resposta ou anexar evidência pelo link, mesmo com o token ainda válido, **Then** o sistema recusa a escrita — o link vira só leitura a partir do fechamento da coleta, não só a partir da finalização.
4. **Given** um assessment finalizado, **When** alguém tenta registrar override, confirmar um eixo, criar, ajustar, remover ou ligar um gap, ou gerar/editar o plano, **Then** o sistema recusa todos.
5. **Given** o mesmo assessment finalizado, **When** alguém lê o relatório, exporta, promove um gap, revoga uma promoção, ou inicia uma reavaliação (que cria um assessment novo), **Then** todas essas ações continuam permitidas normalmente.
6. **Given** um assessment finalizado em que um erro foi percebido, **When** um consultor reabre com motivo de 20 ou mais caracteres, **Then** o assessment volta a REVIEW (nunca a COLLECTING), a reabertura é auditada, e as respostas continuam travadas — corrigir uma resposta exige reavaliação, não a reabertura.
7. **Given** um usuário sem o papel de consultor, **When** tenta reabrir um assessment finalizado, **Then** o sistema recusa.
8. **Given** um assessment reaberto, **When** alguém tenta finalizá-lo de novo sem resolver os eixos que voltaram a ficar contestados, **Then** o sistema recusa pela mesma regra do item 2 — a fila precisa esvaziar de novo.

---

### Edge Cases

- Assessment com zero respondentes atribuídos: coleta não abre e o detalhe orienta a atribuir.
- Todos os respondentes de um eixo concluem, mas só há um respondente: confiança é penalizada por amostra única e o eixo é sinalizado, sem virar contestado.
- Respondente tenta abrir link de outro eixo ou de outro assessment: acesso negado, tentativa registrada.
- Evidência baixada por consultor: leitura registrada na trilha, com quem e quando.
- Template alterado depois do primeiro uso: recusado — a versão em uso é imutável e o assessment guarda qual usou.
- Gap promovido cujo trabalho de destino é excluído no outro produto: gap volta ao estado anterior à promoção e o custo de atraso volta a correr.
- Reavaliação em que o template mudou de versão: diff é gerado por eixo e gap, e declara a mudança de versão.
- Coorte que cai abaixo do mínimo por remoção de opt-in: leitura volta a ser retida na próxima leitura.
- Assessment reaberto que já originou uma trilha noutro produto (Scaffold): o baseline assinado dessa trilha não muda — é versão assinada e imutável; se o número corrigido importar, quem é dono do processo assina uma versão nova do caso de negócio, não espera o Meridian mudar nada por trás.
- Override sem mudança de score continua recusado mesmo depois de existir a confirmação — são dois atos distintos, e nenhum dos dois substitui o outro: confirmar não muda score, override muda; quem não muda o score usa confirmar, não override.
- Plano gerado com grafo desconexo: cada componente é sequenciado independentemente, sem trimestres vazios artificiais.

## Requirements *(mandatory)*

### Functional Requirements

**Acesso e isolamento**

- **FR-001**: O sistema MUST restringir todo dado do Meridian à organização da sessão, sem exceção por papel.
- **FR-002**: O sistema MUST recusar acesso ao módulo quando a organização não o tiver contratado, com mensagem que diferencia "não contratado" de "sem permissão".
- **FR-003**: O sistema MUST exigir papel de consultor para conduzir assessments (atribuir respondentes, fechar coleta, registrar override, promover gap) e permitir leitura a papéis de visualização.
- **FR-004**: O sistema MUST permitir que um respondente acesse exclusivamente a bateria do seu eixo no seu assessment, por link de uso individual e com validade.

**Assessment e coleta**

- **FR-005**: Usuários MUST poder criar um assessment escolhendo organização, versão de template e prazo.
- **FR-006**: O sistema MUST congelar a versão de template no assessment na criação e MUST recusar alteração de um template já usado por algum assessment.
- **FR-007**: Usuários MUST poder atribuir um ou mais respondentes por eixo, com papel declarado.
- **FR-008**: O sistema MUST enviar convite e lembretes automáticos ao respondente até a conclusão ou o prazo, e MUST cessar lembretes na conclusão.
- **FR-009**: Respondentes MUST poder salvar respostas parciais e retomar depois.
- **FR-010**: Respondentes MUST poder anexar evidência por pergunta; o sistema MUST armazenar o arquivo em repositório segregado por organização, fora do banco relacional.
- **FR-011**: O sistema MUST impedir o fechamento da coleta enquanto houver eixo sem respondente atribuído.
- **FR-012**: O sistema MUST permitir fechar a coleta com respostas pendentes, declarando o impacto na confiança dos eixos afetados.

**Scoring e revisão**

- **FR-013**: O sistema MUST computar, ao fechar a coleta, um score inteiro de 0 a 100 e uma confiança de 0 a 1 por eixo.
- **FR-014**: O scoring MUST ser determinístico: mesma versão de template e mesmo conjunto de respostas produzem sempre o mesmo resultado.
- **FR-015**: O sistema MUST marcar como contestado o eixo cuja dispersão entre respondentes exceder o limiar configurado.
- **FR-016**: O sistema MUST expor, para eixo contestado, a divergência resposta a resposta com autor, papel, valor normalizado e contagem de evidências.
- **FR-017**: Consultores MUST poder registrar override de score por eixo, com rationale de no mínimo 20 caracteres e score diferente do computado.
- **FR-018**: O sistema MUST preservar o score computado e todos os overrides anteriores — o registro é append-only, nada é editado nem removido.
- **FR-019**: O sistema MUST exibir o composite do assessment como a média dos scores finais dos cinco eixos.
- **FR-020**: O sistema MUST reunir, numa fila global, todos os eixos contestados de toda a carteira.

**Gaps e plano**

- **FR-021**: O sistema MUST derivar gaps dos eixos cujo score final ficar abaixo do limiar do eixo, e MUST permitir ao consultor criar, ajustar e remover gaps manualmente.
- **FR-022**: Cada gap MUST ter enunciado, eixo, severidade, esforço, dono sugerido, custo de atraso de 0 a 100 e selo de confiança do achado.
- **FR-023**: O sistema MUST permitir declarar dependências entre gaps e MUST recusar qualquer escrita que introduza ciclo, nomeando os gaps do ciclo.
- **FR-024**: O sistema MUST gerar o plano de 12 meses por ordenação topológica do grafo, distribuída em quatro trimestres, garantindo que nenhum item preceda um pré-requisito.
- **FR-025**: O sistema MUST expor o plano em formato legível por máquina contendo, por gap, identificador, eixo, severidade, custo de atraso, dependências e trimestre alvo.
- **FR-026**: O registro de gaps MUST ser canônico e atravessar assessments: o gap continua existindo e sendo reavaliado independentemente do run em que nasceu.
- **FR-027**: Usuários MUST poder promover um gap a trabalho em outro produto da suíte; o trabalho criado MUST carregar a referência ao gap de origem.
- **FR-028**: O sistema MUST manter a posse do gap no Meridian após a promoção — nenhum outro produto pode editar enunciado, severidade ou custo de atraso.
- **FR-029**: Cada gap MUST estar em exatamente um estado entre aberto, no plano, promovido e resolvido, e o sistema MUST registrar cada transição.

**Finalização e travas por estado**

- **FR-029a**: Consultores MUST poder "confirmar o computado" de um eixo contestado — ação distinta do override, que tira o eixo da fila sem alterar o score, com as mesmas exigências do override (papel, justificativa de 20+ caracteres), registrada de forma append-only (antes e depois iguais) e auditada; o eixo confirmado MUST aparecer, no relatório e no shape, como "confirmado pelo revisor" — nunca como "computado" nem como "override". Um override sem mudança de score continua recusado (FR-017); confirmar nunca substitui essa regra.
- **FR-029b**: O sistema MUST permitir finalizar um assessment em revisão apenas quando todo eixo tiver score computado e nenhum eixo estiver contestado sem decisão (override ou confirmação), e apenas para o papel de consultor; a finalização MUST ser auditada.
- **FR-029c**: A partir do fechamento da coleta (assessment em revisão), o sistema MUST recusar escrita de resposta e de anexo de evidência pelo link do respondente, mesmo com token ainda válido — a coleta fechada não aceita mais escrita, antes mesmo da finalização.
- **FR-029d**: Num assessment finalizado, o sistema MUST recusar: override, confirmação de eixo, criação, ajuste, remoção ou vínculo de gap, e geração ou edição do plano. O sistema MUST continuar permitindo, no mesmo assessment: leitura, relatório, exportação, promoção de gap, revogação de promoção e abertura de reavaliação (que cria um assessment novo).
- **FR-029e**: O sistema MUST permitir reabrir um assessment finalizado de volta para revisão — nunca para coleta —, exclusivamente para o papel de consultor, com motivo de 20 ou mais caracteres, e MUST auditar a reabertura. Finalizar de novo MUST exigir a fila de contestados vazia outra vez (FR-029b).

**Relatório e benchmark**

- **FR-030**: O sistema MUST apresentar o shape de prontidão com os cinco eixos, score final, confiança e marcação explícita de override.
- **FR-031**: O sistema MUST gerar documento de entrega ao patrocinador contendo shape, confiança, narrativa dos gaps de maior custo de atraso e plano.
- **FR-032**: O sistema MUST agregar contribuições em coortes definidas por setor e faixa de tamanho, apenas de organizações com opt-in explícito.
- **FR-033**: O sistema MUST reter a leitura de qualquer coorte com menos de 5 organizações contribuintes, declarando a retenção no lugar da comparação.
- **FR-034**: O sistema MUST impedir que qualquer superfície exponha dado que permita identificar uma organização dentro de uma coorte.
- **FR-035**: Para assessment que é reavaliação de outro, o sistema MUST gerar diff por eixo, por gap e por item de plano contra o run anterior.

**Vocabulário e auditoria**

- **FR-036**: O sistema MUST definir a escala de confiança de achados em exatamente três níveis — medido, estimado, declarado — com definição única reutilizada por toda a suíte.
- **FR-037**: O sistema MUST registrar em trilha imutável: criação de assessment, atribuição de respondente, fechamento de coleta, execução de scoring, marcação de contestado, override, criação e transição de gap, promoção de gap, e toda leitura ou download de evidência.
- **FR-038**: Cada entrada da trilha MUST conter autor, horário, entidade afetada e, quando houver mudança de valor, o antes e o depois.

### Key Entities

- **Template de avaliação**: versão imutável da bateria de perguntas, com peso por pergunta e limiar por eixo. Congelado no primeiro uso.
- **Assessment**: um diagnóstico de uma organização num período. Guarda a versão de template, prazo, consultor responsável, estado (rascunho, coletando, em revisão, finalizado), opt-in de benchmark e referência ao run anterior quando é reavaliação.
- **Eixo**: uma das cinco dimensões avaliadas — Data, Process, People, Governance, Infrastructure.
- **Respondente**: pessoa da organização atribuída a um eixo de um assessment, com estado de conclusão e histórico de convites e lembretes.
- **Resposta**: valor dado por um respondente a uma pergunta, com valor normalizado de 0 a 1 e anexos de evidência.
- **Evidência**: arquivo anexado a uma resposta, guardado fora do banco relacional, com trilha de todo acesso.
- **Score de eixo**: score computado, confiança, número de respondentes, dispersão, status (computado, contestado, sobrescrito) e score final quando há override.
- **Override**: decisão do consultor sobre um eixo — score de origem, score de destino, rationale, autor e horário. Append-only.
- **Confirmação**: decisão do consultor sobre um eixo contestado que mantém o computado — rationale, autor e horário. Append-only, distinta do override porque não muda o score.
- **Gap**: lacuna de capacidade com enunciado, eixo, severidade, esforço, dono sugerido, custo de atraso, selo de confiança, estado e assessment de origem.
- **Dependência de gap**: aresta dirigida entre dois gaps, sem ciclos.
- **Item de plano**: gap posicionado num trimestre com uma ordem de execução.
- **Promoção**: vínculo entre um gap e o trabalho criado em outro produto da suíte.
- **Coorte de benchmark**: agregado anônimo por setor e faixa de tamanho, com contagem de contribuições e percentis por eixo.
- **Entrada de auditoria**: registro imutável de quem fez o quê, quando, sobre qual entidade.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma consultora conduz um assessment do zero ao relatório entregue sem sair do produto e sem planilha auxiliar.
- **SC-002**: Rodar o scoring duas vezes sobre o mesmo conjunto de respostas produz resultado idêntico em 100% das execuções.
- **SC-003**: Nenhum score final chega ao relatório sem que sua origem seja rastreável até respostas ou até um override com rationale — verificável em 100% dos eixos.
- **SC-004**: 100% dos eixos com dispersão acima do limiar aparecem na fila de revisão antes de o relatório poder ser gerado.
- **SC-005**: Nenhuma comparação de benchmark é exibida para coorte com menos de 5 contribuições, em nenhuma superfície do produto.
- **SC-006**: Um respondente conclui a bateria do seu eixo em menos de 10 minutos, incluindo anexo de uma evidência.
- **SC-007**: Nenhum plano gerado contém item posicionado antes de um pré-requisito — verificável por checagem topológica sobre qualquer grafo válido.
- **SC-008**: Toda leitura de evidência aparece na trilha de auditoria, sem lacuna, verificável por amostragem.
- **SC-009**: Um gap promovido continua editável apenas no Meridian — nenhuma superfície de outro produto oferece edição do enunciado.
- **SC-010**: A carteira de assessments e o registro de gaps respondem em menos de 2 segundos com 200 assessments e 2.000 gaps.
- **SC-011**: Com 50 respondentes sem conta abrindo o link e gravando rascunho ao mesmo tempo, a rota do respondente responde com p95 abaixo de 800 ms e taxa de erro abaixo de 1%, sustentado por pelo menos 60 segundos no pico de carga. Medido contra um build de produção, não contra o servidor de desenvolvimento. A mesma meta, medida em infraestrutura real (não local), é condição para liberar o primeiro cliente externo, com aprovação do CEO. Fora do critério: upload de evidência e envio final da bateria, que não formam pico.
- **SC-012**: Um assessment com eixo contestado só finaliza depois que todo eixo contestado foi resolvido por override ou por confirmação do computado — verificável em 100% dos casos testados.
- **SC-013**: Depois de finalizado, todo pedido de override, confirmação, ou edição de gap (criar, ajustar, remover, ligar) é recusado pelo servidor — verificável em 100% das tentativas, independentemente da tela de origem.
- **SC-014**: Nenhuma resposta ou evidência é gravada pelo link do respondente depois de a coleta fechar, mesmo com token ainda dentro da validade — fecha a divergência anterior em que a resposta mudava depois do fechamento e o computado, não.
- **SC-015**: Um consultor reabre um assessment finalizado informando motivo, e qualquer outro papel que tente é recusado — verificável em 100% das tentativas testadas; a reabertura sempre volta a revisão, nunca a coleta.

## Assumptions

- Meridian é um módulo de produto contratável, como Cosmos e Charter, e vive na mesma aplicação de tenant sob seu próprio grupo de rotas e sua própria casca visual.
- A escala de confiança e o registro de gaps são de posse do Meridian; Signal, Scaffold e Cosmos consomem sem redefinir. A promoção para Scaffold e Signal fica declarada mas só é implementada para os produtos que já existem no repositório.
- O papel de consultor é atribuído por organização, na mesma mecânica de papéis já usada pelo Charter.
- A geração do documento de entrega ao patrocinador reusa o mecanismo de export já existente no repositório; formato e template gráfico do PDF são tratados como incremento posterior.
- O limiar de dispersão que marca um eixo como contestado e o limiar de score que deriva gap são configuráveis por template, com valores padrão definidos na implementação.
- O mínimo de 5 organizações por coorte é fixo em V1, não configurável por tenant.
- Link seguro de respondente é um token de uso individual com validade até o prazo do assessment; o respondente não precisa de conta na plataforma.
- Armazenamento de evidência usa o mesmo repositório de objetos já configurado no projeto, com segregação por organização.
- Idioma da interface é português do Brasil, seguindo os demais módulos.
- A paleta e as primitivas visuais do Meridian são as mesmas já usadas pelo Charter — mesma identidade de suíte, escopo próprio.
- Quando um assessment reaberto já originou uma trilha noutro produto (Scaffold), o Meridian expõe que foi reaberto e quando; a tela da trilha do Scaffold mostrar esse aviso é consequência a implementar do lado do Scaffold, fora desta entrega (FR-029e cobre só o lado do Meridian).
