# Telas "Empresa" do back-office — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar às quatro telas desenhadas em 5 set 2026 (Fornecedores e DPA, Consentimento, CAC, Financeiro) modelo, cálculo, actions, seed e páginas no back-office, no tenant `system`.

**Architecture:** Seis modelos novos em `packages/database/prisma/schema/empresa.prisma`, todos com `tenantId` do tenant `system` e RLS declarada. Todo cálculo (CAC, DRE, caixa, transições de DPA, render do aviso) é função pura em `apps/backoffice/lib/empresa/`, testada sem banco. Actions em `apps/backoffice/app/actions/empresa/` seguem o contrato das vizinhas (`requirePlatformStaff` → `assertCanWrite` → `safeAction` → `logPlatformAudit`). A única escrita fora do `system` é a exportação para o `CharterVendor` do tenant `nebuloz`, via `platformDb` + `withTenantDb` (ADR-0013), recomputando `maxClass` com `deriveVendorMaxClass` movida para `packages/provisioning`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (schema multi-arquivo, `prisma.config.ts`), Vitest 4, zod 4, kit Cosmos (`@repo/design-system/cosmos/kit`), Biome via ultracite.

**Spec:** [`docs/superpowers/specs/2026-09-05-telas-empresa-modelo-design.md`](../specs/2026-09-05-telas-empresa-modelo-design.md)

## Global Constraints

- Tudo pertence ao tenant `system`: toda query filtra `tenantId: SYSTEM_TENANT_ID` (`apps/backoffice/lib/guard.ts`), toda relação em `Tenant` é nomeada `"<Modelo>SystemTenant"`.
- Dinheiro em centavos `Int`; percentual em `Int` (12 = 12%). Nunca `Float`/`Decimal`.
- Célula de entrada é `Int?` — nulo é "não preenchido", zero é zero. Nunca `@default(0)` em campo de entrada.
- Nenhum valor calculado (CAC, payback, totais, margem, EBITDA, saldo) é persistido.
- Texto de documento (avisos, cláusula, plano de contas) fica em código; dado em tabela.
- Actions: `"use server"`, `requirePlatformStaff()` para ler, `assertCanWrite(staff)` para escrever, `safeAction` em volta, zod nos inputs, `logPlatformAudit` em toda escrita, `revalidatePath` da rota.
- Cross-tenant só por `platformDb` (leitura de tenant por slug) e `withTenantDb` (escrita no Charter). Nenhum import de `apps/app` no back-office.
- Commits sem trailer `Co-Authored-By` (pedido do usuário em 5 set). Mensagens em português, conventional commits.
- Comandos de teste: `pnpm --filter backoffice test -- <arquivo>`; typecheck: `pnpm --filter backoffice typecheck`; lint: `pnpm check` na raiz (o hook do `rtk` reescreve `grep`/`git`: use `/usr/bin/grep`, `/usr/bin/git`).
- Banco local de ensaio: Docker `cosmos-e2e-db` na porta 5434, banco `cosmos_dev` (ledger reconciliado; é o `DATABASE_URL` de `apps/app/.env.local`, que `apps/backoffice/.env.local` aponta por symlink). Nunca rodar migration ou seed contra produção a partir deste plano — produção recebe pelo `migrate:deploy` do build da Vercel.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/database/prisma/schema/empresa.prisma` | Enums e seis modelos (Task 1) |
| `packages/database/prisma/schema/tenant.prisma` | Seis retro-relações novas (Task 1) |
| `packages/database/prisma/migrations/20260906000000_empresa/migration.sql` | Criação + RLS (Task 1) |
| `packages/provisioning/src/charter-rules.ts` | `deriveVendorMaxClass`, `CLAUSE_LABEL`, `VendorPosture`, `MaxClassDerivation` movidos de `apps/app` (Task 2) |
| `apps/app/lib/charter/rules.ts` | Reexporta os quatro símbolos (Task 2) |
| `apps/backoffice/lib/empresa/plano-de-contas.ts` | `PLANO_DE_CONTAS`, grupos, linhas do DRE, contas do CAC (Task 3) |
| `apps/backoffice/lib/empresa/fornecedores.ts` | Transições de estado do DPA e contadores (Task 4) |
| `apps/backoffice/lib/empresa/cac.ts` | `calcularCac`, `pesosSomam100` (Task 5) |
| `apps/backoffice/lib/empresa/financeiro.ts` | `calcularDre`, `calcularCaixa`, janela de 13 semanas (Task 6) |
| `apps/backoffice/lib/empresa/aviso.ts` | Textos do aviso e `renderAviso` (Task 7) |
| `apps/backoffice/app/actions/empresa/fornecedores.ts` | Listar, agir, atualizar, exportar ao Charter (Task 8) |
| `apps/backoffice/app/actions/empresa/consentimento.ts` | Ler, salvar decisão, responder, marcar parecer (Task 9) |
| `apps/backoffice/app/actions/empresa/cac.ts` | Ler e salvar parcelas, conversão, alocação (Task 10) |
| `apps/backoffice/app/actions/empresa/financeiro.ts` | DRE e caixa (Task 11) |
| `packages/provisioning/src/empresa-nebuloz.ts` + `apps/app/scripts/seed-empresa-nebuloz.ts` | Seed dos 18 fornecedores e 7 perguntas (Task 12) |
| `apps/backoffice/components/nav.ts` + `app/(staff)/empresa/**` | Seção Empresa e quatro páginas (Tasks 13–16) |
| `apps/backoffice/__tests__/empresa-*.test.ts`, `__tests__/no-cross-tenant-leak.test.ts` | Testes (em cada task; Task 17) |

---

### Task 1: Schema, retro-relações e migration

**Files:**
- Create: `packages/database/prisma/schema/empresa.prisma`
- Modify: `packages/database/prisma/schema/tenant.prisma:268` (após `addOnsComerciais`)
- Create: `packages/database/prisma/migrations/20260906000000_empresa/migration.sql`

**Interfaces:**
- Produces: modelos Prisma `FornecedorDpa`, `DecisaoDeConsentimento`, `PerguntaAoParecer`, `LancamentoMensal`, `CacPeriodo`, `CacAlocacaoProduto`, `SemanaDeCaixa`; enums `EstadoDpa`, `BaseLegal`, `StatusParecer`. Clientes Prisma: `database.fornecedorDpa`, `database.decisaoDeConsentimento`, `database.perguntaAoParecer`, `database.lancamentoMensal`, `database.cacPeriodo`, `database.cacAlocacaoProduto`, `database.semanaDeCaixa`. Chaves compostas: `tenantId_codigo`, `tenantId_numero`, `tenantId_competencia_conta`, `tenantId_competencia`, `cacPeriodoId_produto`, `tenantId_semanaInicio`.

- [ ] **Step 1: Criar `empresa.prisma`**

```prisma
/// Empresa — o que a Nebuloz controla sobre si mesma: contratos com
/// fornecedores, consentimento de gravação, custo de aquisição e base
/// financeira. Quatro telas do back-office (spec
/// docs/superpowers/specs/2026-09-05-telas-empresa-modelo-design.md).
///
/// Tudo aqui pertence ao tenant `system`, como platform-ops.prisma e
/// comercial.prisma: é dado da casa, não do cliente. Dinheiro em centavos
/// inteiros; percentual inteiro; célula de entrada é `Int?` porque a tela
/// distingue "não preenchido" de zero.

// ─────────────────────────── Fornecedores e DPA ───────────────────────────

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

/// Estado do acordo de tratamento de dados com cada fornecedor do Charter
/// interno. Vínculo com `CharterVendor` (tenant nebuloz) pelo `codigo`, não
/// por FK: são tenants diferentes (ADR-0013).
model FornecedorDpa {
  id       String @id @default(cuid())
  tenantId String

  /// Mesmo código do `CharterVendor` no tenant nebuloz ("V-01").
  codigo String
  nome   String

  estado                  EstadoDpa
  /// O asterisco de dpa-fornecedores.md §1: documento existe mas o texto não
  /// pôde ser lido (PDF sem camada de texto, portal dinâmico).
  classificacaoProvisoria Boolean   @default(false)

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
  acaoPendente  String?
  /// Papel do RACI do playbook, não pessoa — os nomes ainda estão em branco.
  donoPapel     String?
  bloqueiaVenda Boolean @default(false)

  /// Quando se pediu o DPA ao fornecedor ("Registrar pedido").
  pedidoEm             DateTime?
  /// Quando foi aceito/assinado ("Marcar aceito", "Anexar assinado").
  assinadoEm           DateTime?
  /// Última exportação para o `CharterVendor` do tenant nebuloz. Nulo = nunca.
  exportadoAoCharterEm DateTime?

  notas String? @db.Text

  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  tenant Tenant @relation("FornecedorDpaSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, codigo])
  @@index([tenantId, estado])
}

// ─────────────────────────── Consentimento ───────────────────────────

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
/// Nebuloz. Os textos do aviso ficam em código
/// (apps/backoffice/lib/empresa/aviso.ts); aqui só o que os preenche.
model DecisaoDeConsentimento {
  id       String @id @default(cuid())
  tenantId String @unique

  /// `[ferramenta]` — ex. "Fireflies".
  ferramenta     String?
  /// `[prazo]` — resposta à pergunta 6; nulo enquanto o RoPA disser
  /// "não definida".
  prazoRetencao  String?
  /// `[contato]` — canal do titular (operadora-controladora.md §4).
  contatoTitular String?

  baseLegal           BaseLegal @default(SEM_DECISAO)
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

  numero    Int
  pergunta  String @db.Text
  /// "responsável jurídico" | "Dono do SLA" — papel, pelo mesmo motivo de
  /// `FornecedorDpa.donoPapel`.
  donoPapel String

  resposta     String?   @db.Text
  respondidaEm DateTime?

  tenant Tenant @relation("PerguntaAoParecerSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, numero])
}

// ─────────────────────────── Financeiro ───────────────────────────

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

// ─────────────────────────── CAC ───────────────────────────

/// Das oito parcelas do CAC, seis são contas 4.1–4.6 de LancamentoMensal da
/// mesma competência. Aqui fica só o que não é conta do DRE.
model CacPeriodo {
  id       String @id @default(cuid())
  tenantId String

  /// Mesma chave de LancamentoMensal — é de lá que vêm as seis parcelas 4.x.
  competencia String

  /// Horas de entrega do diagnóstico vendido no período × custo-hora +
  /// ferramentas da entrega. Não é a conta 3.1: aquela inclui acompanhamento
  /// contínuo; esta é só a parcela que é custo de aquisição.
  entregaDiagnosticoCentavos Int?
  /// Denominador. Entrada manual em v1 — Proposal não tem `aceitaEm`.
  clientesGanhos             Int?

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

// ─────────────────────────── Caixa ───────────────────────────

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
  /// Entrada manual em v1, com o total ponderado como referência — Proposal
  /// não tem previsão de fechamento para alocar por semana sozinha.
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

- [ ] **Step 2: Retro-relações em `Tenant`**

Em `packages/database/prisma/schema/tenant.prisma`, logo após a linha
`addOnsComerciais AddOnComercial[] @relation("AddOnComercialSystemTenant")` (linha 268), antes do `}` que fecha o modelo:

```prisma
  // Empresa — o que a Nebuloz controla sobre si mesma (também no tenant `system`)
  fornecedoresDpa          FornecedorDpa[]               @relation("FornecedorDpaSystemTenant")
  decisaoDeConsentimento   DecisaoDeConsentimento?       @relation("DecisaoDeConsentimentoSystemTenant")
  perguntasAoParecer       PerguntaAoParecer[]           @relation("PerguntaAoParecerSystemTenant")
  lancamentosMensais       LancamentoMensal[]            @relation("LancamentoMensalSystemTenant")
  cacPeriodos              CacPeriodo[]                  @relation("CacPeriodoSystemTenant")
  semanasDeCaixa           SemanaDeCaixa[]               @relation("SemanaDeCaixaSystemTenant")
```

- [ ] **Step 3: Validar e gerar o client**

```bash
cd packages/database && npx prisma format && npx prisma validate && npx prisma generate --no-hints
```

Esperado: `The schema at prisma/schema is valid 🚀` e client gerado sem erro. Se `format` reordenar alinhamento, aceitar.

- [ ] **Step 4: Gerar a migration contra o banco local**

```bash
cd packages/database && npx prisma migrate dev --create-only --name empresa
```

Esperado: pasta `prisma/migrations/2026MMDDHHMMSS_empresa/`. **Renomear** para `20260906000000_empresa` (o ledger ordena por nome e as anteriores terminam em `20260902190000`). O SQL gerado deve conter `CREATE TYPE "EstadoDpa"`, `"BaseLegal"`, `"StatusParecer"`, sete `CREATE TABLE`, os índices únicos e as FKs. Se o comando recusar por drift do banco local, gerar com:

```bash
cd packages/database && npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --shadow-database-url "$SHADOW_DATABASE_URL" --script > prisma/migrations/20260906000000_empresa/migration.sql
```

(`SHADOW_DATABASE_URL` = URL do banco `cosmos_shadow` na porta 5434.)

- [ ] **Step 5: Anexar o bloco de RLS ao fim da migration**

```sql
-- RLS nas sete tabelas de Empresa, no mesmo ato da criação.
--
-- ADR-0012: declarar é correto, mas a policy fica INERTE enquanto a aplicação
-- conectar como superuser (BYPASSRLS implícito). O isolamento real hoje é o
-- filtro por tenant em toda query (SYSTEM_TENANT_ID no back-office).
--
-- ADR-0013: estas tabelas vivem no tenant de sistema e são lidas pelo
-- back-office sem app.tenant_id na sessão — o mesmo aviso que vale para
-- PlanoComercial e Engagement. Quando existir papel sem BYPASSRLS, o
-- back-office precisa de caminho próprio.
--
-- CacAlocacaoProduto não tem tenantId: herda o isolamento pelo CASCADE do
-- CacPeriodo, como ProposalItem herda de Proposal.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'FornecedorDpa',
    'DecisaoDeConsentimento',
    'PerguntaAoParecer',
    'LancamentoMensal',
    'CacPeriodo',
    'SemanaDeCaixa'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_isolation" ON %I USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())',
      t
    );
  END LOOP;
END $$;
```

- [ ] **Step 6: Aplicar no banco local e conferir que não sobra drift**

```bash
cd packages/database && npx prisma migrate deploy && npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code
```

Esperado: `1 migration found … applied` e o `diff` sai com código 0 ("No difference detected"). Se o `diff` recusar a flag `--from-config-datasource`, usar `--from-url "$DATABASE_URL"`.

- [ ] **Step 7: Typecheck do pacote e commit**

```bash
pnpm --filter @repo/database typecheck
/usr/bin/git add packages/database/prisma/schema/empresa.prisma packages/database/prisma/schema/tenant.prisma packages/database/prisma/migrations/20260906000000_empresa
/usr/bin/git commit -m "feat(database): modelos de Empresa — fornecedores DPA, consentimento, lançamentos, CAC e caixa

Sete tabelas no tenant system com RLS declarada na mesma migration. Célula de
entrada é Int? porque a tela distingue não preenchido de zero."
```

---

### Task 2: Mover `deriveVendorMaxClass` para `packages/provisioning`

**Files:**
- Create: `packages/provisioning/src/charter-rules.ts`
- Modify: `apps/app/lib/charter/rules.ts:350-425` (remover `CLAUSE_LABEL`, `VendorPosture`, `MaxClassDerivation`, `deriveVendorMaxClass`; reexportar)
- Modify: `packages/provisioning/src/index.ts`
- Test: `apps/app/__tests__/charter/rules.test.ts` (já existe; deve continuar verde)

**Interfaces:**
- Produces: `deriveVendorMaxClass(vendor: VendorPosture): MaxClassDerivation`, `CLAUSE_LABEL: Record<string, string>`, `VendorPosture = { tier: CharterVendorTier; dpa: boolean; clauseCodes: string[] }`, `MaxClassDerivation = { maxClass: CharterDataClass | null; reasoning: string[] }`, exportados de `@repo/provisioning`.

- [ ] **Step 1: Rodar o teste existente antes de mexer (linha de base)**

```bash
pnpm --filter app test -- __tests__/charter/rules.test.ts
```

Esperado: PASS.

- [ ] **Step 2: Criar `packages/provisioning/src/charter-rules.ts`**

Copiar de `apps/app/lib/charter/rules.ts` o bloco `CLAUSE_LABEL` (linhas 358–368), `VendorPosture`, `MaxClassDerivation` e o corpo inteiro de `deriveVendorMaxClass` (até o `return { maxClass: "RESTRICTED", reasoning }; }`), sem alterar uma linha do corpo, com este cabeçalho:

```ts
import type { CharterDataClass, CharterVendorTier } from "@repo/database";

// Derivação do teto contratual de um fornecedor (ADR-0003).
//
// Morava em apps/app/lib/charter/rules.ts. Saiu para cá porque o back-office
// também muda `dpa` (exportação da tela Fornecedores e DPA) e precisa
// recomputar `maxClass` na mesma escrita — e o back-office não importa de
// apps/app. `rules.ts` reexporta daqui: nada no app mudou de import.
//
// Sem `server-only`, sem I/O, sem Prisma: o intake do Charter recalcula isto
// no cliente a cada tecla.

export const CLAUSE_LABEL: Record<string, string> = {
  // ... copiar as 8 entradas
};

export type VendorPosture = { /* copiar */ };
export type MaxClassDerivation = { /* copiar */ };
export function deriveVendorMaxClass(vendor: VendorPosture): MaxClassDerivation {
  // copiar o corpo inteiro, sem alteração
}
```

- [ ] **Step 3: Substituir em `rules.ts` pelo reexport**

Remover as definições movidas de `apps/app/lib/charter/rules.ts` e, no lugar delas:

```ts
// Movidos para packages/provisioning/src/charter-rules.ts — ver o cabeçalho
// de lá. Reexportados para que intake, vendors.ts e os testes não mudem.
export {
  CLAUSE_LABEL,
  deriveVendorMaxClass,
  type MaxClassDerivation,
  type VendorPosture,
} from "@repo/provisioning/src/charter-rules";
```

Caminho profundo (`/src/charter-rules`) e não o índice: o índice de `@repo/provisioning` reexporta `platformDb`, que tem `import "server-only"`, e `rules.ts` é isomórfico — importá-lo no cliente derrubaria o intake. Se `apps/app/package.json` não depender de `@repo/provisioning`, adicionar `"@repo/provisioning": "workspace:*"` em `dependencies` e rodar `pnpm install`. Conferir que `CRITICAL_CLAUSE_CODES` (linhas 350–356) **fica** em `rules.ts` — só o que a derivação usa se move.

- [ ] **Step 4: Exportar pelo índice do provisioning**

Em `packages/provisioning/src/index.ts`, adicionar:

```ts
export {
  CLAUSE_LABEL,
  deriveVendorMaxClass,
  type MaxClassDerivation,
  type VendorPosture,
} from "./charter-rules";
```

- [ ] **Step 5: Verificar que nada quebrou**

```bash
pnpm --filter app test -- __tests__/charter/rules.test.ts
pnpm --filter app typecheck
pnpm --filter @repo/provisioning typecheck
/usr/bin/grep -rn 'from "@/lib/charter/rules"' apps/app --include='*.ts' --include='*.tsx' -l | head
```

Esperado: teste PASS, dois typechecks limpos. O `grep` mostra que os consumidores continuam importando de `rules.ts` — nenhum precisa mudar.

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add packages/provisioning/src/charter-rules.ts packages/provisioning/src/index.ts apps/app/lib/charter/rules.ts apps/app/package.json pnpm-lock.yaml
/usr/bin/git commit -m "refactor(charter): deriveVendorMaxClass sai de apps/app para @repo/provisioning

O back-office vai mudar dpa na exportação da tela de fornecedores e precisa
recomputar maxClass na mesma escrita. rules.ts reexporta: nada no app muda."
```

---

### Task 3: Plano de contas em código

**Files:**
- Create: `apps/backoffice/lib/empresa/plano-de-contas.ts`
- Test: `apps/backoffice/__tests__/empresa-plano-de-contas.test.ts`

**Interfaces:**
- Produces:
  - `type Grupo = 1 | 2 | 3 | 4 | 5 | 6`
  - `type CentroDeCusto = "comercial" | "produto-engenharia" | "entrega" | "ga"`
  - `type Conta = { conta: string; nome: string; grupo: Grupo; centroDeCusto: CentroDeCusto | null }`
  - `PLANO_DE_CONTAS: readonly Conta[]` (25 contas)
  - `CONTAS_DO_CAC = ["4.1","4.2","4.3","4.4","4.5","4.6"] as const`; `type ContaDoCac = (typeof CONTAS_DO_CAC)[number]`
  - `contaValida(codigo: string): boolean`
  - `contasDoGrupo(grupo: Grupo): string[]`
  - `type LinhaDre = { id: string; rotulo: string; contas: string[] }`; `LINHAS_RECEITA`, `LINHAS_CUSTO`, `LINHAS_DESPESA: readonly LinhaDre[]`

- [ ] **Step 1: Teste**

```ts
// empresa-plano-de-contas.test.ts — o plano de contas é constante, e as
// linhas agregadas do DRE precisam cobrir cada conta exatamente uma vez:
// conta fora de linha some do DRE; conta em duas linhas soma dobrado.
import { describe, expect, it } from "vitest";
import {
  CONTAS_DO_CAC,
  contaValida,
  contasDoGrupo,
  LINHAS_CUSTO,
  LINHAS_DESPESA,
  LINHAS_RECEITA,
  PLANO_DE_CONTAS,
} from "../lib/empresa/plano-de-contas";

describe("PLANO_DE_CONTAS", () => {
  it("tem as 25 contas de plano-de-contas.md, sem código repetido", () => {
    const codigos = PLANO_DE_CONTAS.map((c) => c.conta);
    expect(codigos).toHaveLength(25);
    expect(new Set(codigos).size).toBe(25);
  });

  it("valida código conhecido e recusa desconhecido", () => {
    expect(contaValida("1.1")).toBe(true);
    expect(contaValida("6.3")).toBe(true);
    expect(contaValida("7.1")).toBe(false);
    expect(contaValida("")).toBe(false);
  });

  it("as seis contas do CAC são todas do grupo 4 e do centro comercial", () => {
    expect(contasDoGrupo(4)).toEqual([...CONTAS_DO_CAC]);
    for (const c of CONTAS_DO_CAC) {
      const conta = PLANO_DE_CONTAS.find((p) => p.conta === c);
      expect(conta?.centroDeCusto).toBe("comercial");
    }
  });

  it("as linhas do DRE cobrem receita (1), custo (3) e despesa (4–6) sem sobra nem repetição", () => {
    const receita = LINHAS_RECEITA.flatMap((l) => l.contas).sort();
    const custo = LINHAS_CUSTO.flatMap((l) => l.contas).sort();
    const despesa = LINHAS_DESPESA.flatMap((l) => l.contas).sort();
    expect(receita).toEqual(contasDoGrupo(1).sort());
    expect(custo).toEqual(contasDoGrupo(3).sort());
    expect(despesa).toEqual(
      [...contasDoGrupo(4), ...contasDoGrupo(5), ...contasDoGrupo(6)].sort()
    );
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-plano-de-contas.test.ts
```

Esperado: FAIL, módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
/**
 * Plano de contas da Nebuloz — docs/financeiro/plano-de-contas.md, em código.
 *
 * Em constante e não em tabela: conta nova é uma linha aqui e um commit, e o
 * DRE precisa saber a que grupo cada conta pertence para somar. Uma tabela
 * obrigaria a semear e a validar contra o banco o que o documento já fixa.
 */

export type Grupo = 1 | 2 | 3 | 4 | 5 | 6;

export type CentroDeCusto =
  | "comercial"
  | "produto-engenharia"
  | "entrega"
  | "ga";

export type Conta = {
  conta: string;
  nome: string;
  grupo: Grupo;
  centroDeCusto: CentroDeCusto | null;
};

export const PLANO_DE_CONTAS: readonly Conta[] = [
  // 1 — Receita
  { conta: "1.1", nome: "Receita de assinatura — Meridian", grupo: 1, centroDeCusto: null },
  { conta: "1.2", nome: "Receita de assinatura — Charter", grupo: 1, centroDeCusto: null },
  { conta: "1.3", nome: "Receita de assinatura — Cosmos", grupo: 1, centroDeCusto: null },
  { conta: "1.4", nome: "Receita de assinatura — Signal", grupo: 1, centroDeCusto: null },
  { conta: "1.5", nome: "Receita de serviço — Meridian (diagnóstico)", grupo: 1, centroDeCusto: null },
  { conta: "1.6", nome: "Receita de serviço — Scaffold", grupo: 1, centroDeCusto: null },
  { conta: "1.7", nome: "Receita de serviço — Charter (setup)", grupo: 1, centroDeCusto: null },
  { conta: "1.8", nome: "Receita de outros serviços", grupo: 1, centroDeCusto: null },
  // 2 — Deduções
  { conta: "2.1", nome: "Impostos sobre serviço/receita", grupo: 2, centroDeCusto: null },
  { conta: "2.2", nome: "Cancelamentos e estornos", grupo: 2, centroDeCusto: null },
  // 3 — Custo de entrega
  { conta: "3.1", nome: "Pessoal de entrega — Meridian", grupo: 3, centroDeCusto: "entrega" },
  { conta: "3.2", nome: "Pessoal de entrega — Scaffold", grupo: 3, centroDeCusto: "entrega" },
  { conta: "3.3", nome: "Pessoal de entrega — Charter/outros", grupo: 3, centroDeCusto: "entrega" },
  { conta: "3.4", nome: "Terceiros e subcontratados de entrega", grupo: 3, centroDeCusto: "entrega" },
  { conta: "3.5", nome: "Ferramentas de entrega", grupo: 3, centroDeCusto: "entrega" },
  // 4 — Comercial (as contas que o CAC lê)
  { conta: "4.1", nome: "Pessoal de vendas", grupo: 4, centroDeCusto: "comercial" },
  { conta: "4.2", nome: "Pessoal de marketing", grupo: 4, centroDeCusto: "comercial" },
  { conta: "4.3", nome: "Comissões", grupo: 4, centroDeCusto: "comercial" },
  { conta: "4.4", nome: "Ferramentas de vendas e marketing", grupo: 4, centroDeCusto: "comercial" },
  { conta: "4.5", nome: "Mídia paga", grupo: 4, centroDeCusto: "comercial" },
  { conta: "4.6", nome: "Discovery não faturado", grupo: 4, centroDeCusto: "comercial" },
  // 5 — Produto/engenharia
  { conta: "5.1", nome: "Pessoal de engenharia e produto", grupo: 5, centroDeCusto: "produto-engenharia" },
  { conta: "5.2", nome: "Infraestrutura", grupo: 5, centroDeCusto: "produto-engenharia" },
  { conta: "5.3", nome: "Ferramentas de engenharia", grupo: 5, centroDeCusto: "produto-engenharia" },
  // 6 — G&A
  { conta: "6.1", nome: "Pessoal de liderança e administrativo", grupo: 6, centroDeCusto: "ga" },
  { conta: "6.2", nome: "Jurídico e contábil", grupo: 6, centroDeCusto: "ga" },
  { conta: "6.3", nome: "Escritório e outras despesas", grupo: 6, centroDeCusto: "ga" },
];

