# Checklist de avaliação interna de engenharia — Cosmos e back office

Responda cada linha com **X** (não), **Y** (parcial) ou **Z** (sim).

**Y é a resposta mais útil do checklist.** "Existe, mas só para metade dos
casos" é informação acionável; forçar essa realidade para X ou Z apaga
justamente onde está o trabalho. Quando marcar Y, escreva ao lado o que falta —
uma linha basta.

**Uma regra para não inflar a nota:** só marque Z se conseguir apontar o
arquivo, o teste ou o job que sustenta a resposta. Controle que ninguém consegue
localizar é controle que não existe — e um checklist cheio de Z sem lastro é
pior que um cheio de X, porque para de fazer alguém procurar.

Escopo dos blocos:

| Bloco | Cobre |
|---|---|
| A — Transversal | monorepo, CI/CD, segredos, dependências, processo |
| B — Cosmos | `apps/app` — produto multi-tenant com IA |
| C — Back office | `apps/backoffice` — painel interno da Nebuloz |

---

## A — Transversal

### A.1 Arquitetura e fronteiras

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| A1.1 | Existe um diagrama atual das fronteiras de confiança (navegador → app → banco → provedor de LLM → integrações de terceiro)? | | |
| A1.2 | Está escrito em algum lugar qual app pode falar com qual pacote, e isso é verificado por ferramenta (não só por combinado)? | | |
| A1.3 | Toda escrita em banco passa por uma camada que exige `tenantId`, sem caminho alternativo? | | |
| A1.4 | Mudança de schema exige migration versionada, sem `db push` em produção? | | |
| A1.5 | O que é derivado (status, saúde, score) está documentado como derivado, em vez de virar coluna que envelhece? | | |

### A.2 Segredos e dependências

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| A2.1 | Nenhum segredo em código, e isso é verificado no CI a cada PR? | | |
| A2.2 | Existe processo de rotação de segredo com prazo, e a última rotação tem data registrada? | | |
| A2.3 | Segredo que vazou em log, ticket, transcrição ou conversa com IA é tratado como comprometido e rotacionado? | | |
| A2.4 | `pnpm audit` roda no CI e falha o PR acima de uma severidade definida? | | |
| A2.5 | As vulnerabilidades **críticas** abertas hoje têm dono e prazo, ou estão apenas listadas? | | |
| A2.6 | Dependência Python (`experiments/slm-pipeline/requirements.txt`) tem versão fixada? | | |
| A2.7 | O lockfile é commitado junto com toda mudança de `package.json`, e o CI valida com `--frozen-lockfile`? | | |

### A.3 CI/CD

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| A3.1 | Todo app do monorepo tem `lint`, `typecheck`, `test` e `build` rodando no CI? | | |
| A3.2 | Job vermelho bloqueia merge, ou dá para mergear por cima? | | |
| A3.3 | Existe proteção de branch na `main` exigindo review de outra pessoa? | | |
| A3.4 | Existe `CODEOWNERS` roteando revisão por área (auth, billing, IA, dados)? | | |
| A3.5 | Os jobs que hoje falham de forma crônica estão como falha declarada (não silenciados com `continue-on-error`)? | | |
| A3.6 | Deploy de produção é rastreável até um commit e reversível sem intervenção manual longa? | | |
| A3.7 | Migration de banco é aplicada por pipeline, não por alguém colando SQL no editor? | | |

### A.4 Observabilidade

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| A4.1 | Todo app manda exceção de produção para um coletor (Sentry ou equivalente)? | | |
| A4.2 | Existe alerta que chama alguém, ou os erros só ficam no painel esperando alguém abrir? | | |
| A4.3 | Log de produção não contém PII, prompt em claro nem segredo? | | |
| A4.4 | Dá para responder "o que este usuário fez às 14h de terça" sem abrir o banco à mão? | | |

### A.5 QA e processo

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| A5.1 | Feature relevante passa por QA de alguém que não a escreveu? | | |
| A5.2 | O template de PR tem checklist de segurança, e ele é preenchido de verdade? | | |
| A5.3 | Existe suíte de regressão que roda antes de release, distinta da suíte de PR? | | |
| A5.4 | Erro de produção vira teste que reproduz, antes de virar correção? | | |
| A5.5 | Existe runbook para incidente de vazamento de dado, abuso de agente e custo fora de controle? | | |

---

## B — Cosmos (`apps/app`)

