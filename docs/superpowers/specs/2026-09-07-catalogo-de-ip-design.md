# Catálogo de IP — procedência, licença e reuso medido

**Data:** 2026-09-07 · **Estado:** aguardando aprovação
**Referência de design:** projeto `691f7fe5-e623-458e-aa9f-92b8c46dbbd9`,
`backoffice-ip.jsx` (`NewIpModal`, `IpLibraryScreen`)

## O problema

`IpAsset` hoje é um **editor de markdown versionado**: criar um ativo semeia
`conteudo: "# nome\n\n"` e a tela é um editor com nota de revisão. Funciona, e
tem dados.

O que falta é tudo que decide se o ativo **pode ser reusado** e se o reuso
**está pagando**: de onde ele veio, se há direito de reuso, que licença de
terceiro carrega, quem o mantém, que serviços ele encurta, e quantas vezes foi
de fato reusado.

Sem procedência, registrar um artefato que nasceu dentro de um engajamento pago
cria passivo, não ativo — ele é IP do cliente até o contrato dizer o contrário.

## Decisões tomadas antes do spec

O usuário decidiu, com as alternativas na mesa:

1. **O catálogo convive com o editor.** `conteudo` permanece. `link` entra
   opcional: ou o ativo vive aqui, ou vive lá fora e o catálogo aponta.
2. **Reuso vira registro de verdade.** Tabela nova ligando ativo a engajamento.
   Reusos, horas poupadas e maturidade passam a ser derivados, nunca digitados.

## Modelo

### `IpAsset` — colunas novas

| Coluna | Tipo | Papel |
|---|---|---|
| `link` | `String?` | Endereço onde o ativo vive de verdade. **Nulo é significativo**: quer dizer que ele vive aqui, no editor. Não há coluna "vive aqui" — o nulo já é essa informação |
| `donoPersonId` | `String?` → `StaffPerson` | Quem **mantém**, não quem criou. `criadoPorId` continua existindo e responde outra pergunta |
| `procedencia` | `String @default("INTERNO")` | `INTERNO` · `ENGAJAMENTO` · `LAB` · `TERCEIRO` |
| `reusoConfirmado` | `Boolean @default(false)` | Cláusula de reuso conferida no contrato. Só significa algo quando `procedencia = ENGAJAMENTO` |
| `licenca` | `String @default("NENHUMA")` | `NENHUMA` · `PERMISSIVA` · `COPYLEFT` · `COMERCIAL` · `NAO_RESOLVIDA` |
| `licencaRef` | `String?` | Número da licença ou componente e versão. Obrigatório em `COPYLEFT` e `COMERCIAL` |

`origemEngagementId` **já existe** e passa a ser o engajamento de nascimento
quando `procedencia = ENGAJAMENTO`. Nenhuma coluna nova para isso.

`tipo` muda de conjunto: `ACELERADOR` · `PLAYBOOK` · `TEMPLATE` ·
`EVAL_HARNESS` · `MODELO_BPMN` · `DOCUMENTO`. `COMPONENTE` vira `ACELERADOR`
por `UPDATE` na migration — são o mesmo conceito com dois nomes, e dois nomes
para uma coisa divergem. `DOCUMENTO` fica: já tem linhas e é o caso genérico.

`descricao` **continua nullable no banco**. O mínimo de 40 caracteres é regra do
cadastro, não do schema: aplicar retroativamente exigiria inventar texto para
linha antiga. A régua vale para quem entra a partir de agora.

### `IpAssetService` — o que ele encurta

```prisma
model IpAssetService {
  assetId   String
  serviceId String
  @@id([assetId, serviceId])
}
```

Sem serviço vinculado o ativo não aparece na hora de montar proposta, que é
onde ele paga. Por isso é regra bloqueante, não campo opcional.

### `IpAssetReuse` — o reuso, como fato

```prisma
model IpAssetReuse {
  id             String   @id @default(cuid())
  assetId        String
  engagementId   String
  horasPoupadas  Int      @default(0)
  nota           String?
  registradoPorId   String
  registradoPorNome String?
  criadoEm       DateTime @default(now())

  @@unique([assetId, engagementId])
}
```

`@@unique([assetId, engagementId])` porque "foi reusado no EN-041" é um fato,
não um contador: registrar duas vezes contaria o mesmo reuso duas vezes, e o
número que a tela mostra deixaria de ser verificável.

**As horas ficam no evento, não no ativo.** O protótipo guarda uma média
digitada no ativo e multiplica por `reusos - 1`. Somar os eventos dá o mesmo
número com uma fonte só, e permite que um reuso difícil conte diferente de um
fácil. Nenhuma linha a mais de código.

### Derivados — nada digitado