export const CONTAS_DO_CAC = ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] as const;
export type ContaDoCac = (typeof CONTAS_DO_CAC)[number];

const CODIGOS = new Set(PLANO_DE_CONTAS.map((c) => c.conta));

export function contaValida(codigo: string): boolean {
  return CODIGOS.has(codigo);
}

export function contasDoGrupo(grupo: Grupo): string[] {
  return PLANO_DE_CONTAS.filter((c) => c.grupo === grupo).map((c) => c.conta);
}

/** Linha agregada do DRE: um rótulo e as contas que soma (dre-modelo.md). */
export type LinhaDre = { id: string; rotulo: string; contas: string[] };

export const LINHAS_RECEITA: readonly LinhaDre[] = [
  { id: "assin-meridian", rotulo: "Receita de assinatura — Meridian", contas: ["1.1"] },
  { id: "assin-charter", rotulo: "Receita de assinatura — Charter", contas: ["1.2"] },
  { id: "assin-cosmos", rotulo: "Receita de assinatura — Cosmos", contas: ["1.3"] },
  { id: "assin-signal", rotulo: "Receita de assinatura — Signal", contas: ["1.4"] },
  { id: "serv-meridian", rotulo: "Receita de serviço — Meridian", contas: ["1.5"] },
  { id: "serv-scaffold", rotulo: "Receita de serviço — Scaffold", contas: ["1.6"] },
  { id: "serv-outros", rotulo: "Receita de serviço — Charter e outros", contas: ["1.7", "1.8"] },
];

export const LINHAS_CUSTO: readonly LinhaDre[] = [
  { id: "custo-meridian", rotulo: "Custo de entrega — Meridian", contas: ["3.1"] },
  { id: "custo-scaffold", rotulo: "Custo de entrega — Scaffold", contas: ["3.2"] },
  { id: "custo-outros", rotulo: "Custo de entrega — Charter e outros", contas: ["3.3", "3.4", "3.5"] },
];

export const LINHAS_DESPESA: readonly LinhaDre[] = [
  { id: "comercial", rotulo: "Comercial", contas: [...CONTAS_DO_CAC] },
  { id: "produto", rotulo: "Produto e engenharia", contas: ["5.1", "5.2", "5.3"] },
  { id: "ga", rotulo: "G&A", contas: ["6.1", "6.2", "6.3"] },
];
```

- [ ] **Step 4: Rodar — deve passar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-plano-de-contas.test.ts
```

Esperado: 4 passed. Se o Biome reclamar do comprimento de linha das entradas, rodar `pnpm fix` e aceitar a quebra.

- [ ] **Step 5: Commit**

```bash
/usr/bin/git add apps/backoffice/lib/empresa/plano-de-contas.ts apps/backoffice/__tests__/empresa-plano-de-contas.test.ts
/usr/bin/git commit -m "feat(backoffice): plano de contas em código com as linhas agregadas do DRE"
```

---

### Task 4: Transições de estado do DPA

**Files:**
- Create: `apps/backoffice/lib/empresa/fornecedores.ts`
- Test: `apps/backoffice/__tests__/empresa-fornecedores.test.ts`

**Interfaces:**
- Produces:
  - `type EstadoDpa = "EMBUTIDO" | "A_ASSINAR" | "ASSINADO" | "SEM_DOCUMENTO"` (espelha o enum Prisma; string literal para o lib não importar Prisma)
  - `type AcaoDpa = "MARCAR_ACEITO" | "REGISTRAR_PEDIDO"`
  - `type PosturaDpa = { estado: EstadoDpa; evidenciaUrl: string | null }`
  - `type PatchDpa = { estado: EstadoDpa; evidenciaUrl?: string; assinadoEm?: Date; pedidoEm?: Date }`
  - `aplicarAcao(atual: PosturaDpa, acao: AcaoDpa, agora: Date, evidenciaUrl?: string): { ok: true; patch: PatchDpa } | { ok: false; erro: string }`
  - `acoesDisponiveis(estado: EstadoDpa): AcaoDpa[]`
  - `type Contadores = { embutidos: number; aAssinar: number; semDocumento: number; bloqueiamVenda: number }`
  - `contadores(lista: { estado: EstadoDpa; bloqueiaVenda: boolean }[]): Contadores`

- [ ] **Step 1: Teste**

```ts
// empresa-fornecedores.test.ts — spec §3.1: só as transições que a tela
// oferece existem, e ASSINADO sem evidência é afirmação, não prova.
import { describe, expect, it } from "vitest";
import {
  acoesDisponiveis,
  aplicarAcao,
  contadores,
} from "../lib/empresa/fornecedores";

const AGORA = new Date("2026-09-06T12:00:00Z");

describe("aplicarAcao", () => {
  it("A_ASSINAR + MARCAR_ACEITO com evidência vira ASSINADO e carimba assinadoEm", () => {
    const r = aplicarAcao(
      { estado: "A_ASSINAR", evidenciaUrl: null },
      "MARCAR_ACEITO",
      AGORA,
      "https://exemplo/dpa-assinado.pdf"
    );
    expect(r).toEqual({
      ok: true,
      patch: {
        estado: "ASSINADO",
        evidenciaUrl: "https://exemplo/dpa-assinado.pdf",
        assinadoEm: AGORA,
      },
    });
  });

  it("MARCAR_ACEITO sem evidência é recusado", () => {
    const r = aplicarAcao(
      { estado: "A_ASSINAR", evidenciaUrl: null },
      "MARCAR_ACEITO",
      AGORA
    );
    expect(r.ok).toBe(false);
  });

  it("SEM_DOCUMENTO + REGISTRAR_PEDIDO mantém o estado e carimba pedidoEm", () => {
    const r = aplicarAcao(
      { estado: "SEM_DOCUMENTO", evidenciaUrl: null },
      "REGISTRAR_PEDIDO",
      AGORA
    );
    expect(r).toEqual({
      ok: true,
      patch: { estado: "SEM_DOCUMENTO", pedidoEm: AGORA },
    });
  });

  it("SEM_DOCUMENTO + MARCAR_ACEITO com evidência vira ASSINADO (o DPA chegou)", () => {
    const r = aplicarAcao(
      { estado: "SEM_DOCUMENTO", evidenciaUrl: null },
      "MARCAR_ACEITO",
      AGORA,
      "https://exemplo/dpa.pdf"
    );
    expect(r.ok && r.patch.estado).toBe("ASSINADO");
  });

  it("EMBUTIDO não transita — nada a assinar", () => {
    expect(acoesDisponiveis("EMBUTIDO")).toEqual([]);
    const r = aplicarAcao(
      { estado: "EMBUTIDO", evidenciaUrl: null },
      "MARCAR_ACEITO",
      AGORA,
      "https://x"
    );
    expect(r.ok).toBe(false);
  });

  it("ASSINADO é terminal", () => {
    expect(acoesDisponiveis("ASSINADO")).toEqual([]);
  });

  it("A_ASSINAR não registra pedido — o documento já existe", () => {
    expect(acoesDisponiveis("A_ASSINAR")).toEqual(["MARCAR_ACEITO"]);
    const r = aplicarAcao(
      { estado: "A_ASSINAR", evidenciaUrl: null },
      "REGISTRAR_PEDIDO",
      AGORA
    );
    expect(r.ok).toBe(false);
  });
});

describe("contadores", () => {
  it("conta por estado e só conta bloqueio enquanto não assinado", () => {
    const c = contadores([
      { estado: "EMBUTIDO", bloqueiaVenda: false },
      { estado: "A_ASSINAR", bloqueiaVenda: true },
      { estado: "SEM_DOCUMENTO", bloqueiaVenda: true },
      { estado: "ASSINADO", bloqueiaVenda: true },
    ]);
    expect(c).toEqual({
      embutidos: 1,
      aAssinar: 1,
      semDocumento: 1,
      bloqueiamVenda: 2,
    });
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-fornecedores.test.ts
```

- [ ] **Step 3: Implementar**

```ts
/**
 * Transições do estado do DPA (spec §3.1).
 *
 * Só existem as que a tela oferece. `ASSINADO` exige evidência: sem ela o
 * estado seria afirmação, e o documento de 5 set existe justamente para
 * separar afirmação de prova.
 */

export type EstadoDpa = "EMBUTIDO" | "A_ASSINAR" | "ASSINADO" | "SEM_DOCUMENTO";
export type AcaoDpa = "MARCAR_ACEITO" | "REGISTRAR_PEDIDO";

export type PosturaDpa = { estado: EstadoDpa; evidenciaUrl: string | null };

export type PatchDpa = {
  estado: EstadoDpa;
  evidenciaUrl?: string;
  assinadoEm?: Date;
  pedidoEm?: Date;
};

const ACOES: Record<EstadoDpa, AcaoDpa[]> = {
  EMBUTIDO: [],
  A_ASSINAR: ["MARCAR_ACEITO"],
  SEM_DOCUMENTO: ["REGISTRAR_PEDIDO", "MARCAR_ACEITO"],
  ASSINADO: [],
};

export function acoesDisponiveis(estado: EstadoDpa): AcaoDpa[] {
  return ACOES[estado];
}

export function aplicarAcao(
  atual: PosturaDpa,
  acao: AcaoDpa,
  agora: Date,
  evidenciaUrl?: string
): { ok: true; patch: PatchDpa } | { ok: false; erro: string } {
  if (!ACOES[atual.estado].includes(acao)) {
    return {
      ok: false,
      erro: `Fornecedor em ${atual.estado} não aceita ${acao}.`,
    };
  }
  if (acao === "REGISTRAR_PEDIDO") {
    return { ok: true, patch: { estado: atual.estado, pedidoEm: agora } };
  }
  const evidencia = evidenciaUrl?.trim();
  if (!evidencia) {
    return {
      ok: false,
      erro: "Marcar como assinado exige o link da via assinada ou do aceite.",
    };
  }
  return {
    ok: true,
    patch: { estado: "ASSINADO", evidenciaUrl: evidencia, assinadoEm: agora },
  };
}

export type Contadores = {
  embutidos: number;
  aAssinar: number;
  semDocumento: number;
  bloqueiamVenda: number;
};

export function contadores(
  lista: { estado: EstadoDpa; bloqueiaVenda: boolean }[]
): Contadores {
  const c: Contadores = { embutidos: 0, aAssinar: 0, semDocumento: 0, bloqueiamVenda: 0 };
  for (const f of lista) {
    if (f.estado === "EMBUTIDO") c.embutidos += 1;
    if (f.estado === "A_ASSINAR") c.aAssinar += 1;
    if (f.estado === "SEM_DOCUMENTO") c.semDocumento += 1;
    if (f.bloqueiaVenda && f.estado !== "ASSINADO") c.bloqueiamVenda += 1;
  }
  return c;
}
```

- [ ] **Step 4: Rodar — deve passar; commit**

```bash
pnpm --filter backoffice test -- __tests__/empresa-fornecedores.test.ts
/usr/bin/git add apps/backoffice/lib/empresa/fornecedores.ts apps/backoffice/__tests__/empresa-fornecedores.test.ts
/usr/bin/git commit -m "feat(backoffice): transições de estado do DPA — assinado exige evidência"
```

---

### Task 5: Cálculo do CAC

**Files:**
- Create: `apps/backoffice/lib/empresa/cac.ts`
- Test: `apps/backoffice/__tests__/empresa-cac.test.ts`

**Interfaces:**
- Consumes: `CONTAS_DO_CAC`, `ContaDoCac` (Task 3).
- Produces:
  - `type ParcelasCac = Record<ContaDoCac, number | null> & { entregaDiagnosticoCentavos: number | null; clientesGanhos: number | null }`
  - `type AlocacaoCac = { produto: string; pesoPercent: number }`
  - `type ResultadoCac = { preenchidas: number; total: 8; cacCentavos: number | null; porProduto: { produto: string; pesoPercent: number; cacCentavos: number | null }[]; paybackMeses: number | null }`
  - `calcularCac(p: ParcelasCac, alocacoes: AlocacaoCac[], mensalidadeReferenciaCentavos: number | null): ResultadoCac`
  - `pesosSomam100(alocacoes: AlocacaoCac[]): boolean`
  - `PARCELAS_TOTAL = 8`

- [ ] **Step 1: Teste**

```ts
// empresa-cac.test.ts — "sem número, sem chute": com 7 de 8 o CAC é nulo.
import { describe, expect, it } from "vitest";
import {
  calcularCac,
  type ParcelasCac,
  pesosSomam100,
} from "../lib/empresa/cac";

// O exemplo de cac-modelo.md §3, marcado lá como hipótese: 40.500 ÷ 2.
const CHEIO: ParcelasCac = {
  "4.1": 1_500_000,
  "4.2": 1_000_000,
  "4.3": 0,
  "4.4": 150_000,
  "4.5": 200_000,
  "4.6": 600_000,
  entregaDiagnosticoCentavos: 600_000,
  clientesGanhos: 2,
};

describe("calcularCac", () => {
  it("com todas as parcelas, divide o total pelos clientes ganhos", () => {
    const r = calcularCac(CHEIO, [], null);
    expect(r.preenchidas).toBe(8);
    expect(r.cacCentavos).toBe(2_025_000);
  });

  it("zero é preenchido; nulo não", () => {
    const r = calcularCac({ ...CHEIO, "4.5": null }, [], null);
    expect(r.preenchidas).toBe(7);
    expect(r.cacCentavos).toBeNull();
    expect(r.paybackMeses).toBeNull();
  });

  it("zero clientes ganhos não divide", () => {
    const r = calcularCac({ ...CHEIO, clientesGanhos: 0 }, [], null);
    expect(r.preenchidas).toBe(8);
    expect(r.cacCentavos).toBeNull();
  });

  it("rateia por produto pelo peso", () => {
    const r = calcularCac(
      CHEIO,
      [
        { produto: "MERIDIAN", pesoPercent: 41 },
        { produto: "CHARTER", pesoPercent: 59 },
      ],
      null
    );
    expect(r.porProduto).toEqual([
      { produto: "MERIDIAN", pesoPercent: 41, cacCentavos: 830_250 },
      { produto: "CHARTER", pesoPercent: 59, cacCentavos: 1_194_750 },
    ]);
  });

  it("payback = CAC ÷ mensalidade de referência, com uma casa", () => {
    // 3.278 é a mensalidade líquida do Scale anual pela fórmula testada em
    // precificar.test.ts — aqui entra como parâmetro, não como constante.
    const r = calcularCac(CHEIO, [], 327_800);
    expect(r.paybackMeses).toBe(6.2);
  });

  it("sem mensalidade de referência, sem payback", () => {
    expect(calcularCac(CHEIO, [], null).paybackMeses).toBeNull();
  });
});

describe("pesosSomam100", () => {
  it("aceita 100, recusa o resto e a lista vazia", () => {
    expect(pesosSomam100([{ produto: "A", pesoPercent: 60 }, { produto: "B", pesoPercent: 40 }])).toBe(true);
    expect(pesosSomam100([{ produto: "A", pesoPercent: 60 }])).toBe(false);
    expect(pesosSomam100([])).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-cac.test.ts
```

- [ ] **Step 3: Implementar**

```ts
/**
 * CAC totalmente carregado (cac-modelo.md §1), como função pura.
 *
 * O resultado só existe com as oito parcelas preenchidas — a tela diz "sem
 * número, sem chute", e a função é onde isso vale. Nulo é "não preenchido";
 * zero é zero.
 */
import { CONTAS_DO_CAC, type ContaDoCac } from "./plano-de-contas";

export type ParcelasCac = Record<ContaDoCac, number | null> & {
  entregaDiagnosticoCentavos: number | null;
  clientesGanhos: number | null;
};

export type AlocacaoCac = { produto: string; pesoPercent: number };

export type ResultadoCac = {
  preenchidas: number;
  total: 8;
  cacCentavos: number | null;
  porProduto: { produto: string; pesoPercent: number; cacCentavos: number | null }[];
  paybackMeses: number | null;
};

export const PARCELAS_TOTAL = 8;

export function calcularCac(
  p: ParcelasCac,
  alocacoes: AlocacaoCac[],
  mensalidadeReferenciaCentavos: number | null
): ResultadoCac {
  const contas = CONTAS_DO_CAC.map((c) => p[c]);
  const valores = [...contas, p.entregaDiagnosticoCentavos, p.clientesGanhos];
  const preenchidas = valores.filter((v) => v !== null).length;

  let cacCentavos: number | null = null;
  if (preenchidas === PARCELAS_TOTAL && (p.clientesGanhos ?? 0) > 0) {
    const numerador =
      contas.reduce<number>((a, b) => a + (b ?? 0), 0) +
      (p.entregaDiagnosticoCentavos ?? 0);
    cacCentavos = Math.round(numerador / (p.clientesGanhos as number));
  }

  const porProduto = alocacoes.map((a) => ({
    produto: a.produto,
    pesoPercent: a.pesoPercent,
    cacCentavos:
      cacCentavos === null ? null : Math.round((cacCentavos * a.pesoPercent) / 100),
  }));

  const paybackMeses =
    cacCentavos === null ||
    mensalidadeReferenciaCentavos === null ||
    mensalidadeReferenciaCentavos <= 0
      ? null
      : Math.round((cacCentavos / mensalidadeReferenciaCentavos) * 10) / 10;

  return { preenchidas, total: 8, cacCentavos, porProduto, paybackMeses };
}

export function pesosSomam100(alocacoes: AlocacaoCac[]): boolean {
  return (
    alocacoes.length > 0 &&
    alocacoes.reduce((a, b) => a + b.pesoPercent, 0) === 100
  );
}
```

- [ ] **Step 4: Rodar — deve passar; commit**

```bash
pnpm --filter backoffice test -- __tests__/empresa-cac.test.ts
/usr/bin/git add apps/backoffice/lib/empresa/cac.ts apps/backoffice/__tests__/empresa-cac.test.ts
/usr/bin/git commit -m "feat(backoffice): cálculo do CAC — só com as oito parcelas preenchidas"
```

---

### Task 6: Cálculo do DRE e do caixa

**Files:**
- Create: `apps/backoffice/lib/empresa/financeiro.ts`
- Test: `apps/backoffice/__tests__/empresa-financeiro.test.ts`

**Interfaces:**
- Consumes: `LINHAS_RECEITA`, `LINHAS_CUSTO`, `LINHAS_DESPESA`, `contasDoGrupo` (Task 3).
- Produces:
  - `type LancamentosDoMes = Record<string, number>` (conta → centavos; só as lançadas)
  - `type LinhaCalculada = { id: string; rotulo: string; valorCentavos: number | null; calculada: boolean; percent?: number | null }`
  - `calcularDre(l: LancamentosDoMes): LinhaCalculada[]` — 20 linhas na ordem da tela
  - `somarMeses(meses: LinhaCalculada[][]): LinhaCalculada[]` — trimestre
  - `competenciasAte(final: string, n: number): string[]` — `("2026-09", 3)` → `["2026-07","2026-08","2026-09"]`
  - `competenciaValida(s: string): boolean` — `/^\d{4}-(0[1-9]|1[0-2])$/`
  - `type SemanaEntrada = { semanaInicio: string; saldoInicialCentavos: number | null; recebiveisCentavos: number | null; contratosAssinadosCentavos: number | null; pipelinePonderadoCentavos: number | null; saidasPessoalCentavos: number | null; saidasFornecedoresCentavos: number | null; saidasComercialCentavos: number | null; saidasImpostosCentavos: number | null; saidasOutrasCentavos: number | null }`
  - `type SemanaCalculada = SemanaEntrada & { saldoInicialEfetivoCentavos: number | null; totalEntradasCentavos: number | null; totalSaidasCentavos: number | null; saldoFinalCentavos: number | null }`
  - `calcularCaixa(semanas: SemanaEntrada[]): SemanaCalculada[]` (entrada já ordenada, 13 itens)
  - `segundaFeira(d: Date): string` — ISO `YYYY-MM-DD` da segunda-feira (UTC) da semana de `d`
  - `janelaDe13(hoje: Date): string[]` — 13 segundas a partir de `segundaFeira(hoje)`
  - `semanaVazia(semanaInicio: string): SemanaEntrada`
  - `referenciaPipeline(totalPropostasCentavos: number, convPercent: number | null): number | null`

- [ ] **Step 1: Teste**

```ts
// empresa-financeiro.test.ts — as linhas calculadas fecham sozinhas, e uma
// linha agregada só existe quando todas as contas dela existem no mês.
import { describe, expect, it } from "vitest";
import {
  calcularCaixa,
  calcularDre,
  competenciasAte,
  competenciaValida,
  janelaDe13,
  referenciaPipeline,
  segundaFeira,
  semanaVazia,
  somarMeses,
} from "../lib/empresa/financeiro";

function linha(dre: ReturnType<typeof calcularDre>, id: string) {
  const l = dre.find((x) => x.id === id);
  if (!l) throw new Error(`linha ${id} ausente`);
  return l;
}

const MES_CHEIO: Record<string, number> = {
  "1.1": 100, "1.2": 200, "1.3": 300, "1.4": 0, "1.5": 400, "1.6": 500, "1.7": 50, "1.8": 50,
  "2.1": 100, "2.2": 0,
  "3.1": 100, "3.2": 100, "3.3": 50, "3.4": 0, "3.5": 50,
  "4.1": 100, "4.2": 100, "4.3": 0, "4.4": 10, "4.5": 10, "4.6": 30,
  "5.1": 200, "5.2": 50, "5.3": 50,
  "6.1": 100, "6.2": 20, "6.3": 30,
};

describe("calcularDre", () => {
  it("fecha receita bruta, líquida, margem e EBITDA", () => {
    const dre = calcularDre(MES_CHEIO);
    expect(linha(dre, "receita-bruta").valorCentavos).toBe(1600);
    expect(linha(dre, "deducoes").valorCentavos).toBe(100);
    expect(linha(dre, "receita-liquida").valorCentavos).toBe(1500);
    expect(linha(dre, "custo-total").valorCentavos).toBe(300);
    expect(linha(dre, "margem-bruta").valorCentavos).toBe(1200);
    expect(linha(dre, "margem-bruta-pct").percent).toBe(80);
    expect(linha(dre, "comercial").valorCentavos).toBe(250);
    expect(linha(dre, "despesas-total").valorCentavos).toBe(800);
    expect(linha(dre, "ebitda").valorCentavos).toBe(400);
    expect(linha(dre, "ebitda-pct").percent).toBe(27);
  });

  it("linha agregada com conta faltando fica nula, e puxa os totais junto", () => {
    const { "1.8": _omitida, ...semUmaConta } = MES_CHEIO;
    const dre = calcularDre(semUmaConta);
    expect(linha(dre, "serv-outros").valorCentavos).toBeNull();
    expect(linha(dre, "receita-bruta").valorCentavos).toBeNull();
    expect(linha(dre, "ebitda").valorCentavos).toBeNull();
    // As linhas que não dependem dela seguem calculadas.
    expect(linha(dre, "custo-total").valorCentavos).toBe(300);
  });

  it("mês vazio é tudo nulo, sem lançar", () => {
    const dre = calcularDre({});
    expect(dre.every((l) => l.valorCentavos === null)).toBe(true);
  });

  it("percentual é nulo quando a receita líquida é zero", () => {
    const zero = Object.fromEntries(Object.keys(MES_CHEIO).map((k) => [k, 0]));
    const dre = calcularDre(zero);
    expect(linha(dre, "ebitda-pct").percent).toBeNull();
  });
});

describe("somarMeses", () => {
  it("soma linha a linha e propaga nulo", () => {
    const a = calcularDre(MES_CHEIO);
    const b = calcularDre({});
    const tri = somarMeses([a, a, a]);
    expect(linha(tri, "ebitda").valorCentavos).toBe(1200);
    expect(linha(somarMeses([a, b]), "ebitda").valorCentavos).toBeNull();
  });
});

describe("competências", () => {
  it("lista as n competências até a final", () => {
    expect(competenciasAte("2026-09", 3)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(competenciasAte("2026-01", 2)).toEqual(["2025-12", "2026-01"]);
  });
  it("valida o formato", () => {
    expect(competenciaValida("2026-09")).toBe(true);
    expect(competenciaValida("2026-13")).toBe(false);
    expect(competenciaValida("2026-9")).toBe(false);
  });
});

describe("caixa", () => {
  it("segunda-feira da semana, em UTC", () => {
    expect(segundaFeira(new Date("2026-09-05T10:00:00Z"))).toBe("2026-08-31"); // sábado
    expect(segundaFeira(new Date("2026-09-06T10:00:00Z"))).toBe("2026-08-31"); // domingo
    expect(segundaFeira(new Date("2026-09-07T10:00:00Z"))).toBe("2026-09-07"); // segunda
  });

  it("janela de 13 começa na segunda corrente", () => {
    const j = janelaDe13(new Date("2026-09-05T10:00:00Z"));
    expect(j).toHaveLength(13);
    expect(j[0]).toBe("2026-08-31");
    expect(j[12]).toBe("2026-11-23");
  });

  it("encadeia o saldo e respeita o saldo de extrato da semana 1", () => {
    const s1 = {
      ...semanaVazia("2026-08-31"),
      saldoInicialCentavos: 1000,
      recebiveisCentavos: 500, contratosAssinadosCentavos: 0, pipelinePonderadoCentavos: 0,
      saidasPessoalCentavos: 300, saidasFornecedoresCentavos: 0, saidasComercialCentavos: 0,
      saidasImpostosCentavos: 0, saidasOutrasCentavos: 0,
    };
    const s2 = { ...s1, semanaInicio: "2026-09-07", saldoInicialCentavos: null, recebiveisCentavos: 100 };
    const [c1, c2] = calcularCaixa([s1, s2]);
    expect(c1.saldoFinalCentavos).toBe(1200);
    expect(c2.saldoInicialEfetivoCentavos).toBe(1200);
    expect(c2.saldoFinalCentavos).toBe(1000);
  });

  it("semana 1 sem saldo de extrato deixa tudo pendente", () => {
    const [c1] = calcularCaixa([semanaVazia("2026-08-31")]);
    expect(c1.saldoInicialEfetivoCentavos).toBeNull();
    expect(c1.saldoFinalCentavos).toBeNull();
  });

  it("uma parcela nula anula o total daquela semana e das seguintes", () => {
    const s1 = { ...semanaVazia("2026-08-31"), saldoInicialCentavos: 0 };
    const [c1, c2] = calcularCaixa([s1, semanaVazia("2026-09-07")]);
    expect(c1.totalEntradasCentavos).toBeNull();
    expect(c2.saldoInicialEfetivoCentavos).toBeNull();
  });

  it("referência do pipeline pondera pela conversão", () => {
    expect(referenciaPipeline(100_000, 25)).toBe(25_000);
    expect(referenciaPipeline(100_000, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-financeiro.test.ts
```

