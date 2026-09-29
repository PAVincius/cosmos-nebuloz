# Decisões provisórias de PO — handoff "correções" (Scaffold · Signal · Charter)

**Data:** 2026-09-29 (noite de 28 para 29) · **Autor:** Norte (CPO) · **Status:** PROVISÓRIO, aguarda confirmação do CEO às 06:00.

**Fonte do pedido:** `/Users/azos/Downloads/correcoes.pdf` (13 páginas, "Documento de modificações · PO · PM · DEV", set/2026) e o backlog que o acompanha, `/Users/azos/Downloads/Scaffold - Backlog Trilhas e Entregaveis.md`. O protótipo citado (`scaffold.html`, `scaffold-data.jsx`) não está na máquina: onde o PDF só dá o nome ou o código, o conteúdo abaixo é decisão minha, não transcrição.

**Fundamento:** `docs/produto/scaffold-{prd,srd}.md`, `cosmos-prd.md`, `mapa-de-fronteiras.md`, o schema (`packages/database/prisma/schema/scaffold.prisma`, `art-core.prisma`), a matriz `packages/rbac/src/scaffold-matrix.ts` e o seed `packages/database/scripts/scaffold-templates.ts`. A memória de longo prazo (`mcp__memoria__buscar`) deu timeout nesta sessão; não consegui conferir se algo abaixo já havia sido decidido antes. Se houver conflito com decisão registrada lá, a registrada vale até o CEO decidir.

**Como ler:** cada decisão tem **Escolha**, **Descartada** e **Reversibilidade**. Números marcados *(hipótese)* não têm fonte; são padrão proposto e o limiar real de cada trilha vem do caso de negócio assinado.

**Ordem de entrega:** esta parte 1 cobre (b), (c), (d), (e) e (a). SG-PO e CH-PO (item f) vêm na parte 2, no mesmo arquivo.

---

## (b) Códigos A1…E3 sobre as 4 fases

**Escolha.** Continuam 4 fases (`ScaffoldPhase`: ASSESS, PILOT, SCALE, EMBED). A letra é o **grupo de passos**, e não a fase:

| Letra | Fase (`ScaffoldPhase`) | Grupo | Coluna na anatomia |
|---|---|---|---|
| A | ASSESS | Diagnóstico e promessa | 1 |
| B | PILOT | Piloto com contrafactual | 2 |
| C | SCALE | Escala sob política | 3 |
| D | EMBED | Desligar o caminho antigo | 4 |
| E | EMBED | Documentar, transferir e sustentar | 4 (mesma coluna, abaixo de D) |

- Código de passo = letra + número (`A1`, `E3`). Código de entregável = passo + ponto + número (`A1.1`, `B1.2`).
- Os códigos ficam **estáveis entre versões** do mesmo template e **nunca são reusados**: um passo removido deixa o código vago (SC-DEV-01, ST-03).
- O grupo E fecha no gate da EMBED, como D. Não cria estado novo: a janela de observação de 30 dias (SG-06, `observationEndsAt`) continua sendo critério DERIVED da EMBED, como já é no seed.

**Por quê.** O PDF manda "anatomia em 4 colunas com gate" (p. 3) e ao mesmo tempo usa "A1…E3". Quatro colunas com cinco letras só fecha se uma coluna tiver dois grupos. A EMBED é a fase mais longa do método: aposentar o caminho antigo (D) é outro trabalho, com outro dono, que transferir a posse (E). O seed de hoje já tem os dois na mesma fase (`retire-old`, `write-onboarding` / `handover`).

**Descartada: criar uma fase E (5ª fase).** A ordem das fases é regra do produto ("uma fase não pula para a frente", `scaffold.prisma:21-23`). Três travas estão amarradas a fases nomeadas: SG-04 na ASSESS, SG-05 na SCALE e SG-06 na EMBED. Além disso, `closePhase()` tem teste de arquitetura, o PRD vende quatro fases e o Signal congela o baseline no gate. Uma 5ª fase mexe em tudo isso para ganhar só um rótulo.

**Reversibilidade.** Até o primeiro `publish` das versões novas, a decisão é livre. Depois dele, o código vira identificador imutável (ST-03): dá para mudar a coluna em que E aparece, mas não o código. **Este é o único ponto de (b) que o CEO precisa confirmar antes do publish.**

---

## (c) As 5 trilhas por forma do trabalho

### c.0 Regras comuns aos 5 templates

