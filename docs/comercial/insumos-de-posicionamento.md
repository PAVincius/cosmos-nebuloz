# Insumos de posicionamento — o que a Nebuloz tem hoje

**Levantamento de 2026-09-07.** Consolida, num arquivo só, os três insumos de
posicionamento que existem de verdade no repositório: a copy da landing page em
produção, a lista de features por produto, e o material comercial (ICP, preço,
objeções, funil).

Os outros três insumos de uma auditoria de posicionamento — calls de discovery,
pesquisa com cliente/NPS/tickets, depoimentos e casos — **não existem**. §1 diz
exatamente o que falta e por quê, porque um documento de posicionamento que
esconde a ausência de voz do cliente vale menos que nenhum.

---

## 1. Inventário: o que existe e o que não

| Insumo | Status | Fonte |
|---|---|---|
| Landing page atual | Completo | [§2](#2-landing-page-atual) |
| Documentação de produto / features | Completo | [§3](#3-lista-de-features-por-produto) |
| Material comercial (ICP, preço, funil) | Completo | [§4](#4-material-comercial) |
| Calls de discovery / vendas | **Não existe** | — |
| Pesquisa com cliente · NPS · tickets | **Não existe** | — |
| Depoimentos e casos de cliente | **Não existe** | — |
| Dados de uso e churn | Modelado, dado inacessível | [§5](#5-uso-e-churn-o-que-está-modelado) |

### 1.1 Por que os três ausentes estão ausentes

**Calls de discovery.** Nenhuma transcrição no repositório. Os modelos
`MeetingTranscript`, `MeetingInsight` e `MeetingParticipant`
(`packages/database/prisma/schema/meeting.prisma`) são *feature do produto* —
transcrevem a reunião do cliente dentro do Cosmos — e não gravação das nossas
calls de venda. O que existe no lugar é o roteiro de discovery
([playbook §1](playbook-de-vendas.md), reproduzido em [§4.4](#44-roteiro-de-discovery-os-cinco-eixos)):
as perguntas que *fazemos*, não as respostas que *ouvimos*.

**Pesquisa com cliente, NPS, tickets.** Não há modelo de NPS, survey ou ticket
em nenhum dos 33 arquivos de schema Prisma, e não há helpdesk conectado.
[`pesquisa-mercado-scaffold.md`](../produto/pesquisa-mercado-scaffold.md) (31 KB)
é desk research de mercado, não cliente falando. O instrumento que *seria* voz de
cliente — o Meridian, que o cliente responde dentro do produto — existe em código
(`MeridianResponse`, `MeridianRespondent`) e ainda não tem resposta real de
cliente pago em produção.

**Depoimentos e casos.** Zero. A seção `proof` da landing não é prova social — é
o conteúdo do diagnóstico (as cinco perguntas). Nenhum logo de cliente no site.
O playbook já assume isso por escrito e resolve com dogfooding — ver
[§4.5](#45-prova-social-o-que-temos-de-verdade).

**Consequência para o posicionamento.** Tudo que existe aqui foi escrito por
nós. Nada foi validado por cliente pagante falando. Qualquer reposicionamento
feito só com este arquivo é reposicionamento sobre hipótese própria — o que é
legítimo enquanto for dito em voz alta.

---

## 2. Landing page atual

Ao vivo em `nebuloz.ai`. Implementação:
[`apps/web/app/[locale]/(home)/readiness/`](../../apps/web/app/[locale]/(home)/readiness)
(13 componentes de seção). **Toda a copy vem de**
[`packages/internationalization/dictionaries/pt.json`](../../packages/internationalization/dictionaries/pt.json)
→ chave `web.readiness`. Editar copy = editar o dicionário, não o `.tsx`.

### 2.0 Meta

- **Título**: Prontidão para IA, na ordem certa
- **Descrição**: A Nebuloz deixa organizações prontas para IA numa ordem fixa: diagnosticar a lacuna, estruturar a adoção, medir o retorno, governar o risco. O método fica com o seu time.

### 2.1 Hero

- **Badge**: Prontidão e adoção de IA
- **Manchete**: *Seus times não / precisam de mais IA. / Precisam de um plano.*
- **Lead**: A Nebuloz deixa organizações prontas para IA numa ordem fixa: diagnosticar a lacuna, estruturar a adoção, medir o retorno, governar o risco. O método fica com o seu time.
- **CTA primário**: Agendar o diagnóstico · **secundário**: Ver os cinco estágios
- **A sequência**: Diagnosticar → Estruturar → Medir → Governar → Operar

### 2.2 A lacuna (01)

> **A maioria das empresas não está travada por tecnologia.**
> Está travada por sequência. Prontidão não é ferramenta que se instala — é uma ordem de operações que quase ninguém mostrou a elas.

| Item | Texto |
|---|---|
| Ninguém é dono do ponto de partida | A liderança concorda que IA importa. Ninguém sabe dizer qual processo mudar primeiro, nem o que precisa ser verdade antes de funcionar. |
| Piloto nunca vira prática | Um time entrega um piloto promissor. Ele morre na passagem de bastão, porque não há método que o carregue para a operação do dia a dia. |
| Ninguém consegue provar que deu certo | O gasto é visível, o retorno é anedota. Sem linha de base medida, a próxima conversa de orçamento vira questão de fé. |
| O jurídico é o bloqueio silencioso | Sem política de uso, sem matriz de risco, sem cláusula de fornecedor. Então a decisão mais segura é sempre esperar mais um trimestre. |

### 2.3 A escada (02) — cinco estágios, nesta ordem

> Cada estágio é um produto que se compra sozinho — e cada um deixa o seu time mais capaz do que encontrou. Rodados em sequência, prontidão deixa de ser questão de opinião.

| # | Produto | Papel | Promessa | Itens |
|---|---|---|---|---|
| 01 | **Meridian** | Diagnosticar | Saiba exatamente onde você está. | Cinco eixos: Dados · Processo · Pessoas · Governança · Infraestrutura |
| 02 | **Scaffold** | Estruturar | Um método, não um workshop. | Quatro fases: Avaliar · Pilotar · Escalar · Incorporar |
| 03 | **Signal** | Medir | Prove o retorno em número de verdade. | Taxa de adoção · Horas recuperadas · Tempo de ciclo · Custo por resultado |
| 04 | **Charter** | Governar | Política em minutos, não em meses. | Política de uso · Matriz de risco · Cláusulas de fornecedor · Guia de integração |
| 05 | **Cosmos** | Operar | Onde quem está pronto opera. | Melhor encaixe quando: diagnóstico feito · método no lugar · linha de base medida · política assinada |

### 2.4 Sua forma (interativo) — as cinco perguntas do sampler

> Responda cinco perguntas. Veja sua forma se desenhar. *A esfera ao lado é a sua organização. Cada resposta condensa ou afrouxa um setor. Isto é uma amostra do diagnóstico Meridian — o de verdade desce cinco camadas.*

| Eixo | Pergunta | Opções (alta → baixa) |
|---|---|---|
| Dados | Se um modelo precisasse do histórico dos seus clientes amanhã, ele conseguiria chegar nele? | Uma fonte limpa, com dono e documentada · Existe, mas espalhado por vários sistemas · Em algum lugar entre planilhas e caixas de entrada |
| Processo | Você saberia dizer qual processo automatizaria primeiro? | Sim — mapeado, medido e com dono · Temos candidatos, sem ordem entre eles · Cada time diria um diferente |
| Pessoas | Quem na sua empresa usou uma ferramenta de IA para trabalho de verdade na semana passada? | A maioria dos times, abertamente · Alguns entusiastas, discretamente · Ninguém — ou ninguém admite |
| Governança | Um funcionário pergunta "posso colar isto no ChatGPT?" — o que acontece? | Ele consulta a política. Existe uma. · Ele pergunta ao gestor, que chuta · Ele cola assim mesmo. Ninguém fica sabendo. |
| Infraestrutura | Onde os seus dados têm permissão de morar? | Definido por classe, exigido em contrato · Sabemos mais ou menos, nada escrito · Onde o fornecedor colocou |

**Vereditos**: *alta* — "Estruturado. O diagnóstico completo afinaria a sequência, não a direção." · *média* — "Forma típica: a capacidade existe, a ordem não." · *baixa* — "Resposta honesta — e a mais comum. A lacuna é de plano, não de talento."

### 2.5 Método (03) — as primeiras oito semanas

> Sem teatro de descoberta. O diagnóstico é produtizado, então a parte cara de um projeto tradicional termina antes da segunda semana.

| Quando | Passo | O quê |
|---|---|---|
| Semana 01 | Diagnóstico | Entrevistas estruturadas e revisão de sistemas nos cinco eixos. Você sai com uma nota e uma lista de lacunas ordenada. |
| Semana 02–03 | Sequenciamento | Transformamos a lista de lacunas num plano ordenado — o que muda primeiro, o que precisa ser verdade antes, quem é o dono. |
| Semana 04–08 | Primeira trilha | Um processo, levado de ponta a ponta com o seu time dentro do Scaffold. O objetivo é um padrão repetível, não uma demonstração. |
| Contínuo | Linha de base | O Signal mede a mudança contra a linha de base anterior ao trabalho, para a segunda decisão ser tomada com evidência. |

**Números de destaque**: 2 semanas até um diagnóstico com nota · 8 semanas até um padrão repetível · método que o seu time fica.

### 2.6 Os produtos (04) — ficha de cada um

> Cinco produtos. Cada um se sustenta sozinho. *A escada é a ordem recomendada, não um pacote.* Nota de rodapé do site: "A maioria começa no Meridian e para quando a lacuna fecha".

**Meridian — Diagnosticar** · *O diagnóstico de prontidão, produtizado.*
- **Quem abre**: Patrocinador executivo · Líder de transformação
- **Cadência**: Duas semanas
- **Pitch**: Entrevistas estruturadas e revisão de sistemas nos cinco eixos. Substitui a fase de descoberta de um projeto tradicional — a parte cara — por um instrumento repetível.
- **Entregáveis**: Nota por eixo, 0–100 · Lista de lacunas ordenada por custo de atraso · Plano sequenciado de 12 meses · Comparativo com pares
- **Compre sozinho quando**: a liderança discorda sobre por onde começar.

**Scaffold — Estruturar** · *O método de adoção que seu time roda sem a gente.*
- **Quem abre**: Líderes de time · Donos de processo
- **Cadência**: Por workspace
- **Pitch**: Trilhas guiadas que levam um processo do piloto à prática. Checklists, modelos de prompt e portões de validação em cada fase, para o avanço não depender de quem está na sala.
- **Entregáveis**: Trilha guiada por processo · Modelos de prompt e de política · Portões de validação · Pacote de passagem de bastão
- **Compre sozinho quando**: os pilotos morrem na passagem de bastão.

**Signal — Medir** · *O número que o seu CFO aceita.*
- **Quem abre**: Financeiro · Liderança de operações
- **Cadência**: Contínuo
- **Pitch**: Conecta às ferramentas que você já usa e mede a adoção contra uma linha de base anterior ao trabalho. Transforma "a IA está ajudando" em horas recuperadas, tempo de ciclo e custo por resultado.
- **Entregáveis**: Telemetria de adoção por time · Registro de horas recuperadas · Variação de tempo de ciclo · Relatório pronto para o conselho
- **Compre sozinho quando**: o próximo orçamento pedir evidência, não anedota.

**Charter — Governar** · *A camada de governança que destrava o jurídico.*
- **Quem abre**: Jurídico · Riscos · Segurança
- **Cadência**: Uma vez + atualizações
- **Pitch**: Gera as regras escritas que impedem "posso usar?" de virar "espera". Redigidas contra as suas obrigações, revisadas com o seu jurídico, versionadas conforme a regulação anda.
- **Entregáveis**: Política de uso de IA · Matriz de risco por classe de dado · Biblioteca de cláusulas de fornecedor · Guia de integração da equipe
- **Compre sozinho quando**: o jurídico é o motivo de nada ter saído do papel.

**Cosmos — Operar** · *Entrega em SAFe 6.0, com IA dentro das cerimônias.*
- **Quem abre**: RTEs · Líderes de portfólio e programa
- **Cadência**: Por ART
- **Pitch**: Nossa plataforma de entrega para quem roda SAFe: planejamento de portfólio, programa e time numa superfície só, com assistência de IA dentro do PI Planning, do refinamento de backlog e do mapeamento de dependências.
- **Entregáveis**: Do portfólio ao planejamento de time · PI Planning assistido por IA · Mapa de dependências e riscos · Métricas de fluxo
- **Compre sozinho** apenas se você já roda SAFe e os quatro primeiros estão resolvidos.

### 2.7 O diagnóstico (05) — as cinco perguntas que os roadmaps pulam

> Isto é a substância do Meridian. Se um fornecedor não sabe responder estas sobre a sua organização, ele está vendendo software, não prontidão.

| Eixo | Pergunta | O que fazemos |
|---|---|---|
| Dados | Um modelo consegue chegar ao dado certo, com a permissão certa, no formato certo? | Auditamos fontes, propriedade, atualidade e controle de acesso. A saída é a lista do que precisa ser corrigido antes de qualquer modelo ser útil — normalmente mais curta do que os times esperam. |
| Processo | Qual processo, mudado primeiro, devolve mais com menos ruptura? | Mapeamos os candidatos por volume, variação e reversibilidade. Alto volume e reversível ganha primeiro; irreversível e político espera. |
| Pessoas | Quem vai de fato usar isso numa terça à tarde? | Adoção falha no indivíduo, não na organização. Identificamos os operadores, o contorno que eles usam hoje, e o que tornaria o caminho novo mais fácil que o antigo. |
| Governança | Qual é a regra escrita quando alguém pergunta "posso usar?" | Ausência de política é lida como proibição. Produzimos a política de uso, a matriz de risco e o caminho de escalonamento, para a resposta padrão deixar de ser "espera". |
| Infraestrutura | Isso pode rodar onde os seus dados têm permissão de morar? | Residência, retenção e postura do fornecedor, avaliadas contra as suas obrigações atuais — antes da conversa de compras, não depois. |

### 2.8 Posição (06) — como trabalhamos, dito sem rodeio

| Fazemos | Não fazemos |
|---|---|
| Diagnosticamos antes de construir | Não começamos escolhendo ferramenta |
| Entregamos o método ao seu time | Não viramos dependência permanente |
| Medimos contra uma linha de base | Não reportamos atividade como resultado |
| Escrevemos a política que você assina | Não deixamos a governança só com o jurídico |

### 2.9 CTA final e contato

**CTA** — *Descubra onde você está de verdade.* "O diagnóstico de prontidão leva
duas semanas e termina com uma nota, uma lista de lacunas ordenada e um plano
sequenciado. Os três são seus, continuando conosco ou não." Notas: diagnóstico de
duas semanas · os entregáveis são seus · sem compromisso de ferramenta.

**Contato** — *Quatro portas. Escolha uma direção.* "Todos os canais chegam às
mesmas duas pessoas. Use o que custar menos esforço — nenhum deles passa por
fila." Canais: E-mail · WhatsApp · Formulário de diagnóstico · LinkedIn.

> **Pendência aberta na landing.** Três dos quatro canais ainda são
> *placeholder* no dicionário — `NEBULOZ_EMAIL_AQUI`, `NEBULOZ_WHATSAPP_AQUI`,
> `NEBULOZ_LINKEDIN_AQUI` — **em pt e en**. Não aparecem no HTML inicial porque
> os cartões de canal só renderizam depois de a seção de contato ser aberta; o
> valor entregue ao visitante que chega lá é o token. O formulário, esse,
> funciona — envia por Resend para a caixa em `RESEND_FROM`, com limite de 1
> envio por IP por dia (`apps/web/app/[locale]/contact/actions/contact.tsx`).
>
> **Segunda pendência — corrigida em 2026-09-07, aguardando deploy**:
> `nebuloz.ai` respondia em **inglês** para todo mundo, inclusive para navegador
> com `Accept-Language: pt-BR`, e `/pt` devolvia 404. O locale de origem passou a
> ser `pt` (`packages/internationalization/languine.json`), então português é o
> que se serve sem prefixo e inglês vive em `/en`. Verificado localmente; a
> produção só muda no próximo deploy do `apps/web`.

**Rodapé** — tagline: "Prontidão e adoção de IA, entregues como uma sequência que
o seu time consegue rodar." · "Meridian · Scaffold · Signal · Charter · Cosmos" ·
© 2026 Nebuloz.

---

## 3. Lista de features por produto

Cinco módulos contratáveis, definidos em
[`modules.prisma`](../../packages/database/prisma/schema/modules.prisma) como
`ProductModule`: `COSMOS`, `CHARTER`, `SIGNAL`, `MERIDIAN`, `SCAFFOLD`. Ausência
de linha `TenantModule` = módulo não contratado (*default deny*).

### 3.1 Cosmos — 63 telas em nove seções

Fonte: [`cosmos-prd.md`](../produto/cosmos-prd.md) §4. Rota única
`/cosmos/[[...seg]]`. A divisão segue as altitudes do SAFe.

| Seção | O que carrega |
|---|---|
| Board Snapshot e Visão Geral | Estado do PI, previsibilidade, épicos em progresso |
| Portfolio | Kanban de épicos, WSJF, temas estratégicos, value realization, strategy map, OKRs, lean budgets, tag rules, anomalias, roadmap, governance board, decision log |
| ART Board | ARTs, program board, PI Planning, dependências, riscos, capacity planning |
| Times e Board do Time | Sprint, story, task, defeito, impedimento |
| Analytics | Flow metrics, velocity, Measure & Grow |
| Workflows | Estados por time, transição, BPMN |
| Large Solution | Solution trains, capabilities, solution epics, LACE, fornecedores, dependências entre ARTs |
| Integrações | Linear, GitHub, Fireflies, Fathom; webhooks de saída, chaves de API |
| Settings | Workspace, membros, papéis customizados, SSO, segurança, notificações, billing, SAFe, auditoria |

> **Restrição dura, do PRD.** Nenhuma tela inventa número. Métrica sem dado
> coletado mostra "sem sinal" — não zero, não média, não estimativa. *É um
> diferencial de posicionamento, não um detalhe técnico.*

### 3.2 Charter — 12 telas, módulo à parte

Política de uso de IA · registro de casos de uso · fornecedores · risco ·
conformidade · trilha de auditoria. Contratado por tenant, independente do
Cosmos. Schema: `charter.prisma` (24 KB, ~20 models incluindo
`CharterPolicy`, `CharterPolicyVersion`, `CharterVendorClause`,
`CharterUseCase`, `CharterMitigation`, `CharterAcknowledgment`).

### 3.3 Meridian — diagnóstico produtizado

Telas em `apps/app/components/meridian/screens/`: registry (catálogo de
templates) · assessments · assessment-detail · fila de respondentes · formulário
do respondente (link com token, sem login) · escala de confiança · scoring ·
gaps · plano. Schema `meridian.prisma` (20 KB): `MeridianAssessment`,
`MeridianAxisScore`, `MeridianQuestion`, `MeridianRespondent`,
`MeridianResponse`, `MeridianGap`, `MeridianGapPromotion`, `MeridianPlanItem`,
`MeridianEvidence`, `MeridianBenchmarkCohort` (comparativo com pares),
`MeridianOverride`.

### 3.4 Signal — medição de adoção e ROI

Fonte: [`specs/003-signal-measure/spec.md`](../../specs/003-signal-measure/spec.md).
Regra-mãe: **adoção e resultado moram juntos; ROI nunca aparece sem fórmula e sem
confiança.**

- **No V1**: registro de iniciativas · baseline versionado e assinado · conexões
  de dado com saúde · mapeamento evento→métrica · métricas de adoção e resultado
  · ROI com componentes/custos/premissas versionados · score de confiança ·
  veredito · dashboards executivo e de detalhe · alertas · evidências
  rastreáveis · trilha de auditoria · relatórios congeláveis e exportáveis.
- **Fora**: substituir BI · treino/benchmark de modelo · enforcement de política
  · workflow de GRC · benchmarking cross-tenant (V2) · **ingestão automática
  real das fontes** (V1 entrega o contrato de conexão + entrada semi-manual).
- **Personas de design**: CFO · CTO · AI program owner · PMO · gerente de
  operações.

### 3.5 Scaffold — trilhas de adoção

Schema `scaffold.prisma` (28 KB, o maior do repositório): `ScaffoldTemplate`,
`ScaffoldTrack`, `ScaffoldPhaseInstance`, `ScaffoldStepInstance`,
`ScaffoldGateCriterion`/`GateResult`/`GateOverride` (portões de validação),
`ScaffoldBusinessCase` + versões e contestação, `ScaffoldArtefact`,
`ScaffoldTemplateOverlay`. Quatro trilhas de conteúdo já escritas:
[ai-governance](../produto/trilhas/ai-governance.md) ·
[ai-compliance](../produto/trilhas/ai-compliance.md) ·
[ai-security](../produto/trilhas/ai-security.md) ·
[MAPEAMENTO](../produto/trilhas/MAPEAMENTO.md).

> **Divergência entre site e catálogo.** O Scaffold está na landing como produto
> vendável e existe em `ProductModule` (para negar acesso a quem não comprou),
> mas está **fora do catálogo de preço** — é vendido por projeto, não por
> assinatura. [`icp-e-precificacao.md`](icp-e-precificacao.md) registra a linha
> como "fora do catálogo — o produto não existe".

### 3.6 Back-office (uso interno, não vendável)

[`backoffice-prd.md`](../produto/backoffice-prd.md): contrata, provisiona,
acompanha e cobra o cliente sem abrir o banco. Telas: funil de leads · propostas
· serviços (catálogo) · aprovações · clientes/provisionamento · delivery
(`Engagement`) · financeiro (livro-razão, DRE, MRR, recorrente) · segurança.

### 3.7 Onde está o resto da documentação

- PRD/SRD por produto: `docs/produto/{cosmos,backoffice,lab,scaffold}-{prd,srd}.md`
- SRDs de épico: `docs/srd-epic-006.md` a `009` (~150 KB somados)
- `docs/PRD-v1.0.md` (1,2 MB — o documento-mãe)
- Histórias: `docs/stories/epic-001` … `epic-009`
- Site de docs: 81 arquivos `.mdx` em `docs/content/docs/`
- Superfície de dados real: 33 schemas Prisma, ~250 models

---

## 4. Material comercial

### 4.1 Preço de tabela

Fonte: [`icp-e-precificacao.md`](icp-e-precificacao.md) §1. Catálogo mora em
tabela (`comercial.prisma`), não em constante de código — mudar preço não exige
deploy. Tudo em centavos inteiros.

| Plano | Assento | Mín. assentos | Teto usuários | Piso mensal | Roles custom |
|---|---|---|---|---|---|
| Starter | R$ 89 | 10 | 25 | R$ 890 | não |
| Scale | R$ 149 | 25 | 100 | R$ 3.725 | não |
| Enterprise | R$ 219 | 50 | ilimitado | R$ 10.950 | sim |

| Módulo | Mensal |
|---|---|
| Cosmos | incluído no assento |
| Charter | R$ 1.800 |
| Signal | R$ 1.200 |
| Meridian | R$ 1.200 |
| Scaffold | fora do catálogo — vendido por projeto |

Desconto comercial acima de **15%** não sai direto: vai para fila de aprovação
(RevOps). Prazo de contrato (`TermoDeContrato`) carrega desconto próprio:
MENSAL · ANUAL · BIENAL.

> **Buraco conhecido, do próprio documento** (§2): *o produto de entrada não é
> vendável sozinho*. O Meridian é a porta da escada mas o ticket do diagnóstico é
> decisão em aberto — a recomendação registrada são dois SKUs para o Meridian.
> E o Signal tem preço de tabela sem nenhuma linha de código que o implemente.

### 4.2 ICP por produto

| | Meridian | Charter | Cosmos | Signal |
|---|---|---|---|---|
| **Porte** | 200–2.000 func., 50–400 em tech | Igual ou acima | 3+ ARTs, ou 100+ em engenharia | Quem já rodou uma trilha de adoção |
| **Setor** | Empresa com engenharia própria: software house, serviços financeiros, saúde, varejo com TI interna. BR e LATAM | Regulados (financeiro, saúde, seguros) **e** fornecedores que vendem para regulados | Quem adotou ou está adotando SAFe | Qualquer um — o argumento é financeiro |
| **Quem assina** | CIO ou CTO; CFO co-assina acima de certo valor | Head de Compliance ou Riscos; CIO co-assina | VP de Engenharia ou CTO | CFO, ou Head de Operações |
| **Usuário real** | — | — | RTE e LPM | Quem monta a próxima rodada de orçamento |
| **Verba** | Consultoria/assessment (verba de projeto, aprovação mais rápida) | Compliance, recorrente — **não disputa a verba da entrada** | Software | A mesma que já paga a adoção |
| **Gatilho** | Auditoria marcada · exigência de cliente grande · conselho pedindo plano de IA com data | EU AI Act · exigência contratual · SOC 2/ISO em curso | Adoção de SAFe · Jira Align avaliado e recusado | Rodada de orçamento · conselho pedindo ROI · fim de trilha do Scaffold |
| **Sinal de qualificação** | Mais de uma iniciativa de IA em produção **e** nenhuma política escrita | Já respondeu questionário de IA de algum cliente | — | Já mediu alguma coisa e não confiou no número |
| **Anti-ICP** | <50 pessoas · sem engenharia própria · já contratou Big Four para o mesmo escopo | Sem obrigação regulatória e sem cliente que exija | Sem framework · time único · Scrum puro | Sem linha de base; ou quem quer telemetria como vigilância |

**Dor central do Meridian, na voz do cliente**: *"Usamos IA em vários times e
ninguém sabe exatamente onde nem com que dado."*

**Dor central do Signal**: *"A IA está ajudando" sem número. Gasto visível,
retorno anedótico, e a próxima conversa de orçamento virando questão de fé.*

### 4.3 Funil e conversão

Estágios do `Lead`: `LEAD → DISCOVERY → EVALUATION → PROPOSAL`.
Estados da `Proposal`: `RASCUNHO → (AGUARDANDO_APROVACAO) → ENVIADA → ACEITA | RECUSADA`.
Estados do `Engagement`: `PROPOSTO → ATIVO → PAUSADO → CONCLUIDO | CANCELADO`.

Sete etapas mapeadas em [`mapa-de-processo.md`](mapa-de-processo.md): ICP →
Qualificação → Precificação → Proposta → Contrato → Provisionamento → Entrega.

**As lacunas mais caras do funil** (§9 do mapa de processo), porque afetam
diretamente qualquer medição de posicionamento:

- Sem captura automática de lead a partir do site — **todo lead entra por
  cadastro manual**. Não há atribuição de canal confiável.
- `origem` do lead é texto livre, sem lista fechada de canal.
- Sem critério escrito de `DISCOVERY → EVALUATION` — é julgamento de quem toca.
- Nenhuma ação marca proposta `ENVIADA` como `ACEITA`/`RECUSADA`; sem motivo
  estruturado de recusa; sem validade de proposta.
- `Proposal.aceitaEm` ausente → o denominador do CAC é aproximação.
- CAC totalmente carregado **não medido**. A hipótese do modelo
  ([`cac-modelo.md`](cac-modelo.md) §3) é R$ 40.500/mês ÷ 2 clientes =
  **R$ 20.250/cliente** — explicitamente marcada como hipótese, não decisão.

### 4.4 Roteiro de discovery (os cinco eixos)

O que perguntamos em call. Mesmas perguntas do sampler da landing — o site é o
discovery, produtizado.

| Eixo | Pergunta | O que a resposta revela |
|---|---|---|
| Dados | Se um modelo precisasse do histórico dos seus clientes amanhã, ele conseguiria chegar nele? | Se há fonte com dono, ou planilha e caixa de entrada |
| Processo | Você saberia dizer qual processo automatizaria primeiro? | Se existe ordem, ou só candidatos |
| Pessoas | Quem usou uma ferramenta de IA para trabalho de verdade na semana passada? | Uso real versus uso declarado |
| Governança | Um funcionário pergunta "posso colar isto no ChatGPT?" — o que acontece? | Se a política existe ou se o padrão é o chute |
| Infraestrutura | Onde os seus dados têm permissão de morar? | Se residência é decisão ou acidente |

### 4.5 Prova social: o que temos de verdade

Reproduzido de [`playbook-de-vendas.md`](playbook-de-vendas.md) §3, porque é a
resposta mais honesta do repositório inteiro:

> **Existe:** MVP validado com três RTEs, e TOTVS mais dois leads no funil.
> **Não existe:** caso de cliente publicado, número de ROI medido, logo no site.

Até o primeiro caso fechar, a prova social é o **dogfooding**:

- A política de IA da própria Nebuloz, gerada pelo próprio Charter, com
  fornecedores classificados e casos de uso decididos — **inclusive um
  bloqueado**. Anexo de proposta, não slide.
  Ver [`charter-nebuloz.md`](../runbooks/charter-nebuloz.md).
- O SAFe que o Cosmos vende, aplicado na operação interna, com as métricas de
  fluxo da própria squad.

> *Um caso bloqueado no export do Charter vale mais que nove aprovados. Mostra
> que o instrumento tem dente. Não esconda.*

### 4.6 Objeções e respostas

| Objeção | Resposta curta | O que **não** dizer |
|---|---|---|
| "Já usamos ChatGPT, estamos adiantados." | "Ótimo — quantos times, e qual é a regra escrita hoje sobre que dado pode entrar?" É sinal de compra disfarçado de objeção. | Que o uso deles não conta |
| "Está caro para um diagnóstico." | "Você fica com a nota, a lista de lacunas e o plano, continuando conosco ou não." A comparação certa é com a fase de descoberta de um projeto tradicional, não com software. | Não desconte na call — teto sem aprovação é 15% |
| "Vamos esperar a regulação assentar." | "A ausência de política já é uma política — hoje ela diz 'espera', e é por isso que nada saiu do papel." | — (é o argumento que mais converte em regulado) |
| "Por que não Jira Align?" | Se já rodam SAFe com Jira Align adotado e funcionando, o Cosmos não é a venda. Ganhamos onde foi avaliado e recusado por preço ou adoção. | Não ataque o concorrente; pergunte o que fizeram com ele |
| "Vocês são pequenos demais." | "Somos, e é por isso que o diagnóstico é de duas semanas e não de dois meses." | Não negue o tamanho; ancore em entregável |
| "Quero começar pelo Cosmos." | "Dá, mas o Cosmos recompensa quem chega estruturado — deixa eu te mostrar o que o diagnóstico responde antes." Se insistir, venda e registre como exceção. | — (inverter o funil produz o cliente que abandona no 3º mês) |

---

## 5. Uso e churn: o que está modelado

O dado não é extraível deste repositório — `DATABASE_URL` local aponta para
`localhost:5434/cosmos_dev`, a credencial de produção não está versionada, e não
há `psql` nem Vercel CLI na máquina. Para puxar de verdade: backoffice.nebuloz.ai
na mão, ou `npm i -g vercel && vercel env pull`.

O que já existe **modelado e implementado**, pronto para responder quando houver
acesso:

| Pergunta | Onde vive |
|---|---|
| MRR, movimento do mês, churn de clientes | `apps/backoffice/lib/empresa/recorrente.ts` + tela `financeiro/recorrente.tsx` |
| Assinatura ativa por tenant, mudanças de plano | `AssinaturaDoTenant`, `MudancaDeAssinatura`, `CreditoDoMes` |
| Módulos contratados por cliente | `TenantModule` (`status`: ACTIVE · TRIAL · SUSPENDED · CANCELED) |
| Funil e conversão | `Lead`, `EstagioDoFunil`, `HistoricoDeEstagio`, `CanalDeLead`, `Proposal` |
| Telemetria de produto | PostHog (`NEXT_PUBLIC_POSTHOG_KEY` configurado em app e web) |
| Adoção por cliente | `SignalAdoptionSnapshot`, `OnboardingProgress` |

---

## 6. O que fazer com isto

O maior achado deste levantamento não é a copy nem o preço — é que **três dos
seis insumos de posicionamento são voz do cliente, e os três estão vazios**. As
três lacunas, em ordem de custo para fechar:

1. **Gravar e transcrever as calls de discovery.** O produto já sabe transcrever
   reunião (`MeetingTranscript` + integrações Fireflies/Fathom). Dogfooding aqui
   fecha a lacuna mais barata das três.
2. **Instrumentar a captura de lead no site.** Hoje todo lead entra à mão e
   `origem` é texto livre — nenhuma afirmação sobre canal é defensável.
3. **Fechar o primeiro caso e publicá-lo.** Até lá, o dogfooding do Charter é a
   prova, e o playbook já sabe usá-lo.