- [ ] **Step 3: Implementar**

```ts
/**
 * DRE por competência e caixa de 13 semanas (dre-modelo.md,
 * caixa-13-semanas.md), como funções puras.
 *
 * A regra que vale em todas: nulo é "não preenchido" e contamina o que
 * depende dele. Um total que some "o que tem" mentiria com cara de número.
 */
import {
  contasDoGrupo,
  LINHAS_CUSTO,
  LINHAS_DESPESA,
  LINHAS_RECEITA,
  type LinhaDre,
} from "./plano-de-contas";

export type LancamentosDoMes = Record<string, number>;

export type LinhaCalculada = {
  id: string;
  rotulo: string;
  valorCentavos: number | null;
  calculada: boolean;
  /** Só nas linhas de percentual. */
  percent?: number | null;
};

function somaContas(l: LancamentosDoMes, contas: string[]): number | null {
  let total = 0;
  for (const c of contas) {
    const v = l[c];
    if (v === undefined) return null;
    total += v;
  }
  return total;
}

function soma(valores: (number | null)[]): number | null {
  let total = 0;
  for (const v of valores) {
    if (v === null) return null;
    total += v;
  }
  return total;
}

function sub(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a - b;
}

function pct(parte: number | null, todo: number | null): number | null {
  if (parte === null || todo === null || todo === 0) return null;
  return Math.round((parte / todo) * 100);
}

function agregadas(l: LancamentosDoMes, linhas: readonly LinhaDre[]): LinhaCalculada[] {
  return linhas.map((x) => ({
    id: x.id,
    rotulo: x.rotulo,
    valorCentavos: somaContas(l, x.contas),
    calculada: false,
  }));
}

/** As 20 linhas do DRE da tela, na ordem. */
export function calcularDre(l: LancamentosDoMes): LinhaCalculada[] {
  const receita = agregadas(l, LINHAS_RECEITA);
  const receitaBruta = soma(receita.map((x) => x.valorCentavos));
  const deducoes = somaContas(l, contasDoGrupo(2));
  const receitaLiquida = sub(receitaBruta, deducoes);

  const custo = agregadas(l, LINHAS_CUSTO);
  const custoTotal = soma(custo.map((x) => x.valorCentavos));
  const margemBruta = sub(receitaLiquida, custoTotal);

  const despesa = agregadas(l, LINHAS_DESPESA);
  const despesasTotal = soma(despesa.map((x) => x.valorCentavos));
  const ebitda = sub(margemBruta, despesasTotal);

  const calc = (id: string, rotulo: string, valorCentavos: number | null): LinhaCalculada =>
    ({ id, rotulo, valorCentavos, calculada: true });
  const pctLinha = (id: string, rotulo: string, p: number | null): LinhaCalculada =>
    ({ id, rotulo, valorCentavos: null, calculada: true, percent: p });

  return [
    ...receita,
    calc("receita-bruta", "Receita bruta total", receitaBruta),
    calc("deducoes", "Deduções", deducoes),
    calc("receita-liquida", "Receita líquida", receitaLiquida),
    ...custo,
    calc("custo-total", "Custo de entrega total", custoTotal),
    calc("margem-bruta", "Margem bruta", margemBruta),
    pctLinha("margem-bruta-pct", "Margem bruta %", pct(margemBruta, receitaLiquida)),
    ...despesa,
    calc("despesas-total", "Despesas totais", despesasTotal),
    calc("ebitda", "EBITDA", ebitda),
    pctLinha("ebitda-pct", "EBITDA %", pct(ebitda, receitaLiquida)),
  ];
}

/** Trimestre: soma linha a linha; percentuais recalculados sobre as somas. */
export function somarMeses(meses: LinhaCalculada[][]): LinhaCalculada[] {
  const [primeiro] = meses;
  if (!primeiro) return [];
  const somado = primeiro.map((linha, i) => ({
    ...linha,
    valorCentavos: soma(meses.map((m) => m[i]?.valorCentavos ?? null)),
    percent: linha.percent === undefined ? undefined : null,
  }));
  const valor = (id: string) => somado.find((x) => x.id === id)?.valorCentavos ?? null;
  for (const l of somado) {
    if (l.id === "margem-bruta-pct") l.percent = pct(valor("margem-bruta"), valor("receita-liquida"));
    if (l.id === "ebitda-pct") l.percent = pct(valor("ebitda"), valor("receita-liquida"));
  }
  return somado;
}

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

export function competenciaValida(s: string): boolean {
  return COMPETENCIA.test(s);
}

export function competenciasAte(final: string, n: number): string[] {
  const [ano, mes] = final.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// ── Caixa ──────────────────────────────────────────────────────────────────

export type SemanaEntrada = {
  semanaInicio: string;
  saldoInicialCentavos: number | null;
  recebiveisCentavos: number | null;
  contratosAssinadosCentavos: number | null;
  pipelinePonderadoCentavos: number | null;
  saidasPessoalCentavos: number | null;
  saidasFornecedoresCentavos: number | null;
  saidasComercialCentavos: number | null;
  saidasImpostosCentavos: number | null;
  saidasOutrasCentavos: number | null;
};

export type SemanaCalculada = SemanaEntrada & {
  saldoInicialEfetivoCentavos: number | null;
  totalEntradasCentavos: number | null;
  totalSaidasCentavos: number | null;
  saldoFinalCentavos: number | null;
};

export function semanaVazia(semanaInicio: string): SemanaEntrada {
  return {
    semanaInicio,
    saldoInicialCentavos: null,
    recebiveisCentavos: null,
    contratosAssinadosCentavos: null,
    pipelinePonderadoCentavos: null,
    saidasPessoalCentavos: null,
    saidasFornecedoresCentavos: null,
    saidasComercialCentavos: null,
    saidasImpostosCentavos: null,
    saidasOutrasCentavos: null,
  };
}

const DIA_MS = 86_400_000;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function segundaFeira(d: Date): string {
  const dia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const recuo = (dia.getUTCDay() + 6) % 7; // segunda = 0
  return iso(new Date(dia.getTime() - recuo * DIA_MS));
}

export function janelaDe13(hoje: Date): string[] {
  const inicio = new Date(`${segundaFeira(hoje)}T00:00:00Z`);
  return Array.from({ length: 13 }, (_, i) => iso(new Date(inicio.getTime() + i * 7 * DIA_MS)));
}

/** `semanas` já ordenadas por `semanaInicio`. O saldo inicial de cada semana
 *  é o de extrato quando lançado; senão, o final calculado da anterior. */
export function calcularCaixa(semanas: SemanaEntrada[]): SemanaCalculada[] {
  let anterior: number | null = null;
  return semanas.map((s) => {
    const saldoInicialEfetivoCentavos = s.saldoInicialCentavos ?? anterior;
    const totalEntradasCentavos = soma([s.recebiveisCentavos, s.contratosAssinadosCentavos, s.pipelinePonderadoCentavos]);
    const totalSaidasCentavos = soma([
      s.saidasPessoalCentavos, s.saidasFornecedoresCentavos, s.saidasComercialCentavos,
      s.saidasImpostosCentavos, s.saidasOutrasCentavos,
    ]);
    const saldoFinalCentavos =
      saldoInicialEfetivoCentavos === null || totalEntradasCentavos === null || totalSaidasCentavos === null
        ? null
        : saldoInicialEfetivoCentavos + totalEntradasCentavos - totalSaidasCentavos;
    anterior = saldoFinalCentavos;
    return { ...s, saldoInicialEfetivoCentavos, totalEntradasCentavos, totalSaidasCentavos, saldoFinalCentavos };
  });
}

export function referenciaPipeline(totalPropostasCentavos: number, convPercent: number | null): number | null {
  return convPercent === null ? null : Math.round((totalPropostasCentavos * convPercent) / 100);
}
```

- [ ] **Step 4: Rodar — deve passar; `pnpm fix` se o Biome pedir quebra de linha; commit**

```bash
pnpm --filter backoffice test -- __tests__/empresa-financeiro.test.ts
/usr/bin/git add apps/backoffice/lib/empresa/financeiro.ts apps/backoffice/__tests__/empresa-financeiro.test.ts
/usr/bin/git commit -m "feat(backoffice): DRE por competência e caixa de 13 semanas como funções puras"
```

---

### Task 7: Textos do aviso e `renderAviso`

**Files:**
- Create: `apps/backoffice/lib/empresa/aviso.ts`
- Test: `apps/backoffice/__tests__/empresa-aviso.test.ts`

**Interfaces:**
- Produces:
  - `type PecaDoAviso = "INTERNA_PT" | "EXTERNA_PT" | "EXTERNA_EN" | "CLAUSULA_PT"`
  - `AVISOS: Record<PecaDoAviso, { titulo: string; nota: string; texto: string }>`
  - `type Marcadores = { ferramenta: string | null; prazoRetencao: string | null; contatoTitular: string | null }`
  - `renderAviso(peca: PecaDoAviso, m: Marcadores): { texto: string; abertos: string[] }`
  - `camposEmAberto(m: Marcadores): string[]` — subconjunto de `["[ferramenta]","[prazo]","[contato]"]`

- [ ] **Step 1: Teste**

```ts
// empresa-aviso.test.ts — marcador sem valor fica visível; nunca se lê vazio.
import { describe, expect, it } from "vitest";
import { AVISOS, camposEmAberto, renderAviso } from "../lib/empresa/aviso";

const VAZIO = { ferramenta: null, prazoRetencao: null, contatoTitular: null };

describe("renderAviso", () => {
  it("substitui os três marcadores quando há valor", () => {
    const r = renderAviso("EXTERNA_PT", {
      ferramenta: "Fireflies",
      prazoRetencao: "12 meses",
      contatoTitular: "privacidade@nebuloz.ai",
    });
    expect(r.texto).toContain("pelo Fireflies");
    expect(r.texto).toContain("por 12 meses");
    expect(r.texto).toContain("para privacidade@nebuloz.ai");
    expect(r.texto).not.toContain("[ferramenta]");
    expect(r.abertos).toEqual([]);
  });

  it("marcador nulo permanece entre colchetes e é listado", () => {
    const r = renderAviso("EXTERNA_PT", { ...VAZIO, ferramenta: "Fireflies" });
    expect(r.texto).toContain("[prazo]");
    expect(r.texto).toContain("[contato]");
    expect(r.abertos).toEqual(["[prazo]", "[contato]"]);
  });

  it("[organização] nunca é substituído — muda por tenant", () => {
    const r = renderAviso("EXTERNA_EN", {
      ferramenta: "Fireflies", prazoRetencao: "12 months", contatoTitular: "x@y",
    });
    expect(r.texto).toContain("[organização]");
  });

  it("o aviso interno não tem [contato] e por isso não o lista", () => {
    const r = renderAviso("INTERNA_PT", VAZIO);
    expect(r.abertos).toEqual(["[ferramenta]", "[prazo]"]);
  });

  it("a cláusula termina com a frase que impede autorização genérica", () => {
    expect(AVISOS.CLAUSULA_PT.texto.trim().endsWith("diversa da aqui descrita.")).toBe(true);
  });
});

describe("camposEmAberto", () => {
  it("conta os nulos e o vazio", () => {
    expect(camposEmAberto(VAZIO)).toEqual(["[ferramenta]", "[prazo]", "[contato]"]);
    expect(camposEmAberto({ ...VAZIO, ferramenta: "  " })).toHaveLength(3);
    expect(camposEmAberto({ ferramenta: "F", prazoRetencao: "P", contatoTitular: "C" })).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-aviso.test.ts
```

- [ ] **Step 3: Implementar** — os textos são cópia literal de `docs/compliance/aviso-de-gravacao.md` §1.1 (PT), §1.2 (PT e EN) e §2 (cláusula). Copiar dali, não redigitar.

```ts
/**
 * Aviso de gravação e cláusula de consentimento permanente
 * (docs/compliance/aviso-de-gravacao.md §1–§2), em código.
 *
 * Os marcadores `[ferramenta]`, `[prazo]` e `[contato]` são preenchidos pela
 * DecisaoDeConsentimento; `[organização]` muda por tenant e fica sempre.
 * Marcador sem valor permanece visível: a tela destaca, e "Copiar" copia com o
 * marcador — o prazo "não se lê em voz alta vazio".
 */

export type PecaDoAviso = "INTERNA_PT" | "EXTERNA_PT" | "EXTERNA_EN" | "CLAUSULA_PT";

export const AVISOS: Record<PecaDoAviso, { titulo: string; nota: string; texto: string }> = {
  INTERNA_PT: {
    titulo: "Reunião só interna · PT",
    nota: "Por reunião · ~20 s de fala",
    texto: "Esta reunião está sendo gravada e transcrita pelo [ferramenta], e o resumo é processado por um modelo de IA de terceiro. O acesso fica com quem tem papel ADMIN, STE ou RTE nesta organização, e o conteúdo é retido por [prazo]. Quem não quiser ser gravado diz agora. Depois, pedindo a revogação, o resumo e os itens derivados são apagados.",
  },
  EXTERNA_PT: {
    titulo: "Com participante externo · PT",
    nota: "A versão que importa",
    texto: "Esta reunião está sendo gravada e transcrita pelo [ferramenta], e o conteúdo é processado por um modelo de IA de terceiro para gerar resumo e itens de ação. Quem responde por esses dados é a [organização], que os retém por [prazo]. Se alguém não concordar, diga agora e a gravação não é processada. Pedidos de acesso ou exclusão vão para [contato].",
  },
  EXTERNA_EN: {
    titulo: "With external participant · EN",
    nota: "",
    texto: "This meeting is being recorded and transcribed by [ferramenta], and the content is processed by a third-party AI model to produce a summary and action items. [organização] is responsible for this data and keeps it for [prazo]. If anyone objects, say so now and the recording will not be processed. Requests for access or deletion go to [contato].",
  },
  CLAUSULA_PT: {
    titulo: "Consentimento permanente · cláusula",
    nota: "STANDING só habilitável com referência versionada e datada",
    texto: "Gravação e transcrição de cerimônias. As cerimônias conduzidas por esta organização podem ser gravadas e transcritas por ferramenta de terceiro, e o conteúdo resultante processado por modelo de inteligência artificial com a finalidade determinada de gerar resumo, riscos, impedimentos e itens de ação registrados na plataforma de gestão. Quem conduz a cerimônia deve anunciar a gravação na abertura, antes de ela começar, e interrompê-la caso qualquer participante se oponha. O acesso é restrito a quem tem papel de governança na organização; a retenção é de [prazo]. O consentimento pode ser revogado a qualquer momento, por procedimento gratuito, junto a [contato], hipótese em que o resumo e os itens derivados daquela cerimônia são eliminados. Esta cláusula não autoriza gravação para finalidade diversa da aqui descrita.",
  },
};

export type Marcadores = {
  ferramenta: string | null;
  prazoRetencao: string | null;
  contatoTitular: string | null;
};

const MARCADORES: { marcador: string; campo: keyof Marcadores }[] = [
  { marcador: "[ferramenta]", campo: "ferramenta" },
  { marcador: "[prazo]", campo: "prazoRetencao" },
  { marcador: "[contato]", campo: "contatoTitular" },
];

function valor(m: Marcadores, campo: keyof Marcadores): string | null {
  const v = m[campo]?.trim();
  return v ? v : null;
}

export function camposEmAberto(m: Marcadores): string[] {
  return MARCADORES.filter((x) => valor(m, x.campo) === null).map((x) => x.marcador);
}

export function renderAviso(peca: PecaDoAviso, m: Marcadores): { texto: string; abertos: string[] } {
  let texto = AVISOS[peca].texto;
  const abertos: string[] = [];
  for (const x of MARCADORES) {
    if (!texto.includes(x.marcador)) continue;
    const v = valor(m, x.campo);
    if (v === null) {
      abertos.push(x.marcador);
    } else {
      texto = texto.replaceAll(x.marcador, v);
    }
  }
  return { texto, abertos };
}
```

- [ ] **Step 4: Rodar — deve passar; commit**

```bash
pnpm --filter backoffice test -- __tests__/empresa-aviso.test.ts
/usr/bin/git add apps/backoffice/lib/empresa/aviso.ts apps/backoffice/__tests__/empresa-aviso.test.ts
/usr/bin/git commit -m "feat(backoffice): textos do aviso de gravação com marcadores preservados quando vazios"
```

---

### Task 8: Action de fornecedores, com exportação ao Charter

**Files:**
- Create: `apps/backoffice/app/actions/empresa/fornecedores.ts`
- Test: `apps/backoffice/__tests__/empresa-fornecedores-action.test.ts`

**Interfaces:**
- Consumes: `aplicarAcao`, `contadores`, `acoesDisponiveis`, `EstadoDpa`, `AcaoDpa` (Task 4); `deriveVendorMaxClass`, `platformDb`, `logPlatformAudit` de `@repo/provisioning` (Task 2); `withTenantDb` de `@repo/database`.
- Produces:
  - `type FornecedorDpaRow = { codigo: string; nome: string; estado: EstadoDpa; classificacaoProvisoria: boolean; regiao: string | null; retencao: string | null; transferencia: string | null; dpaUrl: string | null; subprocessadoresUrl: string | null; evidenciaUrl: string | null; verificadoEm: string; acaoPendente: string | null; donoPapel: string | null; bloqueiaVenda: boolean; pedidoEm: string | null; assinadoEm: string | null; exportadoAoCharterEm: string | null; notas: string | null; acoes: AcaoDpa[] }`
  - `listarFornecedoresDpa(): Promise<Result<{ linhas: FornecedorDpaRow[]; contadores: Contadores }>>`
  - `aplicarAcaoDpa(input: { codigo: string; acao: AcaoDpa; evidenciaUrl?: string }): Promise<Result<FornecedorDpaRow>>`
  - `atualizarFornecedorDpa(input: { codigo: string; notas?: string | null; acaoPendente?: string | null; donoPapel?: string | null; bloqueiaVenda?: boolean; regiao?: string | null; retencao?: string | null; verificadoEm?: string }): Promise<Result<FornecedorDpaRow>>`
  - `exportarAoCharter(input: { codigos: string[] }): Promise<Result<{ exportados: string[]; semCorrespondente: string[] }>>`
  - `ROTA_FORNECEDORES = "/empresa/fornecedores"`

- [ ] **Step 1: Teste**

```ts
// empresa-fornecedores-action.test.ts — a exportação é a única escrita fora
// do tenant system: muda quatro colunas do CharterVendor e recomputa maxClass,
// e não toca notes, tier, score, subprocessors.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  tenantFindUnique: vi.fn(),
  vendorFindUnique: vi.fn(),
  vendorUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const tx = {
  charterVendor: { findUnique: mocks.vendorFindUnique, update: mocks.vendorUpdate },
  auditLog: { create: mocks.auditCreate },
};
vi.mock("@repo/database", () => ({
  database: {
    fornecedorDpa: { findMany: mocks.findMany, findUnique: mocks.findUnique, update: mocks.update },
    auditLog: { create: mocks.auditCreate },
  },
  withTenantDb: (_tenantId: string, fn: (db: typeof tx) => Promise<unknown>) => fn(tx),
}));
vi.mock("@repo/provisioning", async () => {
  const rules = await vi.importActual<typeof import("@repo/provisioning/src/charter-rules")>(
    "@repo/provisioning/src/charter-rules"
  );
  return {
    logPlatformAudit: mocks.logPlatformAudit,
    ProvisioningError: class extends Error {},
    platformDb: { tenant: { findUnique: mocks.tenantFindUnique } },
    deriveVendorMaxClass: rules.deriveVendorMaxClass,
  };
});

import {
  aplicarAcaoDpa,
  atualizarFornecedorDpa,
  exportarAoCharter,
  listarFornecedoresDpa,
} from "../app/actions/empresa/fornecedores";

const staff = { userId: "u-1", name: "Vinícius", email: "v@nebuloz.com", canWrite: true };

const LINHA = {
  codigo: "V-08", nome: "Sentry", estado: "A_ASSINAR", classificacaoProvisoria: false,
  regiao: "US ou EU", retencao: null, transferencia: "SCCs + DPF",
  dpaUrl: "https://sentry.io/legal/dpa/", subprocessadoresUrl: null, evidenciaUrl: null,
  verificadoEm: new Date("2026-09-05T00:00:00Z"), acaoPendente: "Aceitar o DPA no portal",
  donoPapel: "Dono do SLA", bloqueiaVenda: false, pedidoEm: null, assinadoEm: null,
  exportadoAoCharterEm: null, notas: null,
};

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.findMany.mockResolvedValue([LINHA]);
  mocks.findUnique.mockResolvedValue(LINHA);
  mocks.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ ...LINHA, ...args.data }));
  mocks.tenantFindUnique.mockResolvedValue({ id: "t-nebuloz", slug: "nebuloz" });
  mocks.vendorFindUnique.mockResolvedValue({
    id: "cv-1", code: "V-08", tier: "REVIEW", dpa: false, region: null, retention: null,
    renewalAt: null, maxClass: "PUBLIC",
    clauses: [{ clause: { code: "CL-01" } }],
  });
  mocks.vendorUpdate.mockResolvedValue({ id: "cv-1" });
}

describe("listarFornecedoresDpa", () => {
  beforeEach(resetar);

  it("é leitura de todo staff, filtra o tenant system e devolve contadores e ações", async () => {
    const res = await listarFornecedoresDpa();
    expect(res.ok && res.data.linhas[0].acoes).toEqual(["MARCAR_ACEITO"]);
    expect(res.ok && res.data.contadores.aAssinar).toBe(1);
    expect(mocks.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: "system" });
    expect(mocks.assertCanWrite).not.toHaveBeenCalled();
  });
});

describe("aplicarAcaoDpa", () => {
  beforeEach(resetar);

  it("MEMBER não age", async () => {
    mocks.assertCanWrite.mockImplementation(() => { throw new Error("Somente leitura"); });
    const res = await aplicarAcaoDpa({ codigo: "V-08", acao: "MARCAR_ACEITO", evidenciaUrl: "https://x" });
    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marcar aceito sem evidência é recusado antes do banco", async () => {
    const res = await aplicarAcaoDpa({ codigo: "V-08", acao: "MARCAR_ACEITO" });
    expect(res.ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marcar aceito grava ASSINADO, evidência e assinadoEm, e audita o diff", async () => {
    const res = await aplicarAcaoDpa({ codigo: "V-08", acao: "MARCAR_ACEITO", evidenciaUrl: "https://x/ok.pdf" });
    expect(res.ok).toBe(true);
    const data = mocks.update.mock.calls[0][0].data;
    expect(data.estado).toBe("ASSINADO");
    expect(data.evidenciaUrl).toBe("https://x/ok.pdf");
    expect(data.assinadoEm).toBeInstanceOf(Date);
    expect(mocks.update.mock.calls[0][0].where).toEqual({ tenantId_codigo: { tenantId: "system", codigo: "V-08" } });
    expect(mocks.logPlatformAudit.mock.calls[0][1]).toMatchObject({
      tenantId: "system", entityType: "FornecedorDpa", diff: [["estado", "A_ASSINAR", "ASSINADO"]],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/fornecedores");
  });

  it("fornecedor inexistente", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const res = await aplicarAcaoDpa({ codigo: "V-99", acao: "REGISTRAR_PEDIDO" });
    expect(res.ok).toBe(false);
  });
});

describe("atualizarFornecedorDpa", () => {
  beforeEach(resetar);

  it("só grava os campos enviados", async () => {
    await atualizarFornecedorDpa({ codigo: "V-08", bloqueiaVenda: true, notas: "confirmado com o SLA" });
    expect(mocks.update.mock.calls[0][0].data).toEqual({ bloqueiaVenda: true, notas: "confirmado com o SLA" });
  });

  it("verificadoEm inválido é recusado", async () => {
    const res = await atualizarFornecedorDpa({ codigo: "V-08", verificadoEm: "ontem" });
    expect(res.ok).toBe(false);
  });
});

describe("exportarAoCharter", () => {
  beforeEach(resetar);

  it("escreve dpa, region, retention, renewalAt e maxClass recomputado — e nada mais", async () => {
    mocks.findUnique.mockResolvedValue({ ...LINHA, estado: "ASSINADO", assinadoEm: new Date("2026-09-06T00:00:00Z"), retencao: "90 dias" });
    const res = await exportarAoCharter({ codigos: ["V-08"] });
    expect(res.ok && res.data.exportados).toEqual(["V-08"]);
    const data = mocks.vendorUpdate.mock.calls[0][0].data;
    expect(data).toEqual({
      dpa: true,
      region: "US ou EU",
      retention: "90 dias",
      renewalAt: new Date("2027-09-06T00:00:00Z"),
      maxClass: "INTERNAL", // dpa + CL-01, sem CL-02..04
    });
    expect(Object.keys(data)).not.toContain("notes");
    expect(Object.keys(data)).not.toContain("tier");
  });

  it("A_ASSINAR exporta dpa=false e mantém o teto Público", async () => {
    await exportarAoCharter({ codigos: ["V-08"] });
    const data = mocks.vendorUpdate.mock.calls[0][0].data;
    expect(data.dpa).toBe(false);
    expect(data.maxClass).toBe("PUBLIC");
    expect(data.renewalAt).toBeNull();
  });

  it("carimba exportadoAoCharterEm no system e audita nos dois tenants", async () => {
    await exportarAoCharter({ codigos: ["V-08"] });
    expect(mocks.update.mock.calls[0][0].data.exportadoAoCharterEm).toBeInstanceOf(Date);
    const tenants = mocks.logPlatformAudit.mock.calls.map((c) => c[1].tenantId).sort();
    expect(tenants).toEqual(["system", "t-nebuloz"]);
  });

  it("código sem CharterVendor correspondente é devolvido, não erro", async () => {
    mocks.vendorFindUnique.mockResolvedValue(null);
    const res = await exportarAoCharter({ codigos: ["V-08"] });
    expect(res.ok && res.data.semCorrespondente).toEqual(["V-08"]);
    expect(mocks.vendorUpdate).not.toHaveBeenCalled();
  });

  it("sem tenant nebuloz, recusa", async () => {
    mocks.tenantFindUnique.mockResolvedValue(null);
    const res = await exportarAoCharter({ codigos: ["V-08"] });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-fornecedores-action.test.ts
```