1. **Forma do trabalho (X-02):** enum com os valores `CONVERSATIONAL`, `ANALYSIS`, `DOC_REVIEW`, `TRIAGE`, `REPORTING`. Os três últimos reusam os nomes do `ScaffoldArchetype` atual, para que a promoção a enum compartilhado entre produtos não exija migração de dado. Onde o enum mora (plataforma ou Scaffold) é decisão do Maestro.
2. **Chaves de template:** `conversational` e `analysis` (novas); `triage`, `docreview` e `reporting` (existentes) ganham versão nova. As versões antigas ficam pinadas nas trilhas que as usam (ST-03).
3. **16 entregáveis por trilha**, todos obrigatórios. O PDF dá "16 no conversacional" (SC-DEV-02); os cinco templates usam o mesmo esqueleto. **Opcional só existe como adicional** (fora do template), e aí quem adiciona escolhe se é obrigatório. O campo `required` fica no modelo (default `true`) para uso futuro.
4. **Responsável por entregável (`who`)**: O = dono do processo, C = consultora, A = área técnica (TI/dados), J = Jurídico/DPO. *(hipótese: o PDF usa O/C/A/J sem legenda; O, C e J são inferidos do backlog, e A é minha leitura.)* Isso é a **função** de quem produz o entregável. Não é papel de acesso; ver (d).
5. **Tipos (`kind`)**: documento, planilha, dataset, configuração, assinatura, treinamento, relatório, pacote (backlog DEV-05).
6. **Regra de gate do sistema, igual em toda fase e toda trilha:** "todos os entregáveis obrigatórios da fase aprovados" (SG-01 no PDF). É critério DERIVED que a máquina de gate aplica. **Não é critério de template**, e por isso nenhum overlay consegue removê-lo.
7. **Critério mensurável (SC-PO-02):** todo critério declara métrica, comparador, limiar e janela. O limiar vem do caso de negócio assinado (A3.2) ou do critério de vitória (B1.1), não de texto livre. O critério genérico `no-new-risk` ("Nenhum risco novo introduzido", `scaffold-templates.ts:183`) sai das versões novas e é substituído por G-GUARD e G-CHARTER abaixo.

### c.1 Esqueleto comum (15 dos 16 entregáveis têm o mesmo código nas cinco trilhas)

| Passo | Entregável | Nome (genérico; o texto por trilha está em c.3) | Tipo | Quem |
|---|---|---|---|---|
| A1 Mapear o processo | A1.1 | Mapa do processo atual e volume | planilha | O |
| A2 Mapear a fonte | A2.1 | Fonte de verdade do trabalho (específico por trilha) | varia | A ou O |
| A3 Medir e prometer | A3.1 | Baseline medido, ≥ 4 semanas de dado | planilha | A |
| | A3.2 | Caso de negócio assinado | assinatura | O |
| B1 Preparar o piloto | B1.1 | Critério de vitória e contrafactual escritos | documento | C |
| | B1.2 | Configuração do piloto (específico por trilha) | configuração | A |
| B2 Garantir reversão | B2.1 | Plano de rollback testado | documento | A |
| B3 Rodar e comparar | B3.1 | Relatório do piloto contra o contrafactual | relatório | C |
| C1 Aplicar política | C1.1 | Política do Charter vinculada ao fluxo | assinatura | J |
| C2 Treinar o time | C2.1 | Registro de treinamento | treinamento | O |
| C3 Migrar volume | C3.1 | Curva de migração (específico por trilha) | planilha | A |
| D1 Aposentar o caminho antigo | D1.1 | Registro de desativação | documento | A |
| E1 Escrever o processo novo | E1.1 | Runbook e onboarding do time | documento | O |
| E2 Transferir a posse | E2.1 | Handover pack (o aceite do time é a aprovação dele pelo dono do processo) | pacote | C |
| E3 Sustentar | E3.1 | Plano de sustentação: dono da métrica e cadência pós-entrega | documento | O |

São 15 entregáveis no esqueleto. Por fase: ASSESS 4, PILOT 4, SCALE 3, EMBED 4 (D 1 + E 3). O 16º é o específico de cada trilha, listado em c.3, e fica sempre na PILOT (que passa a ter 5).

