# Trilha de framework no Scaffold: o que falta no schema

- **Pedido por:** CEO, via Morgana · **Data:** 2026-09-30 · **Autor:** Norte (CPO)
- **Estado:** decisão **provisória** (D-23 em `../registro-de-decisoes.md`). Trilha escolhida:
  **AI Governance** (§6). O detalhamento por perfil e por cláusula espera a pesquisa do Radar.
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

## 6. Trilha escolhida: AI Governance (2026-09-30)

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
