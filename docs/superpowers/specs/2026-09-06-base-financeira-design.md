# Base financeira da empresa — design (subprojeto D)

As quatro telas que faltam para o back-office responder onde o dinheiro da
Nebuloz entra, sai, foi prometido e se repete: livro-razão, títulos a pagar e
receber, orçado contra realizado, e receita recorrente.

Decisões tomadas com o usuário em 2026-09-06: lançamento vira linha
individual e o DRE passa a somar as linhas; baixar um título gera o lançamento
na competência; MRR sai de uma assinatura enxuta por cliente, e crédito de IA
segue a mecânica da ElevenLabs — franquia mensal por tier, que reseta, com
excedente cobrado por unidade ou barrado.

## 0. Escopo, colisão e cortes

**Colisão de nome, importante.** Já existe `packages/database/prisma/schema/finops.prisma`.
Aquilo é o FinOps **do produto**: custo de nuvem do cliente, alinhado a FOCUS
v1.1, com `BillingEntry`, `BudgetPlan`, `CostAnomaly`. Este subprojeto é a
contabilidade **da Nebuloz**. Nada aqui entra naquele arquivo, e nenhum modelo
novo reusa aqueles nomes — `BudgetPlan` em particular já está tomado. Os
modelos novos vivem em `empresa.prisma`, em português, como o resto do
subprojeto A.

**Dois planos, não um.** A entrega se divide, porque a migração do DRE é a
parte arriscada e não pode viajar junto com tela nova:

| Plano | Entrega | Depende de |
|---|---|---|
| D-a | Livro-razão e títulos | nada |
| D-b | Orçado × realizado e receita recorrente | D-a (o realizado sai das linhas) |

**Fica fora, com o motivo:**

| Cortado | Por quê |
|---|---|
| Medição de crédito por chamada | não existe telemetria de uso hoje. O consumo entra por competência; quando houver medição, ela substitui o número sem mudar o modelo |
| Conciliação bancária e importação de OFX | livro-razão primeiro. Sem ele não há contra o que conciliar |
| Multimoeda | a Nebuloz fatura em real. `CurrencyRate` existe no FinOps do produto e não se aplica aqui |
| Regime de competência automático para serviço faturado em parcelas | v1 lança na competência informada. Rateio automático quando houver contrato parcelado de verdade |
| Nota fiscal e integração com prefeitura | fora do escopo do back-office |

## 1. Dados

Tudo em `packages/database/prisma/schema/empresa.prisma`, tenant `system`,
migration com bloco RLS `DO $$` no padrão de `20260909000000_mapa_de_processos`.

### 1.1 Livro-razão

```prisma
/// Uma linha do livro-razão da Nebuloz. Substitui o valor único por conta e
/// mês de `LancamentoMensal`: o DRE passa a somar estas linhas, e a pergunta
/// "o que formou a conta 4.2 em setembro" passa a ter resposta.
model Lancamento {
  id       String @id @default(cuid())
  tenantId String

  /// "2026-09". Mês de competência, que é o que o DRE agrupa. Não deriva de
  /// `data`: uma nota de dezembro paga em janeiro é competência de dezembro.
  competencia String
  /// Data do fato. Alimenta o caixa de 13 semanas, não o DRE.
  data        DateTime @db.Date

  /// Código do plano de contas ("1.1" … "6.3"), validado contra `ContaDoPlano`.
  conta     String
  descricao String
  /// Positivo sempre. O sinal vem do grupo da conta, como já vem no DRE.
  valorCentavos Int

  /// Contraparte, quando há. Texto livre: fornecedor da casa não é entidade
  /// própria, e `FornecedorDpa` é sobre tratamento de dado, não sobre compra.
  contraparte String?
  documento   String?
  nota        String?

  /// Título que gerou esta linha, quando veio de uma baixa. SetNull: apagar o
  /// título não apaga o fato contábil.
  tituloId String?

  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  titulo Titulo? @relation(fields: [tituloId], references: [id], onDelete: SetNull)

  @@index([tenantId, competencia])
  @@index([tenantId, conta])
}
```

`LancamentoMensal` **não é apagado** nesta entrega. A migration copia cada
linha existente para um `Lancamento` de abertura, com `data` no primeiro dia
da competência, `descricao` "Saldo de abertura (migrado)" e a nota preservada.
O modelo antigo fica no schema, sem tela, por uma versão, para que qualquer
divergência de total seja auditável contra a origem. A remoção é uma migration
posterior, depois de o DRE bater.

### 1.2 Títulos