- **A3.2** é o caso de negócio (`ScaffoldBusinessCase`). O estado dele deriva da assinatura (SG-04) e ninguém o aprova à mão. Isso destrava o bloqueio P0 do SRD ("a ASSESS não fecha"): o entregável A3.2 é o gatilho de criação do caso de negócio que hoje não existe.
- **C1.1** só é obrigatório quando o tenant tem o Charter contratado, como o SG-05 já faz (`assertCharterPolicyAcked`). Sem Charter, ele nasce **dispensado pelo sistema**, com o motivo gravado. É a única exceção à regra 3.
- **E3.1** substitui a "lição de encerramento". Pelo mapa (entidade 15), a lição é do Signal e volta ao template como insumo. Se o Scaffold a produzisse, estaria invadindo a entidade 15.

### c.2 Critérios de gate comuns (além da regra 6)

| Fase | Chave | Critério | Avaliação |
|---|---|---|---|
| ASSESS | `baseline-measured` | Baseline com ≥ 4 semanas de dado (já no seed) | DERIVED |
| ASSESS | `baseline-signed` | Caso de negócio assinado (SG-04, já no seed) | DERIVED |
| PILOT | `beats-baseline` | Métrica primária do B1.1 melhora ≥ limiar do B1.1 contra o contrafactual, na amostra mínima do B1.1 | MANUAL, com o número do B3.1 anexado |
| PILOT | G-GUARD `guard-held` | Nenhuma métrica guarda do B1.1 piora além da tolerância escrita no B1.1 | MANUAL |
| PILOT | `rollback-tested-prod` | Rollback executado em produção ao menos 1 vez, com registro no B2.1 (regra da v4) | MANUAL |
| SCALE | `charter-policy-acked` | Política aceita (SG-05, condicional ao Charter) | DERIVED |
| SCALE | G-CHARTER `charter-controls-clear` | Caso de uso ligado no Charter sem controle em Sem evidência, Ajuste pedido ou Vencida (costura CH-PM-03) | DERIVED, condicional ao Charter |
| SCALE | `volume-migrated` | ≥ 80% do volume no caminho novo por 2 semanas seguidas *(hipótese; troca "maioria do volume", que não é mensurável como está)* | MANUAL, com C3.1 |
| EMBED | `old-path-retired` | Zero transações pelo caminho antigo nos 14 dias após a desativação *(hipótese: 14 dias)* | MANUAL, com D1.1 |
| EMBED | `handover-delivered` | E2.1 aprovado pelo dono do processo | DERIVED |
| EMBED | `observation-window` | 30 dias sem envolvimento da Nebuloz (SG-06, já no seed) | DERIVED |

### c.3 As 5 trilhas (SC-PO-01 e o conteúdo específico)

Casos de referência do PDF p. 2: Orbi (Orbital Pay), Agrônomo virtual (Helix Agro), Glosas (Vanta Saúde), Triagem de autorizações prévias (TR-104 · IN-014 · UC-118).

**1. Assistente conversacional — `conversational` (novo)**
- *Quando usar:* o público pergunta em volume e a resposta existe em fonte oficial. *Quando não usar:* a resposta exige julgamento caso a caso ou não tem fonte escrita; aí é Triagem ou Análise.
- *Casos típicos:* Orbi, Agrônomo virtual, Copiloto do beneficiário (UC-117).
- *Métrica do gate:* taxa de resolução sem humano *(primária)* e taxa de respostas incorretas em auditoria semanal *(guarda)*.
- *Específicos:* A2.1 = base de conhecimento oficial com dono por tema (documento, O). B1.2 = configuração do assistente com temas proibidos e regra de escalonamento a humano (configuração, A). C3.1 = curva de migração por canal. **16º:** B1.3 = lista de temas proibidos e RIPD quando o dado for ≥ confidencial (documento, J). O exemplo "RIPD entra no conversacional a partir de dado confidencial" está no PDF, p. 11.
- *Critérios específicos:* PILOT `contrafactual-held`: 10% das conversas sem assistente por 4 semanas (contrafactual do PDF, p. 8). PILOT `incorrect-rate`: incorretas ≤ limite do B1.1 na auditoria semanal. O UC-117 usa 2% como limite e hoje mede 4% (PDF p. 11); o 2% é número do cenário de demo, não padrão.

