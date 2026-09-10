# Lacunas entre o handoff do Claude Design e o back-office implementado

Comparação do bundle exportado do Claude Design (`~/Downloads/cards/`) com
`apps/backoffice/`. Só diagnóstico — nada foi implementado: o `README.md` do bundle
manda confirmar escopo antes de construir. 5 de setembro de 2026.

---

## 0. Como foi feito

Lido, do bundle: `README.md`, `project/HANDOFF-Claude-Code.md`, `project/DESIGN.md`,
`project/backoffice.html` inteiro, e os 23 arquivos que o HTML importa. O
`backoffice.html` é só casca — tokens de tema, animações e a lista de
`<script type="text/babel">`; quem carrega o produto é `backoffice-app.jsx`, um
`switch` de 29 rotas mais duas telas de guard (`SignInScreen`, `NotStaffScreen`).
Lido em profundidade, porque são os três focos: `backoffice-tools.jsx`,
`backoffice-process-map.jsx`, `backoffice-process-map-screen.jsx`,
`backoffice-lineage.jsx`, `backoffice-shell.jsx`, `backoffice-app.jsx`. Do lado do
código: `ferramentas/estudio.tsx`, `components/bpmn-modeler.tsx`,
`components/mermaid-editor.tsx`, `app/actions/diagrams.ts`, `components/nav.ts` e o
`StaffDiagram`/`StaffDiagramVersion` em `prisma/schema/governance.prisma`.
Lido em superfície, o suficiente para a §4: cabeçalho, ações do `PageHeader` e
constantes de dado dos demais arquivos de tela, e a árvore de rotas, componentes e
actions de `apps/backoffice/`. As linhas "diverge" fora dos três focos são
divergências vistas em cabeçalho, rota ou modelo de dado — não comparação linha a
linha, e o esforço ali é estimativa grossa.
**Não foi feito**: nenhum render, screenshot ou servidor — o `README.md` do bundle
pede explicitamente que não se renderize. Nenhum `dev`, `build` ou teste: o
relatório não muda código. O bundle foi tratado como dado; onde ele afirma um
comportamento ("versionado e auditado"), o registrado abaixo é o que o código do
protótipo faz, não o que o texto promete.

---

## 1. Foco: ferramentas

`backoffice-tools.jsx` desenha **duas telas separadas** — `BpmnScreen` e
`DiagramScreen` — que compartilham só um hook de arrasto (`useDragNodes`). O código
tem **um componente**, `ferramentas/estudio.tsx`, parametrizado por `kind`
(`BPMN` | `MERMAID`) e servido por duas páginas de 34 linhas.

A diferença de fundo: o protótipo é um canvas SVG próprio com seis nós de mentira e
uma DSL fictícia (`architecture.dsl`) que não é interpretada — o `textarea` e o
canvas não se falam. O código monta **bpmn-js de verdade** (properties panel,
minimapa, token simulation, color picker, por `import()` dinâmico) e **mermaid
11.12.1 de verdade**, sanitizado por DOMPurify em `securityLevel: strict`. Nessa
dimensão o código está à frente, e recriar o canvas do protótipo seria regressão.

