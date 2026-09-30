# Trilha de framework no Scaffold: o que falta no schema

- **Pedido por:** CEO, via Morgana · **Data:** 2026-09-30 · **Autor:** Norte (CPO)
- **Estado:** decisões **provisórias** D-23 e D-24 em `../registro-de-decisoes.md`. A trilha principal
  é a **Fundação de Prontidão de IA** (§7, D-24), escolhida pelo CEO em 2026-09-30. A AI Governance (§6)
  passa a trilha de apoio.
- **Base:** `github/main` @ `71fefcce`.

O CEO quer uma trilha específica construída sobre os frameworks clássicos de gestão e adoção de IA
(ISO/IEC 42001, NIST AI RMF, EU AI Act, PL 2338), por perfil de organização, vendida dentro de uma
oferta (AI Governance, AI Adopt). Este documento diz o que o Scaffold já sustenta, o que falta e o
mínimo que se acrescenta.

## 1. O que já sustenta, sem mudança

| Precisa | Já existe | Onde |
|---|---|---|
| Quatro fases com gate bloqueante | `ScaffoldPhase` ASSESS → PILOT → SCALE → EMBED; `ScaffoldGateCriterion` | `scaffold.prisma:24,296` |
| Conteúdo versionado e imutável do método | `ScaffoldTemplate`, `ScaffoldTemplateVersion` (ST-01); `authorLabel` = "método Nebuloz" | `scaffold.prisma:152,170` |
| Passos com código A1…E3 e entregável esperado | `ScaffoldStepTemplate.code`, `expectedArtefact` | `scaffold.prisma:197` |
| Entregáveis por versão, com tipo, quem produz e obrigatoriedade | `ScaffoldDeliverableTemplate` | `scaffold-deliverable.prisma:171` |
| Entregável que só existe com outro módulo contratado | `requiresModule` (a instância nasce dispensada com motivo) | `scaffold-deliverable.prisma:185-187` |
| Customização do cliente sem fork | `ScaffoldTemplateOverlay` (ST-02) | `scaffold.prisma:231` |
| Gate do Scale lê a política do Charter | SG-05 (`actions/gates.ts`) | spec 002 |
| **Catálogo de normas e cláusulas** | `CharterRequirementSet` (global quando `tenantId` é nulo, `origem = REGULACAO`), `CharterRequirement.codigo`, `normaStatus` (PL 2338 = `PROPOSTO`), `licenca = REFERENCIA` (ISO 42001 só por citação), `CharterCoverage` por tenant | `charter.prisma:561-699` |

O último item decide a fronteira. O catálogo de frameworks já existe e é do **Charter** (GOVERNAR:
"É permitido? Sob qual risco?"). O Scaffold não cria um segundo catálogo: aponta para o do Charter.

## 2. O que falta

| # | Falta | Por quê |
|---|---|---|
| F1 | Referência do entregável à cláusula da norma | Sem ela, "esta trilha cobre a ISO 42001 6.1.2" é texto solto, e ninguém consegue dizer quais cláusulas a trilha cobre nem o que falta |
| F2 | Perfil de organização | Uma trilha, entregáveis diferentes por perfil (ex.: quem desenvolve IA × quem só usa; setor regulado; porte). Sem isso, ou se duplica o template por perfil (3× o conteúdo e o versionamento), ou se entrega tudo para todo mundo |
| F3 | Trilha sem forma de trabalho | `ScaffoldTemplate.archetype` é `WorkForm` obrigatório. Uma trilha de governança cobre a organização, não uma forma de trabalho (conversacional, triagem…). Forçar um valor mentiria para Signal e Charter, que casam modelo de medição e perfil de controle pela forma |
| F4 | Oferta (AI Governance, AI Adopt) como agrupador | Ver §3: **não é do Scaffold** |

## 3. Decisão provisória: o mínimo de schema