**2. Análise e priorização — `analysis` (novo)**
- *Quando usar:* um score ordena casos para uma pessoa decidir. *Quando não usar:* o sistema decide sozinho o destino, que é Triagem; ou não há desfecho histórico para calibrar.
- *Casos típicos:* Glosas hospitalares (TR-114, UC-119).
- *Métrica do gate:* valor recuperado ou acerto no topo da fila *(primária)* e razão de erro entre segmentos *(guarda)*.
- *Específicos:* A2.1 = dataset histórico com desfecho real (dataset, A). B1.2 = modelo de score com variáveis documentadas (configuração, A). C3.1 = curva de migração por fila. **16º:** B1.3 = explicabilidade para quem decide, LGPD art. 20 (documento, J).
- *Critérios específicos:* PILOT `top-k-precision`: precisão no topo da fila ≥ limiar do B1.1. PILOT `segment-parity`: nenhum segmento com erro > 1,5× a média *(hipótese: 1,5×)*. O achado do UC-119/TR-114, erro 2,3× em autogestão (PDF p. 11), reprovaria.

**3. Revisão de documentos — `docreview` (versão nova)**
- *Quando usar:* ler contratos, laudos ou prontuários e extrair o que importa. *Quando não usar:* o documento não tem estrutura repetível, ou a decisão final não é auditável por amostra.
- *Casos típicos:* laudos e contratos; dos casos do PDF, nenhum é puro.
- *Métrica do gate:* concordância com revisão humana *(primária)* e erro em campos críticos *(guarda)*.
- *Específicos:* A2.1 = amostra rotulada por tipologia (dataset, A). B1.2 = configuração de extração (configuração, A). C3.1 = curva por tipologia. **16º:** B3.2 = planilha de concordância em amostragem dupla (planilha, C). É o `double-sampling` da docreview v2, que vira entregável.
- *Critérios específicos:* PILOT `sampling-agreement` (já existe na v2): concordância ≥ limiar do B1.1. PILOT `critical-fields`: erro em campo crítico ≤ baseline.

**4. Triagem de demanda — `triage` (versão nova; a v4 atual se chama "Triagem de suporte")**
- *Quando usar:* decidir destino e urgência de pedidos. *Quando não usar:* o pedido exige análise de mérito; aí é Análise ou Revisão.
- *Casos típicos:* Triagem de autorizações prévias (TR-104, IN-014, UC-118).
- *Métrica do gate:* tempo até o destino certo *(primária)* e taxa de reencaminhamento *(guarda)*.
- *Específicos:* A2.1 = histórico de pedidos com destino e urgência finais (dataset, A). B1.2 = regras de triagem e holdout configurados (configuração, A). C3.1 = curva por tipo de pedido. **16º:** B1.3 = lista de casos que sempre vão para humano (documento, O).
- *Critérios específicos:* PILOT `holdout-held`: holdout de 15% por ordem de chegada (PDF p. 8). PILOT `no-urgent-downgrade`: zero pedidos urgentes classificados como não urgentes na amostra auditada. O B2.1 aqui é exatamente o "TR-2 rollback testado" que segura o gate do Pilot no UC-118 (PDF p. 11).

**5. Relatórios recorrentes — `reporting` (versão nova)**
- *Quando usar:* gerar conteúdo que sai da empresa ou vira registro, em ciclo fixo. *Quando não usar:* o relatório é único ou exploratório.
- *Casos típicos:* relatórios regulatórios e de gestão.
- *Métrica do gate:* horas por ciclo *(primária)* e divergências por ciclo *(guarda)*.
- *Específicos:* A2.1 = fontes de dado com dono por campo (documento, A). B1.2 = configuração da geração (configuração, A). C3.1 = reconciliação por ciclo (planilha, A), que é o `reconciliation-checklist` da v3. **16º:** B1.3 = checklist de revisão antes de sair (documento, C).
- *Critérios específicos:* PILOT `parallel-cycles`: 2 ciclos em paralelo com o processo antigo *(hipótese: 2)*. SCALE `reconciliation-clean` (já existe na v3): reconciliação fecha sem divergência não explicada.

Com isso, cada trilha tem 15 entregáveis do esqueleto + 1 específico = 16.

**Descartada:** passos diferentes por trilha desde a raiz. Cinco anatomias sem esqueleto comum quebram a comparação no portfólio ("X/Y entregáveis") e a costura com o Signal, que espera a mesma chave nos três produtos.

**Reversibilidade:** o texto e os limiares são livres até o publish e, depois dele, mudam com versão nova. Os códigos têm a mesma trava de (b).

---

## (d) Papéis sponsor e team lead