```prisma
/// Compromisso a pagar ou receber. O título é a promessa; o lançamento é o
/// fato. Baixar o título gera a linha no livro-razão.
model Titulo {
  id       String @id @default(cuid())
  tenantId String

  /// PAGAR | RECEBER
  tipo        String
  descricao   String
  contraparte String

  /// Conta do plano em que a baixa vai lançar.
  conta         String
  valorCentavos Int

  emissao    DateTime @db.Date
  vencimento DateTime @db.Date

  /// ABERTO | BAIXADO | CANCELADO. Sem "vencido": vencido é `vencimento` no
  /// passado com status ABERTO, e status derivado não desatualiza sozinho.
  status String @default("ABERTO")

  baixadoEm    DateTime? @db.Date
  /// Competência em que a baixa lançou. Guardada porque pode diferir do mês
  /// da baixa quando se paga uma conta de mês anterior.
  competenciaBaixa String?
  motivoCancelamento String?

  /// Cliente que deve, quando é um RECEBER de assinatura ou serviço.
  clienteTenantId String?

  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  lancamentos Lancamento[]

  @@index([tenantId, status, vencimento])
  @@index([tenantId, tipo])
}
```

### 1.3 Orçamento

```prisma
/// Orçado por conta e competência. O realizado não mora aqui: sai da soma dos
/// lançamentos, para não haver dois números para a mesma pergunta.
model OrcamentoDaConta {
  id       String @id @default(cuid())
  tenantId String

  competencia   String
  conta         String
  valorCentavos Int
  nota          String?

  atualizadoEm DateTime @updatedAt

  @@unique([tenantId, competencia, conta])
  @@index([tenantId, competencia])
}
```

### 1.4 Assinatura e crédito

```prisma
/// O que o cliente paga hoje. Não duplica a proposta: o catálogo diz o preço
/// de tabela, a proposta diz o que foi vendido uma vez, e a assinatura diz o
/// que é cobrado agora, depois de desconto, upgrade e downgrade.
model AssinaturaDoTenant {
  id       String @id @default(cuid())
  tenantId String

  /// Slug do tenant cliente. Slug e não FK: a assinatura sobrevive ao tenant
  /// ser removido, e a série histórica de MRR não pode ficar com buraco.
  clienteSlug String
  clienteNome String

  /// Degrau vendido. Slug de `PlanoComercial`, congelado como a proposta faz.
  planoSlug String
  /// Preço realmente acordado. Preço de tabela ignora desconto, e desconto é
  /// a regra e não a exceção nas primeiras vendas.
  valorMensalCentavos Int

  /// Franquia mensal de créditos de IA do degrau. Reseta todo mês e não
  /// acumula — é o que torna a receita da franquia recorrente de verdade.
  creditosMesIncluidos Int @default(0)
  /// Preço do crédito acima da franquia. Nulo = excedente barrado em vez de
  /// cobrado, que é o comportamento dos degraus de entrada.
  precoCreditoExtraCentavos Int?

  iniciouEm  DateTime  @db.Date
  /// Nulo = ativa. Preenchido = saiu, e sai da conta de MRR a partir daí.
  encerradaEm DateTime? @db.Date
  /// PRECO | ESCOPO | INSATISFACAO | FIM_DE_PROJETO | INADIMPLENCIA | OUTRO
  motivoEncerramento String?

  /// Proposta que originou. Sem FK por ser de outro domínio e poder sumir.
  propostaId String?

  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  mudancas MudancaDeAssinatura[]

  @@index([tenantId, encerradaEm])
  @@index([tenantId, clienteSlug])
}

/// Append-only, no padrão de `MudancaDeEstagio`. Sem isto, MRR é um número
/// sem explicação: não dá para abrir o mês em novo, expansão, contração e
/// churn olhando só o estado atual.
model MudancaDeAssinatura {
  id           String @id @default(cuid())
  tenantId     String
  assinaturaId String

  /// "2026-09". Competência em que a mudança passa a valer.
  competencia String
  /// NOVO | EXPANSAO | CONTRACAO | CHURN | REATIVACAO
  tipo        String

  deCentavos   Int
  paraCentavos Int
  motivo       String

  autorId   String
  autorNome String?
  criadoEm  DateTime @default(now())

  assinatura AssinaturaDoTenant @relation(fields: [assinaturaId], references: [id], onDelete: Cascade)

  @@index([tenantId, competencia])
}

/// Consumo e venda de crédito por cliente e mês. Uma linha por competência,
/// digitada enquanto não há telemetria. Quando houver medição por chamada,
/// ela preenche `consumidos` e o resto do modelo não muda.
model CreditoDoMes {
  id       String @id @default(cuid())
  tenantId String

  clienteSlug String
  competencia String

  /// Franquia vigente no mês, copiada da assinatura. Copiada e não lida por
  /// join: o degrau muda, e o histórico tem que continuar dizendo qual era a
  /// franquia daquele mês.
  franquia   Int
  consumidos Int @default(0)

  /// Créditos avulsos vendidos no mês, além da franquia.
  compradosCentavos Int @default(0)
  /// Excedente cobrado por unidade, quando o degrau permite.
  excedenteCentavos Int @default(0)

  atualizadoEm DateTime @updatedAt

  @@unique([tenantId, clienteSlug, competencia])
  @@index([tenantId, competencia])
}
```

Crédito avulso vendido tem validade. Crédito comprado que não expira é receita
diferida, ou seja, passivo até o consumo, e reconhecê-lo na venda infla o mês.
A validade é o que torna honesto reconhecer na venda, e é a razão de a
franquia mensal que reseta ser o desenho preferido.