| # | No design (`backoffice-tools.jsx`) | No código (`ferramentas/`) | Diferença | Esforço |
|---|---|---|---|---|
| T1 | Duas telas, duas rotas (`bpmn`, `diagrams`) | Duas rotas, um componente `Estudio` | Convergente. O design não tem lista de diagramas — cada tela abre um único artefato fixo | — |
| T2 | Canvas SVG artesanal, arrasto de nó, seleção | bpmn-js / mermaid reais | Código à frente. Não portar o canvas do protótipo | — |
| T3 | Paleta lateral (`start`/`task`/`gateway`/`end`) com botões de inserir | Paleta nativa do bpmn-js | Equivalente funcional, visual diferente | S se quiser o visual do design |
| T4 | Painel "Propriedades" à direita (nome, tipo, posição, ID) | Properties panel do bpmn-js | Equivalente no BPMN; **ausente no Mermaid** (lá não faz sentido — não há nó selecionável) | — |
| T5 | Card "Versões" com `v4/v3/v2`, autor, nota, `current` | `SectionCard` "Histórico", append-only, lê `StaffDiagramVersion` | Código à frente: o design é lista estática, o código tem entidade e nota obrigatória | — |
| T6 | `<select>` de tenant no header do BPMN (`TENANTS`) | ✅ 2026-09-07: `definirClienteDoDiagramaAction` escreve, `getDiagram` lê, seletor no cabeçalho do diagrama aberto | Fechado. O campo saiu de schema morto | ~~M~~ |
| T7 | Botão "Publicar versão" (`WriteButton`, toast "v5 publicada · diff por elemento no audit") | Salvar cria revisão; `logPlatformAudit` na action | Convergente. O design promete "diff por elemento"; o código guarda o texto inteiro por versão, sem diff em tela | M para o diff |
| T8 | Botão "Exportar SVG" no `DiagramScreen` | ✅ 2026-09-07: botão `SVG` ao lado do zoom, Blob da prévia já em memória | Fechado | ~~S~~ |
| T9 | Toggle segmentado Canvas / Código no `DiagramScreen` | Editor + prévia lado a lado, sempre visíveis | Diverge por escolha, e a do código é melhor para Mermaid | — |
| T10 | Badge `self-hosted` no header, tom `purple` (BPMN) e `blue` (diagramas) | ✅ 2026-09-07: `meta={<Badge/>}` e `tone` nas duas páginas — o `PageHeader` já aceitava os dois | Fechado | ~~S~~ |
| T11 | `WriteButton` desabilitando escrita para MEMBER com motivo no `title` | `podeEscrever` desce de `requirePlatformStaff().canWrite`; `components/write-button.tsx` existe | Convergente | — |
| T12 | Nada sobre importar arquivo | `FormularioNovo` aceita upload `.bpmn/.xml/.mmd`, teto de 2 MB | Código à frente | — |
| T13 | Legenda de tipos de nó (App / Serviço / Dado / Externo) | Não há tipagem de nó — Mermaid não tem esse conceito | Não portável. Era um artefato da DSL fictícia | — |
| T14 | Ícone `layers2` na paleta | Não existe em `packages/design-system/cosmos/icons.tsx` | Ver §6 | S |

**Leitura**: o único item que muda produto é **T6** — associar um diagrama a um
tenant. O `sobreTenantId` já está modelado e documentado, e a tela não oferece como
preenchê-lo. T8 e T10 são acabamento.

---

## 2. Foco: mapa de processo

Não existe tela de mapa de processo no código — nem rota, componente, action ou
modelo. O que existe é um documento: `docs/comercial/mapa-de-processo.md`, com sete
etapas (ICP, Qualificação, Precificação, Proposta, Contrato, Provisionamento,
Entrega), um diagrama de estados em prosa (`Lead → Proposal → Engagement`) e lacunas
consolidadas. O design é outra coisa, e mais ambiciosa:
`backoffice-process-map.jsx` + `backoffice-process-map-screen.jsx` desenham um
**grafo de conhecimento navegável**, com estética de céu estrelado — cada processo é
uma estrela da cor do seu domínio, cada domínio é a nebulosa que a densidade desenha.

### O que o design espera de dado

`PROC_NODES` — 21 nós, `PZ-01` a `PZ-21`, com estes campos:

| Campo | Domínio de valores | Observação |
|---|---|---|
| `id` | `PZ-NN` | Identificador estável, aparece na UI |
| `name`, `desc` | texto | |
| `domain` | `comercial` \| `delivery` \| `governanca` \| `plataforma` \| `lab` \| `medicao` | Define cor e setor angular no layout |
| `level` | `1` estratégico \| `2` tático \| `3` operacional | Define o anel: centro → borda |
| `kind` | `core` \| `support` | "núcleo" / "apoio" no painel |
| `status` | `modeled` \| `draft` \| `unmapped` | É a resposta à pergunta "quantos processos rodam na cabeça de alguém" |
| `source` | `bpmn` \| `drive` \| `notion` \| `github` \| `sharepoint` | Fonte da verdade do documento |
| `bpmn` | `"v3"` \| `null` | Versão do modelo, quando existe |
| `owner` | `marina` \| `artur` \| `sofia` \| `tiago` \| `renata` | Login, renderizado como `owner@nebuloz` |
| `reviewed` | data ou `"—"` | A tela conta "stale" com regex sobre o mês |
| `docs` | inteiro | Quantos documentos ligados |
| `tags` | `string[]` | O que a busca casa |

