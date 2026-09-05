# Telas "Empresa" do back-office — modelo de dados

**Data**: 2026-09-05
**Status**: proposta, aguardando revisão
**Telas**: Fornecedores e DPA · Consentimento · CAC · Financeiro (canvas
"Telas Empresa do Back-office", 5 set 2026)
**Documentos de origem**: [`dpa-fornecedores.md`](../../compliance/dpa-fornecedores.md),
[`aviso-de-gravacao.md`](../../compliance/aviso-de-gravacao.md),
[`cac-modelo.md`](../../comercial/cac-modelo.md),
[`plano-de-contas.md`](../../financeiro/plano-de-contas.md),
[`dre-modelo.md`](../../financeiro/dre-modelo.md),
[`caixa-13-semanas.md`](../../financeiro/caixa-13-semanas.md)

---

## 0. O que é, e o que não é

Os quatro documentos de 5 de setembro são tabelas com células ⟨preencher⟩.
Esta spec diz onde essas células moram no banco, quem as calcula e por onde
se escreve nelas, para que as quatro telas desenhadas deixem de ser
documento e passem a ser controle. O modelo cobre **só o que a tela mostra**:
nenhuma entidade nasce aqui para uma tela que não existe.

Fora do escopo desta spec, de propósito:

- A UI em si — já está desenhada; o plano de implementação cita o canvas.
- O mapa de processo comercial como entidade (decisão em aberto do relatório
  de lacunas de 5 set) — não é uma das quatro telas.
- Alimentar a configuração dos tenants (`MeetingIntegration`) com o que a tela
  de Consentimento decidir — ver §8.

## 1. Princípios que valem para as quatro

1. **Tudo no tenant `system`.** É dado da casa, não do cliente — a mesma regra
   de `platform-ops.prisma` e `comercial.prisma`. Cada modelo tem `tenantId`
   com relação nomeada `…SystemTenant` em `Tenant`, RLS declarada no padrão
   de `20260902190000_rls_catalogo_comercial`, e toda query filtra por
   `SYSTEM_TENANT_ID`.
2. **Dinheiro em centavos inteiros, percentual em inteiro.** Convenção já
   estabelecida em `comercial.prisma`; a soma de linhas não pode herdar erro de
   ponto flutuante.
3. **Nulo é "não preenchido"; zero é zero.** As telas contam "0 de 8
   preenchidas" e recusam resultado enquanto faltar parcela. Isso só é possível
   se a ausência for distinguível do valor zero — logo, toda célula de entrada
   é `Int?`, nunca `Int @default(0)`.
4. **Nada calculado é persistido.** CAC, payback, receita líquida, margem,
   EBITDA, totais e saldos de caixa são funções puras em
   `apps/backoffice/lib/empresa/`, testadas sem banco. Guardar o resultado
   criaria um segundo lugar para ele divergir da entrada.
5. **Texto de documento fica em código; dado fica em tabela.** O aviso de
   gravação, a cláusula e o plano de contas são versionados em git como os
   documentos que os originaram. O que muda por decisão humana — estado de um
   DPA, resposta a uma pergunta, valor de um mês — vai para o banco.
6. **Um número, uma fonte.** `cac-modelo.md` §2 e `dre-modelo.md` exigem que
   a linha "Comercial" do DRE e o numerador do CAC batam. Batem porque são a
   mesma linha (§2.3): a tela de CAC edita as contas 4.1–4.6 do mês, não uma
   cópia delas.

## 2. Modelos — `packages/database/prisma/schema/empresa.prisma`

Um arquivo novo, com o mesmo cabeçalho de propósito que `platform-ops.prisma`
traz. Nomes em português, como o resto da operação da Nebuloz.

### 2.1 Fornecedores e DPA — `FornecedorDpa`

O inventário de fornecedores já existe: são os 18 `CharterVendor` do tenant
`nebuloz`, semeados por `seed:charter:nebuloz`. O que **não** existe é o
estado do acordo de tratamento de dados por fonte primária — o que
`dpa-fornecedores.md` levantou. É dado de operação da Nebuloz sobre os
próprios contratos, não dado do produto Charter; por isso mora no tenant
`system`, e não como colunas novas em `CharterVendor`.