- [ ] **Step 3: Implementar**

```ts
"use server";

import { database, withTenantDb } from "@repo/database";
import {
  deriveVendorMaxClass,
  logPlatformAudit,
  platformDb,
} from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type AcaoDpa,
  acoesDisponiveis,
  aplicarAcao,
  type Contadores,
  contadores,
  type EstadoDpa,
} from "@/lib/empresa/fornecedores";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Fornecedores e DPA — o estado real do acordo de tratamento de dados com os
 * 18 fornecedores do Charter interno (docs/compliance/dpa-fornecedores.md).
 *
 * Tudo no tenant system, menos `exportarAoCharter`: ela escreve no
 * `CharterVendor` do tenant nebuloz, por `withTenantDb`, e é a única escrita
 * fora de casa deste diretório (ADR-0013).
 */

export const ROTA_FORNECEDORES = "/empresa/fornecedores";

/** Slug do tenant que carrega o Charter interno (seed:charter:nebuloz). */
const TENANT_CHARTER_NEBULOZ = "nebuloz";

export type FornecedorDpaRow = {
  codigo: string;
  nome: string;
  estado: EstadoDpa;
  classificacaoProvisoria: boolean;
  regiao: string | null;
  retencao: string | null;
  transferencia: string | null;
  dpaUrl: string | null;
  subprocessadoresUrl: string | null;
  evidenciaUrl: string | null;
  verificadoEm: string;
  acaoPendente: string | null;
  donoPapel: string | null;
  bloqueiaVenda: boolean;
  pedidoEm: string | null;
  assinadoEm: string | null;
  exportadoAoCharterEm: string | null;
  notas: string | null;
  acoes: AcaoDpa[];
};

const SELECT = {
  codigo: true, nome: true, estado: true, classificacaoProvisoria: true,
  regiao: true, retencao: true, transferencia: true, dpaUrl: true,
  subprocessadoresUrl: true, evidenciaUrl: true, verificadoEm: true,
  acaoPendente: true, donoPapel: true, bloqueiaVenda: true, pedidoEm: true,
  assinadoEm: true, exportadoAoCharterEm: true, notas: true,
} as const;

type Linha = {
  [K in keyof typeof SELECT]: K extends "verificadoEm" ? Date
    : K extends "pedidoEm" | "assinadoEm" | "exportadoAoCharterEm" ? Date | null
    : K extends "estado" ? EstadoDpa
    : K extends "classificacaoProvisoria" | "bloqueiaVenda" ? boolean
    : K extends "codigo" | "nome" ? string
    : string | null;
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function paraRow(l: Linha): FornecedorDpaRow {
  return {
    ...l,
    verificadoEm: l.verificadoEm.toISOString(),
    pedidoEm: iso(l.pedidoEm),
    assinadoEm: iso(l.assinadoEm),
    exportadoAoCharterEm: iso(l.exportadoAoCharterEm),
    acoes: acoesDisponiveis(l.estado),
  };
}

function chave(codigo: string) {
  return { tenantId_codigo: { tenantId: SYSTEM_TENANT_ID, codigo } };
}

async function buscar(codigo: string): Promise<Linha> {
  const l = await database.fornecedorDpa.findUnique({ where: chave(codigo), select: SELECT });
  if (!l) {
    throw new StaffAuthError("FORBIDDEN", `Fornecedor ${codigo} não existe no inventário.`);
  }
  return l as Linha;
}

export async function listarFornecedoresDpa(): Promise<
  Result<{ linhas: FornecedorDpaRow[]; contadores: Contadores }>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const linhas = (await database.fornecedorDpa.findMany({
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: { codigo: "asc" },
      select: SELECT,
    })) as Linha[];
    return { linhas: linhas.map(paraRow), contadores: contadores(linhas) };
  });
}

const AcaoSchema = z.object({
  codigo: z.string().min(1),
  acao: z.enum(["MARCAR_ACEITO", "REGISTRAR_PEDIDO"]),
  evidenciaUrl: z.string().url().optional(),
});

export async function aplicarAcaoDpa(
  input: z.infer<typeof AcaoSchema>
): Promise<Result<FornecedorDpaRow>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { codigo, acao, evidenciaUrl } = AcaoSchema.parse(input);

    const atual = await buscar(codigo);
    const r = aplicarAcao(atual, acao, new Date(), evidenciaUrl);
    if (!r.ok) {
      throw new StaffAuthError("FORBIDDEN", r.erro);
    }

    const depois = (await database.fornecedorDpa.update({
      where: chave(codigo),
      data: r.patch,
      select: SELECT,
    })) as Linha;

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: `empresa.dpa.${acao.toLowerCase()}`,
      entityType: "FornecedorDpa",
      entityId: codigo,
      target: `${codigo} · ${atual.nome}`,
      diff: atual.estado === depois.estado ? [] : [["estado", atual.estado, depois.estado]],
    });
    revalidatePath(ROTA_FORNECEDORES);
    return paraRow(depois);
  });
}

const PatchSchema = z.object({
  codigo: z.string().min(1),
  notas: z.string().nullable().optional(),
  acaoPendente: z.string().nullable().optional(),
  donoPapel: z.string().nullable().optional(),
  bloqueiaVenda: z.boolean().optional(),
  regiao: z.string().nullable().optional(),
  retencao: z.string().nullable().optional(),
  verificadoEm: z.iso.datetime().optional(),
});

export async function atualizarFornecedorDpa(
  input: z.infer<typeof PatchSchema>
): Promise<Result<FornecedorDpaRow>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { codigo, verificadoEm, ...campos } = PatchSchema.parse(input);
    const atual = await buscar(codigo);

    // Só o que veio no input entra no update: `undefined` não é "apagar".
    const data = Object.fromEntries(
      Object.entries({ ...campos, verificadoEm: verificadoEm ? new Date(verificadoEm) : undefined })
        .filter(([, v]) => v !== undefined)
    );

    const depois = (await database.fornecedorDpa.update({
      where: chave(codigo),
      data,
      select: SELECT,
    })) as Linha;

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.dpa.atualizar",
      entityType: "FornecedorDpa",
      entityId: codigo,
      target: `${codigo} · ${atual.nome}`,
      diff: Object.keys(data).map((k) => [
        k, String((atual as Record<string, unknown>)[k] ?? ""), String((depois as Record<string, unknown>)[k] ?? ""),
      ]),
    });
    revalidatePath(ROTA_FORNECEDORES);
    return paraRow(depois);
  });
}

const ExportSchema = z.object({ codigos: z.array(z.string().min(1)).min(1) });

const UM_ANO_MS = 365 * 86_400_000;

/**
 * A única escrita fora do tenant system (spec §4.1).
 *
 * Muda quatro colunas do CharterVendor e recomputa `maxClass`, que é cache
 * derivado de `dpa` (ADR-0003). `notes`, `tier`, `score`, `subprocessors`
 * ficam como estão: são do produto e de quem opera o Charter.
 */
export async function exportarAoCharter(
  input: z.infer<typeof ExportSchema>
): Promise<Result<{ exportados: string[]; semCorrespondente: string[] }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { codigos } = ExportSchema.parse(input);

    const nebuloz = await platformDb.tenant.findUnique({
      where: { slug: TENANT_CHARTER_NEBULOZ },
      select: { id: true, slug: true },
    });
    if (!nebuloz) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `O tenant "${TENANT_CHARTER_NEBULOZ}" não existe — o Charter interno não foi semeado.`
      );
    }

    const exportados: string[] = [];
    const semCorrespondente: string[] = [];
    const agora = new Date();

    for (const codigo of codigos) {
      const f = await buscar(codigo);
      const dpa = f.estado === "EMBUTIDO" || f.estado === "ASSINADO";
      const renewalAt = f.assinadoEm ? new Date(f.assinadoEm.getTime() + UM_ANO_MS) : null;

      const escreveu = await withTenantDb(nebuloz.id, async (tx) => {
        const vendor = await tx.charterVendor.findUnique({
          where: { tenantId_code: { tenantId: nebuloz.id, code: codigo } },
          include: { clauses: { include: { clause: { select: { code: true } } } } },
        });
        if (!vendor) {
          return false;
        }
        const { maxClass } = deriveVendorMaxClass({
          tier: vendor.tier,
          dpa,
          clauseCodes: vendor.clauses.map((c) => c.clause.code),
        });
        const data = { dpa, region: f.regiao, retention: f.retencao, renewalAt, maxClass };
        await tx.charterVendor.update({ where: { id: vendor.id }, data });
        await logPlatformAudit(tx, {
          tenantId: nebuloz.id,
          actorUserId: staff.userId,
          actorName: staff.name,
          action: "charter.vendor.dpa_exportado",
          entityType: "CharterVendor",
          entityId: vendor.id,
          target: `${nebuloz.slug} · ${codigo}`,
          note: "Exportado da tela Fornecedores e DPA do back-office.",
          diff: [
            ["dpa", String(vendor.dpa), String(dpa)],
            ["region", vendor.region ?? "", f.regiao ?? ""],
            ["retention", vendor.retention ?? "", f.retencao ?? ""],
            ["maxClass", vendor.maxClass ?? "", maxClass ?? ""],
          ],
        });
        return true;
      });

      if (!escreveu) {
        semCorrespondente.push(codigo);
        continue;
      }
      await database.fornecedorDpa.update({
        where: chave(codigo),
        data: { exportadoAoCharterEm: agora },
      });
      exportados.push(codigo);
    }

    if (exportados.length > 0) {
      await logPlatformAudit(database, {
        tenantId: SYSTEM_TENANT_ID,
        actorUserId: staff.userId,
        actorName: staff.name,
        action: "empresa.dpa.exportar_charter",
        entityType: "FornecedorDpa",
        entityId: exportados.join(","),
        target: `${exportados.length} fornecedor(es) → ${nebuloz.slug}`,
      });
    }
    revalidatePath(ROTA_FORNECEDORES);
    return { exportados, semCorrespondente };
  });
}
```

Notas para quem implementa: `z.iso.datetime()` é a forma do zod 4 (em zod 3 seria `z.string().datetime()`; o back-office usa zod 4). O tipo `Linha` existe para o `select` congelado devolver tipos exatos sem importar `Prisma` — se o typecheck reclamar do `as Linha`, substituir por `Prisma.FornecedorDpaGetPayload<{ select: typeof SELECT }>` importando `type Prisma` de `@repo/database`.

- [ ] **Step 4: Rodar — deve passar; typecheck; commit**

```bash
pnpm --filter backoffice test -- __tests__/empresa-fornecedores-action.test.ts
pnpm --filter backoffice typecheck
/usr/bin/git add apps/backoffice/app/actions/empresa/fornecedores.ts apps/backoffice/__tests__/empresa-fornecedores-action.test.ts
/usr/bin/git commit -m "feat(backoffice): action de fornecedores e DPA com exportação ao Charter interno

A exportação é a única escrita fora do tenant system: muda dpa, region,
retention e renewalAt do CharterVendor do nebuloz e recomputa maxClass."
```

---

### Task 9: Action de consentimento

**Files:**
- Create: `apps/backoffice/app/actions/empresa/consentimento.ts`
- Test: `apps/backoffice/__tests__/empresa-consentimento-action.test.ts`

**Interfaces:**
- Consumes: `AVISOS`, `renderAviso`, `camposEmAberto`, `PecaDoAviso` (Task 7).
- Produces:
  - `type DecisaoView = { ferramenta: string | null; prazoRetencao: string | null; contatoTitular: string | null; baseLegal: "SEM_DECISAO" | "CONSENTIMENTO" | "LEGITIMO_INTERESSE"; standingHabilitavel: boolean | null; parecer: "PENDENTE" | "ENVIADO" | "RECEBIDO"; parecerEnviadoEm: string | null; parecerRecebidoEm: string | null }`
  - `type PerguntaView = { numero: number; pergunta: string; donoPapel: string; resposta: string | null; respondidaEm: string | null }`
  - `type ConsentimentoView = { decisao: DecisaoView; camposEmAberto: string[]; avisos: { peca: PecaDoAviso; titulo: string; nota: string; texto: string; abertos: string[] }[]; perguntas: PerguntaView[]; abertas: number }`
  - `lerConsentimento(): Promise<Result<ConsentimentoView>>`
  - `salvarDecisao(input: { ferramenta?: string | null; prazoRetencao?: string | null; contatoTitular?: string | null; baseLegal?: DecisaoView["baseLegal"]; standingHabilitavel?: boolean | null }): Promise<Result<DecisaoView>>`
  - `responderPergunta(input: { numero: number; resposta: string | null }): Promise<Result<PerguntaView>>`
  - `marcarParecer(input: { status: "ENVIADO" | "RECEBIDO" }): Promise<Result<DecisaoView>>`
  - `ROTA_CONSENTIMENTO = "/empresa/consentimento"`

- [ ] **Step 1: Teste**

```ts
// empresa-consentimento-action.test.ts — a decisão nasce vazia sem escrever
// (leitura de MEMBER não cria linha), e o parecer só avança.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  decisaoFindUnique: vi.fn(),
  decisaoUpsert: vi.fn(),
  perguntaFindMany: vi.fn(),
  perguntaFindUnique: vi.fn(),
  perguntaUpdate: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  database: {
    decisaoDeConsentimento: { findUnique: mocks.decisaoFindUnique, upsert: mocks.decisaoUpsert },
    perguntaAoParecer: { findMany: mocks.perguntaFindMany, findUnique: mocks.perguntaFindUnique, update: mocks.perguntaUpdate },
  },
}));

import {
  lerConsentimento,
  marcarParecer,
  responderPergunta,
  salvarDecisao,
} from "../app/actions/empresa/consentimento";

const staff = { userId: "u-1", name: "V", email: "v@nebuloz.com", canWrite: true };

const DECISAO = {
  ferramenta: "Fireflies", prazoRetencao: null, contatoTitular: null,
  baseLegal: "SEM_DECISAO", standingHabilitavel: null,
  parecer: "PENDENTE", parecerEnviadoEm: null, parecerRecebidoEm: null,
};
const PERGUNTA = { numero: 6, pergunta: "Qual o prazo?", donoPapel: "Dono do SLA", resposta: null, respondidaEm: null };

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.decisaoFindUnique.mockResolvedValue(DECISAO);
  mocks.decisaoUpsert.mockImplementation(async (a: { update: Record<string, unknown> }) => ({ ...DECISAO, ...a.update }));
  mocks.perguntaFindMany.mockResolvedValue([PERGUNTA]);
  mocks.perguntaFindUnique.mockResolvedValue(PERGUNTA);
  mocks.perguntaUpdate.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ ...PERGUNTA, ...a.data }));
}

describe("lerConsentimento", () => {
  beforeEach(resetar);

  it("renderiza os avisos com os marcadores da decisão e conta os abertos", async () => {
    const res = await lerConsentimento();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.camposEmAberto).toEqual(["[prazo]", "[contato]"]);
    expect(res.data.avisos).toHaveLength(4);
    expect(res.data.avisos[1].texto).toContain("pelo Fireflies");
    expect(res.data.abertas).toBe(1);
    expect(mocks.decisaoUpsert).not.toHaveBeenCalled();
  });

  it("sem decisão gravada, devolve o vazio sem criar", async () => {
    mocks.decisaoFindUnique.mockResolvedValue(null);
    const res = await lerConsentimento();
    expect(res.ok && res.data.decisao.baseLegal).toBe("SEM_DECISAO");
    expect(res.ok && res.data.camposEmAberto).toHaveLength(3);
    expect(mocks.decisaoUpsert).not.toHaveBeenCalled();
  });
});

describe("salvarDecisao", () => {
  beforeEach(resetar);

  it("MEMBER não salva", async () => {
    mocks.assertCanWrite.mockImplementation(() => { throw new Error("Somente leitura"); });
    const res = await salvarDecisao({ prazoRetencao: "12 meses" });
    expect(res.ok).toBe(false);
    expect(mocks.decisaoUpsert).not.toHaveBeenCalled();
  });

  it("faz upsert pelo tenant system com só os campos enviados", async () => {
    const res = await salvarDecisao({ prazoRetencao: "12 meses", baseLegal: "CONSENTIMENTO" });
    expect(res.ok && res.data.prazoRetencao).toBe("12 meses");
    const args = mocks.decisaoUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: "system" });
    expect(args.update).toEqual({ prazoRetencao: "12 meses", baseLegal: "CONSENTIMENTO" });
    expect(args.create).toMatchObject({ tenantId: "system", prazoRetencao: "12 meses" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/consentimento");
  });

  it("base legal fora do enum é recusada", async () => {
    const res = await salvarDecisao({ baseLegal: "ACHISMO" as never });
    expect(res.ok).toBe(false);
  });
});

describe("responderPergunta", () => {
  beforeEach(resetar);

  it("grava resposta e respondidaEm; apagar a resposta zera a data", async () => {
    await responderPergunta({ numero: 6, resposta: "12 meses" });
    expect(mocks.perguntaUpdate.mock.calls[0][0].where).toEqual({ tenantId_numero: { tenantId: "system", numero: 6 } });
    expect(mocks.perguntaUpdate.mock.calls[0][0].data.respondidaEm).toBeInstanceOf(Date);

    await responderPergunta({ numero: 6, resposta: null });
    expect(mocks.perguntaUpdate.mock.calls[1][0].data).toEqual({ resposta: null, respondidaEm: null });
  });

  it("pergunta inexistente", async () => {
    mocks.perguntaFindUnique.mockResolvedValue(null);
    const res = await responderPergunta({ numero: 9, resposta: "x" });
    expect(res.ok).toBe(false);
  });
});

describe("marcarParecer", () => {
  beforeEach(resetar);

  it("ENVIADO carimba parecerEnviadoEm", async () => {
    await marcarParecer({ status: "ENVIADO" });
    const u = mocks.decisaoUpsert.mock.calls[0][0].update;
    expect(u.parecer).toBe("ENVIADO");
    expect(u.parecerEnviadoEm).toBeInstanceOf(Date);
  });

  it("RECEBIDO exige ter sido ENVIADO", async () => {
    const res = await marcarParecer({ status: "RECEBIDO" });
    expect(res.ok).toBe(false);
    mocks.decisaoFindUnique.mockResolvedValue({ ...DECISAO, parecer: "ENVIADO" });
    const ok = await marcarParecer({ status: "RECEBIDO" });
    expect(ok.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-consentimento-action.test.ts
```

- [ ] **Step 3: Implementar**

```ts
"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AVISOS,
  camposEmAberto,
  type PecaDoAviso,
  renderAviso,
} from "@/lib/empresa/aviso";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Consentimento de gravação — o lado da Nebuloz
 * (docs/compliance/aviso-de-gravacao.md). O produto garante que alguém afirmou
 * ter consentimento; isto é o que faz o consentimento existir: o aviso, a
 * cláusula e a base legal que o parecer ainda não escolheu.
 */

export const ROTA_CONSENTIMENTO = "/empresa/consentimento";

const BASES = ["SEM_DECISAO", "CONSENTIMENTO", "LEGITIMO_INTERESSE"] as const;
const PARECERES = ["PENDENTE", "ENVIADO", "RECEBIDO"] as const;

export type DecisaoView = {
  ferramenta: string | null;
  prazoRetencao: string | null;
  contatoTitular: string | null;
  baseLegal: (typeof BASES)[number];
  standingHabilitavel: boolean | null;
  parecer: (typeof PARECERES)[number];
  parecerEnviadoEm: string | null;
  parecerRecebidoEm: string | null;
};

export type PerguntaView = {
  numero: number;
  pergunta: string;
  donoPapel: string;
  resposta: string | null;
  respondidaEm: string | null;
};

export type ConsentimentoView = {
  decisao: DecisaoView;
  camposEmAberto: string[];
  avisos: { peca: PecaDoAviso; titulo: string; nota: string; texto: string; abertos: string[] }[];
  perguntas: PerguntaView[];
  abertas: number;
};

const VAZIA: DecisaoView = {
  ferramenta: null, prazoRetencao: null, contatoTitular: null,
  baseLegal: "SEM_DECISAO", standingHabilitavel: null,
  parecer: "PENDENTE", parecerEnviadoEm: null, parecerRecebidoEm: null,
};

const SELECT_DECISAO = {
  ferramenta: true, prazoRetencao: true, contatoTitular: true, baseLegal: true,
  standingHabilitavel: true, parecer: true, parecerEnviadoEm: true, parecerRecebidoEm: true,
} as const;

type DecisaoDb = Omit<DecisaoView, "parecerEnviadoEm" | "parecerRecebidoEm"> & {
  parecerEnviadoEm: Date | null;
  parecerRecebidoEm: Date | null;
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function paraDecisao(d: DecisaoDb | null): DecisaoView {
  if (!d) return VAZIA;
  return { ...d, parecerEnviadoEm: iso(d.parecerEnviadoEm), parecerRecebidoEm: iso(d.parecerRecebidoEm) };
}

async function lerDecisao(): Promise<DecisaoView> {
  const d = (await database.decisaoDeConsentimento.findUnique({
    where: { tenantId: SYSTEM_TENANT_ID },
    select: SELECT_DECISAO,
  })) as DecisaoDb | null;
  return paraDecisao(d);
}

const PECAS: PecaDoAviso[] = ["INTERNA_PT", "EXTERNA_PT", "EXTERNA_EN", "CLAUSULA_PT"];

export async function lerConsentimento(): Promise<Result<ConsentimentoView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const [decisao, perguntas] = await Promise.all([
      lerDecisao(),
      database.perguntaAoParecer.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        orderBy: { numero: "asc" },
        select: { numero: true, pergunta: true, donoPapel: true, resposta: true, respondidaEm: true },
      }),
    ]);
    const avisos = PECAS.map((peca) => ({ peca, ...AVISOS[peca], ...renderAviso(peca, decisao) }));
    const lista = perguntas.map((p) => ({ ...p, respondidaEm: iso(p.respondidaEm) }));
    return {
      decisao,
      camposEmAberto: camposEmAberto(decisao),
      avisos,
      perguntas: lista,
      abertas: lista.filter((p) => p.resposta === null).length,
    };
  });
}

const DecisaoSchema = z.object({
  ferramenta: z.string().nullable().optional(),
  prazoRetencao: z.string().nullable().optional(),
  contatoTitular: z.string().nullable().optional(),
  baseLegal: z.enum(BASES).optional(),
  standingHabilitavel: z.boolean().nullable().optional(),
});

function soDefinidos<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

async function gravarDecisao(
  update: Record<string, unknown>,
  staff: { userId: string; name: string | null },
  action: string
): Promise<DecisaoView> {
  const d = (await database.decisaoDeConsentimento.upsert({
    where: { tenantId: SYSTEM_TENANT_ID },
    create: { tenantId: SYSTEM_TENANT_ID, ...update },
    update,
    select: SELECT_DECISAO,
  })) as DecisaoDb;
  await logPlatformAudit(database, {
    tenantId: SYSTEM_TENANT_ID,
    actorUserId: staff.userId,
    actorName: staff.name,
    action,
    entityType: "DecisaoDeConsentimento",
    entityId: SYSTEM_TENANT_ID,
    target: "consentimento de gravação",
    diff: Object.entries(update).map(([k, v]) => [k, "", String(v ?? "")]),
  });
  revalidatePath(ROTA_CONSENTIMENTO);
  return paraDecisao(d);
}

export async function salvarDecisao(
  input: z.infer<typeof DecisaoSchema>
): Promise<Result<DecisaoView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const update = soDefinidos(DecisaoSchema.parse(input));
    return await gravarDecisao(update, staff, "empresa.consentimento.decisao");
  });
}

const RespostaSchema = z.object({
  numero: z.number().int().min(1),
  resposta: z.string().nullable(),
});

export async function responderPergunta(
  input: z.infer<typeof RespostaSchema>
): Promise<Result<PerguntaView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { numero, resposta } = RespostaSchema.parse(input);
    const where = { tenantId_numero: { tenantId: SYSTEM_TENANT_ID, numero } };

    const existe = await database.perguntaAoParecer.findUnique({ where, select: { numero: true } });
    if (!existe) {
      throw new StaffAuthError("FORBIDDEN", `Pergunta ${numero} não existe.`);
    }
    const texto = resposta?.trim() ? resposta.trim() : null;
    const p = await database.perguntaAoParecer.update({
      where,
      data: { resposta: texto, respondidaEm: texto ? new Date() : null },
      select: { numero: true, pergunta: true, donoPapel: true, resposta: true, respondidaEm: true },
    });
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.consentimento.responder",
      entityType: "PerguntaAoParecer",
      entityId: String(numero),
      target: `pergunta ${numero}`,
    });
    revalidatePath(ROTA_CONSENTIMENTO);
    return { ...p, respondidaEm: iso(p.respondidaEm) };
  });
}

const ParecerSchema = z.object({ status: z.enum(["ENVIADO", "RECEBIDO"]) });

export async function marcarParecer(
  input: z.infer<typeof ParecerSchema>
): Promise<Result<DecisaoView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { status } = ParecerSchema.parse(input);
    const atual = await lerDecisao();
    if (status === "RECEBIDO" && atual.parecer !== "ENVIADO") {
      throw new StaffAuthError("FORBIDDEN", "O parecer só pode ser recebido depois de enviado.");
    }
    const update =
      status === "ENVIADO"
        ? { parecer: status, parecerEnviadoEm: new Date() }
        : { parecer: status, parecerRecebidoEm: new Date() };
    return await gravarDecisao(update, staff, `empresa.consentimento.parecer_${status.toLowerCase()}`);
  });
}
```