## 2. Regras puras

`apps/backoffice/lib/empresa/livro.ts`:
- `sinalDoGrupo(grupo)` — receita soma, custo e despesa subtraem. Já existe a
  regra dentro de `calcularDre`; sai de lá para cá e passa a ser usada pelos
  dois lados.
- `dreDeLancamentos(contas, lancamentos)` — substitui `calcularDre(contas, l)`.
  Mesma saída, entrada por linha.
- `totalPorConta(lancamentos)`, `totalPorCentro(contas, lancamentos)`.
- `situacaoDoTitulo(t, hoje)` — ABERTO, VENCIDO (aberto e vencimento passado),
  BAIXADO, CANCELADO. Derivada, nunca coluna.
- `envelhecimento(titulos, hoje)` — faixas a vencer, 1–30, 31–60, 61–90, 90+.

`apps/backoffice/lib/empresa/recorrente.ts`:
- `mrr(assinaturas, competencia)` — soma das ativas na competência.
- `arr(mrr)` — vezes doze. Não inclui serviço nem excedente.
- `movimento(mudancas, competencia)` — `{novo, expansao, contracao, churn, reativacao, liquido}`.
- `churnDeReceita(mudancas, mrrInicial)` e `churnDeClientes(assinaturas, competencia)`.
- `receitaDeServico(contas, lancamentos, competencia)` — soma das contas de
  receita não recorrente, para aparecer ao lado do MRR e nunca dentro dele.
- `usoDaFranquia(creditos)` — consumo sobre franquia por cliente, com as duas
  leituras que importam: abaixo de 30% é risco de churn, acima de 100% é
  gatilho de upgrade.

## 3. Actions

`app/actions/empresa/livro.ts`: `listarLancamentos({de, ate, conta?})`,
`criarLancamento`, `atualizarLancamento`, `excluirLancamento`.
`app/actions/empresa/titulos.ts`: `listarTitulos({tipo?, status?})`,
`criarTitulo`, `baixarTitulo({id, data, competencia})`, `cancelarTitulo({id, motivo})`.
`app/actions/empresa/recorrente.ts`: `listarAssinaturas`, `criarAssinatura`,
`alterarValor({id, valor, motivo, competencia})`, `encerrarAssinatura({id, data, motivo})`,
`salvarCreditoDoMes`.

Todas por `safeAction` + `requirePlatformStaff`; escrita com `assertCanWrite`,
`logPlatformAudit` e `revalidatePath`. Tenant `system`. `baixarTitulo` e
`alterarValor` escrevem em `$transaction`: baixa e lançamento juntos, mudança
de valor e linha de histórico juntas. `alterarValor` classifica sozinha em
EXPANSAO ou CONTRACAO comparando os valores; ninguém digita o tipo.

## 4. Telas

Tudo em `/empresa/financeiro`, que ganha três abas, além das três que já tem:

- **Lançamentos** — tabela por intervalo, com filtro por conta e por centro,
  busca por descrição e contraparte, total do período, e o diálogo de criar e
  editar. Cada linha mostra data, conta, descrição, contraparte e valor.
- **Títulos** — duas listas, a pagar e a receber, com chips de situação e o
  envelhecimento no topo. Baixar abre um diálogo que pede data e competência,
  já preenchidas com hoje e o mês corrente, e avisa quando as duas divergem.
- **Orçado × realizado** — uma linha por conta, com orçado editável, realizado
  somado dos lançamentos, desvio em valor e em percentual, e o desvio em
  vermelho quando estoura. Total por centro de custo no rodapé.
- **Receita recorrente** — quatro cartões (MRR, ARR, movimento líquido do mês,
  churn de receita), a cascata do mês, a tabela de assinaturas com valor,
  degrau, franquia e uso, e a receita de serviço numa faixa própria, rotulada
  como não recorrente.

A aba DRE não muda de aparência. Muda de origem: passa a somar os lançamentos.

## 5. Testes

Regras puras: sinal por grupo, DRE por linha contra a mesma fixture do DRE
atual (tem que dar o mesmo número), situação e envelhecimento de título,
MRR com assinatura encerrada no meio do mês, movimento com os cinco tipos,
ARR não incluindo serviço nem excedente, uso da franquia nos dois extremos.
Actions com Prisma mockado: baixa gera lançamento na competência informada e
não na data; baixa de título já baixado é recusada; alterar valor grava a
mudança com o tipo certo; encerrar tira do MRR do mês seguinte.
Telas em jsdom: filtro compõe, o diálogo de baixa avisa a divergência de
competência, e o desvio negativo aparece em vermelho.

## 6. Produção

1. Push. A Vercel aplica a migration, que cria as tabelas e copia
   `LancamentoMensal` para `Lancamento` de abertura.
2. Conferir no back-office que o DRE do mês corrente dá o mesmo número de
   antes. É a verificação que decide se a migração foi bem.
3. Semear nada: assinatura e orçamento são dado que a Nebuloz digita.

A remoção de `LancamentoMensal` fica para uma migration posterior, depois de o
DRE bater por um mês.
