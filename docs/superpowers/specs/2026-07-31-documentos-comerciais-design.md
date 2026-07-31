# Documentos comerciais — proposta, contrato e assinatura

**Data**: 2026-07-31 · **Status**: aprovado, pronto para plano de implementação

## Problema

As propostas da Nebuloz são montadas à mão, fora do sistema: o número é
escolhido manualmente (o exemplo de referência é o `87393-3`), não existe
histórico do que foi enviado para quem, e reemitir uma proposta de três meses
atrás significa refazê-la de memória. Contrato é pior — não existe nenhum, e
vender assinatura recorrente sem contrato é vender sem vigência, sem reajuste e
sem rescisão definidos.

Esta fatia é independente do back-office (fatia A) e do pipeline (fatia C).

| Fatia | O que é | Ordem |
|---|---|---|
| A — clientes e contratação | quem é cliente, o que contratou, provisionar | 1ª |
| **Documentos comerciais** | **proposta, contrato montável e assinatura via Clicksign** | **2ª — esta spec** |
| B — cobrança | Stripe ↔ `TenantModule.status` | 3ª |
| C — pipeline comercial | lead → proposta → fechado | 4ª |

**Duas fases**, para a primeira poder ir ao ar sem esperar a segunda:

- **Fase 1** — proposta e contrato: montagem, numeração, histórico, PDF.
- **Fase 2** — Clicksign: envio para assinatura, webhook, arquivo assinado.

A fase 1 já elimina o trabalho manual. A fase 2 traz credencial, sandbox e um
endpoint público exposto — riscos que não pertencem ao mesmo dia.

## O material de referência

Três PDFs: o timbrado em branco e as duas páginas de um orçamento real.

- **Página 1** — dados da empresa e do cliente lado a lado, descrição do
  projeto, escopo em tópicos, tabela de itens com valores (alguns "A definir") e
  o total.
- **Página 2** — condições comerciais (valor por extenso, formas de pagamento,
  prazo, suporte, validade), termos e condições em tópicos, e o fecho com
  assinatura, razão social e CNPJ.

**É proposta, não contrato.** Falta vigência, reajuste, rescisão com aviso
prévio, foro, LGPD e DPA. E vende projeto fechado de site, enquanto a plataforma
vende assinatura recorrente. A casca visual e a estrutura se aproveitam
inteiras; as cláusulas do orçamento original, não.

**Dado pessoal:** o orçamento de referência traz nome, endereço, telefone e
e-mail de um cliente real. Esses arquivos não entram no repositório. O único
asset versionado é o **timbrado em branco**, exportado para PNG em resolução A4
2x; os exemplos usam dados fictícios.

## Onde mora

Telas em `apps/backoffice` (mesmo app da fatia A, mesmo `requirePlatformStaff`).
Montagem e renderização em `packages/documents` — server-only, sem dependência
do app, porque a fatia C vai chamar o mesmo mecanismo quando a proposta nascer
de um lead. O webhook da Clicksign vai em `apps/api`, ao lado do webhook de
pagamento que já existe.

Documento comercial é da Nebuloz, não de um cliente: não é tenant-scoped e usa a
porta `platformDb` da fatia A.

## Fase 1 — proposta e contrato

### Proposta

```prisma
model Proposal {
  id     String         @id @default(cuid())
  number String         @unique   // "2026-0007", sequencial por ano
  status ProposalStatus @default(DRAFT)

  clientName    String
  clientDoc     String?   // CNPJ ou CPF
  clientAddress String?
  clientCity    String?
  clientPhone   String?
  clientEmail   String?

  tenantId String?   // preenchido quando vira cliente

  title       String
  description String        @db.Text
  scope       String[]
  items       ProposalItem[]

  paymentTerms  String[]
  deliveryDays  Int?
  supportMonths Int?
  validUntil    DateTime
  terms         String[]

  issuedById String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model ProposalItem {
  id         String   @id @default(cuid())
  proposalId String
  label      String
  amount     Decimal? @db.Decimal(10, 2)   // null = "A definir"
  ordinal    Int
}

enum ProposalStatus { DRAFT SENT ACCEPTED DECLINED }
```

Três decisões embutidas:

- **`amount` nulo é "A definir"**, como o template já exibe. O total soma apenas
  os itens com valor.
- **Dinheiro é `Decimal(10,2)`**, nunca float. Formatação pt-BR na borda.
- **Não existe status `EXPIRED`.** Vencida é derivado de `validUntil < hoje`. Um
  status persistido exigiria job e mentiria entre o vencimento e a execução dele.

### Contrato: biblioteca de cláusulas versionada

O contrato não é um arquivo — é a montagem de cláusulas com variáveis
preenchidas. É o mesmo padrão que o Charter já usa para política, e pela mesma
razão: você precisa saber qual versão o cliente assinou e o que mudou da
anterior.

```prisma
model Clause {
  id        String       @id @default(cuid())
  code      String       @unique   // "CL-VIGENCIA"
  title     String
  body      String       @db.Text  // texto com {{variáveis}}
  status    ClauseStatus @default(DRAFT)
  version   Int          @default(1)
  updatedAt DateTime     @updatedAt
}

model ContractTemplate {
  id      String                  @id @default(cuid())
  name    String                  // "Assinatura de módulo — mensal"
  clauses ContractTemplateClause[] // ordem e obrigatoriedade
  status  ClauseStatus            @default(DRAFT)
}

model Contract {
  id         String  @id @default(cuid())
  number     String  @unique   // mesma sequência anual, prefixo próprio
  templateId String
  proposalId String?           // quando nasce de uma proposta aceita
  tenantId   String?

  variables Json               // partes e valores resolvidos na emissão

  // SNAPSHOT: o texto exato emitido, cláusula a cláusula
  body ContractClauseSnapshot[]

  status     ContractStatus @default(DRAFT)
  issuedById String
  createdAt  DateTime       @default(now())
}

enum ClauseStatus   { DRAFT ACTIVE RETIRED }
enum ContractStatus { DRAFT SENT SIGNED CANCELED }
```

**O snapshot é o ponto central.** Ao emitir, o texto renderizado de cada
cláusula é congelado no contrato. Trocar a cláusula de reajuste amanhã muda os
contratos **novos** e não toca no que já foi assinado. Sem isso, o sistema
reescreveria retroativamente um documento assinado — exatamente o que a
imutabilidade da trilha do Charter existe para impedir.

**Variáveis** (`{{cliente.razaoSocial}}`, `{{contrato.valorMensal}}`,
`{{modulos}}`, …) são resolvidas por um dicionário tipado. Variável não
resolvida **falha a emissão**: contrato com `{{}}` cru no corpo é pior que
contrato nenhum.

### Renderização

`@react-pdf/renderer`: JavaScript puro, roda em função serverless sem Chromium,
layout declarativo. O timbrado entra como imagem de fundo em cada página e o
conteúdo flui por cima — escopo, itens e cláusulas têm tamanho variável, então a
quebra de página tem que ser automática, não coordenada à mão.

O renderizador recebe dados já montados e devolve bytes. Nenhuma consulta ao
banco dentro dele: isso o mantém testável e reutilizável pela fatia C.

### Numeração

`DocumentSequence` por ano e por tipo, incrementado na mesma transação que cria
o documento — sem buraco e sem repetição sob concorrência.

### Telas

| Rota | Conteúdo |
|---|---|
| `/propostas` | Lista: número, cliente, total, status, validade (vencida em vermelho). |
| `/propostas/nova` | Formulário: partes, descrição, escopo, itens, condições, validade. |
| `/propostas/[id]` | Ver, baixar PDF, duplicar, marcar enviada/aceita/recusada. Aceita → caminho para gerar contrato e provisionar. |
| `/clausulas` | Biblioteca: criar, editar, ativar, aposentar. Editar cláusula ativa cria versão nova. |
| `/contratos` | Lista e emissão a partir de um template, com as variáveis do cliente. |
| `/contratos/[id]` | Corpo emitido, PDF e — na fase 2 — a situação da assinatura. |

## Fase 2 — assinatura via Clicksign

### O fluxo na API v3

O envelope é a unidade: um container com documentos, signatários e requisitos,
que vive em `draft` → `running` → `closed` (ou `canceled`). A sequência:

1. criar envelope
2. subir o PDF do contrato como documento
3. criar os signatários (você e o responsável do cliente)
4. definir os requisitos de qualificação e de autenticação de cada signatário
5. ativar — a ativação é a mudança de status de `draft` para `running`
6. notificar os signatários

O ambiente de testes é o `sandbox.clicksign.com`, com Access Token próprio
gerado em Configurações → API. Documento assinado em sandbox não tem valor
legal, que é exatamente o que se quer no teste de integração.

### O que guardamos

```prisma
model ContractEnvelope {
  id           String    @id @default(cuid())
  contractId   String    @unique
  clicksignKey String    @unique
  status       String              // espelho do status do envelope
  signers      Json                // nome, e-mail e situação de cada um
  sentAt       DateTime?
  signedAt     DateTime?
  signedFileId String?             // arquivo assinado no @repo/storage
}
```

### Webhook

Endpoint em `apps/api`, ao lado do de pagamento. Três regras não negociáveis:

- **Validar a assinatura HMAC antes de ler o corpo.** Payload sem assinatura
  válida é descartado com 401 e registrado. O header e o algoritmo exatos se
  confirmam contra a documentação no momento da implementação.
- **Idempotência por evento.** Webhook reenvia; processar duas vezes não pode
  duplicar nada.
- **O webhook não provisiona cliente.** Ele marca o contrato como assinado e
  guarda o arquivo. Criar tenant e liberar módulo continua sendo um clique
  humano no back-office. Um payload forjado que passe pela validação não deve
  conseguir criar cliente com acesso ativo — o custo desse clique é baixo, o do
  contrário não é.

### Credenciais

`CLICKSIGN_ACCESS_TOKEN` e o segredo do webhook em variável de ambiente, com
valores distintos para sandbox e produção. Nada de token em código, e o token
nunca aparece em log — mesma regra do `ENCRYPTION_KEY`.

## Erros e estados

Validação: `validUntil` obrigatória e futura; ao menos um item na proposta;
valor não-negativo; toda variável do contrato resolvida.

Gerar PDF não pode depender de rede: fonte e timbrado são assets locais do
package. Falha de renderização retorna erro nomeado, não PDF corrompido.

A Clicksign fora do ar não trava a emissão: o contrato existe e o PDF sai mesmo
sem envelope. Enviar para assinatura é ação separada e repetível.

## Testes

**Fase 1**

- numeração sequencial sem buraco nem repetição sob duas emissões concorrentes
- total ignora itens sem valor, e o PDF os mostra como "A definir"
- documento com corpo longo quebra em mais de uma página, e toda página sai com
  o timbrado
- "vencida" é derivado da data, sem job envolvido
- **emitir contrato congela o texto**: alterar a cláusula depois não muda o
  contrato emitido
- variável não resolvida falha a emissão em vez de emitir `{{}}` cru

**Fase 2**

- webhook com assinatura HMAC inválida é rejeitado e não altera nada
- o mesmo evento entregue duas vezes produz um único efeito
- envelope `closed` marca o contrato assinado e guarda o arquivo, **sem**
  provisionar cliente

## Fora de escopo

- **Envio de proposta por e-mail** — você baixa e manda. Envio automático só
  vale com rastreio de entrega e abertura, e isso é outra conversa.
- **Lead e pipeline** — fatia C.
- **Cobrança** — fatia B.
- **Assinatura da proposta** — proposta se aceita por e-mail; quem vai para a
  Clicksign é o contrato.

## O texto do contrato não é entregável desta spec

O sistema monta, versiona, emite e coleta assinatura. **As cláusulas em si
precisam ser escritas e revisadas por advogado**: vigência e renovação,
reajuste, rescisão e aviso prévio, SLA e crédito por indisponibilidade,
tratamento de dados pessoais (LGPD, com o DPA que o próprio Charter exige que
seus clientes cobrem dos fornecedores deles), propriedade intelectual e foro.

A biblioteca nasce vazia. Sem esse texto, a fase 1 entrega um editor sem o que
editar.

## Fontes

- [Envelope — API v3](https://developers.clicksign.com/docs/envelope)
- [Primeiros passos — API 3.0](https://developers.clicksign.com/docs/primeiros-passos)