A ligação com o inventário é pelo `codigo` ("V-01"), não por FK: as duas
linhas vivem em tenants diferentes, e uma FK entre tenants cruzaria a
fronteira que a ADR-0013 mantém greppável. O código é estável — é o que
aparece no runbook, no seed e na tela.

```prisma
/// Estado do DPA por fonte primária (dpa-fornecedores.md §0).
enum EstadoDpa {
  /// Vale pelo contrato comercial; nada a assinar, só guardar o link.
  EMBUTIDO
  /// Existe documento; só produz efeito quando a Nebuloz aceita ou assina.
  A_ASSINAR
  /// Aceito no portal ou assinado. Exige `evidenciaUrl` (validado na action).
  ASSINADO
  /// Nenhum DPA público localizado. Não quer dizer que não exista sob NDA.
  SEM_DOCUMENTO
}

model FornecedorDpa {
  id       String @id @default(cuid())
  tenantId String

  /// Mesmo código do `CharterVendor` no tenant nebuloz ("V-01"). Vínculo por
  /// código, não FK: são tenants diferentes (ADR-0013).
  codigo String
  nome   String

  estado EstadoDpa
  /// O asterisco de dpa-fornecedores.md §1: documento existe mas o texto não
  /// pôde ser lido (PDF sem camada de texto, portal dinâmico).
  classificacaoProvisoria Boolean @default(false)

  regiao        String?
  retencao      String?
  /// Mecanismo de transferência declarado: "SCCs + DPF", "SCCs + UK IDTA".
  transferencia String?

  dpaUrl              String?
  subprocessadoresUrl String?
  /// Via assinada ou registro do aceite. Obrigatório quando `estado = ASSINADO`.
  evidenciaUrl        String?

  /// Data da última leitura da fonte primária.
  verificadoEm DateTime

  /// Texto da ação (dpa-fornecedores.md §3). Nulo = nada a fazer.
  acaoPendente String?
  /// Papel do RACI do playbook, não pessoa — os nomes ainda estão em branco.
  donoPapel    String?
  bloqueiaVenda Boolean @default(false)

  /// Quando se pediu o DPA ao fornecedor ("Registrar pedido").
  pedidoEm   DateTime?
  /// Quando foi aceito/assinado ("Marcar aceito", "Anexar assinado").
  assinadoEm DateTime?
  /// Última vez que a linha foi exportada para o `CharterVendor` do tenant
  /// nebuloz (§4.1). Nulo = nunca.
  exportadoAoCharterEm DateTime?

  notas String? @db.Text

  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  tenant Tenant @relation("FornecedorDpaSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, codigo])
  @@index([tenantId, estado])
}
```

Os quatro cartões da tela derivam de `estado` e `bloqueiaVenda`; os filtros
("A assinar", "Sem documento", "Bloqueiam venda") também. O botão "Ação" da
linha muda `estado` e carimba `pedidoEm` ou `assinadoEm` — transições em §3.1.

### 2.2 Consentimento — `DecisaoDeConsentimento` e `PerguntaAoParecer`

O que a tela mostra tem três naturezas:

- **Textos** (aviso interno PT, aviso externo PT/EN, cláusula STANDING) —
  ficam em código, `apps/backoffice/lib/empresa/aviso.ts`, copiados de
  `aviso-de-gravacao.md` §1–§2 com os marcadores `[ferramenta]`, `[prazo]`,
  `[contato]`, `[organização]` intactos.
- **Decisões operacionais** — o que preenche os marcadores e o resultado do
  parecer. Um registro só por tenant, como `CharterSettings`.
- **As sete perguntas ao parecer** — cada uma com dono e resposta.

