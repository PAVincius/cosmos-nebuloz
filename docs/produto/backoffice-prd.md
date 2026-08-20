# Back-office — Product Requirements Document

> **PRODUCT** Back-office (BigBang) · **STAGE** Operação (interno) · **STATUS** Draft for review
> **VERSION** 1.0 · **OWNER** Product, Nebuloz
> **COMPANION** [Back-office SRD v1.0](./backoffice-srd.md)

O painel interno da Nebuloz. Uma pessoa contrata, provisiona, acompanha e cobra
um cliente sem abrir o banco.

---

## 1. Problema

Contratar um cliente hoje é uma sequência de atos que só existem na cabeça de
quem os executa: criar tenant, ligar módulo, semear dado inicial, conferir se
subiu, avisar o comercial. Cada passo é possível pelo SQL, e é assim que vinha
sendo feito — o que significa que a operação da plataforma depende de alguém com
credencial de produção e memória do procedimento.

O custo não é a lentidão. É que **nada disso deixa rastro**: não há registro de
quem contratou o quê, quando um módulo foi suspenso, nem por quê. Quando um
cliente pergunta "desde quando estou sem acesso", a resposta é uma reconstrução
a partir de logs de aplicação.

> **POR QUE ESTE É O GARGALO DA OPERAÇÃO**
> O Cosmos entrega valor ao cliente. Sem o back-office, entregar esse valor a um
> cliente novo exige uma pessoa técnica no console — e a operação não escala com
> vendas, escala com disponibilidade de quem sabe o procedimento.

### Evidência

- Todas as migrations desta leva foram aplicadas colando SQL no editor do Supabase.
- Não havia registro de quem provisionou nenhum dos tenants existentes.
- Suspender módulo de cliente era um `UPDATE` — sem confirmação, sem trilha.
- A pergunta "quais clientes renovam nos próximos 60 dias" não tinha resposta
  sem consulta manual.

---

## 2. Usuários

| PAPEL | TRABALHO A FAZER | SUCESSO É |
|---|---|---|
| Operação da plataforma | Contratar e provisionar cliente sem console | Um fluxo que termina com o cliente logando |
| Comercial | Saber quem renova, quem está em risco | Carteira ordenada por quem precisa de telefonema |
| Delivery | Ver capacidade e engajamento por pessoa | Alocação visível antes de assumir escopo |
| Segurança interna | Auditar sem poder mudar nada | Leitura completa com escrita negada |
| Engenharia de ML | Trabalhar no modelo próprio | Acesso concedido à parte, não herdado de admin |
| Sponsor | Saber se a carteira está saudável | Saúde derivada do que a plataforma já grava |

---

## 3. Objetivos e não-objetivos

### Objetivos

| OBJETIVO | MEDIDA |
|---|---|
| Tirar a operação do console | Share de tenants provisionados pelo painel |
| Dar rastro a toda operação sensível | Share de operações com trilha de auditoria |
| Antecipar renovação e risco | Clientes em risco identificados antes do vencimento |
| Separar quem pede de quem aprova | Share de operações sensíveis com aprovador distinto |
| Reduzir dependência de pessoa específica | Operações executáveis por qualquer membro do staff |

### Não-objetivos

- **Não é o produto.** O back-office administra clientes do Cosmos; não entrega
  funcionalidade a eles. Tela de cliente mora no Cosmos.
- **Não é BI.** Mostra o que a plataforma já grava. Métrica que exige pipeline
  de dados é do Signal.
- **Não é CRM.** Propostas e serviços existem para virar contrato e
  provisionamento, não para gerir funil.
- **Não é o LAB.** O registro de modelo próprio — dataset, treino, avaliação,
  linhagem, model card — saiu deste painel e ganhou documento próprio
  ([LAB PRD v1.0](./lab-prd.md)). Enquanto não houver schema, não há rota: seis
  rotas prometendo o que não existe eram um quarto do menu.
- **Não substitui o banco.** Operação de emergência continua sendo SQL — o
  painel cobre o caminho normal, não todos.

---

## 4. As seis áreas

O painel tem 16 rotas em seis seções. A divisão não é de conveniência: cada
seção corresponde a um papel que usa o painel por um motivo diferente.

**Plataforma** — Tenants, aprovações, observabilidade. É onde o cliente nasce e
onde se vê se ele está de pé.

**Delivery** — Engajamentos por escopo fechado, capacidade por pessoa,
biblioteca de IP versionada com diagramas.

**Comercial** — Propostas, catálogo de serviços, health e renovação, benchmark
entre clientes.

**Ferramentas** — Modelagem BPMN e diagramas, para o IP não ser prosa.

**Auditoria** — Audit Explorer (a única tela que lê vários clientes de uma vez)
e atividade do staff.

**Operações** — Criar tenant.