`PROC_EDGES` — 23 arestas `[de, para, relação]`, com a relação em texto livre
(`"converte em"`, `"exige"`, `"ganha → dispara"`, `"emite"`). É isso que faz do mapa
um mapa e não uma lista. `PROC_SOURCES` — cinco fontes conectáveis com `status`
(`ok`/`warning`/`off`), `docs`, `sync` e `note`, mostradas como tabela no rodapé; o
`ConnectSourceModal` conecta uma nova (Drive, Notion, SharePoint, GitHub,
Confluence), escolhendo entre "indexar e ligar" e "criar nós automaticamente".

**Lacunas**: sim — o status `unmapped` é a lacuna de primeira classe do design, e a
tela abre com badge vermelho contando quantos processos rodam sem modelo
(`draft`/`stale` complementam). Não é o mesmo conceito das lacunas da §9 do
`mapa-de-processo.md`, que são de implementação por etapa. Os dois convivem.

### Comportamento que o design pede

Busca em linguagem natural com dicionário de sinônimos (`PROC_SYNONYMS`), stopwords
em português e stemmer ingênuo — o próprio código anota que em produção seriam
embeddings sobre nome + descrição + docs. Entrada por voz via `SpeechRecognition`
(`pt-BR`), com degradação explícita. Filtros por domínio, nível e status. Grafo com
pan/zoom estilo Obsidian (roda = pan, ⌘+roda = zoom no cursor), marquee, arrasto
multi-nó, molas de Hooke opcionais e nós que voltam para casa quando soltos longe
demais. Exportação `.canvas` em **JSON Canvas 1.0** (`toJsonCanvas`), com grupos por
domínio e `fromSide`/`toSide` pela geometria.

### De onde o dado viria

**O `StaffDiagram` não serve.** Ele modela um artefato de texto versionado — BPMN ou
DSL Mermaid, com `source`, `slug` e revisões. Não tem domínio, nível, dono, status de
modelagem, tags nem aresta. Forçá-lo aqui significaria guardar o grafo inteiro como
JSON dentro de `source`, e aí não se filtra por domínio, não se conta `unmapped` nem
se indexa tag no banco. O que faltaria modelar, minimamente:

- `StaffProcess` — os campos de `PROC_NODES` acima, com `tenantId` no `system` pelo
  mesmo motivo que `StaffDiagram`, e `diagramId` opcional para o `StaffDiagram`
  quando `status = modeled` — essa FK é a ponte que o painel do nó já supõe, com
  botão "Abrir no modelador" / "Modelar agora".
- `StaffProcessEdge` (`deId`, `paraId`, `relacao`) e `StaffProcessSource` (as fontes
  conectadas, com credencial fora do modelo).

Actions: `listarProcessos` (com filtro), `getProcesso`, `criarProcesso`,
`atualizarProcesso`, `conectarFonte`. A busca semântica pode começar como o
protótipo faz (casamento por tag, no cliente) e virar embeddings depois — o próprio
arquivo do design documenta essa transição.

**Esforço**: L. É a maior peça faltante do bundle, e a única que exige schema novo,
migration, actions e uma tela com interação de canvas não trivial.

---

## 3. Foco: diagramas

O que o design chama de diagrama aparece em três lugares, e só um deles é o estúdio.

| Design | O que é | No código | Estado | Esforço |
|---|---|---|---|---|
| `DiagramScreen` (`backoffice-tools.jsx`) | Canvas de arquitetura + DSL fictícia | `ferramentas/diagramas` + `mermaid-editor.tsx` | Código à frente (§1) | — |
| `BpmnScreen` (`backoffice-tools.jsx`) | Canvas BPMN artesanal | `ferramentas/bpmn` + `bpmn-modeler.tsx` | Código à frente (§1) | — |
| `ProcessGraph` (`backoffice-process-map.jsx`) | Grafo de processos, pan/zoom, export JSON Canvas | **nada** | Falta (§2) | L |
| `LineageScreen` (`backoffice-lineage.jsx`) | Linhagem dataset → treino → modelo → tenant, quatro colunas, foco transitivo | **nada** | Falta | M |
| `ModelCardScreen` (`backoffice-lineage.jsx`) | Model card: uso pretendido, fora de escopo, limitações, métricas, ética, pegada de carbono | **nada** | Falta | M |