- [ ] **Step 4: Rodar — deve passar; typecheck; commit**

```bash
pnpm --filter backoffice test -- __tests__/empresa-consentimento-action.test.ts
pnpm --filter backoffice typecheck
/usr/bin/git add apps/backoffice/app/actions/empresa/consentimento.ts apps/backoffice/__tests__/empresa-consentimento-action.test.ts
/usr/bin/git commit -m "feat(backoffice): action de consentimento — decisão, perguntas ao parecer e avisos renderizados"
```

---

### Task 10: Action do CAC

**Files:**
- Create: `apps/backoffice/app/actions/empresa/cac.ts`
- Test: `apps/backoffice/__tests__/empresa-cac-action.test.ts`

**Interfaces:**
- Consumes: `calcularCac`, `pesosSomam100`, `ParcelasCac`, `ResultadoCac` (Task 5); `CONTAS_DO_CAC` (Task 3); `competenciaValida` (Task 6); `precificarProposta` de `@/lib/comercial/precificar`.
- Produces:
  - `type ConversaoView = { convLeadDiscoveryPercent: number | null; convDiscoveryEvaluationPercent: number | null; convEvaluationPropostaPercent: number | null; convPropostaAceitaPercent: number | null }`
  - `type CacView = { competencia: string; parcelas: ParcelasCac; conversao: ConversaoView; alocacoes: { produto: string; pesoPercent: number }[]; resultado: ResultadoCac; mensalidadeReferenciaCentavos: number | null; sugestaoClientesGanhos: number }`
  - `lerCac(input: { competencia: string }): Promise<Result<CacView>>`
  - `salvarParcelas(input: { competencia: string; contas?: Partial<Record<ContaDoCac, number | null>>; entregaDiagnosticoCentavos?: number | null; clientesGanhos?: number | null }): Promise<Result<CacView>>`
  - `salvarConversao(input: { competencia: string } & Partial<ConversaoView>): Promise<Result<CacView>>`
  - `salvarAlocacao(input: { competencia: string; alocacoes: { produto: "COSMOS" | "CHARTER" | "SIGNAL" | "MERIDIAN" | "SCAFFOLD"; pesoPercent: number }[] }): Promise<Result<CacView>>`
  - `ROTA_CAC = "/empresa/cac"`

- [ ] **Step 1: Teste**

```ts
// empresa-cac-action.test.ts — as seis parcelas 4.x moram em LancamentoMensal:
// salvar parcela é escrever no DRE. Nulo apaga o lançamento.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  lancFindMany: vi.fn(),
  lancUpsert: vi.fn(),
  lancDeleteMany: vi.fn(),
  cacFindUnique: vi.fn(),
  cacUpsert: vi.fn(),
  alocDeleteMany: vi.fn(),
  alocCreateMany: vi.fn(),
  planoFindUnique: vi.fn(),
  termoFindUnique: vi.fn(),
  proposalCount: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  database: {
    lancamentoMensal: { findMany: mocks.lancFindMany, upsert: mocks.lancUpsert, deleteMany: mocks.lancDeleteMany },
    cacPeriodo: { findUnique: mocks.cacFindUnique, upsert: mocks.cacUpsert },
    cacAlocacaoProduto: { deleteMany: mocks.alocDeleteMany, createMany: mocks.alocCreateMany },
    planoComercial: { findUnique: mocks.planoFindUnique },
    termoDeContrato: { findUnique: mocks.termoFindUnique },
    proposal: { count: mocks.proposalCount },
    $transaction: (fns: Promise<unknown>[]) => Promise.all(fns),
  },
}));

import { lerCac, salvarAlocacao, salvarConversao, salvarParcelas } from "../app/actions/empresa/cac";

const staff = { userId: "u-1", name: "V", email: "v@nebuloz.com", canWrite: true };

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.lancFindMany.mockResolvedValue([{ conta: "4.1", valorCentavos: 100 }]);
  mocks.cacFindUnique.mockResolvedValue({
    id: "cac-1", entregaDiagnosticoCentavos: null, clientesGanhos: null,
    convLeadDiscoveryPercent: null, convDiscoveryEvaluationPercent: null,
    convEvaluationPropostaPercent: null, convPropostaAceitaPercent: 25,
    alocacoes: [{ produto: "MERIDIAN", pesoPercent: 100 }],
  });
  mocks.cacUpsert.mockResolvedValue({ id: "cac-1" });
  mocks.planoFindUnique.mockResolvedValue({ precoAssentoCentavos: 14_900, minimoAssentos: 25 });
  mocks.termoFindUnique.mockResolvedValue({ meses: 12, descontoPercent: 12 });
  mocks.proposalCount.mockResolvedValue(1);
}

describe("lerCac", () => {
  beforeEach(resetar);

  it("monta as parcelas do DRE + CacPeriodo e a mensalidade de referência do catálogo", async () => {
    const res = await lerCac({ competencia: "2026-09" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.parcelas["4.1"]).toBe(100);
    expect(res.data.parcelas["4.2"]).toBeNull();
    expect(res.data.resultado.preenchidas).toBe(1);
    expect(res.data.resultado.cacCentavos).toBeNull();
    // 25 × 14.900 × 0,88 = 327.800 — a fórmula de precificar.test.ts.
    expect(res.data.mensalidadeReferenciaCentavos).toBe(327_800);
    expect(res.data.sugestaoClientesGanhos).toBe(1);
    expect(mocks.lancFindMany.mock.calls[0][0].where).toMatchObject({ tenantId: "system", competencia: "2026-09" });
  });

  it("sem plano scale no catálogo, a referência é nula e nada quebra", async () => {
    mocks.planoFindUnique.mockResolvedValue(null);
    const res = await lerCac({ competencia: "2026-09" });
    expect(res.ok && res.data.mensalidadeReferenciaCentavos).toBeNull();
  });

  it("competência inválida", async () => {
    const res = await lerCac({ competencia: "set/26" });
    expect(res.ok).toBe(false);
  });
});

describe("salvarParcelas", () => {
  beforeEach(resetar);

  it("MEMBER não salva", async () => {
    mocks.assertCanWrite.mockImplementation(() => { throw new Error("Somente leitura"); });
    const res = await salvarParcelas({ competencia: "2026-09", contas: { "4.1": 5 } });
    expect(res.ok).toBe(false);
  });

  it("conta 4.x vira upsert em LancamentoMensal; nulo apaga", async () => {
    await salvarParcelas({ competencia: "2026-09", contas: { "4.1": 500, "4.2": null } });
    expect(mocks.lancUpsert.mock.calls[0][0].where).toEqual({
      tenantId_competencia_conta: { tenantId: "system", competencia: "2026-09", conta: "4.1" },
    });
    expect(mocks.lancUpsert.mock.calls[0][0].update).toEqual({ valorCentavos: 500 });
    expect(mocks.lancDeleteMany.mock.calls[0][0].where).toEqual({ tenantId: "system", competencia: "2026-09", conta: "4.2" });
  });

  it("conta fora das seis é recusada", async () => {
    const res = await salvarParcelas({ competencia: "2026-09", contas: { "5.1": 5 } as never });
    expect(res.ok).toBe(false);
    expect(mocks.lancUpsert).not.toHaveBeenCalled();
  });

  it("entrega e clientes ganhos vão para CacPeriodo, por upsert na competência", async () => {
    await salvarParcelas({ competencia: "2026-09", entregaDiagnosticoCentavos: 600_000, clientesGanhos: 2 });
    const a = mocks.cacUpsert.mock.calls[0][0];
    expect(a.where).toEqual({ tenantId_competencia: { tenantId: "system", competencia: "2026-09" } });
    expect(a.update).toEqual({ entregaDiagnosticoCentavos: 600_000, clientesGanhos: 2 });
  });

  it("centavos fracionados e negativos são recusados", async () => {
    expect((await salvarParcelas({ competencia: "2026-09", contas: { "4.1": 1.5 } })).ok).toBe(false);
    expect((await salvarParcelas({ competencia: "2026-09", clientesGanhos: -1 })).ok).toBe(false);
  });
});

describe("salvarConversao", () => {
  beforeEach(resetar);

  it("percentual entre 0 e 100", async () => {
    expect((await salvarConversao({ competencia: "2026-09", convPropostaAceitaPercent: 101 })).ok).toBe(false);
    await salvarConversao({ competencia: "2026-09", convPropostaAceitaPercent: 30 });
    expect(mocks.cacUpsert.mock.calls[0][0].update).toEqual({ convPropostaAceitaPercent: 30 });
  });
});

describe("salvarAlocacao", () => {
  beforeEach(resetar);

  it("pesos que não somam 100 são recusados", async () => {
    const res = await salvarAlocacao({ competencia: "2026-09", alocacoes: [{ produto: "MERIDIAN", pesoPercent: 50 }] });
    expect(res.ok).toBe(false);
    expect(mocks.alocCreateMany).not.toHaveBeenCalled();
  });

  it("substitui as alocações do período", async () => {
    await salvarAlocacao({
      competencia: "2026-09",
      alocacoes: [{ produto: "MERIDIAN", pesoPercent: 40 }, { produto: "CHARTER", pesoPercent: 60 }],
    });
    expect(mocks.alocDeleteMany.mock.calls[0][0].where).toEqual({ cacPeriodoId: "cac-1" });
    expect(mocks.alocCreateMany.mock.calls[0][0].data).toEqual([
      { cacPeriodoId: "cac-1", produto: "MERIDIAN", pesoPercent: 40 },
      { cacPeriodoId: "cac-1", produto: "CHARTER", pesoPercent: 60 },
    ]);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-cac-action.test.ts
```

- [ ] **Step 3: Implementar**

```ts
"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { precificarProposta } from "@/lib/comercial/precificar";
import {
  calcularCac,
  type ParcelasCac,
  pesosSomam100,
  type ResultadoCac,
} from "@/lib/empresa/cac";
import { competenciaValida } from "@/lib/empresa/financeiro";
import { CONTAS_DO_CAC, type ContaDoCac } from "@/lib/empresa/plano-de-contas";
import { assertCanWrite, requirePlatformStaff, StaffAuthError, SYSTEM_TENANT_ID } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * CAC totalmente carregado (docs/comercial/cac-modelo.md).
 *
 * Seis das oito parcelas são as contas 4.1–4.6 do DRE: esta action lê e
 * escreve LancamentoMensal, não uma cópia. É o que faz o numerador do CAC e a
 * linha "Comercial" do DRE baterem por construção.
 */

export const ROTA_CAC = "/empresa/cac";

/** Plano e termo que dão a mensalidade de referência do payback
 *  (cac-modelo.md §3): Scale, mínimo de assentos, termo anual. */
const PLANO_REFERENCIA = "scale";
const TERMO_REFERENCIA = "ANUAL";

const PRODUTOS = ["COSMOS", "CHARTER", "SIGNAL", "MERIDIAN", "SCAFFOLD"] as const;

export type ConversaoView = {
  convLeadDiscoveryPercent: number | null;
  convDiscoveryEvaluationPercent: number | null;
  convEvaluationPropostaPercent: number | null;
  convPropostaAceitaPercent: number | null;
};

export type CacView = {
  competencia: string;
  parcelas: ParcelasCac;
  conversao: ConversaoView;
  alocacoes: { produto: string; pesoPercent: number }[];
  resultado: ResultadoCac;
  mensalidadeReferenciaCentavos: number | null;
  /** Propostas ACEITA atualizadas no mês — sugestão, não valor. */
  sugestaoClientesGanhos: number;
};

const Competencia = z.string().refine(competenciaValida, "Competência no formato AAAA-MM.");
const Centavos = z.number().int().min(0).nullable();
const Percent = z.number().int().min(0).max(100).nullable();

function chaveCac(competencia: string) {
  return { tenantId_competencia: { tenantId: SYSTEM_TENANT_ID, competencia } };
}

async function mensalidadeReferencia(): Promise<number | null> {
  const [plano, termo] = await Promise.all([
    database.planoComercial.findUnique({
      where: { tenantId_slug: { tenantId: SYSTEM_TENANT_ID, slug: PLANO_REFERENCIA } },
      select: { precoAssentoCentavos: true, minimoAssentos: true },
    }),
    database.termoDeContrato.findUnique({
      where: { tenantId_slug: { tenantId: SYSTEM_TENANT_ID, slug: TERMO_REFERENCIA } },
      select: { meses: true, descontoPercent: true },
    }),
  ]);
  if (!(plano && termo)) return null;
  return precificarProposta(
    { plano, modulos: [], termo, addOns: [], servicos: [] },
    { assentos: plano.minimoAssentos, descontoPercent: 0 }
  ).liquidoMensalCentavos;
}

function limitesDoMes(competencia: string): { inicio: Date; fim: Date } {
  const [ano, mes] = competencia.split("-").map(Number);
  return { inicio: new Date(Date.UTC(ano, mes - 1, 1)), fim: new Date(Date.UTC(ano, mes, 1)) };
}

async function montar(competencia: string): Promise<CacView> {
  const { inicio, fim } = limitesDoMes(competencia);
  const [lancamentos, periodo, mensalidade, sugestao] = await Promise.all([
    database.lancamentoMensal.findMany({
      where: { tenantId: SYSTEM_TENANT_ID, competencia, conta: { in: [...CONTAS_DO_CAC] } },
      select: { conta: true, valorCentavos: true },
    }),
    database.cacPeriodo.findUnique({
      where: chaveCac(competencia),
      select: {
        id: true, entregaDiagnosticoCentavos: true, clientesGanhos: true,
        convLeadDiscoveryPercent: true, convDiscoveryEvaluationPercent: true,
        convEvaluationPropostaPercent: true, convPropostaAceitaPercent: true,
        alocacoes: { select: { produto: true, pesoPercent: true }, orderBy: { produto: "asc" } },
      },
    }),
    mensalidadeReferencia(),
    database.proposal.count({
      where: { tenantId: SYSTEM_TENANT_ID, status: "ACEITA", atualizadoEm: { gte: inicio, lt: fim } },
    }),
  ]);

  const porConta = new Map(lancamentos.map((l) => [l.conta, l.valorCentavos]));
  const parcelas = {
    ...(Object.fromEntries(CONTAS_DO_CAC.map((c) => [c, porConta.get(c) ?? null])) as Record<ContaDoCac, number | null>),
    entregaDiagnosticoCentavos: periodo?.entregaDiagnosticoCentavos ?? null,
    clientesGanhos: periodo?.clientesGanhos ?? null,
  };
  const conversao: ConversaoView = {
    convLeadDiscoveryPercent: periodo?.convLeadDiscoveryPercent ?? null,
    convDiscoveryEvaluationPercent: periodo?.convDiscoveryEvaluationPercent ?? null,
    convEvaluationPropostaPercent: periodo?.convEvaluationPropostaPercent ?? null,
    convPropostaAceitaPercent: periodo?.convPropostaAceitaPercent ?? null,
  };
  const alocacoes = (periodo?.alocacoes ?? []).map((a) => ({ produto: String(a.produto), pesoPercent: a.pesoPercent }));

  return {
    competencia,
    parcelas,
    conversao,
    alocacoes,
    resultado: calcularCac(parcelas, alocacoes, mensalidade),
    mensalidadeReferenciaCentavos: mensalidade,
    sugestaoClientesGanhos: sugestao,
  };
}

export async function lerCac(input: { competencia: string }): Promise<Result<CacView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await montar(Competencia.parse(input.competencia));
  });
}

async function auditar(staff: { userId: string; name: string | null }, action: string, competencia: string, diff: [string, string, string][]) {
  await logPlatformAudit(database, {
    tenantId: SYSTEM_TENANT_ID,
    actorUserId: staff.userId,
    actorName: staff.name,
    action,
    entityType: "CacPeriodo",
    entityId: competencia,
    target: `CAC ${competencia}`,
    diff,
  });
  revalidatePath(ROTA_CAC);
}

/** Upsert em CacPeriodo com só os campos enviados; devolve o id. */
async function upsertPeriodo(competencia: string, update: Record<string, unknown>): Promise<string> {
  const p = await database.cacPeriodo.upsert({
    where: chaveCac(competencia),
    create: { tenantId: SYSTEM_TENANT_ID, competencia, ...update },
    update,
    select: { id: true },
  });
  return p.id;
}

const ParcelasSchema = z.object({
  competencia: Competencia,
  contas: z.record(z.enum(CONTAS_DO_CAC), Centavos).optional(),
  entregaDiagnosticoCentavos: Centavos.optional(),
  clientesGanhos: z.number().int().min(0).nullable().optional(),
});

export async function salvarParcelas(input: z.infer<typeof ParcelasSchema>): Promise<Result<CacView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, contas, entregaDiagnosticoCentavos, clientesGanhos } = ParcelasSchema.parse(input);
    const diff: [string, string, string][] = [];

    for (const [conta, valor] of Object.entries(contas ?? {})) {
      const where = { tenantId: SYSTEM_TENANT_ID, competencia, conta };
      if (valor === null) {
        await database.lancamentoMensal.deleteMany({ where });
      } else {
        await database.lancamentoMensal.upsert({
          where: { tenantId_competencia_conta: where },
          create: { ...where, valorCentavos: valor },
          update: { valorCentavos: valor },
        });
      }
      diff.push([conta, "", valor === null ? "" : String(valor)]);
    }

    const update: Record<string, unknown> = {};
    if (entregaDiagnosticoCentavos !== undefined) update.entregaDiagnosticoCentavos = entregaDiagnosticoCentavos;
    if (clientesGanhos !== undefined) update.clientesGanhos = clientesGanhos;
    if (Object.keys(update).length > 0) {
      await upsertPeriodo(competencia, update);
      for (const [k, v] of Object.entries(update)) diff.push([k, "", String(v ?? "")]);
    }

    await auditar(staff, "empresa.cac.parcelas", competencia, diff);
    return await montar(competencia);
  });
}

const ConversaoSchema = z.object({
  competencia: Competencia,
  convLeadDiscoveryPercent: Percent.optional(),
  convDiscoveryEvaluationPercent: Percent.optional(),
  convEvaluationPropostaPercent: Percent.optional(),
  convPropostaAceitaPercent: Percent.optional(),
});

export async function salvarConversao(input: z.infer<typeof ConversaoSchema>): Promise<Result<CacView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, ...campos } = ConversaoSchema.parse(input);
    const update = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined));
    await upsertPeriodo(competencia, update);
    await auditar(staff, "empresa.cac.conversao", competencia, Object.entries(update).map(([k, v]) => [k, "", String(v ?? "")]));
    return await montar(competencia);
  });
}

const AlocacaoSchema = z.object({
  competencia: Competencia,
  alocacoes: z.array(z.object({ produto: z.enum(PRODUTOS), pesoPercent: z.number().int().min(0).max(100) })),
});

export async function salvarAlocacao(input: z.infer<typeof AlocacaoSchema>): Promise<Result<CacView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, alocacoes } = AlocacaoSchema.parse(input);
    if (!pesosSomam100(alocacoes)) {
      throw new StaffAuthError("FORBIDDEN", "Os pesos por produto precisam somar 100%.");
    }
    const cacPeriodoId = await upsertPeriodo(competencia, {});
    await database.cacAlocacaoProduto.deleteMany({ where: { cacPeriodoId } });
    await database.cacAlocacaoProduto.createMany({
      data: alocacoes.map((a) => ({ cacPeriodoId, produto: a.produto, pesoPercent: a.pesoPercent })),
    });
    await auditar(staff, "empresa.cac.alocacao", competencia, alocacoes.map((a) => [a.produto, "", `${a.pesoPercent}%`]));
    return await montar(competencia);
  });
}
```

Nota: `planoComercial.findUnique` por `tenantId_slug` e `termoDeContrato.findUnique` por `tenantId_slug` existem porque os dois modelos têm `@@unique([tenantId, slug])` (`comercial.prisma`). `proposal.count` por `atualizadoEm` é a sugestão que a spec §2.4 descreve — `Proposal` não tem `aceitaEm`.

- [ ] **Step 4: Rodar — deve passar; typecheck; commit**

```bash
pnpm --filter backoffice test -- __tests__/empresa-cac-action.test.ts
pnpm --filter backoffice typecheck
/usr/bin/git add apps/backoffice/app/actions/empresa/cac.ts apps/backoffice/__tests__/empresa-cac-action.test.ts
/usr/bin/git commit -m "feat(backoffice): action do CAC lendo as contas 4.x do DRE e o catálogo para o payback"
```

---

### Task 11: Action financeira — DRE e caixa

**Files:**
- Create: `apps/backoffice/app/actions/empresa/financeiro.ts`
- Test: `apps/backoffice/__tests__/empresa-financeiro-action.test.ts`

**Interfaces:**
- Consumes: `calcularDre`, `somarMeses`, `competenciasAte`, `competenciaValida`, `calcularCaixa`, `janelaDe13`, `semanaVazia`, `referenciaPipeline`, `LinhaCalculada`, `SemanaEntrada`, `SemanaCalculada` (Task 6); `PLANO_DE_CONTAS`, `contaValida` (Task 3).
- Produces:
  - `type DreView = { competencias: string[]; linhas: { id: string; rotulo: string; calculada: boolean; valores: (number | null)[]; percents?: (number | null)[]; trimestre: number | null; trimestrePercent?: number | null }[]; contas: { conta: string; nome: string; grupo: number; valores: (number | null)[] }[] }`
  - `lerDre(input: { competenciaFinal: string }): Promise<Result<DreView>>`
  - `salvarLancamento(input: { competencia: string; conta: string; valorCentavos: number | null }): Promise<Result<DreView>>`
  - `type CaixaView = { semanas: SemanaCalculada[]; referenciaPipelineCentavos: number | null; convPropostaAceitaPercent: number | null; totalPropostasAbertasCentavos: number }`
  - `lerCaixa(): Promise<Result<CaixaView>>`
  - `salvarSemana(input: { semanaInicio: string } & Partial<Omit<SemanaEntrada, "semanaInicio">>): Promise<Result<CaixaView>>`
  - `ROTA_FINANCEIRO = "/empresa/financeiro"`

- [ ] **Step 1: Teste**

```ts
// empresa-financeiro-action.test.ts — o DRE devolve três meses e o trimestre;
// o caixa devolve sempre 13 semanas ancoradas na segunda corrente, criando em
// memória as que não existem.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformStaff: vi.fn(),
  assertCanWrite: vi.fn(),
  logPlatformAudit: vi.fn(),
  revalidatePath: vi.fn(),
  lancFindMany: vi.fn(),
  lancUpsert: vi.fn(),
  lancDeleteMany: vi.fn(),
  semanaFindMany: vi.fn(),
  semanaUpsert: vi.fn(),
  cacFindFirst: vi.fn(),
  proposalAggregate: vi.fn(),
}));

vi.mock("@/lib/guard", () => ({
  requirePlatformStaff: mocks.requirePlatformStaff,
  assertCanWrite: mocks.assertCanWrite,
  SYSTEM_TENANT_ID: "system",
  StaffAuthError: class extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@repo/provisioning", () => ({
  logPlatformAudit: mocks.logPlatformAudit,
  ProvisioningError: class extends Error {},
}));
vi.mock("@repo/database", () => ({
  database: {
    lancamentoMensal: { findMany: mocks.lancFindMany, upsert: mocks.lancUpsert, deleteMany: mocks.lancDeleteMany },
    semanaDeCaixa: { findMany: mocks.semanaFindMany, upsert: mocks.semanaUpsert },
    cacPeriodo: { findFirst: mocks.cacFindFirst },
    proposal: { aggregate: mocks.proposalAggregate },
  },
}));

import { lerCaixa, lerDre, salvarLancamento, salvarSemana } from "../app/actions/empresa/financeiro";

const staff = { userId: "u-1", name: "V", email: "v@nebuloz.com", canWrite: true };

function resetar() {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.requirePlatformStaff.mockResolvedValue(staff);
  mocks.lancFindMany.mockResolvedValue([
    { competencia: "2026-08", conta: "1.1", valorCentavos: 100 },
    { competencia: "2026-09", conta: "1.1", valorCentavos: 200 },
  ]);
  mocks.semanaFindMany.mockResolvedValue([]);
  mocks.cacFindFirst.mockResolvedValue({ convPropostaAceitaPercent: 25 });
  mocks.proposalAggregate.mockResolvedValue({ _sum: { totalCentavos: 100_000 } });
}

describe("lerDre", () => {
  beforeEach(resetar);

  it("três competências, uma coluna por mês, lançamentos no lugar e totais nulos onde falta conta", async () => {
    const res = await lerDre({ competenciaFinal: "2026-09" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.competencias).toEqual(["2026-07", "2026-08", "2026-09"]);
    const c11 = res.data.contas.find((c) => c.conta === "1.1");
    expect(c11?.valores).toEqual([null, 100, 200]);
    const bruta = res.data.linhas.find((l) => l.id === "receita-bruta");
    expect(bruta?.valores).toEqual([null, null, null]); // faltam 1.2…1.8
    expect(bruta?.trimestre).toBeNull();
    expect(mocks.lancFindMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "system", competencia: { in: ["2026-07", "2026-08", "2026-09"] },
    });
  });
});

describe("salvarLancamento", () => {
  beforeEach(resetar);

  it("conta desconhecida é recusada", async () => {
    const res = await salvarLancamento({ competencia: "2026-09", conta: "9.9", valorCentavos: 1 });
    expect(res.ok).toBe(false);
    expect(mocks.lancUpsert).not.toHaveBeenCalled();
  });

  it("valor grava por upsert; nulo apaga; devolve o DRE até a competência", async () => {
    await salvarLancamento({ competencia: "2026-09", conta: "1.1", valorCentavos: 300 });
    expect(mocks.lancUpsert.mock.calls[0][0].where).toEqual({
      tenantId_competencia_conta: { tenantId: "system", competencia: "2026-09", conta: "1.1" },
    });
    await salvarLancamento({ competencia: "2026-09", conta: "1.1", valorCentavos: null });
    expect(mocks.lancDeleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/empresa/financeiro");
  });

  it("MEMBER não lança", async () => {
    mocks.assertCanWrite.mockImplementation(() => { throw new Error("Somente leitura"); });
    const res = await salvarLancamento({ competencia: "2026-09", conta: "1.1", valorCentavos: 1 });
    expect(res.ok).toBe(false);
  });
});

describe("lerCaixa", () => {
  beforeEach(() => {
    resetar();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T15:00:00Z")); // sábado → semana 1 = 2026-08-31
  });
  afterEach(() => vi.useRealTimers());

  it("devolve 13 semanas a partir da segunda corrente, com as gravadas no lugar", async () => {
    mocks.semanaFindMany.mockResolvedValue([
      { semanaInicio: new Date("2026-09-07T00:00:00Z"), saldoInicialCentavos: null, recebiveisCentavos: 500,
        contratosAssinadosCentavos: 0, pipelinePonderadoCentavos: 0, saidasPessoalCentavos: 0,
        saidasFornecedoresCentavos: 0, saidasComercialCentavos: 0, saidasImpostosCentavos: 0, saidasOutrasCentavos: 0 },
    ]);
    const res = await lerCaixa();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.semanas).toHaveLength(13);
    expect(res.data.semanas[0].semanaInicio).toBe("2026-08-31");
    expect(res.data.semanas[1].recebiveisCentavos).toBe(500);
    expect(res.data.semanas[0].saldoFinalCentavos).toBeNull(); // sem extrato
    expect(res.data.referenciaPipelineCentavos).toBe(25_000);
    expect(res.data.convPropostaAceitaPercent).toBe(25);
    expect(mocks.proposalAggregate.mock.calls[0][0].where).toMatchObject({
      tenantId: "system", status: { in: ["ENVIADA", "AGUARDANDO_APROVACAO"] },
    });
  });

  it("sem conversão registrada, a referência é nula", async () => {
    mocks.cacFindFirst.mockResolvedValue(null);
    const res = await lerCaixa();
    expect(res.ok && res.data.referenciaPipelineCentavos).toBeNull();
  });
});

describe("salvarSemana", () => {
  beforeEach(resetar);

  it("exige segunda-feira", async () => {
    const res = await salvarSemana({ semanaInicio: "2026-09-08", recebiveisCentavos: 1 });
    expect(res.ok).toBe(false);
  });

  it("upsert pela segunda-feira com só os campos enviados", async () => {
    await salvarSemana({ semanaInicio: "2026-09-07", recebiveisCentavos: 500, saidasPessoalCentavos: null });
    const a = mocks.semanaUpsert.mock.calls[0][0];
    expect(a.where).toEqual({ tenantId_semanaInicio: { tenantId: "system", semanaInicio: new Date("2026-09-07T00:00:00Z") } });
    expect(a.update).toEqual({ recebiveisCentavos: 500, saidasPessoalCentavos: null });
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter backoffice test -- __tests__/empresa-financeiro-action.test.ts
```