### B.1 Segurança e multi-tenancy

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| B1.1 | Toda server action começa por sessão de tenant, e não apenas o layout? | | |
| B1.2 | Toda consulta tem `tenantId` no `where`, incluindo as que buscam por id? | | |
| B1.3 | Existe teste que falha se alguém remover o filtro de tenant de uma query? | | |
| B1.4 | RBAC é verificado no servidor, e o botão escondido na UI é enfeite, não controle? | | |
| B1.5 | Rota de API (não server action) tem proteção CSRF onde cabe? | | |
| B1.6 | Rate limiting cobre todas as rotas de IA, ou só algumas? | | |
| B1.7 | Credencial de integração é cifrada em repouso e nunca entra em `select` de leitura? | | |

### B.2 IA — entrada, saída e agência

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| B2.1 | Conteúdo de terceiro (transcrição de reunião, descrição vinda do cliente) é delimitado antes de entrar no prompt? | | |
| B2.2 | Instrução de sistema e entrada de usuário estão em campos separados, com hierarquia que a entrada não consegue subverter? | | |
| B2.3 | Resposta do LLM é tratada como dado não confiável antes de persistir ou acionar efeito colateral? | | |
| B2.4 | Resposta de LLM nunca chega a `dangerouslySetInnerHTML` sem sanitização? | | |
| B2.5 | Toda tool de escrita do Copilot verifica papel do usuário, e existe teste que prova que o guard é de fato exercido? | | |
| B2.6 | Operação de alto impacto disparada por agente exige confirmação humana? | | |
| B2.7 | Tool call de agente é registrada com quem, quando, qual ação e quais parâmetros? | | |
| B2.8 | Prompt de sistema é versionado, com rollback possível sem deploy completo? | | |

### B.3 IA — dados, custo e RAG

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| B3.1 | Está escrito se dado de cliente pode ou não ser usado para treinar, e isso bate com o contrato? | | |
| B3.2 | A base vetorial (`PIKnowledgeVector`) é isolada por tenant em **toda** consulta, inclusive nas de manutenção? | | |
| B3.3 | Documento é sanitizado antes de ser indexado, com remoção de segredo? | | |
| B3.4 | Todo ponto de chamada de LLM tem teto de tokens de saída? | | |
| B3.5 | Existe cota por tenant para **todos** os pontos de IA, ou só para o Copilot? | | |
| B3.6 | Custo de IA é monitorado quase em tempo real, com alerta para pico anômalo? | | |
| B3.7 | Existe kill switch para desligar IA de um tenant específico sem deploy? | | |
| B3.8 | Prompt e resposta são mascarados antes de irem para a telemetria? | | |

### B.4 Testes

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| B4.1 | Regra de negócio crítica (transição de estado, cálculo de score, limite de WIP) tem teste que expressa a **regra**, não o código? | | |
| B4.2 | Teste de autorização existe para cada action de escrita, cobrindo o papel que **não** pode? | | |
| B4.3 | Erro de validação e conflito de concorrência (duas escritas simultâneas) estão cobertos? | | |
| B4.4 | Tela crítica tem teste de componente cobrindo dado renderizado, interação principal, estado vazio e estado de erro? | | |
| B4.5 | Suíte E2E cobre as jornadas que dão dinheiro (onboarding, contratação, planejamento de PI)? | | |
| B4.6 | A suíte E2E está verde hoje, ou há specs quarentenados sem prazo? | | |
| B4.7 | Teste chama LLM real, ou tudo é mockado? | | |
| B4.8 | Existe teste que prova que dado de um tenant não aparece para outro? | | |

### B.5 Cobertura

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| B5.1 | Cobertura do `apps/app` é medida e publicada a cada PR? | | |
| B5.2 | Existe limiar mínimo que reprova o PR, e ele é respeitado (não baixado quando incomoda)? | | |
| B5.3 | A cobertura é lida por área crítica, ou só o número global do app? | | |
| B5.4 | Código novo entra com cobertura igual ou maior que a do módulo que toca? | | |

---

## C — Back office (`apps/backoffice`)

O painel interno concentra o que é mais sensível: tenants, planos, provisionamento,
aprovações, governança de IA e o LAB. As perguntas aqui são mais duras de
propósito — é o app com menos usuários e maior alcance por ação.

### C.1 Acesso e superfície

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| C1.1 | Toda rota exige autenticação **e** pertencimento ao tenant interno, verificado no servidor? | | |
| C1.2 | O guard roda em toda server action, não só no layout — porque layout protege navegação, não protege RPC? | | |
| C1.3 | Existe segundo fator ou SSO para acesso ao painel interno? | | |
| C1.4 | Os fluxos de login, expiração de sessão e logout têm teste automatizado? | | |
| C1.5 | Papel de leitura e papel de escrita são distinguidos no servidor, com teste para cada um? | | |
| C1.6 | Capability sensível (ex.: LAB, dado de treino) é concedida **separadamente** do papel de admin? | | |
| C1.7 | Existe teste que falha se alguém derivar essa capability de "é admin"? | | |
| C1.8 | Rate limiting cobre o painel, e a chave é a identidade da pessoa (não o IP, que a equipe compartilha)? | | |
| C1.9 | Quando o rate limiting está indisponível, o comportamento é **decidido e registrado**, não acidental? | | |