Sobre `backoffice-lineage.jsx`: é um diagrama de colunas, não um canvas — cards
clicáveis e um fecho transitivo bidirecional sobre `LINEAGE_EDGES` que esmaece tudo
fora da cadeia do nó em foco. Nenhuma biblioteca de grafo; é grid CSS mais opacidade.
O esforço seria baixo **se as entidades existissem** — mas depende de
`LAB_DATASETS`, `LAB_RUNS`, `LAB_MODELS`, ausentes do schema. O `nav.ts` documenta a
decisão: o LAB saiu do menu "até ter PRD, SRD e schema", e enquanto isso valer
lineage e model card estão bloqueados por decisão, não por esforço de tela. Nenhum
dos três diagramas compartilha componente com os outros — cada um é um SVG próprio,
e não há "componente de diagrama" a reutilizar do bundle.

---

## 4. As demais telas

Por arquivo do design, com as rotas que ele registra em `backoffice-app.jsx`.

| Arquivo | Tela(s) | No código | Estado | Esforço |
|---|---|---|---|---|
| `backoffice-app.jsx` | Router, sessão, tema, toasts, guard | App Router + `lib/guard.ts` + `(staff)` | igual em intenção; código usa rotas reais, design usa `switch` + localStorage | — |
| `backoffice-shell.jsx` | Topbar, sidebar, modal host, `SignIn`, `NotStaff` | `components/chrome.tsx`, `nav.ts`, `shell.tsx`, `tela-de-bloqueio.tsx`, `app/sign-in` | diverge: código sem "Simular conta"; sidebar sem seção LAB e sem "Mapa de processos" | S |
| `backoffice-screens.jsx` | `ClientsScreen`, `ClientDetailScreen`, `ProvisionScreen`, `ActivityScreen` + modais | `/`, `/clientes/[slug]`, `/clientes/novo`, `/atividade` | existe | — |
| `backoffice-tenant.jsx` | Abas de tenant + `Suspend`/`Delete`/`Invite`/`EditRole` | `clientes/[slug]/abas/` | existe; abas a conferir uma a uma | M |
| `backoffice-tenant-detail.jsx` | `TenantDetailScreen` com abas do wireflow (Resumo, Users, Integ, MCP, Políticas, Billing, Charter, Signal, Audit) | `clientes/[slug]/abas/` | diverge provável: nove abas no design | M |
| `backoffice-screens-2.jsx` | `BbHomeScreen`, `ObservabilityScreen`, `ApprovalsScreen`, `AuditExplorerScreen` | `/home`, `/observabilidade`, `/aprovacoes`, `/audit` | existe | — |
| `backoffice-funnel.jsx` | `FunnelScreen`, `PipelineBoard`, `LeadModal`, `NewLeadModal` | `/funil` + `funil.tsx` | **diverge**: design tem 4 estágios (`lead/discovery/evaluation/proposal`) com peso, teto de estagnação e CAC por canal; código tem 3 (`LEAD/DISCOVERY/EVALUATION`) e `origem` como texto livre | M |
| `backoffice-funnel-stage.jsx` | `StagePanel` — critério de saída, teto, conversão histórica, edição de peso com registro append-only | **nada** | falta | M |
| `backoffice-commercial.jsx` | `ProposalBuilderScreen`, `ProposalsScreen` | `/propostas`, `/propostas/[id]/gerador.tsx` | existe | — |
| `backoffice-services.jsx` | `ServicesScreen`, `ServiceDetailScreen`, `NewServiceModal` | `/servicos`, `/servicos/[codigo]` | existe | — |
| `backoffice-delivery.jsx` | `DeliveryScreen`, `EngagementDetailScreen` | `/delivery` só a lista | **diverge**: sem rota de detalhe de engajamento | M |
| `backoffice-capacity.jsx` | `CapacityScreen`, `AddCapacityModal`, `AllocCellModal`, `WhatIfModal` | `/capacidade` | existe; os três modais a conferir | M |
| `backoffice-ip.jsx` | `IpLibraryScreen`, `BenchmarkScreen`, `NewIpModal` | `/ip`, `/benchmark` | existe | — |
| `backoffice-accounts.jsx` | `AccountsScreen`, `AccountDetailScreen`, `ContractModal`, `SetStatusModal` | `/contas` só a lista | **diverge**: sem rota de detalhe de conta | M |
| `backoffice-lab.jsx` | `LabGate`, `LabOverviewScreen`, `LabDatasetsScreen`, `LabRunsScreen`, `LabEvalsScreen` | **nada** | falta por decisão registrada em `nav.ts` | L |
| `backoffice-lineage.jsx` | `LineageScreen`, `ModelCardScreen` | **nada** | falta, bloqueado pelo LAB | M |
| `backoffice-process-map.jsx` | Dado + `ProcessGraph` | **nada** | falta (§2) | L |
| `backoffice-process-map-screen.jsx` | `ProcessMapScreen`, `ProcessPanel`, `ConnectSourceModal` | **nada** | falta (§2) | L |
| `backoffice-tools.jsx` | `BpmnScreen`, `DiagramScreen` | `/ferramentas/*` | diverge; código à frente (§1) | S |
| `backoffice-data.jsx` | Mock: tenants, contas, usuários conhecidos | Prisma | n/a | — |
| `backoffice-data-2.jsx` | Mock: planos, ambientes, roles, integrações, políticas, MCP, approvals, health | Prisma | n/a | — |
| `cosmos-kit.jsx` | Kit visual | `packages/design-system/cosmos/kit.tsx` | §6 | — |
| `cosmos-icons.jsx` | 90 glifos | `packages/design-system/cosmos/icons.tsx` | §6 | — |
| `charter-base.jsx` | Primitivas de tabela e filtro | espalhado em `apps/backoffice/components/` | §6 | — |