```prisma
enum BaseLegal {
  SEM_DECISAO
  /// art. 7º, I — exige aviso inequívoco e cláusula destacada.
  CONSENTIMENTO
  /// art. 7º, IX — exige teste do art. 10 e relatório de impacto.
  LEGITIMO_INTERESSE
}

enum StatusParecer {
  PENDENTE
  ENVIADO
  RECEBIDO
}

/// Singleton do tenant system: o que faz o consentimento existir do lado da
/// Nebuloz. Os textos do aviso ficam em código; aqui só o que os preenche.
model DecisaoDeConsentimento {
  id       String @id @default(cuid())
  tenantId String @unique

  /// `[ferramenta]` — ex. "Fireflies".
  ferramenta     String?
  /// `[prazo]` — é a resposta à pergunta 6; nulo enquanto o RoPA disser
  /// "não definida".
  prazoRetencao  String?
  /// `[contato]` — canal do titular (operadora-controladora.md §4).
  contatoTitular String?

  baseLegal BaseLegal @default(SEM_DECISAO)
  /// Pergunta 4. Nulo = sem resposta; `false` mantém STANDING desabilitado.
  standingHabilitavel Boolean?

  parecer           StatusParecer @default(PENDENTE)
  parecerEnviadoEm  DateTime?
  parecerRecebidoEm DateTime?

  atualizadoEm DateTime @updatedAt

  tenant Tenant @relation("DecisaoDeConsentimentoSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)
}

/// Uma linha por pergunta de aviso-de-gravacao.md §4. Semeadas; a tela só
/// responde.
model PerguntaAoParecer {
  id       String @id @default(cuid())
  tenantId String

  numero   Int
  pergunta String @db.Text
  /// "responsável jurídico" | "Dono do SLA" — papel, pelo mesmo motivo de
  /// `FornecedorDpa.donoPapel`.
  donoPapel String

  resposta     String?   @db.Text
  respondidaEm DateTime?

  tenant Tenant @relation("PerguntaAoParecerSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, numero])
}
```

"3 campos em aberto" é a contagem de nulos entre `ferramenta`,
`prazoRetencao` e `contatoTitular`. `[organização]` não é campo: muda por
tenant e é preenchido por quem lê.

### 2.3 Financeiro — `LancamentoMensal` e o plano de contas em código

O DRE é um razão simplificado: um valor por conta por mês. As linhas de soma
(receita bruta, líquida, margem, EBITDA) são cálculo, nunca lançamento.

```prisma
/// Um valor por conta do plano de contas por mês de competência. As linhas
/// calculadas do DRE (totais, margens, EBITDA) não existem aqui.
model LancamentoMensal {
  id       String @id @default(cuid())
  tenantId String

  /// "2026-09". String e não Date: competência é mês, e Date obrigaria a
  /// convencionar "dia 1" em toda query.
  competencia String
  /// Código do plano de contas ("1.1" … "6.3"), validado contra
  /// PLANO_DE_CONTAS em código. String porque conta nova é constante nova,
  /// não migration.
  conta String

  valorCentavos Int
  nota          String?

  atualizadoEm DateTime @updatedAt

  tenant Tenant @relation("LancamentoMensalSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, competencia, conta])
  @@index([tenantId, competencia])
}
```

