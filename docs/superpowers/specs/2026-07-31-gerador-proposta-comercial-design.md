# Gerador de proposta comercial — design

**Data**: 2026-07-31 · **Status**: aprovado, pronto para plano de implementação

## Problema

As propostas da Nebuloz são montadas à mão, fora do sistema. Isso custa três
coisas: o número é escolhido manualmente (o exemplo de referência é o
`87393-3`), não existe histórico do que foi enviado para quem, e reemitir uma
proposta de três meses atrás significa refazê-la de memória.

Esta é uma fatia independente: não depende do back-office da fatia A nem do
pipeline da fatia C, e por isso pode ser construída antes de ambos entregarem
valor completo.

| Fatia | O que é | Ordem |
|---|---|---|
| A — clientes e contratação | quem é cliente, o que contratou, provisionar | 1ª |
| **Gerador de proposta** | **proposta comercial no timbrado, guardada e emitida em PDF** | **2ª — esta spec** |
| B — cobrança | Stripe ↔ `TenantModule.status` | 3ª |
| C — pipeline comercial | lead → proposta → fechado | 4ª |

## O que o template de referência é — e o que não é

O material de origem são três PDFs: o timbrado em branco e as duas páginas de um
orçamento real. A estrutura que eles definem:

- **Página 1** — dados da empresa e do cliente lado a lado, descrição do
  projeto, escopo em tópicos, tabela de itens com valores (com itens marcados
  "A definir") e o total.
- **Página 2** — condições comerciais (valor por extenso, formas de pagamento,
  prazo de entrega, período de suporte, validade), termos e condições em
  tópicos, e o fecho com assinatura, razão social e CNPJ.

**Não é um contrato.** Falta vigência, reajuste, rescisão com aviso prévio,
foro, LGPD e DPA. É uma proposta comercial, e é isso que esta spec gera.

**O modelo comercial do template é outro.** Ele vende projeto fechado de site,
por entrega. A plataforma vende assinatura de módulo, recorrente. A casca visual
e a estrutura se aproveitam inteiras; as cláusulas do template original não —
elas falam de briefing, entrega e uso em portfólio.

**Dado pessoal:** o orçamento de referência traz nome, endereço, telefone e
e-mail de um cliente real. Esses arquivos não entram no repositório. O único
asset versionado é o **timbrado em branco**, exportado para PNG em resolução A4
2x; os exemplos usam dados fictícios.

## Onde mora

Dentro de `apps/backoffice` (mesmo app, mesmo `requirePlatformStaff`), com a
renderização isolada em `packages/documents` — server-only, sem dependência do
app. A fatia C vai chamar o mesmo renderizador quando a proposta nascer de um
lead; manter no package evita que o gerador precise ser extraído depois.

Proposta é documento **da Nebuloz**, não de um cliente: não é tenant-scoped e
usa a porta `platformDb` da fatia A. É a segunda exceção coberta pelo mesmo ADR.

## Modelo de dados

Primeira migration nova da série (a fatia A não precisou de nenhuma).

```prisma
model Proposal {
  id        String         @id @default(cuid())
  number    String         @unique   // "2026-0007", sequencial por ano
  status    ProposalStatus @default(DRAFT)

  // partes
  clientName    String
  clientDoc     String?   // CNPJ ou CPF
  clientAddress String?
  clientCity    String?
  clientPhone   String?
  clientEmail   String?

  // vira cliente: preenchido quando a proposta é aceita e o tenant provisionado
  tenantId String?

  // conteúdo
  title       String
  description String   @db.Text
  scope       String[]           // tópicos do escopo
  items       ProposalItem[]

  // condições
  paymentTerms  String[]         // opções de pagamento, em tópicos
  deliveryDays  Int?
  supportMonths Int?
  validUntil    DateTime
  terms         String[]         // termos e condições, default do template

  issuedById String              // staff que emitiu
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

model ProposalSequence {
  year Int @id
  next Int @default(1)
}

enum ProposalStatus {
  DRAFT
  SENT
  ACCEPTED
  DECLINED
}
```

Três decisões embutidas:

- **`amount` nulo significa "A definir"**, que é exatamente o que o template já
  exibe. O total soma só os itens com valor.
- **Dinheiro é `Decimal(10,2)`**, nunca float. Formatação pt-BR na borda, com
  `Intl.NumberFormat`.
- **Não existe status `EXPIRED`.** Vencida é derivado de `validUntil < hoje`,
  calculado na leitura. Um status persistido exigiria job para virar e mentiria
  entre a data de vencimento e a execução dele.

**Numeração** — `ProposalSequence` incrementado dentro da mesma transação que
cria a proposta, para não abrir buraco nem repetir número sob concorrência.

## Renderização

`@react-pdf/renderer`: JavaScript puro, roda em função serverless sem Chromium,
layout declarativo. O timbrado entra como imagem de fundo em cada página e o
conteúdo flui por cima — escopo, itens e termos têm tamanho variável, então a
quebra de página tem que ser automática, não coordenada à mão.

O renderizador recebe uma `Proposal` já montada e devolve bytes. Nenhuma consulta
ao banco dentro dele: isso o mantém testável e reutilizável pela fatia C.

## Telas

| Rota | Conteúdo |
|---|---|
| `/propostas` | Lista: número, cliente, total, status, validade (vencida em vermelho). |
| `/propostas/nova` | Formulário: partes, descrição, escopo, itens, condições, validade. Termos vêm preenchidos com o texto padrão e são editáveis. |
| `/propostas/[id]` | Ver, baixar PDF, duplicar para outro cliente, marcar como enviada / aceita / recusada. |

Ao marcar **aceita**, aparece o caminho para provisionar o cliente com os dados
da proposta já preenchidos — é o encaixe com a fatia A. Se a A ainda não estiver
pronta, marcar aceita apenas muda o status.

## Erros e estados

Validação: `validUntil` obrigatória e futura na emissão; ao menos um item; valor
não-negativo. Os três estados de tela (carregando, vazio, erro) valem igual ao
resto.

Gerar PDF não pode depender de rede: fonte e timbrado são assets locais do
package. Falha de renderização retorna erro nomeado, não PDF corrompido.

## Testes

- numeração sequencial sem buraco nem repetição sob duas emissões concorrentes
- total ignora itens sem valor, e o PDF os mostra como "A definir"
- proposta com escopo longo quebra em mais de uma página, e toda página sai com
  o timbrado
- "vencida" é derivado da data — proposta com `validUntil` no passado aparece
  como vencida sem nenhum job ter rodado
- duplicar gera número novo e não altera a original

## Fora de escopo

- **Assinatura eletrônica** (Clicksign, DocuSign e afins).
- **Envio por e-mail** — você baixa e manda. Envio automático precisa de
  rastreio de entrega e abertura para valer a pena, e isso é outra conversa.
- **Lead e pipeline** — fatia C.
- **Contrato de assinatura recorrente** — ver lacuna abaixo.

## Lacuna registrada: contrato de assinatura

A plataforma vende assinatura recorrente e não existe contrato para isso. As
cláusulas que faltam, e que o template de proposta não cobre: vigência e
renovação, reajuste, rescisão e aviso prévio, SLA e crédito por
indisponibilidade, tratamento de dados pessoais (LGPD, com o DPA que o próprio
Charter exige dos fornecedores dos clientes), propriedade intelectual, e foro.

Escrever isso não é trabalho de engenharia e pede revisão jurídica. A decisão de
gerar contrato pelo sistema ou usar um serviço de assinatura pronto fica para
depois que o texto existir.