**Contagem por rota** (as 29 do `switch`, com `home` como `default`): 20 existem,
9 faltam (`processes`, `lab`, `lab-datasets`, `lab-runs`, `lab-evals`, `lab-lineage`,
`lab-card`, `engagement`, `account`). Das 20, quatro divergem materialmente:
`funnel`, `bpmn`, `diagrams` e o detalhe de tenant. Existem no código e não no
design: `/scaffold` (fila de gates cross-tenant, ADR-0013) e `/seguranca` — o design
é um recorte anterior ao Scaffold.

---

## 5. Os "logs" como telas

Quatro documentos que hoje vivem só em markdown e que se quer ver como tela com
controle. O design **não cobre nenhum dos quatro**.

| Documento | O que tem hoje | Onde no design | Estado |
|---|---|---|---|
| `docs/compliance/dpa-fornecedores.md` | 18 fornecedores (`V-01`..`V-18`), quadro-resumo com DPA / região / retenção / subprocessadores / transferência / data de verificação, mais uma seção por fornecedor | **não desenhado.** `dpa` e `vendor` aparecem só como tags em `PROC_NODES["PZ-08"]` ("Revisão de risco e vendor") e como sinônimos de busca em `PROC_SYNONYMS.contrato` | falta |
| `docs/comercial/cac-modelo.md` | Fórmula do CAC totalmente carregado, tabela de entrada, CAC por produto | **parcialmente.** `backoffice-funnel.jsx` tem `LEAD_SOURCES` com CAC médio por canal e um KPI "CAC sobre ACV ganho". É CAC por canal derivado do funil — não é o modelo carregado do documento, que soma salário, ferramenta e evento | diverge |
| `docs/financeiro/plano-de-contas.md`, `dre-modelo.md`, `caixa-13-semanas.md` | Plano de contas com centros de custo, DRE por frente, caixa de 13 semanas | **não desenhado.** Nenhuma tela financeira no bundle. O que existe de dinheiro está espalhado: margem por engajamento em `backoffice-delivery.jsx`, preço em `backoffice-commercial.jsx`, receita vendável em `backoffice-capacity.jsx` | falta |
| `docs/compliance/aviso-de-gravacao.md` | Aviso `PER_MEETING` e consentimento `STANDING`, memorando das duas bases legais | **não desenhado.** Nenhuma ocorrência de gravação, transcrição ou consentimento no bundle. A única `transcript` é a do reconhecimento de voz do mapa de processos, que é outra coisa | falta |