`apps/backoffice/lib/empresa/plano-de-contas.ts` exporta
`PLANO_DE_CONTAS`: uma entrada por conta de `plano-de-contas.md` com
`conta`, `nome`, `grupo` (1 a 6) e `centroDeCusto` (comercial |
produto-engenharia | entrega | ga | null). A action recusa `conta` fora da
lista. As linhas agregadas da tela ("Receita de serviço — Charter e outros
(1.7 + 1.8)", "Comercial (4.1–4.6)") são grupos definidos no mesmo arquivo.

### 2.4 CAC — `CacPeriodo` e `CacAlocacaoProduto`

Das oito parcelas da tela, seis **são contas do plano**: 4.1 salários de
vendas, 4.2 marketing, 4.3 comissões, 4.4 ferramentas, 4.5 mídia, 4.6
discovery não faturado. Elas não ganham coluna própria: a tela de CAC lê e
escreve `LancamentoMensal` da mesma competência. O que sobra é do CAC:

```prisma
model CacPeriodo {
  id       String @id @default(cuid())
  tenantId String

  /// Mesma chave de LancamentoMensal — é de lá que vêm as seis parcelas 4.x.
  competencia String

  /// Horas de entrega do diagnóstico vendido no período × custo-hora +
  /// ferramentas da entrega. Não é a conta 3.1: aquela inclui acompanhamento
  /// contínuo; esta é só a parcela que é custo de aquisição.
  entregaDiagnosticoCentavos Int?
  /// Denominador. Entrada manual em v1 — Proposal não tem `aceitaEm`, então a
  /// tela sugere a contagem de ACEITA atualizadas no mês, mas não a impõe.
  clientesGanhos Int?

  /// Conversão do funil no período, percentual inteiro. Nulo = ainda à mão.
  convLeadDiscoveryPercent       Int?
  convDiscoveryEvaluationPercent Int?
  convEvaluationPropostaPercent  Int?
  convPropostaAceitaPercent      Int?

  atualizadoEm DateTime @updatedAt

  tenant    Tenant               @relation("CacPeriodoSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  alocacoes CacAlocacaoProduto[]

  @@unique([tenantId, competencia])
}

/// Peso de cada produto no rateio do CAC (cac-modelo.md §4). Tabela e não
/// quatro colunas: Signal já está no enum e não na tela.
model CacAlocacaoProduto {
  id           String @id @default(cuid())
  cacPeriodoId String

  produto     ProductModule
  pesoPercent Int

  periodo CacPeriodo @relation(fields: [cacPeriodoId], references: [id], onDelete: Cascade)

  @@unique([cacPeriodoId, produto])
}
```

Os pesos somam 100 (validado na action). A regra do documento — ratear pelo
ACV do ano 1 — é como se **chega** ao peso; enquanto não houver volume, o peso
entra à mão, como a tela diz.

### 2.5 Caixa — `SemanaDeCaixa`

```prisma
/// Uma linha por semana de caixa. A janela de 13 é a leitura; a tabela guarda
/// também as semanas que já saíram dela — histórico realizado.
model SemanaDeCaixa {
  id       String @id @default(cuid())
  tenantId String

  /// Segunda-feira da semana. Date, não DateTime: semana não tem hora.
  semanaInicio DateTime @db.Date

  /// Só é lido na primeira semana da janela: saldo de extrato, realizado.
  /// Nas demais, o saldo inicial é o final calculado da anterior.
  saldoInicialCentavos Int?

  recebiveisCentavos         Int?
  contratosAssinadosCentavos Int?
  /// Entrada manual em v1, com o total ponderado (§3.3) como referência para
  /// distribuir — Proposal não tem previsão de fechamento para alocar por
  /// semana sozinha.
  pipelinePonderadoCentavos  Int?

  saidasPessoalCentavos      Int?
  saidasFornecedoresCentavos Int?
  saidasComercialCentavos    Int?
  saidasImpostosCentavos     Int?
  saidasOutrasCentavos       Int?

  atualizadoEm DateTime @updatedAt

  tenant Tenant @relation("SemanaDeCaixaSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, semanaInicio])
}
```

A régua rolante não precisa de job: a leitura ancora a semana 1 na segunda-feira
corrente e devolve 13 linhas, criando em memória as que não existem. Quando
uma semana fecha, o operador lança o saldo de extrato em
`saldoInicialCentavos` da nova semana 1 — regra 2 de `caixa-13-semanas.md`.

### 2.6 `Tenant`

Seis retro-relações novas, no bloco "Catálogo comercial" de `tenant.prisma`:
`fornecedoresDpa`, `decisaoDeConsentimento` (opcional), `perguntasAoParecer`,
`lancamentosMensais`, `cacPeriodos`, `semanasDeCaixa`.

## 3. Cálculo — `apps/backoffice/lib/empresa/`

Funções puras, uma por tela, com teste unitário sem banco.

### 3.1 `fornecedores.ts`

Transições de `estado` que a tela oferece, e só elas:

| De | Ação | Para | Carimba |
|---|---|---|---|
| `A_ASSINAR` | Marcar aceito / Anexar assinado | `ASSINADO` | `assinadoEm`, exige `evidenciaUrl` |
| `SEM_DOCUMENTO` | Registrar pedido | `SEM_DOCUMENTO` | `pedidoEm` |
| `SEM_DOCUMENTO` | Anexar assinado (chegou) | `ASSINADO` | `assinadoEm`, exige `evidenciaUrl` |
| qualquer | Confirmar plano / uso | inalterado | só `notas`, `acaoPendente`, `bloqueiaVenda` |

`EMBUTIDO` não transita: não há o que assinar. Os contadores dos cartões:
embutidos = `EMBUTIDO`; a aceitar = `A_ASSINAR`; sem documento =
`SEM_DOCUMENTO`; bloqueiam venda = `bloqueiaVenda && estado != ASSINADO`.

### 3.2 `cac.ts`

```
parcelas = { 4.1, 4.2, 4.3, 4.4, 4.5, 4.6 } de LancamentoMensal(competencia)
         + entregaDiagnosticoCentavos + clientesGanhos
preenchidas = quantas das 8 não são nulas
CAC = null se preenchidas < 8 ou clientesGanhos == 0
    = (Σ 4.1..4.6 + entregaDiagnostico) ÷ clientesGanhos
CAC por produto = CAC × pesoPercent ÷ 100
payback (meses) = CAC ÷ mensalidade líquida do plano de referência
```

A mensalidade de referência vem do catálogo, pela função que já existe:
`precificarProposta` com o plano Scale, `minimoAssentos` e termo `ANUAL` — os
mesmos valores de `precificar.test.ts`. Não se copia o número 3.278.

### 3.3 `financeiro.ts`

DRE por competência, a partir dos lançamentos do mês e de `PLANO_DE_CONTAS`:

```
receitaBruta   = Σ grupo 1
deducoes       = Σ grupo 2
receitaLiquida = receitaBruta − deducoes
custoEntrega   = Σ grupo 3
margemBruta    = receitaLiquida − custoEntrega
despesas       = Σ grupo 4 + Σ grupo 5 + Σ grupo 6   (uma linha por centro)
ebitda         = margemBruta − despesas
percentuais    = null quando receitaLiquida == 0
```

Uma linha agregada só aparece preenchida quando **todas** as contas do grupo
existem no mês; senão mostra "—" e conta como pendente. Trimestre = soma dos
três meses, com a mesma regra.

Caixa:

```
para i em 1..13:
  saldoInicial_i = saldoInicialCentavos_i ?? saldoFinal_(i−1)   (i = 1 sem valor → pendente)
  entradas_i = recebiveis + contratos + pipeline
  saidas_i   = pessoal + fornecedores + comercial + impostos + outras
  saldoFinal_i = saldoInicial_i + entradas_i − saidas_i    (null se qualquer parcela for nula)
```

Referência do pipeline ponderado (não persistida, mostrada ao lado da linha):
`Σ Proposal.totalCentavos com status ∈ {ENVIADA, AGUARDANDO_APROVACAO}` ×
`convPropostaAceitaPercent` do `CacPeriodo` mais recente ÷ 100. Sem
`CacPeriodo` com conversão, a referência é "sem taxa" e a linha fica manual.

### 3.4 `aviso.ts`

`AVISOS` com as quatro peças (`INTERNA_PT`, `EXTERNA_PT`, `EXTERNA_EN`,
`CLAUSULA_PT`) e `renderAviso(peca, decisao)`: substitui `[ferramenta]`,
`[prazo]`, `[contato]` pelos valores da `DecisaoDeConsentimento` quando não
nulos; marcador com valor nulo permanece visível entre colchetes — a tela
destaca, e "Copiar" copia com o marcador, nunca vazio. `[organização]` nunca é
substituído.

## 4. Actions — `apps/backoffice/app/actions/empresa/`

Mesmo contrato das demais: `"use server"`, `requirePlatformStaff()` para ler,
`assertCanWrite(staff)` para escrever, `safeAction` em volta, zod nos inputs,
`logPlatformAudit` em toda escrita com `entityType` igual ao nome do modelo,
`revalidatePath` da rota da tela.

| Arquivo | Leitura | Escrita |
|---|---|---|
| `fornecedores.ts` | `listarFornecedoresDpa()` — 18 linhas + contadores | `atualizarFornecedorDpa(codigo, patch)` — aplica §3.1; `exportarAoCharter(codigos[])` — §4.1 |
| `consentimento.ts` | `lerConsentimento()` — decisão, perguntas, avisos renderizados | `salvarDecisao(patch)`; `responderPergunta(numero, resposta)`; `marcarParecer(status)` |
| `cac.ts` | `lerCac(competencia)` — parcelas, conversão, alocação, resultado (§3.2) | `salvarParcelas(competencia, parcelas)` — grava 4.x em `LancamentoMensal` e o resto em `CacPeriodo`; `salvarConversao`; `salvarAlocacao` (soma 100) |
| `financeiro.ts` | `lerDre(competenciaFinal)` — três meses + trimestre; `lerCaixa()` — 13 semanas | `salvarLancamento(competencia, conta, valor)`; `salvarSemana(semanaInicio, patch)` |

Toda leitura e escrita filtra `tenantId = SYSTEM_TENANT_ID`; o teste
`no-cross-tenant-leak` passa a cobrir os quatro arquivos.

### 4.1 "Exportar para o Charter" — a única escrita fora do tenant `system`

O `CharterVendor` do tenant `nebuloz` continua com toda coluna contratual no
default, porque o runbook decidiu que confirmação se faz na tela. Esta é a
tela. A exportação escreve, por `codigo`:

| `FornecedorDpa` | → `CharterVendor` |
|---|---|
| `estado ∈ {EMBUTIDO, ASSINADO}` | `dpa = true`; senão `false` |
| `regiao` | `region` |
| `retencao` | `retention` |
| `assinadoEm + 12 meses`, quando houver | `renewalAt` |

`notes`, `tier`, `score` e `subprocessors` não são tocados: são do produto e
de quem opera o Charter. `maxClass` é cache derivado de `dpa`, `tier` e
cláusulas (ADR-0003) — mudar `dpa` sem recomputá-lo deixaria o teto mentindo.
A função que deriva, `deriveVendorMaxClass` em `apps/app/lib/charter/rules.ts`,
é pura, mas o back-office não importa de `apps/app`. Ela sai para
`packages/provisioning/src/charter-rules.ts` junto com `VendorPosture` e
`MaxClassDerivation`; `rules.ts` passa a reexportá-las, e nada em `apps/app`
muda de import. A exportação lê as cláusulas do fornecedor, recomputa e grava
`maxClass` no mesmo update.

Segue a ADR-0013 à letra — resolve o tenant por slug via `platformDb`, escreve
via `withTenantDb(tenantId)`. Carimba `exportadoAoCharterEm`; audita nos dois
tenants com `logPlatformAudit` (`logCharterAudit` também mora em `apps/app`):
no system, quem exportou; no nebuloz, o diff do `CharterVendor`, com
`entityType = "CharterVendor"` para aparecer na trilha do Charter.

## 5. Seed — `seed:empresa:nebuloz`

`packages/provisioning/src/empresa-nebuloz.ts` (só dados e tipos, mesmo
cabeçalho de `charter-nebuloz.ts`) com:

- `FORNECEDORES_DPA`: 18 linhas de `dpa-fornecedores.md` §1 (estado, região,
  retenção, transferência, URLs, `verificadoEm = 2026-09-05`, asterisco) e §3
  (ação, dono-papel, bloqueia venda). Proveniência campo a campo no cabeçalho,
  como o seed do Charter faz.
- `PERGUNTAS_AO_PARECER`: as 7 de `aviso-de-gravacao.md` §4 com o dono.

`apps/app/scripts/seed-empresa-nebuloz.ts` grava no tenant `system`,
**create-only** (`createMany` com `skipDuplicates`): o seed é evidência de 5
set; o que a tela mudou depois não pode ser sobrescrito por reexecução.
`DecisaoDeConsentimento` nasce vazia na primeira leitura da tela (upsert), não
no seed.

## 6. Migration

Uma só, `20260906000000_empresa`: enums, seis tabelas, índices, FKs, e o bloco
de RLS no padrão de `20260902190000_rls_catalogo_comercial` (ENABLE + FORCE +
policy `tenant_isolation`), com o mesmo aviso da ADR-0012 no cabeçalho. Produção
está com o ledger limpo desde 5 set; o `migrate:deploy` do build da Vercel
aplica. Se o pooler recusar o lock outra vez, o SQL vai para o editor do
Supabase como nas anteriores.

## 7. Navegação e rotas

Seção **Empresa** em `BO_NAV`, entre Comercial e Ferramentas, como no canvas:

| Rota | Label |
|---|---|
| `/empresa/fornecedores` | Fornecedores e DPA |
| `/empresa/consentimento` | Consentimento |
| `/empresa/cac` | CAC |
| `/empresa/financeiro` | Financeiro |

Sem `pendente`: as quatro entram implementadas.

## 8. Fora do v1, e por quê

- **"Reverificar fontes"** (botão da tela de fornecedores): é pesquisa em site
  de terceiro, não CRUD. No v1 o botão não existe; `verificadoEm` é editado à
  mão quando alguém reler a fonte.
- **"Exportar xlsx"** (Financeiro): o modelo já existe em
  `docs/financeiro/modelo-financeiro.xlsx`; gerar a partir do banco é uma
  tarefa própria depois de haver dado.
- **Pipeline ponderado por semana, automático**: precisa de
  `Proposal.previsaoFechamentoEm`, que não existe. Entra na lista de lacunas
  de `mapa-de-processo.md`.
- **`Proposal.aceitaEm`**: mesma lacuna — sem ela, "clientes ganhos no
  período" não se conta com precisão; fica manual com sugestão.
- **Levar `prazoRetencao`/`contatoTitular` aos tenants**: a decisão aqui é da
  Nebuloz; o que cada `MeetingIntegration` diz é do cliente. Um passo depois
  do parecer, não antes.
- **Pessoa em vez de papel** em `donoPapel`: quando o RACI do playbook tiver
  nomes, `donoPapel` vira `donoStaffPersonId`. Não antes.

## 9. Testes

- `lib/empresa/*.test.ts`: transições de §3.1 (inclusive `ASSINADO` sem
  evidência recusado); CAC nulo com 7 de 8; CAC e alocação com 8 de 8; payback
  a partir do catálogo mockado; DRE com grupo incompleto → "—"; caixa com
  semana 1 sem extrato → pendente, e encadeamento de saldo; `renderAviso` com
  marcador nulo preservado.
- `__tests__/empresa-*.test.ts`: cada action com o mock de `database` que os
  testes vizinhos usam; `exportarAoCharter` verifica que só as quatro colunas
  mudam; leitura recusa sem staff, escrita recusa sem `canWrite`.
- `no-cross-tenant-leak.test.ts` cobre `actions/empresa/`.

## 10. O que fica com você

1. **`ASSINADO` exige evidência.** É a regra que torna o estado prova e não
   afirmação. Se for pesado demais no começo, cai para "recomendado".
2. **CAC lê o DRE.** Uma fonte para o número, mas a tela de CAC passa a mexer
   em contas do DRE — quem edita uma vê a outra mudar. É intencional.
3. **Signal no rateio.** O enum permite; a tela do canvas mostra quatro
   produtos. O seed não cria linha para Signal; a tela mostra os que existem.