1. **F1 · `ScaffoldDeliverableTemplate.requirementRefs`** (lista, vazia por padrão). Cada item aponta uma
   exigência do catálogo do Charter pelo que é estável entre ambientes: nome do conjunto, versão e
   `codigo` (ex.: `{ set: "ISO/IEC 42001", versao: "2023", codigo: "6.1.2" }`). Não usa o `id`: o cuid muda
   de ambiente para ambiente. **Sem FK**, pelo mesmo motivo de `sourceGapId`: o Scaffold não depende do
   Charter estar contratado. O publish da versão valida que cada referência existe num conjunto global de
   `origem = REGULACAO`, e recusa se não existir. Só no entregável; o critério de gate cita no texto.
2. **F2 · perfil em três campos, reaproveitando o mecanismo do `requiresModule`:**
   - `ScaffoldTemplateVersion.profiles`: os perfis que a versão oferece (chave, rótulo, quando usar).
     Imutável como o resto da versão.
   - `ScaffoldDeliverableTemplate.profiles`: lista de chaves. Vazia = vale para todo perfil.
   - `ScaffoldTrack.orgProfile`: escolhido na criação da trilha, obrigatório quando a versão oferece
     perfis. Entregável fora do perfil **nasce dispensado com motivo**, como o de módulo não contratado.
     Não some: a trilha mostra o que não se aplica e por quê.
3. **F3 · `ScaffoldTemplate.archetype` passa a opcional.** Nulo = trilha de framework, que não tem forma
   de trabalho. `ScaffoldTrack.archetype` já é opcional (`scaffold.prisma`, `archetype WorkForm?`).
   Trilha sem forma não recebe modelo de medição do Signal nem perfil de controle do Charter por forma.