**Escolha: dois papéis novos em `ScaffoldRole`, `SPONSOR` e `TEAM_LEAD`, só de leitura** (`portfolio.read`, `artefact.read`, `deliverable.read`). Escrita devolve 403 no backend (SC-DEV-07).

**Por quê.** O PDF é explícito: "sponsor e team lead só leem" (SC-PO-04). Nenhum papel existente é só de leitura:
- Mapear sponsor em TRANSFORMATION_LEAD, como sugere o comentário em `scaffold.prisma:73-77`, daria `track.manage`, `gate.close` e `businesscase.write`, o que contradiz o PDF.
- Mapear team lead em TEAM_MEMBER daria `step.complete`, o que também contradiz o PDF.

**Descartada:** um papel único `VIEWER`. O card "Quem responde" e a notificação de estagnação ao sponsor (SN-07) precisam saber *quem* é o sponsor.

**Consequência no código:** o comentário de `scaffold.prisma:73-77` ("sponsor lê como TRANSFORMATION_LEAD") deixa de valer. `businesscase.sign` continua com PROCESS_OWNER, como está na matriz. O sponsor do PDF é observador, não signatário.

**Reversibilidade:** adicionar valor a enum é migração aditiva e barata. Remover depois exige migrar membros, e é por isso que o CEO precisa confirmar.

### Matriz do entregável (SC-PO-04)

Permissões novas: `deliverable.read`, `deliverable.work`, `deliverable.review`, `deliverable.reopen`, `deliverable.add`.

| Ação | TEAM_MEMBER | PROCESS_OWNER | TRANSFORMATION_LEAD | CONSULTANT | ADMIN | SPONSOR | TEAM_LEAD |
|---|---|---|---|---|---|---|---|
| Ler, baixar (download logado) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Iniciar, anexar versão, enviar, editar resumo (`work`) | só se responsável | só se responsável | ✓ | ✓ | — | — | — |
| Aprovar, pedir ajuste (`review`) | — | só se aprovador | só se aprovador | só se aprovador | — | — | — |
| Reabrir aprovado (`reopen`) | — | ✓ | ✓ | ✓ | — | — | — |
| Adicionar entregável e marcar como obrigatório (`add`) | — | ✓ | ✓ | ✓ | — | — | — |

Regras de instância:
1. **Ninguém aprova o que é seu.** Aprovador padrão: o dono aprova o que não é dele, e a consultora aprova o que é do dono (backlog DEV-06).
2. **Reabrir tem o mesmo peso de fechar gate.** `reopen` vai para quem tem `gate.close`.
3. **ADMIN não mexe em entregável.** "Administrar acesso não é decidir risco" (`scaffold-matrix.ts:115`).

---

## (e) Costuras

### e.1 Scaffold ↔ Cosmos

O mapa diz: hierarquia de portfólio é do Cosmos (entidade 9, que o Scaffold lê), gap vira iniciativa por ação do Cosmos (entidade 6) e "gate de fase ≠ gate de ciclo de vida" (entidade 8). Portanto:

1. **O Scaffold não escreve no Cosmos.** Ele emite evento (X-04: `scaffold.gate.closed`, `scaffold.gate.reopened`) e o Cosmos cria ou liga o item. Tenant sem o módulo Cosmos não gera nada, pelo mesmo padrão de degradação do SG-05.
2. **Épico: um por trilha, nascido no fechamento do gate da ASSESS**, quando o caso de negócio está assinado. O Cosmos cria o épico em `FUNNEL` com a hipótese do caso, ou liga um épico existente escolhido pelo usuário. A ligação mora no Cosmos (`Epic.originTrackId`, texto sem FK), pelo mesmo padrão de `sourceGapId`.
3. **Feature: uma ao abrir a PILOT e uma ao abrir a SCALE**, sob o épico ("Piloto TR-104", "Escala TR-104"). O evento que dispara é o gate anterior fechado. EMBED não gera feature: é mudança de organização, não trabalho de engenharia.
4. **O gate do Scaffold não move o ciclo de vida do épico.** O Cosmos só *mostra* a fase e o gate da trilha. Reabrir um gate não apaga épico nem feature; o Cosmos recebe `gate.reopened` e decide.
5. **Idempotência:** chave `(tenantId, trackId, phase)`. Reprocessar o evento não duplica.

**Descartadas:**
- Épico na criação da trilha: poluiria o funil com trilhas que morrem na ASSESS.
- Item por entregável: seriam 16 por trilha, puro ruído.
- Gerar no *fechamento* da PILOT: o item nasceria depois do trabalho feito.