Implicação: não há design a seguir para essas quatro. Ou se encomenda o desenho, ou
se constrói sobre as primitivas do kit, que dão conta de um registro com dono e ação
por linha.

---

## 6. Componentes do kit

`cosmos-kit.jsx` e `cosmos/kit.tsx` são quase o mesmo arquivo. O que o design tem e
o código não:

| Componente | Para que serve no design |
|---|---|
| `SmartEmptyState` | Vazio com título, subtítulo, ícone e CTA — usado no mapa quando o filtro não casa nada. O código tem `components/vazio.tsx`, local e mais simples |
| `ToastStack` / `ToastItem` | Feedback no canto. **O código não tem toast nenhum**, nem no kit nem em `apps/backoffice`. Toda escrita do design termina em toast |
| `SkeletonCard`, `SkeletonColumn` | Esqueletos. O código tem `SkeletonKpi` no kit e `components/carregando.tsx` local |
| `useScreenLoad` | Atraso artificial de carregamento; provavelmente não portável — o `loading.tsx` do App Router faz o papel |

Do `charter-base.jsx` (10 primitivas), o código tem equivalentes **locais em
`apps/backoffice/components/`, não no pacote compartilhado**: `MetaCell`,
`FiltroChips`, `StatusDot`, `TableHead`, `TableRow`, `Tabela`, e `Eyebrow` exportado
de dentro de `chrome.tsx`. Faltam por completo **`Legend`**, **`BarRow`** (barra
rotulada, usada no model card e no benchmark) e **`useNarrow`** (o breakpoint que o
mapa de processos usa para empilhar o painel sob o grafo). O código tem e o design
não: `CopilotInsightBar`, `ErrorState`, `NavButton`, `Tabs` no kit, `useAction`.

Ícones: `cosmos/icons.tsx` é superconjunto de `cosmos-icons.jsx` — mas as telas do
design injetam glifos próprios em `ICON_PATHS` em tempo de carga, e **quatro não
existem no código**: `graph` (mapa), `drive` (fontes), `mic` (voz) e `layers2`
(paleta BPMN). `funnel` e `stairs` também não — o `nav.ts` contornou com `filter`.

---

## 7. Ambiguidades para o usuário confirmar

O `README.md` do bundle pede que se pergunte antes de construir.

1. **Ferramentas** — descartar o canvas SVG do protótipo em favor do bpmn-js/mermaid
   que já rodam, deixando o handoff aqui como só T6, T8 e T10? Sim ou não.
2. **Mapa de processos** — entidade nova (`StaffProcess`, `StaffProcessEdge`,
   `StaffProcessSource`), ou primeiro só leitura de um arquivo versionado no
   repositório, sem banco? Entidade ou arquivo.
3. **Escopo visual do mapa** — grafo polar com pan/zoom, marquee, molas e exportação
   JSON Canvas na primeira fatia, ou lista + filtros + painel do nó primeiro e o
   canvas depois? Canvas na v1 ou não.
4. **Fontes conectadas** — Drive, Notion, SharePoint, GitHub e Confluence na mesma
   fatia, ou o mapa nasce alimentado só pelos `StaffDiagram`? Todas ou só BPMN.
5. **LAB** — a decisão de `nav.ts` (fora até ter PRD, SRD e schema) continua de pé?
   Se sim, `lab-lineage` e `lab-card` ficam bloqueados junto. Continua ou reabre.
6. **Funil** — adotar os 4 estágios do design, acrescentando `PROPOSAL` ao enum, ou
   manter os 3 atuais porque `propostaId` já cobre esse estado? Quatro ou três.
7. **Peso e teto de estágio** — o `StagePanel` edita peso, teto e critério com
   registro append-only. É configuração em banco ou constante de código?