4. **F4 · nenhum campo no Scaffold.** Oferta é o que se **vende**, e isso é do Big Bang: `Service` no
   catálogo do back-office (`platform-ops.prisma`, `Service.trilha` é string livre, "trilha nova é
   INSERT"). AI Governance e AI Adopt entram como linhas de `Service`. O Scaffold continua sendo o que se
   **executa** (`MAPEAMENTO.md` §correção). Ligar `Service` a `ScaffoldTemplate.key` só quando a proposta
   precisar abrir a trilha sozinha, e não antes.

O que **não** entra, de propósito: tabela nova de framework (o Charter já tem), enum de oferta, template
por perfil, referência no critério de gate, fase nova.

## 4. Pontos que a escolha da trilha resolve, não o schema

- **SG-04:** a ASSESS só fecha com baseline assinado. A trilha de framework precisa de uma métrica de
  baseline que o Signal consiga apurar (ex.: % dos sistemas de IA inventariados e classificados por
  risco). Sem ela, o gate da primeira fase trava a trilha inteira.
- **Cobertura no Charter:** aprovar um entregável com `requirementRefs` pode alimentar o
  `CharterCoverage` do tenant. A cobertura é do Charter e continua sendo. Se for o caso, é um evento
  Scaffold → Charter, contrato novo no Mapa de fronteiras, fora deste mínimo.
- **Normas proprietárias:** ISO/IEC 42001 tem `licenca = REFERENCIA`. O texto do entregável cita a
  cláusula e formula com palavras próprias, sem copiar a norma. É a mesma regra do Charter.
- **Conteúdo de partida:** `ai-governance.md`, `ai-compliance.md` e `ai-security.md`, nesta pasta, já
  trazem fases e entregáveis com citação de framework. A trilha escolhida parte de um deles ou da
  pesquisa do Radar.

## 5. Entrega

Um PR só, sem depender de outro aberto (regra do CEO): migration aditiva (F1, F2) e relaxada (F3), seed
da trilha escolhida com os entregáveis referenciando o catálogo do Charter, e os testes junto:
- imutabilidade da versão com os campos novos;
- publish recusa referência inexistente;
- a criação da trilha dispensa entregável fora do perfil, com motivo;
- template sem `archetype` instancia e fecha gate;
- nenhum teste existente fica vermelho.

Dono da spec: Regua. Dono da implementação: Bussola (ou quem a Morgana escalar). O PR de código só abre
depois de escolhida a trilha (item 3 do pedido), porque o seed faz parte dele.

## 6. AI Governance (2026-09-30): passou a trilha de apoio

> **Superada em parte pela §7.** O CEO trouxe pesquisa própria e escolheu a Fundação de Prontidão de IA
> como trilha principal. A AI Governance continua como trilha de apoio: é para onde o mapa
> arquétipo→trilha manda os arquétipos "Governança de papel" e "Cautela travada". O que está abaixo vale
> para quando ela for montada.

**Escolha.** O CEO respondeu "ai-governance" à pergunta sobre a terceira trilha, e a Morgana leu a
resposta como a trilha a atacar agora. Pode ser que o CEO só tenha nomeado a terceira trilha; se for
isso, a escolha volta ao CEO. Até ele dizer o contrário, a trilha é **AI Governance**, a partir de
`ai-governance.md` (02/09): "quem decide, com base em quê", sobre NIST AI RMF e ISO/IEC 42001.

**Perfis propostos**, a confirmar pelo Radar:
- **P1 · usa IA de terceiros.** No EU AI Act é o *deployer* (art. 26).
- **P2 · desenvolve ou treina IA própria.** É o *provider* (arts. 9 a 15).
- **P3 · setor financeiro regulado.** Entra por cima de P1 ou P2: SR 11-7, DORA e normas BCB/CMN, que é
  o "Pacote setorial" do documento de 02/09.

**O catálogo do Charter não cobre a trilha inteira.** Em `packages/database/scripts/regulacao-corpora.ts`:

| Conjunto | Tem | Falta para a trilha |
|---|---|---|
| NIST AI RMF 1.0 | GOVERN 1-2, MAP 1-2, MEASURE 1-2, MANAGE 1-2 | GOVERN 6, MAP 5, MEASURE 3, MANAGE 3 e 4 |
| ISO/IEC 42001 (`REFERENCIA`) | cláusulas 4 a 10 | Anexo A (controles) |
| EU AI Act | arts. 9 a 15 (provider, alto risco) | arts. 4, 5, 26 (deployer) e 50 |
| PL 2338/2023 | nenhum conjunto | o conjunto inteiro, com `normaStatus = PROPOSTO` |

Completar o catálogo é INSERT no seed de regulação, dono Charter, e entra **no mesmo PR** da trilha:
referência para código que não existe seria recusada no publish (F1).

**Baseline da ASSESS (SG-04).** Proposta: % dos sistemas de IA inventariados e classificados por risco,
contra o inventário levantado na triagem. O Radar confirma.

**Detalhamento.** O Radar entrega uma linha por entregável: fase, passo, entregável, quem produz,
perfis, cláusulas e critério de aceite verificável. Com isso, eu fecho o seed do template.

## 7. Trilha principal: Fundação de Prontidão de IA (D-24, 2026-09-30)

**Origem.** Pesquisa do CEO, resumida no briefing da Morgana
(`.maestri/briefings/2026-09-30-scaffold-ai-readiness-foundation.md`). A trilha é derivada do Meridian:
as faixas e os arquétipos do diagnóstico dizem por onde começar. "O score é instrução de sequência, não
nota." As decisões abaixo fecham a tabela de encaixe do briefing. Elas valem para o PR único do
Andaime, junto com a spec da Regua, a migration, o código e os testes.

### 7.1 Template

- **Chave `ai-readiness-foundation`**, minúscula e com hífen, no padrão das chaves existentes
  (`triage`, `docreview`, `reporting`). O briefing escreve `AI_READINESS_FOUNDATION`; a chave é string
  livre, e a consistência vale mais que a grafia. Nome "Fundação de Prontidão de IA", versão `v1.0`, autor
  "método Nebuloz".
- **Sem forma de trabalho:** `archetype` nulo. É a F3 da D-23, e entra neste PR.
- **Estimativa:** o `estimateMinutes` guarda a **mediana** da faixa, a 40 h por semana (2.400 min por
  semana). A faixa original fica no texto do passo ("2–4 semanas"). É a regra da §5 do `MAPEAMENTO.md`.

### 7.2 Faixas e arquétipos no Meridian

Função pura em `apps/app/lib/meridian/`, exibida no relatório do assessment e coberta por teste. É
leitura dos scores que o Meridian já calcula, e continua dono dele (Mapa de fronteiras).

- **Faixas por eixo:** Inicial 0–39, Em formação 40–59, Estruturado 60–79, Maduro 80–100.
- **Confiança < 0,6** não substitui a faixa: acrescenta a marca "não confiável" ao eixo. O score continua
  entrando no arquétipo, e o eixo vai para o workshop A2.
- **Limiar do Piloto sem chão: 40, não 50.** Pessoas e Processo ≥ 40; Dados e Infra < 40. São dois
  motivos:
  - 40 é a fronteira de faixa ("Em formação"). Com 50, um cliente com Pessoas 45 e Processo 45 não cairia
    em arquétipo nenhum.
  - O próprio exemplo do CEO exige 40: no Atlas, Pessoas tem 47 e Processo 58. Com 50, o Atlas deixaria de
    ser Piloto sem chão.
- **Perguntas por arquétipo:** os dois arquétipos de pergunta usam os códigos do template vigente do
  Meridian (`packages/provisioning/src/meridian.ts`). "Alta" é ≥ 60 e "baixa" é < 40 no score normalizado
  da pergunta, as mesmas fronteiras das faixas.
  - **Governança de papel:** Q-G01 (política) alta; Q-G02 (comitê) e Q-G03 (controle de acesso) baixas.
  - **Campeão isolado:** Q-E03 (distribuição) baixa, ou Pessoas com confiança < 0,6.
  - Se o template do Meridian mudar esses códigos, a regra muda junto, com teste.
- **Dominante e traço:** o dominante é o primeiro que casar, nesta ordem:
  1. Pronto para escalar;
  2. Uniformemente baixo;
  3. Piloto sem chão;
  4. Dado sem uso;
  5. Cautela travada.

  Os demais que casarem entram como traço secundário, incluindo Governança de papel e Campeão isolado,
  que dependem de pergunta. Entre os traços, **Campeão isolado vem antes de Governança de papel**
  (2026-09-30, a pedido da Bussola): Pessoas trava a adoção no PILOT, e a governança é do EMBED. Os
  traços seguem a ordem da trilha. Nenhum casou: o relatório diz "sem arquétipo dominante" e não inventa um.
  - Atlas: Piloto sem chão com traço de Campeão isolado, como no briefing.

### 7.3 SG-04 continua valendo

O briefing põe o baseline no gate do Piloto. Só que o SG-04 bloqueia o **fechamento da ASSESS** sem caso
de negócio assinado (`actions/gates.ts:107-126`), e isso não se relaxa para uma trilha.

- **ASSESS:** o baseline assinado são os scores por eixo do assessment de origem, com a meta de faixa
  do EMBED (Estruturado em Dados, Governança e Infra).
- **PILOT:** o gate acrescenta os baselines operacionais (qualidade de dado, tempo e custo do processo
  piloto, custo de inferência, participação em capacitação) como **nova versão** do caso de negócio. A
  versão assinada é imutável; alterar exige versão nova (Mapa de fronteiras, costura 3.1).

### 7.4 Gates: v1 manual, derivado depois

- **v1:** todo critério é `MANUAL`. Os critérios que olham o Meridian citam no texto a evidência que
  conta: o código do reassessment (AS-xxx) com a faixa exigida. São dois:
  - SCALE: Dados e Infra pelo menos Em formação;
  - EMBED: pelo menos Estruturado em Dados, Governança e Infra.
- **`DERIVED` depois**, quando existir o contrato Meridian → Scaffold de leitura do score do
  reassessment ligado à trilha. É costura nova no Mapa de fronteiras. Revejo quando três trilhas deste
  template chegarem à SCALE, ou em **2026-12-15**, o que vier primeiro.

### 7.5 D-23 neste PR

| Parte | Entra agora? | Motivo |
|---|---|---|
| F1 `requirementRefs` | **Sim, só com códigos que já existem** no catálogo do Charter | Os entregáveis do EMBED (carta, política, matriz, SoA) citam ISO/IEC 42001 (ISO-CL04..10), NIST AI RMF (GOVERN/MAP/MEASURE/MANAGE 1-2), EU AI Act (AIA-09..15) e LGPD (LGPD-ART*). **Sem ampliar o catálogo neste PR.** PL 2338, AI Act arts. 4/5/26/50 e ISO Anexo A ficam para a AI Governance, e o PR não depende da transcrição do Lacre |
| F2 perfil de organização | **Não** | Aqui o que varia é o arquétipo do Meridian, não o perfil. A variação por cliente entra por overlay (exemplo Atlas). Pacote setorial vai com a AI Governance |
| F3 `archetype` opcional | **Sim** | Obrigatório para esta trilha |
| F4 oferta no `Service` | Sem mudança | Continua no back-office |

### 7.6 Entregáveis: tipo, quem produz, módulo

Nenhum entregável exige módulo (`requiresModule` nulo). Ninguém compra esta trilha sem Meridian, e a
origem é o assessment. Os entregáveis de governança são documento mesmo quando o cliente tem o Charter;
ligar ao Charter fica para a AI Governance. Todos são obrigatórios, salvo onde está marcado.

| Fase | Passo | Entregável | Tipo | Quem produz |
|---|---|---|---|---|
| ASSESS | A1 | Relatório de prontidão por eixo (faixas, arquétipos, confiança) | REPORT | CONSULTANT |
| ASSESS | A2 | Ata do workshop liderança–operação. Obrigatório só se algum eixo tiver confiança < 0,6; senão, nasce dispensado com motivo | DOCUMENT | CONSULTANT |
| ASSESS | A3 | Mapa arquétipo → trilha | DOCUMENT | CONSULTANT |
| PILOT | P1 | Catálogo inicial de dados para IA (3 a 5 fontes, dono, sensibilidade) | SPREADSHEET | TECHNICAL |
| PILOT | P1 | Ambiente segregado com MLOps básico (logging, versionamento, custo de inferência) | CONFIGURATION | TECHNICAL |
| PILOT | P2 | Trilhas de capacitação por persona | TRAINING | CONSULTANT |
| PILOT | P2 | Papéis formais de IA e dados em 1 ou 2 áreas | DOCUMENT | OWNER |
| SCALE | S1 | Portfólio de casos de uso priorizado com critério econômico | SPREADSHEET | OWNER |
| SCALE | S2 | Evidências de comitê ativo (atas) | DOCUMENT | OWNER |
| SCALE | S2 | Painel simples de métricas de IA confiável | REPORT | TECHNICAL |
| EMBED | E1 | Carta de governança, política e matriz de risco (com `requirementRefs`) | DOCUMENT | LEGAL |
| EMBED | E2 | Inventário único de sistemas de IA com classificação de risco | SPREADSHEET | TECHNICAL |
| EMBED | E2 | Declaração de aplicabilidade (ISO/IEC 42001; citação e texto próprio) | DOCUMENT | LEGAL |

A2 condicional segue o mesmo mecanismo do entregável dispensado com motivo. A condição (algum eixo com
confiança < 0,6) é lida do relatório A1 na criação da trilha. Se isso exigir leitura do Meridian que
ainda não existe, o A2 nasce obrigatório e o consultor dispensa com motivo.

### 7.7 Overlay de entregável

Entra o alvo `deliverable` em `overlay-merge.ts`. `ops` é Json, então não há migration.

| Operação | Regra |
|---|---|
| REPLACE de passo ou de título de entregável | Livre, como hoje |
| REMOVE de entregável **não obrigatório** | Livre, com motivo |
| REMOVE de entregável **obrigatório** | **Só o papel CONSULTANT, com motivo.** O entregável não some: a instância nasce dispensada, com o motivo visível na trilha e na fila de supervisão. Remover obrigatório de gate em silêncio é o gate virando formalidade, o risco nº 1 da spec 002 |
| REMOVE de passo que é o único produtor de um entregável obrigatório | Recusado, a não ser que o mesmo overlay dispense esse entregável pela regra acima |

No exemplo do Atlas ("papéis de dado já existem"), a consultora dispensa "Papéis formais de IA e dados"
com motivo.

**Registro da implementação (2026-09-30, via Morgana):**
- **F1:** coluna `requirementRefs Json?` em `ScaffoldDeliverableTemplate`, com itens `{set, versao, codigo}`,
  sem FK. Nulo significa sem referência.
- **Dispensa:** usa o que já existia (`dispensedReason` + `required = false`), sem enum novo.
- **Overlay na criação da trilha:** achado do Andaime. O `seedTrack` guardava o `overlayId`, mas não
  aplicava o overlay. Neste PR passa a aplicar em passos e entregáveis.
- **Overlay de critério de gate continua sem efeito**, porque o gate lê os critérios da versão. É
  débito, com duas regras até ele ser pago:
  1. **Neste PR:** criar ou editar overlay com operação de critério é **recusado**, com mensagem que diz
     por quê. Overlay que já tenha operação de critério aparece marcado "sem efeito no gate". Aceitar a
     operação calado faria o cliente achar que ajustou o gate enquanto o gate continua o da versão.
  2. **Pagar até 2026-10-31:** o gate passa a ler os critérios com o overlay aplicado, e a recusa sai.
     Dono: Andaime/Bussola, com a Regua para a spec. Se antes disso um cliente precisar ajustar
     critério, a saída é versão nova do template, não overlay.

### 7.8 Seed e testes (no mesmo PR)

- Template `ai-readiness-foundation` v1.0 com os passos, os entregáveis e os critérios acima.
- **Cliente fictício Atlas:** Dados 32 (0,72), Processo 58 (0,65), Pessoas 47 (0,55), Governança 41 (0,61),
  Infra 36 (0,80). Resultado esperado: Piloto sem chão + traço Campeão isolado, Pessoas marcada como não
  confiável, e A2 obrigatório. Overlay: REPLACE de passo, REPLACE de título e a dispensa dos papéis de
  dado.
- **Testes:**
  - faixas nas fronteiras (39/40, 59/60, 79/80);
  - cada arquétipo, a ordem de dominância e o caso "sem arquétipo";
  - Atlas de ponta a ponta;
  - SG-04 fechando a ASSESS com o baseline de scores;
  - overlay recusa REMOVE de obrigatório por quem não é consultor;
  - `requirementRefs` recusa código inexistente;
  - template sem `archetype` instancia;
  - nenhum teste existente fica vermelho.

### 7.9 Débito registrado neste PR

- **Overlay de critério de gate não chega à trilha.** `seedTrack` passa a aplicar o overlay em **passos** e
  **entregáveis** (REPLACE e REMOVE; o REMOVE de entregável dispensa a instância, com o motivo). Os
  critérios ficam de fora: o gate lê os critérios da versão pinada, não da trilha. Um overlay que
  acrescenta ou afrouxa critério continua salvo, com conflito detectado, e sem efeito no gate. Fechar exige
  decidir se a trilha copia os critérios na criação, como faz com os passos (ST-03).
- **ADD de passo ou de entregável no overlay** não cria linha na trilha: a operação não diz a fase nem o
  passo de origem.