- [ ] **Step 3: Implementar**

```ts
"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  calcularCaixa,
  calcularDre,
  competenciasAte,
  competenciaValida,
  janelaDe13,
  type LinhaCalculada,
  referenciaPipeline,
  segundaFeira,
  type SemanaCalculada,
  type SemanaEntrada,
  semanaVazia,
  somarMeses,
} from "@/lib/empresa/financeiro";
import { contaValida, PLANO_DE_CONTAS } from "@/lib/empresa/plano-de-contas";
import { assertCanWrite, requirePlatformStaff, StaffAuthError, SYSTEM_TENANT_ID } from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Base financeira (docs/financeiro): DRE por competência e caixa de 13 semanas.
 * As linhas calculadas nascem de lib/empresa/financeiro; aqui só se lê e
 * grava a entrada.
 */

export const ROTA_FINANCEIRO = "/empresa/financeiro";

const MESES_DRE = 3;
const STATUS_PIPELINE = ["ENVIADA", "AGUARDANDO_APROVACAO"];

const Competencia = z.string().refine(competenciaValida, "Competência no formato AAAA-MM.");

export type DreView = {
  competencias: string[];
  linhas: {
    id: string;
    rotulo: string;
    calculada: boolean;
    valores: (number | null)[];
    percents?: (number | null)[];
    trimestre: number | null;
    trimestrePercent?: number | null;
  }[];
  contas: { conta: string; nome: string; grupo: number; valores: (number | null)[] }[];
};

async function montarDre(competenciaFinal: string): Promise<DreView> {
  const competencias = competenciasAte(competenciaFinal, MESES_DRE);
  const lancamentos = await database.lancamentoMensal.findMany({
    where: { tenantId: SYSTEM_TENANT_ID, competencia: { in: competencias } },
    select: { competencia: true, conta: true, valorCentavos: true },
  });

  const porMes = competencias.map((c) =>
    Object.fromEntries(lancamentos.filter((l) => l.competencia === c).map((l) => [l.conta, l.valorCentavos]))
  );
  const dres: LinhaCalculada[][] = porMes.map(calcularDre);
  const trimestre = somarMeses(dres);

  const linhas = trimestre.map((t, i) => {
    const ehPercent = t.percent !== undefined;
    return {
      id: t.id,
      rotulo: t.rotulo,
      calculada: t.calculada,
      valores: dres.map((d) => d[i]?.valorCentavos ?? null),
      ...(ehPercent ? { percents: dres.map((d) => d[i]?.percent ?? null) } : {}),
      trimestre: t.valorCentavos,
      ...(ehPercent ? { trimestrePercent: t.percent ?? null } : {}),
    };
  });

  const contas = PLANO_DE_CONTAS.map((c) => ({
    conta: c.conta,
    nome: c.nome,
    grupo: c.grupo,
    valores: porMes.map((m) => m[c.conta] ?? null),
  }));

  return { competencias, linhas, contas };
}

export async function lerDre(input: { competenciaFinal: string }): Promise<Result<DreView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await montarDre(Competencia.parse(input.competenciaFinal));
  });
}

const LancamentoSchema = z.object({
  competencia: Competencia,
  conta: z.string().refine(contaValida, "Conta fora do plano de contas."),
  valorCentavos: z.number().int().nullable(),
});

export async function salvarLancamento(input: z.infer<typeof LancamentoSchema>): Promise<Result<DreView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, conta, valorCentavos } = LancamentoSchema.parse(input);
    const where = { tenantId: SYSTEM_TENANT_ID, competencia, conta };

    if (valorCentavos === null) {
      await database.lancamentoMensal.deleteMany({ where });
    } else {
      await database.lancamentoMensal.upsert({
        where: { tenantId_competencia_conta: where },
        create: { ...where, valorCentavos },
        update: { valorCentavos },
      });
    }
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.lancamento",
      entityType: "LancamentoMensal",
      entityId: `${competencia}/${conta}`,
      target: `conta ${conta} · ${competencia}`,
      diff: [[conta, "", valorCentavos === null ? "" : String(valorCentavos)]],
    });
    revalidatePath(ROTA_FINANCEIRO);
    return await montarDre(competencia);
  });
}

// ── Caixa ──────────────────────────────────────────────────────────────────

export type CaixaView = {
  semanas: SemanaCalculada[];
  referenciaPipelineCentavos: number | null;
  convPropostaAceitaPercent: number | null;
  totalPropostasAbertasCentavos: number;
};

const CAMPOS_SEMANA = [
  "saldoInicialCentavos", "recebiveisCentavos", "contratosAssinadosCentavos", "pipelinePonderadoCentavos",
  "saidasPessoalCentavos", "saidasFornecedoresCentavos", "saidasComercialCentavos",
  "saidasImpostosCentavos", "saidasOutrasCentavos",
] as const;

function dataUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

async function montarCaixa(): Promise<CaixaView> {
  const janela = janelaDe13(new Date());
  const [gravadas, cac, propostas] = await Promise.all([
    database.semanaDeCaixa.findMany({
      where: { tenantId: SYSTEM_TENANT_ID, semanaInicio: { gte: dataUtc(janela[0]), lte: dataUtc(janela[12]) } },
      select: { semanaInicio: true, ...Object.fromEntries(CAMPOS_SEMANA.map((c) => [c, true])) },
    }),
    // A conversão mais recente registrada na tela de CAC (caixa-13-semanas.md, regra 4).
    database.cacPeriodo.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, convPropostaAceitaPercent: { not: null } },
      orderBy: { competencia: "desc" },
      select: { convPropostaAceitaPercent: true },
    }),
    database.proposal.aggregate({
      where: { tenantId: SYSTEM_TENANT_ID, status: { in: STATUS_PIPELINE } },
      _sum: { totalCentavos: true },
    }),
  ]);

  const porSemana = new Map(
    (gravadas as (SemanaEntrada & { semanaInicio: Date })[]).map((g) => [
      g.semanaInicio.toISOString().slice(0, 10),
      g,
    ])
  );
  const entradas: SemanaEntrada[] = janela.map((s) => {
    const g = porSemana.get(s);
    return g ? { ...g, semanaInicio: s } : semanaVazia(s);
  });

  const conv = cac?.convPropostaAceitaPercent ?? null;
  const total = propostas._sum.totalCentavos ?? 0;
  return {
    semanas: calcularCaixa(entradas),
    referenciaPipelineCentavos: referenciaPipeline(total, conv),
    convPropostaAceitaPercent: conv,
    totalPropostasAbertasCentavos: total,
  };
}

export async function lerCaixa(): Promise<Result<CaixaView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await montarCaixa();
  });
}

const Centavos = z.number().int().nullable().optional();

const SemanaSchema = z.object({
  semanaInicio: z.iso.date().refine((s) => segundaFeira(dataUtc(s)) === s, "A semana começa numa segunda-feira."),
  saldoInicialCentavos: Centavos,
  recebiveisCentavos: Centavos,
  contratosAssinadosCentavos: Centavos,
  pipelinePonderadoCentavos: Centavos,
  saidasPessoalCentavos: Centavos,
  saidasFornecedoresCentavos: Centavos,
  saidasComercialCentavos: Centavos,
  saidasImpostosCentavos: Centavos,
  saidasOutrasCentavos: Centavos,
});

export async function salvarSemana(input: z.infer<typeof SemanaSchema>): Promise<Result<CaixaView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { semanaInicio, ...campos } = SemanaSchema.parse(input);
    const update = Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined));
    if (Object.keys(update).length === 0) {
      throw new StaffAuthError("FORBIDDEN", "Nada a salvar.");
    }
    const dia = dataUtc(semanaInicio);
    await database.semanaDeCaixa.upsert({
      where: { tenantId_semanaInicio: { tenantId: SYSTEM_TENANT_ID, semanaInicio: dia } },
      create: { tenantId: SYSTEM_TENANT_ID, semanaInicio: dia, ...update },
      update,
    });
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.semana",
      entityType: "SemanaDeCaixa",
      entityId: semanaInicio,
      target: `semana de ${semanaInicio}`,
      diff: Object.entries(update).map(([k, v]) => [k, "", String(v ?? "")]),
    });
    revalidatePath(ROTA_FINANCEIRO);
    return await montarCaixa();
  });
}
```

Nota: `z.iso.date()` é zod 4 (`"2026-09-07"`). O `select` do caixa com `Object.fromEntries` pode exigir `as const`/cast para o Prisma aceitar; se o typecheck reclamar, escrever o `select` com os nove campos literais.

- [ ] **Step 4: Rodar — deve passar; typecheck; commit**

```bash
pnpm --filter backoffice test -- __tests__/empresa-financeiro-action.test.ts
pnpm --filter backoffice typecheck
/usr/bin/git add apps/backoffice/app/actions/empresa/financeiro.ts apps/backoffice/__tests__/empresa-financeiro-action.test.ts
/usr/bin/git commit -m "feat(backoffice): action financeira — DRE de três meses e caixa rolante de 13 semanas"
```

---

### Task 12: Seed dos fornecedores e das perguntas

**Files:**
- Create: `packages/provisioning/src/empresa-nebuloz.ts`
- Create: `apps/app/scripts/seed-empresa-nebuloz.ts`
- Modify: `apps/app/package.json:24` (após `seed:meridian:nebuloz`)
- Test: `packages/provisioning/src/__tests__/empresa-nebuloz.test.ts` (ou onde o pacote já guarda testes — conferir com `ls packages/provisioning/src`)

**Interfaces:**
- Produces: `FORNECEDORES_DPA: FornecedorDpaSeed[]` (18), `PERGUNTAS_AO_PARECER: PerguntaSeed[]` (7), `VERIFICADO_EM = "2026-09-05"`; script `pnpm --filter app seed:empresa:nebuloz`.

- [ ] **Step 1: Teste do dado**

```ts
import { describe, expect, it } from "vitest";
import { FORNECEDORES_DPA, PERGUNTAS_AO_PARECER } from "../empresa-nebuloz";

describe("empresa-nebuloz", () => {
  it("18 fornecedores V-01..V-18, sem repetição, e a contagem do documento", () => {
    expect(FORNECEDORES_DPA.map((f) => f.codigo)).toEqual(
      Array.from({ length: 18 }, (_, i) => `V-${String(i + 1).padStart(2, "0")}`)
    );
    const por = (e: string) => FORNECEDORES_DPA.filter((f) => f.estado === e).length;
    expect(por("EMBUTIDO")).toBe(8);
    expect(por("A_ASSINAR")).toBe(6);
    expect(por("SEM_DOCUMENTO")).toBe(4);
    expect(FORNECEDORES_DPA.filter((f) => f.bloqueiaVenda).map((f) => f.codigo)).toEqual(["V-03", "V-11", "V-14"]);
    expect(FORNECEDORES_DPA.find((f) => f.codigo === "V-07")?.classificacaoProvisoria).toBe(true);
  });

  it("7 perguntas numeradas 1..7 com dono", () => {
    expect(PERGUNTAS_AO_PARECER.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(PERGUNTAS_AO_PARECER.filter((p) => p.donoPapel === "Dono do SLA").map((p) => p.numero)).toEqual([5, 6]);
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

```bash
pnpm --filter @repo/provisioning test -- empresa-nebuloz
```

- [ ] **Step 3: Escrever o dado** — transcrever de `docs/compliance/dpa-fornecedores.md` §1 (estado, região, retenção, transferência, URL de subprocessadores, asterisco) e §3 (ação, dono-papel, bloqueia venda), e a URL do DPA de cada bloco de §2; perguntas de `aviso-de-gravacao.md` §4. Cabeçalho com a proveniência campo a campo, como `charter-nebuloz.ts`.

```ts
// Dado da tela Fornecedores e DPA e da tela Consentimento — evidência de
// docs/compliance/dpa-fornecedores.md (5 set 2026) e
// docs/compliance/aviso-de-gravacao.md §4. Consumido por
// apps/app/scripts/seed-empresa-nebuloz.ts.
//
// Só dados e tipos: sem import de valor de "@repo/database" (server-only).
//
// ── Proveniência ──────────────────────────────────────────────────────────
// codigo / nome        → §1 colunas Código / Fornecedor.
// estado               → §1 coluna DPA: "embutido" → EMBUTIDO, "a assinar" →
//                        A_ASSINAR, "não encontrado" → SEM_DOCUMENTO.
// classificacaoProvisoria → asterisco em §1 (só V-07).
// regiao / retencao / transferencia → §1, literal; "não declarada" e "não
//                        confirmada" viram null (a tela mostra o traço).
// subprocessadoresUrl  → link da coluna Subprocessadores de §1; null em V-17.
// dpaUrl               → primeiro link de DPA/termos do bloco do fornecedor
//                        em §2; null onde §2 diz "nenhum DPA público".
// acaoPendente / donoPapel / bloqueiaVenda → §3; fornecedores fora de §3 têm
//                        acaoPendente null e bloqueiaVenda false.
// verificadoEm         → 2026-09-05 para todos.

export const VERIFICADO_EM = "2026-09-05";

export type FornecedorDpaSeed = {
  codigo: string;
  nome: string;
  estado: "EMBUTIDO" | "A_ASSINAR" | "SEM_DOCUMENTO";
  classificacaoProvisoria?: boolean;
  regiao: string | null;
  retencao: string | null;
  transferencia: string | null;
  dpaUrl: string | null;
  subprocessadoresUrl: string | null;
  acaoPendente: string | null;
  donoPapel: string | null;
  bloqueiaVenda: boolean;
};

export const FORNECEDORES_DPA: FornecedorDpaSeed[] = [
  {
    codigo: "V-01", nome: "Anthropic", estado: "EMBUTIDO",
    regiao: null, retencao: null, transferencia: "SCCs",
    dpaUrl: "https://www.anthropic.com/legal/commercial-terms",
    subprocessadoresUrl: "https://trust.anthropic.com/subprocessors",
    acaoPendente: null, donoPapel: null, bloqueiaVenda: false,
  },
  {
    codigo: "V-02", nome: "OpenAI", estado: "EMBUTIDO",
    regiao: null, retencao: "ZDR sob aprovação", transferencia: null,
    dpaUrl: "https://openai.com/policies/data-processing-addendum/",
    subprocessadoresUrl: "https://openai.com/policies/sub-processor-list/",
    acaoPendente: "Decidir se é rota ativa; se for, pedir ZDR", donoPapel: "Responsável pela entrega", bloqueiaVenda: false,
  },
  {
    codigo: "V-03", nome: "Google (Gemini API)", estado: "EMBUTIDO",
    regiao: null, retencao: "ZDR documentado", transferencia: null,
    dpaUrl: "https://ai.google.dev/gemini-api/terms",
    subprocessadoresUrl: "https://cloud.google.com/terms/subprocessors",
    acaoPendente: "Confirmar que a chave é de plano pago", donoPapel: "Responsável pela entrega", bloqueiaVenda: true,
  },
  // V-04 … V-18: mesma transcrição, linha a linha, de §1 + §2 + §3.
  // V-07 leva `classificacaoProvisoria: true`. V-11 e V-14 levam
  // `bloqueiaVenda: true`. V-17 tem dpaUrl e subprocessadoresUrl null.
];

export type PerguntaSeed = { numero: number; pergunta: string; donoPapel: string };

export const PERGUNTAS_AO_PARECER: PerguntaSeed[] = [
  { numero: 1, pergunta: "A base legal da finalidade 7 do RoPA é consentimento (art. 7º, I) ou legítimo interesse (art. 7º, IX)?", donoPapel: "responsável jurídico" },
  { numero: 2, pergunta: "Se consentimento: o aviso opt-out da §1 satisfaz o \"inequívoca\" do art. 5º, XII?", donoPapel: "responsável jurídico" },
  { numero: 3, pergunta: "Se consentimento: a cláusula da §2 satisfaz o art. 8º, § 1º e § 4º como está redigida?", donoPapel: "responsável jurídico" },
  { numero: 4, pergunta: "STANDING é habilitável?", donoPapel: "responsável jurídico" },
  { numero: 5, pergunta: "Se legítimo interesse: quem redige o teste do art. 10 e o relatório de impacto, e até quando?", donoPapel: "Dono do SLA" },
  { numero: 6, pergunta: "Qual o prazo de retenção da finalidade 7?", donoPapel: "Dono do SLA" },
  { numero: 7, pergunta: "Consentimento colhido de empregado nesta forma é livre?", donoPapel: "responsável jurídico" },
];
```

Os 15 fornecedores omitidos acima **precisam ser escritos por inteiro** no arquivo, um objeto por linha da tabela §1 do documento; o teste do Step 1 falha enquanto faltar um.

- [ ] **Step 4: Rodar o teste do dado — deve passar**

```bash
pnpm --filter @repo/provisioning test -- empresa-nebuloz
```

- [ ] **Step 5: Script de seed** — create-only, tenant `system`

```ts
/**
 * scripts/seed-empresa-nebuloz.ts
 *
 * Semeia as telas Empresa do back-office no tenant `system`:
 *   - FornecedorDpa: 18 linhas de docs/compliance/dpa-fornecedores.md
 *   - PerguntaAoParecer: 7 linhas de docs/compliance/aviso-de-gravacao.md §4
 *
 *   pnpm seed:empresa:nebuloz
 *
 * CREATE-ONLY: `createMany` com `skipDuplicates`. O seed é evidência de 5 set;
 * o que a tela mudou depois (estado, pedido, assinatura, notas) não pode ser
 * sobrescrito por reexecução. Nunca `deleteMany`.
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import {
  FORNECEDORES_DPA,
  PERGUNTAS_AO_PARECER,
  VERIFICADO_EM,
} from "@repo/provisioning/src/empresa-nebuloz";
import { Pool } from "pg";
import { PrismaClient } from "../../../packages/database/generated";

const SYSTEM_TENANT_ID = "system";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  const system = await db.tenant.findUnique({ where: { id: SYSTEM_TENANT_ID }, select: { id: true } });
  if (!system) {
    throw new Error("Tenant system não existe — a migration 20260728020000_system_tenant não rodou.");
  }

  console.log("\n🏢  Empresa → tenant system\n");

  const f = await db.fornecedorDpa.createMany({
    skipDuplicates: true,
    data: FORNECEDORES_DPA.map(({ classificacaoProvisoria, ...v }) => ({
      tenantId: SYSTEM_TENANT_ID,
      ...v,
      classificacaoProvisoria: classificacaoProvisoria ?? false,
      verificadoEm: new Date(`${VERIFICADO_EM}T00:00:00Z`),
    })),
  });
  console.log(`  ✓ fornecedores: ${f.count} criados (${FORNECEDORES_DPA.length - f.count} já existiam)`);

  const p = await db.perguntaAoParecer.createMany({
    skipDuplicates: true,
    data: PERGUNTAS_AO_PARECER.map((q) => ({ tenantId: SYSTEM_TENANT_ID, ...q })),
  });
  console.log(`  ✓ perguntas: ${p.count} criadas (${PERGUNTAS_AO_PARECER.length - p.count} já existiam)`);

  await pool.end();
  console.log("\nConcluído.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Em `apps/app/package.json`, após `"seed:meridian:nebuloz"`:

```json
    "seed:empresa:nebuloz": "tsx scripts/seed-empresa-nebuloz.ts",
```

- [ ] **Step 6: Rodar contra o banco local e conferir**

```bash
pnpm --filter app seed:empresa:nebuloz
pnpm --filter app seed:empresa:nebuloz
```

Esperado: primeira execução `18 criados` / `7 criadas`; segunda `0 criados (18 já existiam)` / `0 criadas (7 já existiam)`.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add packages/provisioning/src/empresa-nebuloz.ts packages/provisioning/src/__tests__/empresa-nebuloz.test.ts apps/app/scripts/seed-empresa-nebuloz.ts apps/app/package.json
/usr/bin/git commit -m "feat(seed): fornecedores DPA e perguntas ao parecer no tenant system, create-only"
```

---

### Task 13: Seção Empresa na navegação e tela de Fornecedores e DPA

**Files:**
- Modify: `apps/backoffice/components/nav.ts` (entre as seções "Comercial" e "Ferramentas")
- Create: `apps/backoffice/app/(staff)/empresa/fornecedores/page.tsx`
- Create: `apps/backoffice/app/(staff)/empresa/fornecedores/inventario.tsx`
- Create: `apps/backoffice/lib/empresa/formato.ts`
- Test: `apps/backoffice/__tests__/empresa-nav.test.ts`

**Interfaces:**
- Consumes: `listarFornecedoresDpa`, `aplicarAcaoDpa`, `exportarAoCharter`, `FornecedorDpaRow` (Task 8); `Contadores` (Task 4); kit `PageHeader`, `SectionCard`, `Badge`, `KpiCard`; componentes `Tabela`, `TableHead`, `TableRow`, `Celula`, `FiltroChips`, `WriteButton`, `Erro`, `INPUT`.
- Produces: `formatarData(iso: string | null): string` (`"—"` quando nulo, `dd/mm/aaaa` em UTC), `ROTULO_ESTADO: Record<EstadoDpa, string>`, `TOM_ESTADO: Record<EstadoDpa, Tone>`.

- [ ] **Step 1: Teste da navegação**

```ts
// empresa-nav.test.ts — a seção Empresa entra entre Comercial e Ferramentas,
// com as quatro rotas implementadas (sem `pendente`).
import { describe, expect, it } from "vitest";
import { BO_NAV, itemDaRota } from "../components/nav";

describe("seção Empresa", () => {
  it("fica entre Comercial e Ferramentas", () => {
    const secoes = BO_NAV.map((s) => s.section);
    expect(secoes.indexOf("Empresa")).toBe(secoes.indexOf("Comercial") + 1);
    expect(secoes.indexOf("Ferramentas")).toBe(secoes.indexOf("Empresa") + 1);
  });

  it("tem as quatro rotas, nenhuma pendente", () => {
    const empresa = BO_NAV.find((s) => s.section === "Empresa");
    expect(empresa?.items.map((i) => i.href)).toEqual([
      "/empresa/fornecedores",
      "/empresa/consentimento",
      "/empresa/cac",
      "/empresa/financeiro",
    ]);
    for (const href of empresa?.items.map((i) => i.href) ?? []) {
      expect(itemDaRota(href)?.pendente).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Rodar — deve falhar; então inserir a seção em `nav.ts`**

```ts
  {
    section: "Empresa",
    items: [
      { href: "/empresa/fornecedores", icon: "shield", label: "Fornecedores e DPA" },
      { href: "/empresa/consentimento", icon: "userCheck", label: "Consentimento" },
      { href: "/empresa/cac", icon: "target", label: "CAC" },
      { href: "/empresa/financeiro", icon: "wallet", label: "Financeiro" },
    ],
  },
```

Rodar de novo: PASS.

- [ ] **Step 3: Helper de formato**

```ts
// apps/backoffice/lib/empresa/formato.ts
import type { EstadoDpa } from "./fornecedores";

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export const ROTULO_ESTADO: Record<EstadoDpa, string> = {
  EMBUTIDO: "Embutido",
  A_ASSINAR: "A assinar",
  ASSINADO: "Assinado",
  SEM_DOCUMENTO: "Sem documento",
};

/** Um sinal quente por tela (canvas de 5 set): só "bloqueia venda" é âmbar;
 *  os estados são azul/neutro/verde. */