**Reversibilidade:** alta. É contrato de evento, sem migração no Scaffold. O custo de mudar fica no consumidor do Cosmos.

### e.2 Scaffold ↔ Linear

1. **Link manual, de 0 a N por entregável:** `{provider: cosmos|linear|github|jira, externalId, url}`. O responsável liga; o link é referência.
2. **O estado da issue nunca muda o estado do entregável.** A aprovação continua humana no Scaffold.
3. **Tenant com Cosmos + sync Linear:** o link preferido é para o item do Cosmos, que já sincroniza com o Linear (`LinearSync`, `Feature.externalId`). **Tenant sem Cosmos:** a URL do Linear fica guardada, sem chamada de API e sem sync (R1). Mostrar o status da issue lido via Cosmos fica para R3.

**Descartada: integração Linear própria no Scaffold.** Seria um segundo token e uma segunda fonte de verdade para a mesma issue, e a "fonte de verdade do épico" entre Linear e Cosmos já é uma pergunta aberta (`cosmos-prd.md:229-231`).

**Reversibilidade:** alta. Um campo de link, aditivo.

---

## (a) SC-PO-01…07

| ID | Escolha | Descartada | Reversibilidade |
|---|---|---|---|
| SC-PO-01 | As 5 trilhas de c.3, cada uma com quando usar, quando não usar, casos e métrica do gate | Manter só os 3 arquétipos | Até o publish |
| SC-PO-02 | Regra c.0.7. Os critérios de c.2 e c.3 declaram métrica, limiar e janela. `no-new-risk` sai | Manter o critério genérico e deixar a interpretação para a consultora | Versão nova do template |
| SC-PO-03 | Fluxo do PDF: Não iniciado → Em elaboração → Em revisão → Ajuste pedido / Aprovado; Aprovado → Reaberto → Em elaboração. Detalhes abaixo* | Permitir editar arquivo de entregável aprovado sem reabrir | Média: o histórico é append-only |
| SC-PO-04 | Matriz de (d) | — | Ver (d) |
| SC-PO-05 | Adicional pode ser obrigatório para o gate. Dois adicionais com o mesmo código de passo e o mesmo nome normalizado em **duas trilhas do mesmo tenant** geram proposta de promoção ao **overlay do tenant**. Promover ao método global é decisão da consultora na publicação de versão, lendo só metadado (nome, passo, tipo) pela fila do back-office (ADR-0013) | Promover direto ao template global: o template é da Nebuloz, e vazaria conteúdo entre tenants | Alta |
| SC-PO-06 | Aprovar Orbi, Agrônomo virtual, Glosas e Autorizações prévias só em tenant de demo. Nenhum número além dos do PDF: 4% contra limite de 2%, erro 2,3×, 10% por 4 semanas, holdout de 15%. Nome único: IN-014 = "Triagem de autorizações prévias" (SG-PM-04) | Números ilustrativos novos | Alta |
| SC-PO-07 | **"Versões e ajustes"** (a rota `templates` fica) | "Versões e overlays": "overlay" é jargão para o cliente | Alta: é rótulo |

*Detalhes de SC-PO-03:
- Pedir ajuste e reabrir exigem comentário.
- Enviar exige arquivo.
- Entregável de fase futura fica só leitura.
- Reabrir um aprovado com a fase em GATE_READY volta a fase para OPEN. Com a fase CLOSED, reabre a fase (REOPENED, `reopenCount` + 1), e por isso exige `deliverable.reopen`.

**Migração (SC-PM-03, contexto):** cada `ScaffoldStepInstance` existente vira um entregável cujo código é a `key` legada. Nenhum histórico é reescrito. Em produção havia 0 trilhas na consulta de 2026-09-22 (`scaffold-srd.md`, conflito ADR-0014). Esse dado não foi reconferido hoje.

---

## (f) SG-PO e CH-PO

Parte 2, a seguir neste arquivo.

## Para o CEO confirmar às 06:00 (os pontos menos reversíveis)

1. Os códigos A–E com E dentro da EMBED (b): travam no primeiro publish.
2. `SPONSOR` e `TEAM_LEAD` como papéis novos em `ScaffoldRole` (d).
3. 16 entregáveis, todos obrigatórios, com opcional só como adicional (c.0.3).
4. Limiares marcados *(hipótese)*: 80% por 2 semanas, 14 dias, 1,5×, 2 ciclos.