| Número | De onde vem |
|---|---|
| Reusos | `count(IpAssetReuse)` |
| Horas poupadas | `sum(IpAssetReuse.horasPoupadas)` |
| Maturidade | `RASCUNHO` com menos de 2 reusos, `COMPROVADO` a partir do segundo |

Maturidade não é escolhida em lugar nenhum da interface. É função da contagem, e
só.

## A régua de aceitação

Seis critérios, todos bloqueantes, verificados **no servidor** — a lista lateral
do modal é espelho da regra, não a regra:

| # | Critério | Condição |
|---|---|---|
| IP-R1 | Nome que outra pessoa acha na busca | `nome` ≥ 3 caracteres |
| IP-R2 | Problema que ele resolve, em uma frase | `descricao` ≥ 40 caracteres |
| IP-R3 | Endereço onde o ativo vive de verdade | `link` ≥ 4 caracteres, **ou** o ativo vive aqui |
| IP-R4 | Pelo menos um serviço que ele encurta | ≥ 1 `IpAssetService` |
| IP-R5 | Direito de reuso confirmado na procedência | `procedencia ≠ ENGAJAMENTO` **ou** `reusoConfirmado` |
| IP-R6 | Licença de terceiro resolvida e referenciada | `licenca ≠ NAO_RESOLVIDA` **e** (`licenca ∉ {COPYLEFT, COMERCIAL}` **ou** `licencaRef` ≥ 3) |

`procedencia = ENGAJAMENTO` também exige `origemEngagementId` — a cláusula de
reuso é de um contrato específico, e confirmar sem dizer qual não confirma nada.

**Divergência resolvida:** o protótipo pede `licenseRef` só em `commercial` na
régua, mas mostra o campo também em `copyleft`. Adotado o mais estrito: um
copyleft sem dizer qual componente e qual versão não permite revisar nada antes
de vender.

## Tela

O modal ganha o formato do design: coluna de campos à esquerda, régua e prévia
do catálogo à direita, rodapé com o placar de critérios pendentes e o botão
"Registrar como rascunho" desabilitado até a régua fechar.

Na tela, três KPIs — ativos no catálogo, reusos acumulados, horas poupadas — e o
painel "lacunas de IP" (serviço ativo sem nenhum ativo vinculado), que é o
retorno direto do vínculo com serviço.

Registrar reuso é ação na linha do ativo: escolher engajamento, horas poupadas,
nota.

## Fora de escopo, e por quê

| Do design | Fora | Motivo |
|---|---|---|
| KPI "margem preservada" (R$) | Sim | Multiplica horas por um custo/hora blended de R$ 190 que não existe no back-office. Número em reais sem fonte é o mesmo problema do rodapé em R$ da capacidade |
| Maturidade `EM_ENDURECIMENTO` | Sim | Nada no modelo a distingue de `RASCUNHO`. Seria rótulo digitado dentro de uma dimensão que a decisão 2 tornou derivada |
| Maturidade `APOSENTADO` | Sim | Não foi pedido. `Service.ativo` já tem o padrão pronto se um dia importar |
| Painel "onde o reuso está pagando" | Sim | Mesmo dado do KPI de horas, agrupado por serviço. Cabe depois, quando houver reuso registrado para agrupar |
| Tela de benchmark de readiness | Sim | Está no mesmo arquivo do design, mas é outro assunto — dado de avaliação de cliente, não de IP |

## Ponytail

**Cortado:** coluna "vive aqui" (o nulo de `link` já é isso); coluna de
maturidade (derivada); `horasPoupadas` no ativo (fica no evento); coluna de nome
do dono (FK para `StaffPerson`, que tem 15 linhas — o join é mais barato que a
denormalização divergir); `EM_ENDURECIMENTO` e `APOSENTADO`; margem em reais.

**Mantido apesar de custar:** a tabela de reuso. Sem ela a decisão 2 não existe
e três números da tela voltam a ser digitados. É a única estrutura nova que a
régua de aceitação não pedia, e foi escolha explícita do usuário.

**Risco assumido:** `descricao` fica nullable no banco com mínimo só no
cadastro. Linha antiga com descrição curta continua válida, e a régua não é
verdade universal sobre a tabela — é verdade sobre o que entra a partir de
agora. A alternativa era inventar texto em dado existente.

## Verificação

- Testes puros da régua: os seis critérios, incluindo `link` nulo com ativo que
  vive aqui, e `licencaRef` exigido em copyleft
- Teste da derivação de maturidade na fronteira do segundo reuso
- Teste do `@@unique` de reuso: registrar o mesmo par duas vezes é recusado
- Migration com a renomeação `COMPONENTE → ACELERADOR` conferida por contagem
- `tsc`, suíte do back-office e biome limpos