export const TOM_ESTADO: Record<EstadoDpa, "blue" | "neutral" | "green"> = {
  EMBUTIDO: "blue",
  A_ASSINAR: "blue",
  ASSINADO: "green",
  SEM_DOCUMENTO: "neutral",
};
```

- [ ] **Step 4: Página (server)**

```tsx
// apps/backoffice/app/(staff)/empresa/fornecedores/page.tsx
import { PageHeader } from "@repo/design-system/cosmos/kit";
import { listarFornecedoresDpa } from "@/app/actions/empresa/fornecedores";
import { requirePlatformStaff } from "@/lib/guard";
import { Inventario } from "./inventario";

export const dynamic = "force-dynamic";

export default async function FornecedoresPage() {
  const [staff, res] = await Promise.all([requirePlatformStaff(), listarFornecedoresDpa()]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Governança · Fornecedores"
        subtitle="Os 18 fornecedores do Charter interno, com o estado real do acordo de tratamento de dados por fonte primária."
        title="DPA dos fornecedores"
      />
      {res.ok ? (
        <Inventario contadores={res.data.contadores} iniciais={res.data.linhas} podeEscrever={staff.canWrite} />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>{res.error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Componente cliente**

```tsx
// apps/backoffice/app/(staff)/empresa/fornecedores/inventario.tsx
"use client";

import { Badge, KpiCard, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  aplicarAcaoDpa,
  exportarAoCharter,
  type FornecedorDpaRow,
} from "@/app/actions/empresa/fornecedores";
import { Erro, INPUT } from "@/components/campo";
import { FiltroChips } from "@/components/filtro-chips";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { WriteButton } from "@/components/write-button";
import type { Contadores } from "@/lib/empresa/fornecedores";
import { formatarData, ROTULO_ESTADO, TOM_ESTADO } from "@/lib/empresa/formato";

/**
 * Inventário de fornecedores com o estado do DPA.
 *
 * As ações da linha são as de lib/empresa/fornecedores — a tela oferece só o
 * que `acoes` lista, e o servidor recusa o resto de novo. "Marcar aceito"
 * pede o link da evidência inline: sem ele, o estado seria afirmação.
 */

const FILTROS = [
  { id: "A_ASSINAR", label: "A assinar" },
  { id: "SEM_DOCUMENTO", label: "Sem documento" },
  { id: "bloqueia", label: "Bloqueiam venda" },
];

const LARGURAS = [
  { id: "cod", largura: "64px" }, { id: "nome", largura: "16%" }, { id: "dpa", largura: "110px" },
  { id: "regiao", largura: "12%" }, { id: "ret", largura: "12%" }, { id: "transf", largura: "11%" },
  { id: "acao", largura: "20%" }, { id: "dono", largura: "12%" }, { id: "venda", largura: "150px" },
];

function LinhaFornecedor({ f, podeEscrever, onAgir }: {
  f: FornecedorDpaRow;
  podeEscrever: boolean;
  onAgir: (codigo: string, acao: "MARCAR_ACEITO" | "REGISTRAR_PEDIDO", evidenciaUrl?: string) => Promise<void>;
}) {
  const [evidencia, setEvidencia] = useState("");
  const [pedindo, setPedindo] = useState(false);
  const podeAceitar = f.acoes.includes("MARCAR_ACEITO");
  const podePedir = f.acoes.includes("REGISTRAR_PEDIDO");

  return (
    <TableRow>
      <Celula><span className="mono" style={{ fontWeight: 700 }}>{f.codigo}</span></Celula>
      <Celula>
        {f.nome}
        {f.dpaUrl ? (
          <a href={f.dpaUrl} rel="noreferrer" style={{ marginLeft: 8, fontSize: "var(--fs-nota)", color: "var(--accent-text)" }} target="_blank">Fonte</a>
        ) : null}
      </Celula>
      <Celula>
        <Badge tone={TOM_ESTADO[f.estado]}>
          {ROTULO_ESTADO[f.estado]}{f.classificacaoProvisoria ? " *" : ""}
        </Badge>
      </Celula>
      <Celula>{f.regiao ?? "—"}</Celula>
      <Celula>{f.retencao ?? "—"}</Celula>
      <Celula>{f.transferencia ?? "—"}</Celula>
      <Celula>
        {f.acaoPendente ?? "—"}
        {f.pedidoEm ? <div style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>pedido em {formatarData(f.pedidoEm)}</div> : null}
        {f.assinadoEm ? <div style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>assinado em {formatarData(f.assinadoEm)}</div> : null}
      </Celula>
      <Celula>{f.donoPapel ?? "—"}</Celula>
      <Celula>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {f.bloqueiaVenda && f.estado !== "ASSINADO" ? <Badge tone="amber">Bloqueia venda</Badge> : null}
          {podeEscrever && podePedir ? (
            <button className="btn" onClick={() => onAgir(f.codigo, "REGISTRAR_PEDIDO")} style={BOTAO} type="button">Registrar pedido</button>
          ) : null}
          {podeEscrever && podeAceitar ? (
            pedindo ? (
              <>
                <input aria-label={`Evidência do DPA de ${f.nome}`} onChange={(e) => setEvidencia(e.target.value)} placeholder="https://… via assinada ou aceite" style={{ ...INPUT, padding: "6px 8px" }} value={evidencia} />
                <button className="btn" onClick={() => onAgir(f.codigo, "MARCAR_ACEITO", evidencia)} style={BOTAO} type="button">Confirmar</button>
              </>
            ) : (
              <button className="btn" onClick={() => setPedindo(true)} style={BOTAO} type="button">Marcar aceito</button>
            )
          ) : null}
        </div>
      </Celula>
    </TableRow>
  );
}

const BOTAO = {
  padding: "4px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--hairline)",
  background: "none", color: "var(--ink-muted)", fontSize: "var(--fs-nota)", fontWeight: 600, cursor: "pointer",
} as const;

export function Inventario({ iniciais, contadores: iniciaisContadores, podeEscrever }: {
  iniciais: FornecedorDpaRow[];
  contadores: Contadores;
  podeEscrever: boolean;
}) {
  const [linhas, setLinhas] = useState(iniciais);
  const [filtro, setFiltro] = useState("all");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const contadores = useMemo(() => ({
    ...iniciaisContadores,
    embutidos: linhas.filter((l) => l.estado === "EMBUTIDO").length,
    aAssinar: linhas.filter((l) => l.estado === "A_ASSINAR").length,
    semDocumento: linhas.filter((l) => l.estado === "SEM_DOCUMENTO").length,
    bloqueiamVenda: linhas.filter((l) => l.bloqueiaVenda && l.estado !== "ASSINADO").length,
  }), [linhas, iniciaisContadores]);

  const visiveis = linhas.filter((l) =>
    filtro === "all" ? true : filtro === "bloqueia" ? l.bloqueiaVenda && l.estado !== "ASSINADO" : l.estado === filtro
  );

  const agir = useCallback(async (codigo: string, acao: "MARCAR_ACEITO" | "REGISTRAR_PEDIDO", evidenciaUrl?: string) => {
    setErro(null);
    const res = await aplicarAcaoDpa({ codigo, acao, evidenciaUrl: evidenciaUrl || undefined });
    if (!res.ok) { setErro(res.error); return; }
    setLinhas((atual) => atual.map((l) => (l.codigo === codigo ? res.data : l)));
  }, []);

  const exportar = useCallback(async () => {
    setErro(null); setAviso(null);
    const res = await exportarAoCharter({ codigos: linhas.map((l) => l.codigo) });
    if (!res.ok) { setErro(res.error); return; }
    setAviso(`${res.data.exportados.length} exportados ao Charter${res.data.semCorrespondente.length ? `; sem correspondente: ${res.data.semCorrespondente.join(", ")}` : ""}.`);
  }, [linhas]);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KpiCard icon="check" label="DPA embutido nos termos" tone="blue" value={contadores.embutidos} />
        <KpiCard icon="edit" label="A aceitar ou assinar" tone="blue" value={contadores.aAssinar} />
        <KpiCard icon="eyeOff" label="Sem documento público" tone="neutral" value={contadores.semDocumento} />
        <KpiCard icon="alert" label="Bloqueiam venda hoje" tone="amber" value={contadores.bloqueiamVenda} />
      </div>

      <SectionCard
        action={<WriteButton canWrite={podeEscrever} onClick={exportar} type="button">Exportar para o Charter</WriteButton>}
        subtitle={`${linhas.length} fornecedores · verificado em ${formatarData(linhas[0]?.verificadoEm ?? null)}`}
        title="Inventário"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FiltroChips onMudar={setFiltro} opcoes={FILTROS} rotuloTodas="Todos" valor={filtro} />
          {erro ? <Erro>{erro}</Erro> : null}
          {aviso ? <p style={{ margin: 0, fontSize: "var(--fs-nota)", color: "var(--ink-muted)" }}>{aviso}</p> : null}
          <Tabela larguras={LARGURAS}>
            <TableHead labels={["Cód.", "Fornecedor", "DPA", "Região", "Retenção", "Transferência", "Ação pendente", "Dono", "Venda"]} />
            <tbody>
              {visiveis.map((f) => <LinhaFornecedor f={f} key={f.codigo} onAgir={agir} podeEscrever={podeEscrever} />)}
            </tbody>
          </Tabela>
        </div>
      </SectionCard>
    </>
  );
}
```

- [ ] **Step 6: Typecheck, lint e conferir no navegador**

```bash
pnpm --filter backoffice typecheck && pnpm check
```

Abrir o preview do back-office (`.claude/launch.json` já tem a entrada do backoffice na porta 3013; usar `preview_start` com esse nome) em `/empresa/fornecedores`, logado como staff ADMIN com 2FA. Esperado: quatro KPIs (8 / 6 / 4 / 3), 18 linhas, filtro "Bloqueiam venda" mostra V-03, V-11, V-14; "Registrar pedido" em V-13 carimba a data; "Marcar aceito" sem link recusa com mensagem. Se o KpiCard exigir `unit` ou renderizar diferente, ajustar props sem mudar a informação.

- [ ] **Step 7: Commit**

```bash
/usr/bin/git add apps/backoffice/components/nav.ts apps/backoffice/__tests__/empresa-nav.test.ts "apps/backoffice/app/(staff)/empresa/fornecedores" apps/backoffice/lib/empresa/formato.ts
/usr/bin/git commit -m "feat(backoffice): seção Empresa na navegação e tela de fornecedores e DPA"
```

---

### Task 14: Tela de Consentimento

**Files:**
- Create: `apps/backoffice/app/(staff)/empresa/consentimento/page.tsx`
- Create: `apps/backoffice/app/(staff)/empresa/consentimento/painel.tsx`

**Interfaces:**
- Consumes: `lerConsentimento`, `salvarDecisao`, `responderPergunta`, `marcarParecer`, `ConsentimentoView` (Task 9); `Campo`, `INPUT`, `Erro`, `BotaoPrimario`, `rotuloSalvar`; `WriteButton`; kit `PageHeader`, `SectionCard`, `Badge`.

- [ ] **Step 1: Página**

```tsx
// apps/backoffice/app/(staff)/empresa/consentimento/page.tsx
import { PageHeader } from "@repo/design-system/cosmos/kit";
import { lerConsentimento } from "@/app/actions/empresa/consentimento";
import { requirePlatformStaff } from "@/lib/guard";
import { Painel } from "./painel";

export const dynamic = "force-dynamic";

export default async function ConsentimentoPage() {
  const [staff, res] = await Promise.all([requirePlatformStaff(), lerConsentimento()]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Compliance · Gravação de reuniões"
        subtitle="O produto garante que alguém afirmou ter consentimento. Isto aqui é o que faz o consentimento existir: o aviso lido na abertura, a cláusula permanente e a base legal que o advogado ainda não escolheu."
        title="Consentimento de gravação"
      />
      {res.ok ? <Painel inicial={res.data} podeEscrever={staff.canWrite} /> : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>{res.error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Painel (cliente)** — três blocos: marcadores + avisos com "Copiar"; base legal + STANDING; perguntas com resposta.

```tsx
// apps/backoffice/app/(staff)/empresa/consentimento/painel.tsx
"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  type ConsentimentoView,
  marcarParecer,
  responderPergunta,
  salvarDecisao,
} from "@/app/actions/empresa/consentimento";
import { BotaoPrimario, Campo, Erro, INPUT, rotuloSalvar } from "@/components/campo";
import { WriteButton } from "@/components/write-button";

const ROTULO_BASE = {
  SEM_DECISAO: "Sem decisão",
  CONSENTIMENTO: "Consentimento — art. 7º, I",
  LEGITIMO_INTERESSE: "Legítimo interesse — art. 7º, IX",
} as const;

const ROTULO_PARECER = { PENDENTE: "Parecer pendente", ENVIADO: "Enviado ao jurídico", RECEBIDO: "Parecer recebido" } as const;

/** Marcador destacado no texto: `[prazo]` em cream — o único sinal quente da
 *  tela, porque é o que não se lê em voz alta vazio. */
function Texto({ texto, abertos }: { texto: string; abertos: string[] }) {
  const partes = texto.split(/(\[[^\]]+\])/g);
  return (
    <p style={{ margin: 0, lineHeight: 1.7, fontSize: "var(--fs-base)" }}>
      {partes.map((p, i) =>
        abertos.includes(p) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: texto estático fatiado
          <mark key={i} style={{ background: "var(--amber-soft)", color: "var(--amber-text)", borderRadius: 4, padding: "0 4px" }}>{p}</mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: texto estático fatiado
          <span key={i}>{p}</span>
        )
      )}
    </p>
  );
}

export function Painel({ inicial, podeEscrever }: { inicial: ConsentimentoView; podeEscrever: boolean }) {
  const [view, setView] = useState(inicial);
  const [form, setForm] = useState({
    ferramenta: inicial.decisao.ferramenta ?? "",
    prazoRetencao: inicial.decisao.prazoRetencao ?? "",
    contatoTitular: inicial.decisao.contatoTitular ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const sujo =
    form.ferramenta !== (view.decisao.ferramenta ?? "") ||
    form.prazoRetencao !== (view.decisao.prazoRetencao ?? "") ||
    form.contatoTitular !== (view.decisao.contatoTitular ?? "");

  const recarregar = useCallback(async () => {
    const { lerConsentimento } = await import("@/app/actions/empresa/consentimento");
    const res = await lerConsentimento();
    if (res.ok) setView(res.data);
  }, []);

  const salvarMarcadores = useCallback(async () => {
    setSalvando(true); setErro(null);
    const res = await salvarDecisao({
      ferramenta: form.ferramenta.trim() || null,
      prazoRetencao: form.prazoRetencao.trim() || null,
      contatoTitular: form.contatoTitular.trim() || null,
    });
    setSalvando(false);
    if (!res.ok) { setErro(res.error); return; }
    await recarregar();
  }, [form, recarregar]);

  const decidir = useCallback(async (patch: Parameters<typeof salvarDecisao>[0]) => {
    setErro(null);
    const res = await salvarDecisao(patch);
    if (!res.ok) { setErro(res.error); return; }
    await recarregar();
  }, [recarregar]);

  const responder = useCallback(async (numero: number, resposta: string) => {
    setErro(null);
    const res = await responderPergunta({ numero, resposta: resposta.trim() || null });
    if (!res.ok) { setErro(res.error); return; }
    await recarregar();
  }, [recarregar]);

  const parecer = useCallback(async (status: "ENVIADO" | "RECEBIDO") => {
    setErro(null);
    const res = await marcarParecer({ status });
    if (!res.ok) { setErro(res.error); return; }
    await recarregar();
  }, [recarregar]);

  const proximoParecer = view.decisao.parecer === "PENDENTE" ? "ENVIADO" : view.decisao.parecer === "ENVIADO" ? "RECEBIDO" : null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Badge tone={view.decisao.parecer === "RECEBIDO" ? "green" : "blue"}>{ROTULO_PARECER[view.decisao.parecer]}</Badge>
        {proximoParecer ? (
          <WriteButton canWrite={podeEscrever} onClick={() => parecer(proximoParecer)} type="button">
            {proximoParecer === "ENVIADO" ? "Enviar ao jurídico" : "Marcar parecer recebido"}
          </WriteButton>
        ) : null}
      </div>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard subtitle={`${view.camposEmAberto.length} campos em aberto${view.camposEmAberto.length ? `: ${view.camposEmAberto.join(" · ")}` : ""}`} title="Aviso lido na abertura">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          <Campo htmlFor="ferramenta" label="[ferramenta]"><input id="ferramenta" onChange={(e) => setForm({ ...form, ferramenta: e.target.value })} readOnly={!podeEscrever} style={INPUT} value={form.ferramenta} /></Campo>
          <Campo hint="Pergunta 6 do parecer" htmlFor="prazo" label="[prazo]"><input id="prazo" onChange={(e) => setForm({ ...form, prazoRetencao: e.target.value })} readOnly={!podeEscrever} style={INPUT} value={form.prazoRetencao} /></Campo>
          <Campo htmlFor="contato" label="[contato]"><input id="contato" onChange={(e) => setForm({ ...form, contatoTitular: e.target.value })} readOnly={!podeEscrever} style={INPUT} value={form.contatoTitular} /></Campo>
        </div>
        {podeEscrever ? (
          <BotaoPrimario disabled={!sujo || salvando} full={false} onClick={salvarMarcadores} type="button">{rotuloSalvar(salvando, sujo)}</BotaoPrimario>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          {view.avisos.map((a) => (
            <div key={a.peca} style={{ border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", padding: 14, gridColumn: a.peca === "CLAUSULA_PT" ? "1 / -1" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <strong style={{ fontSize: "var(--fs-base)" }}>{a.titulo}</strong>
                <button className="btn" onClick={() => navigator.clipboard.writeText(a.texto)} style={{ background: "none", border: "1px solid var(--hairline)", borderRadius: "var(--r-sm)", padding: "2px 8px", fontSize: "var(--fs-nota)", cursor: "pointer", color: "var(--ink-muted)" }} type="button">Copiar</button>
              </div>
              {a.nota ? <div style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)", marginBottom: 8 }}>{a.nota}</div> : null}
              <Texto abertos={a.abertos} texto={a.texto} />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard subtitle="A escolha é do responsável jurídico. Até lá, nenhum tenant habilita o consentimento permanente." title="Base legal">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {(Object.keys(ROTULO_BASE) as (keyof typeof ROTULO_BASE)[]).map((b) => (
            <button aria-pressed={view.decisao.baseLegal === b} className="btn" disabled={!podeEscrever} key={b} onClick={() => decidir({ baseLegal: b })} style={{ padding: "6px 12px", borderRadius: 99, border: `1px solid ${view.decisao.baseLegal === b ? "rgba(var(--accent-rgb),.45)" : "var(--hairline)"}`, background: view.decisao.baseLegal === b ? "var(--accent-soft)" : "var(--surface-2)", fontSize: "var(--fs-nota)", fontWeight: 700, cursor: "pointer" }} type="button">
              {ROTULO_BASE[b]}
            </button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-base)" }}>
          <input checked={view.decisao.standingHabilitavel === true} disabled={!podeEscrever} onChange={(e) => decidir({ standingHabilitavel: e.target.checked })} type="checkbox" />
          STANDING habilitável (pergunta 4) — {view.decisao.standingHabilitavel === null ? "sem resposta" : view.decisao.standingHabilitavel ? "sim" : "não"}
        </label>
      </SectionCard>

      <SectionCard subtitle={`${view.abertas} abertas · ${view.perguntas.length - view.abertas} respondidas`} title="Perguntas ao parecer">
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {view.perguntas.map((p) => (
            <li key={p.numero} style={{ fontSize: "var(--fs-base)" }}>
              <div style={{ marginBottom: 6 }}>{p.pergunta} <span style={{ color: "var(--ink-faint)", fontSize: "var(--fs-nota)" }}>· {p.donoPapel}</span></div>
              <textarea aria-label={`Resposta à pergunta ${p.numero}`} defaultValue={p.resposta ?? ""} onBlur={(e) => { if (podeEscrever && e.target.value !== (p.resposta ?? "")) responder(p.numero, e.target.value); }} readOnly={!podeEscrever} rows={2} style={{ ...INPUT, fontWeight: 500 }} />
            </li>
          ))}
        </ol>
      </SectionCard>
    </>
  );
}
```

- [ ] **Step 3: Typecheck, lint, conferir no navegador e commit**

```bash
pnpm --filter backoffice typecheck && pnpm check
```

No preview em `/empresa/consentimento`: preencher `[ferramenta]` = Fireflies e salvar → os quatro textos mostram "Fireflies" e "2 campos em aberto"; responder a pergunta 6 e sair do campo → contador "6 abertas · 1 respondida"; "Enviar ao jurídico" muda o badge. Se `var(--amber-soft)`/`var(--amber-text)` não existirem no `backoffice-theme.css`, usar os tokens de âmbar que `TONES` do kit exporta.

```bash
/usr/bin/git add "apps/backoffice/app/(staff)/empresa/consentimento"
/usr/bin/git commit -m "feat(backoffice): tela de consentimento de gravação — marcadores, base legal e perguntas ao parecer"
```

---

### Task 15: Tela de CAC

**Files:**
- Create: `apps/backoffice/app/(staff)/empresa/cac/page.tsx`
- Create: `apps/backoffice/app/(staff)/empresa/cac/painel.tsx`

**Interfaces:**
- Consumes: `lerCac`, `salvarParcelas`, `salvarConversao`, `salvarAlocacao`, `CacView` (Task 10); `CONTAS_DO_CAC`, `PLANO_DE_CONTAS` (Task 3); `formatarBRL`, `paraCentavos` de `@/lib/comercial/formato`; `Tabela`/`TableHead`/`TableRow`/`Celula`; `Erro`, `INPUT`, `BotaoPrimario`, `rotuloSalvar`.

- [ ] **Step 1: Página** — a competência vem de `?competencia=AAAA-MM`; sem ela, o mês corrente.

```tsx
// apps/backoffice/app/(staff)/empresa/cac/page.tsx
import { PageHeader } from "@repo/design-system/cosmos/kit";
import { lerCac } from "@/app/actions/empresa/cac";
import { requirePlatformStaff } from "@/lib/guard";
import { Painel } from "./painel";

export const dynamic = "force-dynamic";

function mesCorrente(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CacPage({ searchParams }: { searchParams: Promise<{ competencia?: string }> }) {
  const { competencia } = await searchParams;
  const alvo = competencia ?? mesCorrente();
  const [staff, res] = await Promise.all([requirePlatformStaff(), lerCac({ competencia: alvo })]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Comercial · Custo de aquisição"
        subtitle="Cada parcela com a sua fonte. O resultado só aparece quando todas as linhas do período estiverem preenchidas — sem número, sem chute."
        title="CAC totalmente carregado"
      />
      {res.ok ? <Painel inicial={res.data} podeEscrever={staff.canWrite} /> : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>{res.error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Painel (cliente)**

```tsx
// apps/backoffice/app/(staff)/empresa/cac/painel.tsx
"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  type CacView,
  salvarAlocacao,
  salvarConversao,
  salvarParcelas,
} from "@/app/actions/empresa/cac";
import { BotaoPrimario, Erro, INPUT, rotuloSalvar } from "@/components/campo";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";
import type { ContaDoCac } from "@/lib/empresa/plano-de-contas";

/** As oito parcelas da tela, com "como medir" e fonte de cac-modelo.md §2.
 *  As seis primeiras são contas do DRE; as duas últimas, do CacPeriodo. */
const PARCELAS: { chave: ContaDoCac | "entregaDiagnosticoCentavos" | "clientesGanhos"; rotulo: string; comoMedir: string; fonte: string; dinheiro: boolean }[] = [
  { chave: "4.1", rotulo: "Salários e encargos — vendas", comoMedir: "Folha de quem vende × % do tempo em vendas", fonte: "folha / RH", dinheiro: true },
  { chave: "4.2", rotulo: "Salários e encargos — marketing", comoMedir: "Folha de quem faz marketing × % do tempo", fonte: "folha / RH", dinheiro: true },
  { chave: "4.3", rotulo: "Comissões pagas", comoMedir: "Soma de comissão sobre propostas aceitas", fonte: "contrato", dinheiro: true },
  { chave: "4.4", rotulo: "Ferramentas de vendas e marketing", comoMedir: "Assinaturas ativas: CRM, automação, gravação", fonte: "notas fiscais", dinheiro: true },
  { chave: "4.5", rotulo: "Mídia paga", comoMedir: "Anúncio, evento, patrocínio no período", fonte: "extrato", dinheiro: true },
  { chave: "4.6", rotulo: "Horas de discovery, convertidas e não", comoMedir: "Leads em DISCOVERY × horas por lead × custo-hora carregado", fonte: "funil", dinheiro: true },
  { chave: "entregaDiagnosticoCentavos", rotulo: "Custo de entrega do diagnóstico", comoMedir: "Horas de entrega × custo-hora + ferramentas da entrega", fonte: "delivery", dinheiro: true },
  { chave: "clientesGanhos", rotulo: "Clientes ganhos no período", comoMedir: "Propostas com status ACEITA no período", fonte: "propostas", dinheiro: false },
];

const CONVERSOES: { chave: keyof CacView["conversao"]; rotulo: string }[] = [
  { chave: "convLeadDiscoveryPercent", rotulo: "LEAD → DISCOVERY" },
  { chave: "convDiscoveryEvaluationPercent", rotulo: "DISCOVERY → EVALUATION" },
  { chave: "convEvaluationPropostaPercent", rotulo: "EVALUATION → proposta enviada" },
  { chave: "convPropostaAceitaPercent", rotulo: "proposta enviada → ACEITA" },
];

const PRODUTOS = ["MERIDIAN", "CHARTER", "SCAFFOLD", "COSMOS"] as const;

function valorInicial(v: number | null, dinheiro: boolean): string {
  if (v === null) return "";
  return dinheiro ? (v / 100).toFixed(2).replace(".", ",") : String(v);
}

export function Painel({ inicial, podeEscrever }: { inicial: CacView; podeEscrever: boolean }) {
  const router = useRouter();
  const [view, setView] = useState(inicial);
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(PARCELAS.map((p) => [p.chave, valorInicial(
      p.chave === "entregaDiagnosticoCentavos" || p.chave === "clientesGanhos" ? inicial.parcelas[p.chave] : inicial.parcelas[p.chave],
      p.dinheiro
    )]))
  );
  const [conv, setConv] = useState<Record<string, string>>(
    Object.fromEntries(CONVERSOES.map((c) => [c.chave, inicial.conversao[c.chave] === null ? "" : String(inicial.conversao[c.chave])]))
  );
  const [pesos, setPesos] = useState<Record<string, string>>(
    Object.fromEntries(PRODUTOS.map((p) => [p, String(inicial.alocacoes.find((a) => a.produto === p)?.pesoPercent ?? "")]))
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aplicar = useCallback((res: Awaited<ReturnType<typeof salvarParcelas>>) => {
    if (!res.ok) { setErro(res.error); return; }
    setView(res.data);
  }, []);

  const salvar = useCallback(async () => {
    setSalvando(true); setErro(null);
    const contas: Partial<Record<ContaDoCac, number | null>> = {};
    for (const p of PARCELAS) {
      if (p.chave === "entregaDiagnosticoCentavos" || p.chave === "clientesGanhos") continue;
      contas[p.chave] = form[p.chave].trim() === "" ? null : paraCentavos(form[p.chave]);
    }
    aplicar(await salvarParcelas({
      competencia: view.competencia,
      contas,
      entregaDiagnosticoCentavos: form.entregaDiagnosticoCentavos.trim() === "" ? null : paraCentavos(form.entregaDiagnosticoCentavos),
      clientesGanhos: form.clientesGanhos.trim() === "" ? null : Number.parseInt(form.clientesGanhos, 10),
    }));
    setSalvando(false);
  }, [form, view.competencia, aplicar]);

  const salvarConv = useCallback(async () => {
    setErro(null);
    aplicar(await salvarConversao({
      competencia: view.competencia,
      ...Object.fromEntries(CONVERSOES.map((c) => [c.chave, conv[c.chave].trim() === "" ? null : Number.parseInt(conv[c.chave], 10)])),
    }));
  }, [conv, view.competencia, aplicar]);

  const salvarPesos = useCallback(async () => {
    setErro(null);
    aplicar(await salvarAlocacao({
      competencia: view.competencia,
      alocacoes: PRODUTOS.filter((p) => pesos[p].trim() !== "").map((p) => ({ produto: p, pesoPercent: Number.parseInt(pesos[p], 10) })),
    }));
  }, [pesos, view.competencia, aplicar]);

  const r = view.resultado;
  const faltam = r.total - r.preenchidas;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <label className="mono" htmlFor="competencia" style={{ fontSize: "var(--fs-micro)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Período</label>
        <input id="competencia" onChange={(e) => router.push(`/empresa/cac?competencia=${e.target.value}`)} style={{ ...INPUT, width: 160 }} type="month" value={view.competencia} />
        {podeEscrever ? <BotaoPrimario disabled={salvando} full={false} onClick={salvar} type="button">{rotuloSalvar(salvando, true)}</BotaoPrimario> : null}
      </div>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard subtitle={`${r.preenchidas} de ${r.total} preenchidas`} title="Parcelas do período">
        <Tabela larguras={[{ id: "p", largura: "28%" }, { id: "c", largura: "40%" }, { id: "f", largura: "12%" }, { id: "v", largura: "20%" }]}>
          <TableHead labels={["Parcela", "Como medir", "Fonte", "Valor mensal"]} />
          <tbody>
            {PARCELAS.map((p) => (
              <TableRow key={p.chave}>
                <Celula>{p.rotulo}</Celula>
                <Celula style={{ color: "var(--ink-muted)" }}>{p.comoMedir}</Celula>
                <Celula className="mono">{p.fonte}</Celula>
                <Celula>
                  <input aria-label={p.rotulo} inputMode={p.dinheiro ? "decimal" : "numeric"} onChange={(e) => setForm({ ...form, [p.chave]: e.target.value })} placeholder={p.chave === "clientesGanhos" ? `sugestão: ${view.sugestaoClientesGanhos}` : "R$ —"} readOnly={!podeEscrever} style={{ ...INPUT, textAlign: "right" }} value={form[p.chave]} />
                </Celula>
              </TableRow>
            ))}
          </tbody>
        </Tabela>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SectionCard subtitle="o Meridian é a porta de entrada; o custo dele segue para quem ele puxa" title="Alocação por produto">
          <Tabela larguras={[{ id: "p", largura: "34%" }, { id: "w", largura: "33%" }, { id: "c", largura: "33%" }]}>
            <TableHead labels={["Produto", "Peso", "CAC alocado"]} />
            <tbody>
              {PRODUTOS.map((p) => {
                const alocado = r.porProduto.find((a) => a.produto === p)?.cacCentavos ?? null;
                return (
                  <TableRow key={p}>
                    <Celula>{p}</Celula>
                    <Celula><input aria-label={`Peso ${p}`} inputMode="numeric" onChange={(e) => setPesos({ ...pesos, [p]: e.target.value })} placeholder="— %" readOnly={!podeEscrever} style={{ ...INPUT, width: 90, textAlign: "right" }} value={pesos[p]} /></Celula>
                    <Celula className="mono">{alocado === null ? "R$ —" : formatarBRL(alocado)}</Celula>
                  </TableRow>
                );
              })}
            </tbody>
          </Tabela>
          {podeEscrever ? <div style={{ marginTop: 10 }}><BotaoPrimario full={false} onClick={salvarPesos} type="button">Salvar pesos</BotaoPrimario></div> : null}
        </SectionCard>

        <SectionCard subtitle="Pondera as horas de discovery que não viraram cliente. Lê-se do funil quando houver volume; até lá, entra à mão." title="Conversão do funil">
          {CONVERSOES.map((c) => (
            <div key={c.chave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--hairline)", fontSize: "var(--fs-base)" }}>
              <span className="mono">{c.rotulo}</span>
              <input aria-label={c.rotulo} inputMode="numeric" onChange={(e) => setConv({ ...conv, [c.chave]: e.target.value })} placeholder="— %" readOnly={!podeEscrever} style={{ ...INPUT, width: 90, textAlign: "right" }} value={conv[c.chave]} />
            </div>
          ))}
          {podeEscrever ? <div style={{ marginTop: 10 }}><BotaoPrimario full={false} onClick={salvarConv} type="button">Salvar conversão</BotaoPrimario></div> : null}
        </SectionCard>
      </div>

      <SectionCard title="CAC totalmente carregado" tone={r.cacCentavos === null ? "amber" : "green"}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="mono" style={{ fontSize: 32, fontWeight: 700 }}>{r.cacCentavos === null ? "R$ —" : formatarBRL(r.cacCentavos)}</div>
            <div style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>
              {r.cacCentavos === null ? `Faltam ${faltam} parcelas · sem número não há resultado` : "por cliente ganho no período"}
            </div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{r.paybackMeses === null ? "— meses" : `${String(r.paybackMeses).replace(".", ",")} meses`}</div>
            <div style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>
              Payback contra a mensalidade de referência{view.mensalidadeReferenciaCentavos === null ? " (plano scale/anual ausente no catálogo)" : `: ${formatarBRL(view.mensalidadeReferenciaCentavos)}/mês`}
            </div>
          </div>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: "var(--fs-nota)", color: "var(--ink-muted)" }}>
          O ticket do diagnóstico e o preço do pacote S do Scaffold esperam este resultado. Preencher as parcelas é a decisão; o cálculo é automático.
        </p>
      </SectionCard>
    </>
  );
}
```

- [ ] **Step 3: Typecheck, lint, conferir e commit**

```bash
pnpm --filter backoffice typecheck && pnpm check
```

No preview em `/empresa/cac`: preencher as sete parcelas de dinheiro e 2 clientes → "8 de 8", CAC aparece, payback contra R$ 3.278,00/mês; apagar uma → "7 de 8" e "R$ —"; pesos 40/60 → CAC alocado; pesos 50 → erro "somar 100%". `Celula` não aceita `className` hoje — se o typecheck reclamar, trocar `className="mono"` por `style={{ fontFamily: "var(--mono)" }}` ou envolver em `<span className="mono">`.

```bash
/usr/bin/git add "apps/backoffice/app/(staff)/empresa/cac"
/usr/bin/git commit -m "feat(backoffice): tela de CAC — parcelas, conversão, alocação e resultado só com 8 de 8"
```

---

### Task 16: Tela Financeiro — DRE e caixa

**Files:**
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/page.tsx`
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/dre.tsx`
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/caixa.tsx`

**Interfaces:**
- Consumes: `lerDre`, `salvarLancamento`, `lerCaixa`, `salvarSemana`, `DreView`, `CaixaView` (Task 11); `formatarBRL`, `paraCentavos`; `Tabela` e afins; `Erro`, `INPUT`; kit `PageHeader`, `SectionCard`, `Tabs` (se a assinatura de `Tabs` no kit não couber, usar dois `FiltroChips` com `aba` no estado — o conteúdo não muda).

- [ ] **Step 1: Página** — `?aba=dre|caixa` e `?ate=AAAA-MM`

```tsx
// apps/backoffice/app/(staff)/empresa/financeiro/page.tsx
import { PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { lerCaixa, lerDre } from "@/app/actions/empresa/financeiro";
import { requirePlatformStaff } from "@/lib/guard";
import { Caixa } from "./caixa";
import { Dre } from "./dre";

export const dynamic = "force-dynamic";

function mesCorrente(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ aba?: string; ate?: string }> }) {
  const { aba = "dre", ate } = await searchParams;
  const competenciaFinal = ate ?? mesCorrente();
  const [staff, dre, caixa] = await Promise.all([
    requirePlatformStaff(),
    aba === "dre" ? lerDre({ competenciaFinal }) : null,
    aba === "caixa" ? lerCaixa() : null,
  ]);

  const abaStyle = (ativa: boolean) => ({
    padding: "6px 12px", borderRadius: 99, fontSize: "var(--fs-nota)", fontWeight: 700, textDecoration: "none",
    color: "var(--ink)", background: ativa ? "var(--accent-soft)" : "var(--surface-2)",
    border: `1px solid ${ativa ? "rgba(var(--accent-rgb),.45)" : "var(--hairline)"}`,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Empresa · Base financeira"
        subtitle="Uma frente de receita por produto, serviço separado de assinatura, e o caixa rolante de treze semanas. As linhas calculadas fecham sozinhas; as de entrada são suas."
        title="DRE e caixa"
      />
      <div style={{ display: "flex", gap: 6 }}>
        <Link href="/empresa/financeiro?aba=dre" style={abaStyle(aba === "dre")}>DRE mensal</Link>
        <Link href="/empresa/financeiro?aba=caixa" style={abaStyle(aba === "caixa")}>Caixa 13 semanas</Link>
      </div>
      {dre ? (dre.ok ? <Dre inicial={dre.data} podeEscrever={staff.canWrite} /> : <p style={{ color: "var(--red-text)" }}>{dre.error}</p>) : null}
      {caixa ? (caixa.ok ? <Caixa inicial={caixa.data} podeEscrever={staff.canWrite} /> : <p style={{ color: "var(--red-text)" }}>{caixa.error}</p>) : null}
    </div>
  );
}
```

- [ ] **Step 2: DRE (cliente)** — as contas do plano são inputs (por mês); as linhas agregadas e calculadas são leitura, em duas tabelas: "Plano de contas" (entrada) e "DRE" (resultado).

```tsx
// apps/backoffice/app/(staff)/empresa/financeiro/dre.tsx
"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { type DreView, salvarLancamento } from "@/app/actions/empresa/financeiro";
import { Erro, INPUT } from "@/components/campo";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";

const NOME_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function rotuloMes(c: string): string {
  const [a, m] = c.split("-");
  return `${NOME_MES[Number(m) - 1]} ${a}`;
}
const dinheiro = (v: number | null) => (v === null ? "—" : formatarBRL(v));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`);

export function Dre({ inicial, podeEscrever }: { inicial: DreView; podeEscrever: boolean }) {
  const router = useRouter();
  const [view, setView] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const ultima = view.competencias[view.competencias.length - 1];

  const lancar = useCallback(async (competencia: string, conta: string, texto: string) => {
    setErro(null);
    const res = await salvarLancamento({ competencia, conta, valorCentavos: texto.trim() === "" ? null : paraCentavos(texto) });
    if (!res.ok) { setErro(res.error); return; }
    setView(res.data);
  }, []);

  const larguras = [{ id: "l", largura: "34%" }, ...view.competencias.map((c) => ({ id: c, largura: "16.5%" })), { id: "t", largura: "16.5%" }];
  const cabecalho = ["Linha", ...view.competencias.map(rotuloMes), "Trim."];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <label className="mono" htmlFor="ate" style={{ fontSize: "var(--fs-micro)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Até</label>
        <input id="ate" onChange={(e) => router.push(`/empresa/financeiro?aba=dre&ate=${e.target.value}`)} style={{ ...INPUT, width: 160 }} type="month" value={ultima} />
      </div>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard subtitle="receita por frente · custo de entrega · margem bruta · EBITDA" title="DRE por competência">
        <Tabela larguras={larguras}>
          <TableHead labels={cabecalho} />
          <tbody>
            {view.linhas.map((l) => (
              <TableRow key={l.id}>
                <Celula style={{ fontWeight: l.calculada ? 700 : 500 }}>{l.rotulo}</Celula>
                {(l.percents ?? l.valores).map((v, i) => (
                  <Celula key={view.competencias[i]} style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                    {l.percents ? pct(v) : dinheiro(v)}
                  </Celula>
                ))}
                <Celula style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700 }}>
                  {l.percents ? pct(l.trimestrePercent) : dinheiro(l.trimestre)}
                </Celula>
              </TableRow>
            ))}
          </tbody>
        </Tabela>
      </SectionCard>

      <SectionCard subtitle="uma célula por conta e mês; vazio apaga o lançamento" title="Plano de contas — entrada">
        <Tabela larguras={larguras}>
          <TableHead labels={["Conta", ...view.competencias.map(rotuloMes), ""]} />
          <tbody>
            {view.contas.map((c) => (
              <TableRow key={c.conta}>
                <Celula><span className="mono" style={{ marginRight: 8 }}>{c.conta}</span>{c.nome}</Celula>
                {c.valores.map((v, i) => (
                  <Celula key={view.competencias[i]}>
                    <input aria-label={`${c.nome} ${rotuloMes(view.competencias[i])}`} defaultValue={v === null ? "" : (v / 100).toFixed(2).replace(".", ",")} inputMode="decimal" onBlur={(e) => { if (podeEscrever) lancar(view.competencias[i], c.conta, e.target.value); }} readOnly={!podeEscrever} style={{ ...INPUT, padding: "6px 8px", textAlign: "right" }} />
                  </Celula>
                ))}
                <Celula>{""}</Celula>
              </TableRow>
            ))}
          </tbody>
        </Tabela>
      </SectionCard>
    </>
  );
}
```

- [ ] **Step 3: Caixa (cliente)** — 13 colunas; linhas de entrada com input, linhas calculadas em leitura.

```tsx
// apps/backoffice/app/(staff)/empresa/financeiro/caixa.tsx
"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import { type CaixaView, salvarSemana } from "@/app/actions/empresa/financeiro";
import { Erro, INPUT } from "@/components/campo";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";
import type { SemanaEntrada } from "@/lib/empresa/financeiro";

type CampoSemana = Exclude<keyof SemanaEntrada, "semanaInicio">;

const ENTRADAS: { chave: CampoSemana; rotulo: string }[] = [
  { chave: "recebiveisCentavos", rotulo: "Entradas — recebíveis previstos" },
  { chave: "contratosAssinadosCentavos", rotulo: "Entradas — contratos assinados" },
  { chave: "pipelinePonderadoCentavos", rotulo: "Entradas — pipeline ponderado" },
];
const SAIDAS: { chave: CampoSemana; rotulo: string }[] = [
  { chave: "saidasPessoalCentavos", rotulo: "Saídas — pessoal" },
  { chave: "saidasFornecedoresCentavos", rotulo: "Saídas — fornecedores e ferramentas" },
  { chave: "saidasComercialCentavos", rotulo: "Saídas — comercial" },
  { chave: "saidasImpostosCentavos", rotulo: "Saídas — impostos e obrigações" },
  { chave: "saidasOutrasCentavos", rotulo: "Saídas — outras" },
];

const CEL = { padding: "6px 8px", borderBottom: "1px solid var(--hairline)", fontSize: "var(--fs-nota)", whiteSpace: "nowrap" } as const;
const dinheiro = (v: number | null) => (v === null ? "—" : formatarBRL(v));

export function Caixa({ inicial, podeEscrever }: { inicial: CaixaView; podeEscrever: boolean }) {
  const [view, setView] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);

  const gravar = useCallback(async (semanaInicio: string, chave: CampoSemana, texto: string) => {
    setErro(null);
    const res = await salvarSemana({ semanaInicio, [chave]: texto.trim() === "" ? null : paraCentavos(texto) });
    if (!res.ok) { setErro(res.error); return; }
    setView(res.data);
  }, []);

  const Input = ({ s, chave }: { s: CaixaView["semanas"][number]; chave: CampoSemana }) => (
    <input aria-label={`${chave} ${s.semanaInicio}`} defaultValue={s[chave] === null ? "" : ((s[chave] as number) / 100).toFixed(2).replace(".", ",")} inputMode="decimal" onBlur={(e) => { if (podeEscrever) gravar(s.semanaInicio, chave, e.target.value); }} readOnly={!podeEscrever} style={{ ...INPUT, padding: "4px 6px", width: 96, textAlign: "right", fontSize: "var(--fs-nota)" }} />
  );

  const linhaCalc = (rotulo: string, valor: (s: CaixaView["semanas"][number]) => number | null, forte = false) => (
    <tr>
      <td style={{ ...CEL, fontWeight: forte ? 700 : 500 }}>{rotulo}</td>
      {view.semanas.map((s) => <td key={s.semanaInicio} style={{ ...CEL, textAlign: "right", fontFamily: "var(--mono)", fontWeight: forte ? 700 : 500 }}>{dinheiro(valor(s))}</td>)}
    </tr>
  );
  const linhaInput = (rotulo: string, chave: CampoSemana, soPrimeira = false) => (
    <tr>
      <td style={CEL}>{rotulo}</td>
      {view.semanas.map((s, i) => (
        <td key={s.semanaInicio} style={{ ...CEL, textAlign: "right" }}>
          {soPrimeira && i > 0 ? <span style={{ fontFamily: "var(--mono)" }}>{dinheiro(s.saldoInicialEfetivoCentavos)}</span> : <Input chave={chave} s={s} />}
        </td>
      ))}
    </tr>
  );

  return (
    <SectionCard
      subtitle={`atualizado toda segunda; a semana 1 é sempre a atual · pipeline ponderado de referência: ${view.referenciaPipelineCentavos === null ? "sem taxa de conversão registrada na tela de CAC" : `${formatarBRL(view.referenciaPipelineCentavos)} (${formatarBRL(view.totalPropostasAbertasCentavos)} × ${view.convPropostaAceitaPercent}%)`}`}
      title="Caixa rolante"
    >
      {erro ? <Erro>{erro}</Erro> : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 1500 }}>
          <thead>
            <tr>
              <th style={{ ...CEL, textAlign: "left" }}>Linha</th>
              {view.semanas.map((s, i) => <th key={s.semanaInicio} style={{ ...CEL, textAlign: "right" }} title={s.semanaInicio}>S{i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {linhaInput("Saldo inicial (extrato na S1)", "saldoInicialCentavos", true)}
            {ENTRADAS.map((e) => linhaInput(e.rotulo, e.chave))}
            {linhaCalc("Total de entradas", (s) => s.totalEntradasCentavos, true)}
            {SAIDAS.map((e) => linhaInput(e.rotulo, e.chave))}
            {linhaCalc("Total de saídas", (s) => s.totalSaidasCentavos, true)}
            {linhaCalc("Saldo final", (s) => s.saldoFinalCentavos, true)}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
```

- [ ] **Step 4: Typecheck, lint, conferir e commit**

```bash
pnpm --filter backoffice typecheck && pnpm check
```

No preview: aba DRE com "Até" = mês corrente, lançar 1.1 em dois meses → "Receita de assinatura — Meridian" preenche, "Receita bruta total" segue "—" até todas as contas 1.x existirem; aba Caixa mostra S1..S13 com a data no `title`, saldo de extrato na S1 encadeia até o saldo final. Biome pode pedir que `Input` (componente definido dentro de outro) vire função de módulo — mover para fora aceitando `podeEscrever` e `gravar` como props.

```bash
/usr/bin/git add "apps/backoffice/app/(staff)/empresa/financeiro"
/usr/bin/git commit -m "feat(backoffice): tela financeira — DRE de três meses e caixa rolante de 13 semanas"
```

---

### Task 17: Fronteira cross-tenant nas actions de Empresa

**Files:**
- Modify: `apps/backoffice/__tests__/no-cross-tenant-leak.test.ts`

Só `fornecedores.ts` pode importar `platformDb`/`withTenantDb`, e todos os quatro arquivos precisam citar `SYSTEM_TENANT_ID`. É um teste de fonte, deliberadamente: a promessa da spec §4 é sobre onde o código pode olhar, e um grep é a forma honesta de prová-la.

- [ ] **Step 1: Acrescentar ao arquivo existente**

```ts
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

describe("actions/empresa — só fornecedores.ts atravessa tenants", () => {
  const dir = path.resolve(__dirname, "../app/actions/empresa");
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".ts"));

  it("os quatro arquivos existem", () => {
    expect(arquivos.sort()).toEqual(["cac.ts", "consentimento.ts", "financeiro.ts", "fornecedores.ts"]);
  });

  for (const f of arquivos) {
    const fonte = readFileSync(path.join(dir, f), "utf8");

    it(`${f} filtra pelo tenant system`, () => {
      expect(fonte).toContain("SYSTEM_TENANT_ID");
    });

    it(`${f} ${f === "fornecedores.ts" ? "é o único que" : "não"} importa platformDb/withTenantDb`, () => {
      const atravessa = /platformDb|withTenantDb/.test(fonte);
      expect(atravessa).toBe(f === "fornecedores.ts");
    });
  }
});
```

- [ ] **Step 2: Rodar, commit**

```bash
pnpm --filter backoffice test -- __tests__/no-cross-tenant-leak.test.ts
/usr/bin/git add apps/backoffice/__tests__/no-cross-tenant-leak.test.ts
/usr/bin/git commit -m "test(backoffice): fronteira cross-tenant cobre as actions de Empresa"
```

---

### Task 18: Verificação de ponta a ponta e registro

**Files:**
- Create: `.claude/completions/2026-09-06-telas-empresa.md`
- Modify: `docs/comercial/mapa-de-processo.md` (lista de lacunas: `Proposal.aceitaEm` e `Proposal.previsaoFechamentoEm`, spec §8)

- [ ] **Step 1: Suíte inteira, typecheck geral, lint**

```bash
pnpm --filter backoffice test
pnpm --filter app test -- __tests__/charter/rules.test.ts
pnpm --filter @repo/provisioning test
pnpm --filter backoffice typecheck && pnpm --filter app typecheck && pnpm --filter @repo/database typecheck
pnpm check
```

Esperado: tudo verde. `pnpm check` limpo ou só avisos pré-existentes fora dos arquivos deste plano.

- [ ] **Step 2: Banco local — migration aplicada e seed presente**

```bash
cd packages/database && npx prisma migrate status
```

Esperado: `Database schema is up to date!` com `20260906000000_empresa` na lista. Conferir no banco: `SELECT count(*) FROM "FornecedorDpa"` = 18 e `SELECT count(*) FROM "PerguntaAoParecer"` = 7 (via `docker exec cosmos-e2e-db psql …`).

- [ ] **Step 3: Percurso no navegador** — os quatro caminhos das Tasks 13–16, mais: `Exportar para o Charter` com o tenant `nebuloz` semeado localmente (`pnpm --filter app seed:charter:nebuloz` se ainda não existir) → aviso "18 exportados"; no app do Charter (porta 3012, tenant nebuloz, /charter/vendors) V-01 aparece com DPA marcado e teto Interno se tiver CL-01, Público se não. Capturar um screenshot de cada tela.

- [ ] **Step 4: Lacunas do mapa de processo** — em `docs/comercial/mapa-de-processo.md`, na lista de lacunas, acrescentar:

```markdown
- **`Proposal.aceitaEm`** — a tela de CAC conta "clientes ganhos" por
  `atualizadoEm` das propostas `ACEITA`, que é aproximação: qualquer edição
  posterior muda o mês. Sem timestamp do aceite, o denominador do CAC é
  sugestão, não contagem (spec das telas Empresa, §2.4).
- **`Proposal.previsaoFechamentoEm`** — sem data prevista, o pipeline
  ponderado do caixa de 13 semanas não se distribui por semana sozinho: entra
  à mão, com o total ponderado como referência (spec §2.5).
```

- [ ] **Step 5: Completion e commit final**

```markdown
# 2026-09-06 — Telas Empresa do back-office

Spec: docs/superpowers/specs/2026-09-05-telas-empresa-modelo-design.md
Plano: docs/superpowers/plans/2026-09-05-telas-empresa-modelo.md

Entregue: empresa.prisma (7 tabelas, migration 20260906000000_empresa com
RLS), deriveVendorMaxClass em @repo/provisioning, lib/empresa (plano de
contas, DPA, CAC, DRE/caixa, aviso), quatro actions, seed create-only
(18 fornecedores, 7 perguntas), seção Empresa com quatro telas.

Decisões em execução: [registrar aqui o que divergiu do plano e por quê].
Pendente para produção: build da Vercel aplica a migration; rodar
`seed:empresa:nebuloz` contra produção só com "vai" do usuário.
```

```bash
/usr/bin/git add .claude/completions/2026-09-06-telas-empresa.md docs/comercial/mapa-de-processo.md
/usr/bin/git commit -m "docs: registro da entrega das telas Empresa e lacunas de Proposal no mapa de processo"
```

---

## Fora deste plano (spec §8)

"Reverificar fontes", "Exportar xlsx", pipeline ponderado automático por semana, contagem automática de clientes ganhos, levar `prazoRetencao`/`contatoTitular` aos tenants, e `donoPapel` → pessoa. Cada um é uma tarefa própria quando houver entidade a montante ou dado para exportar.
