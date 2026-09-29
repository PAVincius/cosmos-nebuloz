# Data Model: Bootstrap do Charter cria biblioteca de cláusulas

Nenhuma migração de banco nesta feature. A tabela e a constraint abaixo já existem em produção; esta seção documenta o que a feature lê/escreve, não schema novo.

## CharterClause (já existe — `packages/database/prisma/schema/charter.prisma:302-317`)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `String` (cuid) | gerado pelo Prisma |
| `tenantId` | `String` | FK `Tenant`, escopo de RLS |
| `code` | `String` | `CL-01`...`CL-08` nesta feature |
| `name` | `String` | texto da cláusula (fonte: catálogo único, ver abaixo) |
| `critical` | `Boolean` | default `false`; alimenta `deriveVendorMaxClass` (`charter-rules.ts`) |
| `description` | `String?` | não preenchido pelo bootstrap (fica `null`); é o campo que a tela de edição do Legal usa para detalhar a cláusula além do nome |
| `createdAt` | `DateTime` | default `now()` |

**Chave de idempotência**: `@@unique([tenantId, code])` — já existe, é a chave que `createMany({ skipDuplicates: true })` usa (Decisão 2 do `research.md`).

**Relação**: `CharterVendorClause` associa fornecedor ↔ cláusula (N:N); não muda nesta feature — a associação continua sendo feita na tela de Fornecedores, não no bootstrap.

## Catálogo `CHARTER_CLAUSES` (novo — não é tabela, é constante de código)

Fonte única consumida por `bootstrapCharter` e por `seed-charter.ts` (Decisão 1 do `research.md`). Uma entrada por cláusula, retirada de `apps/app/scripts/seed-charter.ts:212-233` sem alterar conteúdo:

| code | name | critical |
|---|---|---|
| CL-01 | Proibição de treinamento com dados do cliente | true |
| CL-02 | Retenção zero de prompt e resposta | true |
| CL-03 | Notificação de incidente em 24h | true |
| CL-04 | Lista de sub-processadores e direito de objeção | true |
| CL-05 | Localidade de processamento definida contratualmente | false |
| CL-06 | Direito de auditoria anual | false |
| CL-07 | Indenização por violação de PI | false |
| CL-08 | BAA / adendo de dado de saúde | true |

**Regra de forma**: 8 entradas, `code` único dentro do catálogo, formato `CL-0N`. Validado por teste de forma (`charter-clauses.test.ts`), não por Zod — é constante interna, não input de boundary (Constitution IV é N/A aqui, ver `plan.md`).

**Nota fora de escopo desta feature**: `charter-rules.ts` mantém seu próprio `CLAUSE_LABEL` (code → nome, para texto de reasoning exibido ao CISO). Ele hoje já duplica nome+code do mesmo catálogo. Unificar `CLAUSE_LABEL` para derivar de `CHARTER_CLAUSES` seria uma limpeza adicional bem-vinda, mas não é exigida por nenhum FR desta spec (FR-002 fala de bootstrap × seed, não de `charter-rules.ts`) — fica registrado aqui para quem for implementar decidir se inclui como bônus de baixo risco ou deixa para outra spec.

## Sem transições de estado

`CharterClause` não tem máquina de estados nesta feature — é criada uma vez (ou pulada, se já existe) e editada manualmente depois pela tela do Charter (fora de escopo, já existe).