> **RESTRIÇÃO DURA**
> Operação sensível não executa no clique. Cinco delas — deleção de tenant,
> MCP avançado, desconto acima de 15%, export sensível e mudança grande de plano
> — passam por fila de aprovação com solicitante e aprovador **obrigatoriamente
> distintos**. Fila que aceita auto-aprovação é decorativa, e pior que não ter
> fila, porque a auditoria exibe um aprovador.

### O que uma operação sensível carrega

| | |
|---|---|
| **Confirmação nomeada** — o alvo escrito por extenso, não "tem certeza?" | **Trilha append-only** — ator, alvo, antes e depois |
| **Papel verificado no servidor** — o botão escondido é enfeite | **Cota própria** — provisionar não divide teto com navegação |

---

## 5. Requisitos

Prioridade: **P0** necessário para operar · **P1** dentro de dois trimestres ·
**P2** desejável.

| ID | REQUISITO | PRI |
|---|---|---|
| B-01 | Provisionamento de tenant pelo painel, com bootstrap de módulo | P0 |
| B-02 | Contratação e mudança de status de módulo, com confirmação nomeada | P0 |
| B-03 | Trilha de auditoria em toda escrita, append-only | P0 |
| B-04 | Papéis de leitura e escrita separados, verificados no servidor | P0 |
| B-05 | Fila de aprovação com solicitante e aprovador distintos | P0 |
| B-06 | Segundo fator obrigatório para entrar no painel | P0 |
| B-07 | Teto de requisição por identidade, com cota própria para provisionar | P0 |
| B-08 | Health e renovação derivados do que a plataforma já grava | P0 |
| B-09 | Audit Explorer com filtro por cliente, ação e período | P0 |
| B-10 | Capability de LAB concedida à parte do papel de admin — ver [LAB SRD](./lab-srd.md) | P1 |
| B-11 | Aprovação executa a operação original ao ser aprovada | P1 |
| B-12 | Reversão de provisionamento sem SQL | P1 |
| B-13 | Coletor de erro de produção no painel | P1 |
| B-14 | E2E do caminho entrar → criar → contratar → provisionar | P1 |
| B-15 | Retenção ou particionamento do AuditLog | P2 |
| B-16 | Recorte do dado de cliente por necessidade da tarefa | P2 |

---

## 6. Critérios de sucesso

- Um cliente novo entra em produção sem ninguém abrir o console.
- Toda operação sensível responde "quem fez, quando e por quê" sem consultar o banco.
- Nenhuma operação irreversível é possível com um clique.
- Quem pede uma operação sensível não consegue aprová-la.
- O comercial sabe quem renova nos próximos 60 dias sem perguntar a ninguém.
- Perder o acesso de um staff é uma ação, não um chamado.

---

## 7. Riscos

| RISCO | MITIGAÇÃO |
|---|---|
| Painel vira o novo gargalo — uma pessoa sabe usar | Papéis distintos e E2E que exercita cada um |
| Trilha existe e ninguém lê | Audit Explorer como tela de primeira classe, não relatório |
| Confirmação vira clique automático | Alvo escrito por extenso; "Voltar" antes de "Confirmar" |
| Health afirma o que não sabe | "Sem sinal" é categoria própria — nunca colapsa em "OK" |
| Fila de aprovação vira carimbo | Auto-aprovação recusada no servidor, com teste |
| Staff sem 2FA por conveniência | Exigido no guard, não na UI |
| Dado de cliente exposto além do necessário | Credencial de integração nunca entra em `select` |

---

## 8. Dependências

| DEPENDE DE | NATUREZA |
|---|---|
| Cosmos | Provisiona tenants e módulos do produto |
| Charter | Bootstrap de conformidade no onboarding do cliente |
| `@repo/provisioning` | Porta única de escrita de plataforma, com auditoria |
| `@repo/auth` | Sessão, papéis e segundo fator |
| `@repo/rate-limit` | Teto por identidade |
| Signal | Futuro: métrica de carteira que exige pipeline |

---

## 9. Questões em aberto

- **Execução da aprovação.** Aprovar hoje só muda o status do pedido; a operação
  original não roda. Qual das cinco entra primeiro?
- **Reversão.** Desprovisionar é apagar, arquivar ou suspender? A resposta muda
  o schema.
- **Recorte de dado de cliente.** Quem opera vê o detalhe inteiro. Faz sentido
  recortar por tarefa, ou o custo de operação supera o ganho?
- **LAB e o resto.** A capability separa acesso a dado de treino. Vale o mesmo
  padrão para dado financeiro do cliente?
- **Escala.** O painel escala com número de clientes, não de staff. Em que
  ordem de grandeza de clientes vale investir em cache e paginação?

---

*Draft para revisão interna. Documento companheiro: Back-office SRD v1.0.*