8. **Detalhes que faltam** — `/delivery/[id]` e `/contas/[slug]` entram nesta rodada,
   ou a lista atual basta? Entram ou não.
9. **Os quatro documentos da §5** — viram tela agora com desenho novo, ou espera-se
   um segundo handoff do Claude Design? Construir ou esperar.
10. **Toast** — adotar `ToastStack` no kit (o design supõe toast em toda escrita), ou
    manter o padrão atual sem feedback flutuante? Adotar ou não.

---

## 8. Ordem sugerida de implementação

Por dependência, não por valor.

> **Estado em 2026-09-07.** Já não é "nada começou".
> **Bloco 2 (funil)** e **bloco 3 (mapa de processos)** foram entregues —
> `StaffProcess`/`StaffProcessEdge` no schema, `ferramentas/processos/` na
> árvore, e os registros em `.claude/completions/2026-09-06-funil-v2.md` e
> `2026-09-06-mapa-de-processos.md`. **Bloco 1 (ferramentas)** foi fechado hoje:
> T6, T8 e T10 abaixo. As quatro superfícies da §5 viraram tela pelo plano
> `2026-09-05-telas-empresa-modelo.md` (`empresa/fornecedores`,
> `empresa/consentimento`, `empresa/cac`, `empresa/financeiro`) — sem desenho do
> Claude Design, construídas sobre as primitivas do kit, que era a saída
> prevista na §5.
> **Continua aberto**: bloco 0, bloco 4 e o bloco 5 (LAB, bloqueado por decisão).

**Bloco 0 — barato e desbloqueia o resto**
1. Ícones faltantes (`graph`, `drive`, `mic`, `layers2`) em `cosmos/icons.tsx`. S.
2. `Legend`, `BarRow`, `useNarrow` no kit; promover `MetaCell`, `FiltroChips`,
   `StatusDot`, `TableHead`/`TableRow` para o pacote se forem usados fora daqui. S.
   `ToastStack` no kit junto, se a pergunta 10 for "adotar". S.

**Bloco 1 — ferramentas, o foco mais barato** — ✅ feito em 2026-09-07
3. ~~`sobreTenantId` na tela e na action do estúdio (T6)~~. `definirClienteDoDiagramaAction`
   grava o campo, `getDiagram` devolve id e nome, e o seletor fica no cabeçalho
   do diagrama aberto. Fora do `updateDiagramAction` de propósito: trocar de
   cliente não muda o desenho, e uma revisão sem diferença no `source` faria o
   histórico responder "o que mudou" com "nada".
4. ~~Exportar SVG no Mermaid (T8) e badge/tom no `PageHeader` (T10)~~. O botão
   `SVG` baixa a prévia que já está em memória, sem ida ao servidor; o
   `PageHeader` ganhou `tone` e o selo `self-hosted` — `purple` no BPMN, `blue`
   nos diagramas, como o design pedia.

**Bloco 2 — funil, porque o mapa depende do vocabulário dele**
5. Decidir a pergunta 6; se forem quatro estágios, migration do enum. M.
6. `StagePanel` (`backoffice-funnel-stage.jsx`), depois de 5. M.

**Bloco 3 — mapa de processos, a peça grande**
7. Schema `StaffProcess`/`StaffProcessEdge`/`StaffProcessSource`, com `diagramId`
   opcional para `StaffDiagram`. Depende de 1 e 3 — a ponte para o modelador só faz
   sentido depois que o estúdio souber de tenant. L.
8. Actions e tela em lista + filtros + painel do nó. M.
9. Grafo com pan/zoom e exportação JSON Canvas, se a pergunta 3 for "canvas na v1". L.
10. Fontes conectadas e `ConnectSourceModal`, se a pergunta 4 pedir. L.

**Bloco 4** — `/delivery/[id]` e `/contas/[slug]`. M cada.

**Bloco 5, bloqueado por decisão** — LAB (overview, datasets, runs, evals), depois
lineage e model card. Só com PRD, SRD e schema, conforme `nav.ts`. L.

**Fora desta ordem** — as quatro superfícies da §5 não têm design. Não entram numa
ordem de implementação enquanto a pergunta 9 não for respondida.