### C.2 Operações de alto impacto

Vale para: criar e apagar tenant, mudar plano, suspender módulo, mexer em limite
de IA, editar política de governança.

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| C2.1 | Cada uma exige confirmação explícita na UI, com o nome do alvo escrito? | | |
| C2.2 | Cada uma grava trilha de auditoria com ator, alvo, antes e depois? | | |
| C2.3 | A trilha é append-only, sem caminho de edição pela aplicação? | | |
| C2.4 | Existe teste que prova que a operação **falha** para quem não pode? | | |
| C2.5 | Existe teste que prova que a operação **grava o log** — e não só que ela funciona? | | |
| C2.6 | Operação irreversível passa por fila de aprovação, com quem pede diferente de quem aprova? | | |
| C2.7 | Provisionamento tem cota própria, mais apertada que a de navegação? | | |
| C2.8 | Existe forma de reverter um provisionamento errado sem SQL manual? | | |

### C.3 Isolamento de dados de cliente

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| C3.1 | Toda leitura que cruza tenants (audit explorer, benchmark, health) é intencional e documentada como tal? | | |
| C3.2 | Existe teste que prova que credencial de integração de cliente nunca sai no payload? | | |
| C3.3 | Quem opera o painel vê apenas o mínimo do dado do cliente necessário para a tarefa? | | |
| C3.4 | Acesso a dado de cliente pelo staff é registrado, para responder "quem olhou o quê"? | | |

### C.4 Testes

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| C4.1 | Cada server action do painel tem teste de autorização, validação e efeito? | | |
| C4.2 | As telas críticas (tabela de tenants, detalhe do cliente, aprovações, billing) têm teste de componente? | | |
| C4.3 | Esses testes cobrem estado de carregamento, estado vazio e estado de erro — não só o caminho feliz? | | |
| C4.4 | Existe teste para escrita concorrente (duas pessoas editando o mesmo tenant)? | | |
| C4.5 | Existe suíte E2E do painel cobrindo o caminho completo: entrar → criar cliente → contratar módulo → provisionar? | | |
| C4.6 | Os papéis internos (leitura, escrita, LAB) são exercidos na E2E com usuários semeados distintos? | | |
| C4.7 | Tela marcada como pendente ou em construção está claramente sinalizada, sem parecer funcional? | | |

### C.5 Cobertura e monitoração

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| C5.1 | A cobertura do back office é medida **separadamente**, não diluída no total do monorepo? | | |
| C5.2 | Ela é comparada release a release, com regressão visível? | | |
| C5.3 | O app manda exceção de produção para o coletor de erros? | | |
| C5.4 | Falha de permissão em produção gera sinal, ou só devolve 403 em silêncio? | | |
| C5.5 | Os erros mais frequentes do painel foram mapeados de volta para lacuna de teste? | | |

### C.6 Go / no-go

| # | Pergunta | X/Y/Z | Nota |
|---|---|---|---|
| C6.1 | Mudança que afeta billing, governança de IA ou acesso a dado de cliente tem aprovação explícita antes de valer? | | |
| C6.2 | Essa aprovação envolve alguém de negócio ou ops, além de engenharia? | | |
| C6.3 | Existe critério escrito de go/no-go, ou "mergeou na main, está valendo"? | | |
| C6.4 | Existe janela e plano de rollback para essas mudanças? | | |
| C6.5 | Feature nova do painel é liberada atrás de flag, ou vai direto para todos? | | |

---

## Como usar o resultado

1. Some os **X** por seção. Seção com muitos X não é dívida distribuída — é uma
   área inteira sem cobertura, e trata-se como uma decisão, não como uma lista
   de tarefas.
2. Para cada **X** e **Y**, abra ação com dono, severidade e prazo. Item sem
   dono volta idêntico na próxima rodada.
3. Priorize por alcance da falha, não por esforço: um X em C2 (operação de alto
   impacto sem trilha) vale mais que cinco X em B5 (cobertura).
4. Refaça a cada release relevante, mudança de modelo, integração de agente nova
   ou alteração de fronteira de dados.

**Não transforme este checklist em meta de nota.** No dia em que o número virar
objetivo, ele para de medir o sistema e passa a medir quem responde.
