# Livro-razão e títulos (D-a) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o valor único por conta e mês por um livro-razão de linhas, com o DRE e o CAC somando as linhas, e acrescentar títulos a pagar e receber cuja baixa gera o lançamento.

**Architecture:** Dois modelos novos em `empresa.prisma` (`Lancamento`, `Titulo`); uma migration que cria as tabelas e copia cada `LancamentoMensal` para uma linha de abertura; um agregador puro que transforma linhas no `LancamentosDoMes` que `calcularDre` já consome, de modo que a matemática do DRE não muda de lugar; actions no padrão `safeAction`; duas abas novas em `/empresa/financeiro`. O DRE e as seis parcelas contábeis do CAC viram leitura, porque o livro-razão passa a ser o único escritor de valor por conta.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (schema multi-arquivo), zod 4, Vitest 4 + jsdom, Biome, tokens do design system do back-office.

**Spec:** [`docs/superpowers/specs/2026-09-06-base-financeira-design.md`](../specs/2026-09-06-base-financeira-design.md) — §1.1, §1.2, §2 (parte do livro), §3 (livro e títulos), §4 (duas abas), §5, §6. Orçamento, assinatura e crédito são o plano D-b e não entram aqui.

## Global Constraints

- Worktree `/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/.claude/worktrees/mapa-pendencias-criticas-803c5f`, branch `claude/telas-empresa-modelo`. Nunca `cd` para o checkout principal. Nunca `git stash`.
- Stage só dos próprios arquivos. NUNCA `pnpm fix` nem `pnpm check` na raiz. Lint só nos arquivos tocados: `../../node_modules/.bin/biome check --write <arquivos>`.
- Teste escopado: `cd apps/backoffice && npx vitest run __tests__/<arquivo>`. `pnpm --filter … test -- <arquivo>` NÃO escopa.
- `/usr/bin/grep` e `/usr/bin/git`. Nenhum implementer despacha subagentes.
- Commits em português, `tipo(escopo): descrição`, sem trailer `Co-Authored-By`.
- Tenant `system` (`SYSTEM_TENANT_ID` de `@/lib/guard`) em toda consulta. O guard `__tests__/no-cross-tenant-leak.test.ts` lista os arquivos de `app/actions/empresa/` por nome e exige `SYSTEM_TENANT_ID` em cada um: arquivo novo entra na lista.
- Toda action passa por `safeAction` + `requirePlatformStaff`; escrita adiciona `assertCanWrite`, `logPlatformAudit`, `revalidatePath("/empresa/financeiro")`. Escrita que toca duas tabelas vai em `$transaction`, com `updateMany` guardado pelo estado lido e `count === 0` tratado como erro.
- Módulo `"use server"` exporta só funções `async` e tipos.
- `lib/` é puro: `import type` apenas; nada de `app/actions` dentro de `lib/`.
- Só tokens CSS. Nenhum hex no JSX. Biome: sem ternário aninhado, `noLeakedRender` pré-calculado, sem componente dentro de componente, complexidade cognitiva em helpers, `useTopLevelRegex`. `Celula` não aceita `className`.
- Regra de nulo do DRE preservada byte a byte: conta sem linha no mês continua sendo `null`, não zero, e contamina os totais. É o que faz a migração ser número por número idêntica (ver Ruling no §"Decisões" abaixo).
- A data de um `Lancamento` é `DateTime @db.Date`; a competência é string `"AAAA-MM"` validada por `competenciaValida` de `lib/empresa/financeiro.ts`. As duas viajam para o cliente como string ISO; nada cruza a fronteira do servidor como `Date` nem como função.
- Verificação de cada task: testes próprios verdes, `npx tsc --noEmit --emitDeclarationOnly false` zero erros em `apps/backoffice`, Biome limpo nos arquivos tocados.

## Decisões tomadas ao planejar

- **O DRE deixa de ser editável.** Uma célula do DRE agora é a soma de várias linhas; digitar nela esconderia a composição, que é o motivo de o livro existir. A célula vira link para a aba Lançamentos filtrada por conta e competência. `salvarLancamento` é removida.
- **O CAC deixa de gravar as contas 4.1–4.6.** `salvarParcelas` continua gravando os campos que não são conta do DRE (`CacPeriodo`); as seis parcelas contábeis viram leitura da soma das linhas, com o mesmo link. Duas telas, um escritor só.
- **`calcularDre` não muda.** O agregador `agregarPorMes` produz o `LancamentosDoMes` que ela já recebe. A prova de que a migração não altera número é estrutural: a função que calcula é a mesma.
- **`sinalDoGrupo` não entra no D-a.** A spec §2 o lista, mas o DRE não usa sinal por grupo — usa estrutura (receita − deduções − custo − despesas), e `valorCentavos` é positivo. Fica para o D-b se o caixa precisar.
- **`Titulo.clienteTenantId` vira `clienteSlug`**, alinhado com `AssinaturaDoTenant` da spec §1.4. Slug e não FK, pelo mesmo motivo de lá. A linha da spec é corrigida no commit do plano.
- **`LancamentoMensal` fica no schema, sem escritor.** A migration copia; nada apaga. A remoção é migration posterior, depois de o DRE bater em produção por um mês (spec §6).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/database/prisma/schema/empresa.prisma` | `Lancamento` e `Titulo`, ao lado de `LancamentoMensal` |
| `packages/database/prisma/migrations/20260910000000_livro_razao_e_titulos/migration.sql` | DDL, cópia de abertura, RLS |
| `apps/backoffice/lib/empresa/livro.ts` | `agregarPorMes`, `totalPorConta`, `situacaoDoTitulo`, `envelhecimento`, tipos e rótulos |
| `apps/backoffice/app/actions/empresa/livro.ts` | CRUD de lançamento |
| `apps/backoffice/app/actions/empresa/titulos.ts` | listar, criar, baixar, cancelar |
| `apps/backoffice/app/actions/empresa/financeiro.ts` | `montarDre` lê o livro; `salvarLancamento` sai |
| `apps/backoffice/app/actions/empresa/cac.ts` | `lerCac` lê o livro; `salvarParcelas` perde `contas` |
| `apps/backoffice/app/(staff)/empresa/financeiro/page.tsx` | duas abas novas |
| `apps/backoffice/app/(staff)/empresa/financeiro/lancamentos.tsx` + `lancamento-dialog.tsx` | aba Lançamentos |
| `apps/backoffice/app/(staff)/empresa/financeiro/titulos.tsx` + `titulo-dialogs.tsx` | aba Títulos |
| `apps/backoffice/app/(staff)/empresa/financeiro/dre.tsx` | células viram link |
| `apps/backoffice/app/(staff)/empresa/cac/painel.tsx` | seis parcelas viram leitura |

---

## Task 1: Schema e migration com cópia de abertura

**Files:**
- Modify: `packages/database/prisma/schema/empresa.prisma`
- Create: `packages/database/prisma/migrations/20260910000000_livro_razao_e_titulos/migration.sql`

**Interfaces:**
- Produces: `database.lancamento`, `database.titulo`.

- [ ] **Step 1: Acrescentar os modelos**

Em `empresa.prisma`, logo depois de `model LancamentoMensal`, acrescentar:

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
  /// Data do fato. Alimenta o caixa, não o DRE.
  data        DateTime @db.Date

  /// Código do plano de contas ("1.1" … "6.3"), validado contra `ContaDoPlano`.
  conta     String
  descricao String
  /// Positivo sempre. O sinal vem da estrutura do DRE, como já vem hoje.
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

  tenant Tenant  @relation("LancamentoSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  titulo Titulo? @relation(fields: [tituloId], references: [id], onDelete: SetNull)

  @@index([tenantId, competencia])
  @@index([tenantId, conta])
}

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

  baixadoEm          DateTime? @db.Date
  /// Competência em que a baixa lançou. Guardada porque pode diferir do mês
  /// da baixa quando se paga uma conta de mês anterior.
  competenciaBaixa   String?
  motivoCancelamento String?

  /// Slug do tenant cliente, quando é um RECEBER de assinatura ou serviço.
  clienteSlug String?

  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  tenant      Tenant       @relation("TituloSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  lancamentos Lancamento[]

  @@index([tenantId, status, vencimento])
  @@index([tenantId, tipo])
}
```

Em `tenant.prisma`, no `model Tenant`, junto das relações `LancamentoMensalSystemTenant` e afins, acrescentar as duas retro-relações:

```prisma
  lancamentos Lancamento[] @relation("LancamentoSystemTenant")
  titulos     Titulo[]     @relation("TituloSystemTenant")
```

- [ ] **Step 2: Validar**

Run: `cd packages/database && npx prisma validate`
Expected: `The schema at prisma/schema is valid 🚀`

- [ ] **Step 3: Gerar o DDL por diff**

```bash
cd packages/database
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script > /tmp/livro.sql
```

Criar `prisma/migrations/20260910000000_livro_razao_e_titulos/migration.sql` com o conteúdo de `/tmp/livro.sql`, conferindo que só há `CREATE TABLE "Lancamento"`, `CREATE TABLE "Titulo"`, seus índices e as FKs (`Lancamento_tenantId_fkey`, `Lancamento_tituloId_fkey`, `Titulo_tenantId_fkey`). Qualquer outro DDL é drift local e sai.

- [ ] **Step 4: Acrescentar a cópia de abertura e o RLS**

Depois das FKs e antes do RLS, a cópia. Cada `LancamentoMensal` vira uma linha datada no primeiro dia da competência:

```sql
-- Cópia de abertura: cada valor mensal vira uma linha do livro-razão, datada
-- no dia 1 da competência. `LancamentoMensal` fica intacto e sem escritor —
-- a remoção é migration posterior, depois de o DRE bater em produção.
INSERT INTO "Lancamento" ("id","tenantId","competencia","data","conta","descricao","valorCentavos","nota","criadoEm","atualizadoEm")
SELECT 'abert_' || "id", "tenantId", "competencia", ("competencia" || '-01')::date, "conta", 'Saldo de abertura (migrado)', "valorCentavos", "nota", now(), now()
FROM "LancamentoMensal";
```

E o bloco RLS, byte a byte no padrão de `20260909000000_mapa_de_processos`:

```sql
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Lancamento',
    'Titulo'
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

A ordem importa: a cópia roda ANTES do `FORCE ROW LEVEL SECURITY`, porque `current_tenant_id()` está vazio durante o `migrate deploy` e o INSERT seria recusado depois do RLS.

- [ ] **Step 5: Aplicar no banco local, gerar o client, provar a cópia**

```bash
cd packages/database
set -a; . ../../apps/app/.env.local; set +a
npx prisma migrate deploy
npx prisma generate --no-hints
```

Depois, provar que a cópia preserva os totais. Script descartável no scratchpad da sessão, com `pg`:

```sql
SELECT
  (SELECT count(*) FROM "LancamentoMensal") AS mensais,
  (SELECT count(*) FROM "Lancamento" WHERE "id" LIKE 'abert_%') AS aberturas,
  (SELECT count(*) FROM (
     SELECT m."competencia", m."conta", m."valorCentavos" AS esperado,
            COALESCE(SUM(l."valorCentavos"), 0) AS obtido
     FROM "LancamentoMensal" m
     LEFT JOIN "Lancamento" l ON l."competencia" = m."competencia" AND l."conta" = m."conta" AND l."tenantId" = m."tenantId"
     GROUP BY m."competencia", m."conta", m."valorCentavos"
     HAVING m."valorCentavos" <> COALESCE(SUM(l."valorCentavos"), 0)
   ) d) AS divergentes;
```

Expected: `mensais = aberturas` e `divergentes = 0`. Se o banco local não tiver `LancamentoMensal`, inserir duas linhas de teste antes de migrar e conferir com elas; dizer no relatório o que foi usado.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema/empresa.prisma packages/database/prisma/schema/tenant.prisma packages/database/prisma/migrations/20260910000000_livro_razao_e_titulos
git commit -m "feat(database): livro-razão e títulos — Lancamento, Titulo e cópia de abertura dos valores mensais"
```

---

## Task 2: Regras puras do livro

**Files:**
- Create: `apps/backoffice/lib/empresa/livro.ts`
- Test: `apps/backoffice/__tests__/empresa-livro.test.ts`

**Interfaces:**
- Consumes: `LancamentosDoMes`, `calcularDre`, `Conta` de `lib/empresa/financeiro.ts` e `lib/empresa/plano-de-contas.ts`.
- Produces: tipos `LinhaDoLivro`, `TituloRow`, `Situacao`, `FaixaDeVencimento`; `agregarPorMes(linhas: Pick<LinhaDoLivro, "competencia" | "conta" | "valorCentavos">[]) → Record<string, LancamentosDoMes>` — recebe o subconjunto de propósito, para o `select` estreito de `montarDre` entrar direto, sem cast; `totalPorConta(linhas) → Record<string, number>`; `situacaoDoTitulo(t, hoje) → Situacao`; `envelhecimento(titulos, hoje) → FaixaDeVencimento[]`; `ROTULO_SITUACAO`, `TOM_SITUACAO`, `ROTULO_TIPO`.

- [ ] **Step 1: Escrever o teste (RED)**

Criar `apps/backoffice/__tests__/empresa-livro.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calcularDre } from "@/lib/empresa/financeiro";
import {
  agregarPorMes,
  envelhecimento,
  type LinhaDoLivro,
  situacaoDoTitulo,
  type TituloRow,
  totalPorConta,
} from "@/lib/empresa/livro";
import type { Conta } from "@/lib/empresa/plano-de-contas";

function linha(over: Partial<LinhaDoLivro> & { conta: string; valorCentavos: number }): LinhaDoLivro {
  return {
    id: over.id ?? `${over.conta}-${over.valorCentavos}`,
    competencia: over.competencia ?? "2026-09",
    data: over.data ?? "2026-09-10",
    conta: over.conta,
    descricao: over.descricao ?? "x",
    valorCentavos: over.valorCentavos,
    contraparte: over.contraparte ?? null,
    documento: over.documento ?? null,
    nota: over.nota ?? null,
    tituloId: over.tituloId ?? null,
  };
}

describe("agregarPorMes", () => {
  it("soma as linhas da mesma conta e competência", () => {
    const r = agregarPorMes([
      linha({ conta: "4.1", valorCentavos: 100 }),
      linha({ conta: "4.1", valorCentavos: 250 }),
      linha({ conta: "1.1", valorCentavos: 1000 }),
    ]);
    expect(r["2026-09"]).toEqual({ "4.1": 350, "1.1": 1000 });
  });

  it("separa competências", () => {
    const r = agregarPorMes([
      linha({ conta: "4.1", valorCentavos: 100, competencia: "2026-08" }),
      linha({ conta: "4.1", valorCentavos: 5, competencia: "2026-09" }),
    ]);
    expect(r["2026-08"]).toEqual({ "4.1": 100 });
    expect(r["2026-09"]).toEqual({ "4.1": 5 });
  });

  it("conta sem linha fica ausente, não zero — é o que preserva o nulo do DRE", () => {
    const r = agregarPorMes([linha({ conta: "1.1", valorCentavos: 10 })]);
    expect(r["2026-09"]["4.1"]).toBeUndefined();
    expect("4.1" in r["2026-09"]).toBe(false);
  });

  it("sem linhas devolve objeto vazio", () => {
    expect(agregarPorMes([])).toEqual({});
  });
});

describe("DRE por linhas dá o mesmo número que o DRE por valor mensal", () => {
  const CONTAS: Conta[] = [
    { conta: "1.1", nome: "Assinaturas", grupo: 1, centroDeCusto: null, ativa: true },
    { conta: "2.1", nome: "Impostos", grupo: 2, centroDeCusto: null, ativa: true },
    { conta: "3.1", nome: "Infra", grupo: 3, centroDeCusto: null, ativa: true },
    { conta: "4.1", nome: "Mídia", grupo: 4, centroDeCusto: "comercial", ativa: true },
    { conta: "5.1", nome: "Time", grupo: 5, centroDeCusto: "produto-engenharia", ativa: true },
    { conta: "6.1", nome: "Contador", grupo: 6, centroDeCusto: "ga", ativa: true },
  ];
  const MENSAL = { "1.1": 100_000, "2.1": 10_000, "3.1": 20_000, "4.1": 15_000, "5.1": 30_000, "6.1": 5_000 };

  it("mesma entrada, mesma saída, linha a linha", () => {
    const porLinhas = agregarPorMes([
      linha({ conta: "1.1", valorCentavos: 60_000 }),
      linha({ conta: "1.1", valorCentavos: 40_000 }),
      linha({ conta: "2.1", valorCentavos: 10_000 }),
      linha({ conta: "3.1", valorCentavos: 20_000 }),
      linha({ conta: "4.1", valorCentavos: 15_000 }),
      linha({ conta: "5.1", valorCentavos: 12_000 }),
      linha({ conta: "5.1", valorCentavos: 18_000 }),
      linha({ conta: "6.1", valorCentavos: 5_000 }),
    ])["2026-09"];
    expect(calcularDre(CONTAS, porLinhas)).toEqual(calcularDre(CONTAS, MENSAL));
  });
});

describe("totalPorConta", () => {
  it("ignora competência e soma tudo por conta", () => {
    expect(
      totalPorConta([
        linha({ conta: "4.1", valorCentavos: 1, competencia: "2026-08" }),
        linha({ conta: "4.1", valorCentavos: 2, competencia: "2026-09" }),
      ])
    ).toEqual({ "4.1": 3 });
  });
});

describe("situacaoDoTitulo", () => {
  const hoje = new Date("2026-09-15T12:00:00Z");
  const t = (over: Partial<TituloRow>): TituloRow => ({
    id: "t1",
    tipo: "PAGAR",
    descricao: "x",
    contraparte: "y",
    conta: "6.1",
    valorCentavos: 100,
    emissao: "2026-09-01",
    vencimento: "2026-09-20",
    status: "ABERTO",
    baixadoEm: null,
    competenciaBaixa: null,
    motivoCancelamento: null,
    clienteSlug: null,
    ...over,
  });

  it("aberto e a vencer", () => {
    expect(situacaoDoTitulo(t({}), hoje)).toBe("ABERTO");
  });
  it("aberto e vencimento passado é VENCIDO", () => {
    expect(situacaoDoTitulo(t({ vencimento: "2026-09-14" }), hoje)).toBe("VENCIDO");
  });
  it("vence hoje ainda não é vencido", () => {
    expect(situacaoDoTitulo(t({ vencimento: "2026-09-15" }), hoje)).toBe("ABERTO");
  });
  it("baixado e cancelado passam direto", () => {
    expect(situacaoDoTitulo(t({ status: "BAIXADO", vencimento: "2026-01-01" }), hoje)).toBe("BAIXADO");
    expect(situacaoDoTitulo(t({ status: "CANCELADO", vencimento: "2026-01-01" }), hoje)).toBe("CANCELADO");
  });
});

describe("envelhecimento", () => {
  const hoje = new Date("2026-09-15T12:00:00Z");
  const t = (vencimento: string, valorCentavos: number, status = "ABERTO"): TituloRow => ({
    id: vencimento + valorCentavos,
    tipo: "PAGAR",
    descricao: "x",
    contraparte: "y",
    conta: "6.1",
    valorCentavos,
    emissao: "2026-01-01",
    vencimento,
    status,
    baixadoEm: null,
    competenciaBaixa: null,
    motivoCancelamento: null,
    clienteSlug: null,
  });

  it("distribui nas cinco faixas e ignora baixado e cancelado", () => {
    const faixas = envelhecimento(
      [
        t("2026-09-30", 10), // a vencer
        t("2026-09-01", 20), // 14 d: 1–30
        t("2026-08-01", 30), // 45 d: 31–60
        t("2026-07-10", 40), // 67 d: 61–90
        t("2026-05-01", 50), // 137 d: 90+
        t("2026-05-01", 999, "BAIXADO"),
        t("2026-05-01", 999, "CANCELADO"),
      ],
      hoje
    );
    expect(faixas.map((f) => [f.id, f.valorCentavos, f.quantidade])).toEqual([
      ["a-vencer", 10, 1],
      ["1-30", 20, 1],
      ["31-60", 30, 1],
      ["61-90", 40, 1],
      ["90-mais", 50, 1],
    ]);
  });

  it("limites: 30 dias é 1–30, 31 é 31–60", () => {
    const faixas = envelhecimento([t("2026-08-16", 1), t("2026-08-15", 2)], hoje);
    expect(faixas.find((f) => f.id === "1-30")?.valorCentavos).toBe(1);
    expect(faixas.find((f) => f.id === "31-60")?.valorCentavos).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/empresa-livro.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Escrever o módulo**

Criar `apps/backoffice/lib/empresa/livro.ts`, puro, com `import type` de `./financeiro` e `./plano-de-contas`. Tipos:

```ts
export type LinhaDoLivro = {
  id: string;
  competencia: string;
  /** ISO "AAAA-MM-DD". */
  data: string;
  conta: string;
  descricao: string;
  valorCentavos: number;
  contraparte: string | null;
  documento: string | null;
  nota: string | null;
  tituloId: string | null;
};

export type TituloRow = {
  id: string;
  tipo: "PAGAR" | "RECEBER";
  descricao: string;
  contraparte: string;
  conta: string;
  valorCentavos: number;
  emissao: string;
  vencimento: string;
  status: "ABERTO" | "BAIXADO" | "CANCELADO";
  baixadoEm: string | null;
  competenciaBaixa: string | null;
  motivoCancelamento: string | null;
  clienteSlug: string | null;
};

export type Situacao = "ABERTO" | "VENCIDO" | "BAIXADO" | "CANCELADO";
export type FaixaDeVencimento = {
  id: "a-vencer" | "1-30" | "31-60" | "61-90" | "90-mais";
  rotulo: string;
  valorCentavos: number;
  quantidade: number;
};
```

`agregarPorMes` recebe `Pick<LinhaDoLivro, "competencia" | "conta" | "valorCentavos">[]` e acumula em `Record<competencia, LancamentosDoMes>`, somando por conta e nunca inicializando conta com zero. `totalPorConta` soma por conta ignorando competência. `situacaoDoTitulo` devolve o status quando não é ABERTO; quando é, compara `vencimento` (dia UTC) com `hoje` truncado a dia UTC: passado estrito é VENCIDO. `envelhecimento` considera só ABERTO, calcula dias de atraso em dias UTC inteiros (`diasEntre` do padrão de `lib/comercial/funil.ts`), e devolve sempre as cinco faixas na ordem, mesmo zeradas. `ROTULO_SITUACAO` = Aberto, Vencido, Baixado, Cancelado; `TOM_SITUACAO` = blue, red, green, neutral; `ROTULO_TIPO` = A pagar, A receber.

- [ ] **Step 4: Ver passar, tipos, lint, commit**

```bash
cd apps/backoffice
npx vitest run __tests__/empresa-livro.test.ts
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write lib/empresa/livro.ts __tests__/empresa-livro.test.ts
cd ../..
git add apps/backoffice/lib/empresa/livro.ts apps/backoffice/__tests__/empresa-livro.test.ts
git commit -m "feat(backoffice): livro-razão — agregador por mês, situação e envelhecimento de título"
```

---

## Task 3: Actions de lançamento e título

**Files:**
- Create: `apps/backoffice/app/actions/empresa/livro.ts`
- Create: `apps/backoffice/app/actions/empresa/titulos.ts`
- Modify: `apps/backoffice/__tests__/no-cross-tenant-leak.test.ts` (lista de arquivos)
- Test: `apps/backoffice/__tests__/empresa-livro-action.test.ts`, `apps/backoffice/__tests__/empresa-titulos-action.test.ts`

**Interfaces:**
- Consumes: `database.lancamento`, `database.titulo` (T1); `LinhaDoLivro`, `TituloRow` (T2); `contaValida`, `competenciaValida`, `IntervaloSchema`/`CAMPOS_INTERVALO`/`REFINE_INTERVALO` de `lib/empresa/periodo.ts`.
- Produces: `listarLancamentos({de, ate, conta?})` → `Result<{ linhas: LinhaDoLivro[]; contas: ContaView[] }>`; `criarLancamento(input)`, `atualizarLancamento(input & {id})`, `excluirLancamento({id})`; `listarTitulos({tipo?})` → `Result<{ titulos: TituloRow[]; contas: ContaView[] }>`; `criarTitulo(input)`; `baixarTitulo({id, data, competencia})`; `cancelarTitulo({id, motivo})`.

- [ ] **Step 1: Atualizar o guard e escrever os testes (RED)**

Em `__tests__/no-cross-tenant-leak.test.ts`, a lista esperada passa a ter seis arquivos: `cac.ts`, `consentimento.ts`, `financeiro.ts`, `fornecedores.ts`, `livro.ts`, `titulos.ts`. O `it` se chama "os seis arquivos existem".

`__tests__/empresa-livro-action.test.ts`, no formato de `__tests__/empresa-financeiro-action.test.ts` (mock de `@repo/database`, `@/lib/guard`, `@repo/provisioning`, `next/cache`). Casos:
1. `listarLancamentos` filtra por `tenantId: SYSTEM_TENANT_ID` e por `competencia in` as competências do intervalo; com `conta`, também por conta.
2. `criarLancamento` recusa conta desativada ou fora do plano com `ok:false`, sem `create`.
3. `criarLancamento` recusa `valorCentavos <= 0`, `competencia` inválida e `data` inválida.
4. `criarLancamento` grava com `tenantId`, `data` como `Date` UTC do ISO, chama `logPlatformAudit` e `revalidatePath("/empresa/financeiro")`.
5. `atualizarLancamento` usa `updateMany` com `{id, tenantId}` e devolve `ok:false` em `count === 0`.
6. `excluirLancamento` de linha com `tituloId` é recusada: "Lançamento veio de um título; cancele o título." — apagar a linha deixaria o título BAIXADO sem fato.
7. MEMBER é recusado nas três escritas e nenhuma chega ao banco.

`__tests__/empresa-titulos-action.test.ts`:
1. `listarTitulos` filtra por tenant e, com `tipo`, por tipo; ordena por vencimento asc.
2. `criarTitulo` recusa conta inválida, `valorCentavos <= 0`, `vencimento < emissao`, `tipo` fora de PAGAR/RECEBER.
3. `baixarTitulo` roda em `$transaction`: `titulo.updateMany` com `{id, tenantId, status: "ABERTO"}` setando `status: "BAIXADO"`, `baixadoEm`, `competenciaBaixa`; depois `lancamento.create` com `tituloId`, `competencia` = a informada (não o mês da data), `data` = a informada, `conta`/`valorCentavos`/`descricao`/`contraparte` do título. Testa os dois `create`/`updateMany` e o payload do lançamento.
4. `baixarTitulo` com `count === 0` (já baixado ou cancelado) devolve `ok:false` e não cria lançamento.
5. `baixarTitulo` recusa `competencia` inválida.
6. `cancelarTitulo` exige `motivo` com 10+ caracteres, `updateMany` guardado por `status: "ABERTO"`, `count === 0` → `ok:false`.
7. MEMBER recusado nas três escritas.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/empresa-livro-action.test.ts __tests__/empresa-titulos-action.test.ts __tests__/no-cross-tenant-leak.test.ts`
Expected: FAIL — módulos não existem; o guard reclama da lista.

- [ ] **Step 3: Escrever as actions**

`app/actions/empresa/livro.ts`, `"use server"`, rota local `const ROTA = "/empresa/financeiro"`. Schema:

```ts
const LancamentoSchema = z.object({
  competencia: z.string().refine(competenciaValida, "Competência no formato AAAA-MM."),
  data: z.iso.date("Data no formato AAAA-MM-DD."),
  conta: z.string().refine(contaValida, "Conta fora do plano de contas."),
  descricao: z.string().trim().min(2, "Descrição com pelo menos 2 caracteres.").max(120, "Descrição com no máximo 120 caracteres."),
  valorCentavos: z.number().int().positive("Valor tem que ser maior que zero."),
  contraparte: z.string().trim().max(80).nullable(),
  documento: z.string().trim().max(60).nullable(),
  nota: z.string().trim().max(500).nullable(),
});
```

`listarLancamentos` recebe `{de, ate, conta?}` validado por `IntervaloSchema` estendido com `conta` opcional; usa `competenciasNoIntervalo` de `periodo.ts` para o `in`; devolve linhas ordenadas por `data desc, criadoEm desc`, com `data` em ISO `AAAA-MM-DD` (`toISOString().slice(0, 10)`), e as contas do plano (`contasDoPlano()` já existe em `financeiro.ts` — exportar de lá ou duplicar duas linhas; exportar). A checagem de conta ativa é a mesma de `salvarLancamento` hoje. `excluirLancamento` lê a linha antes e recusa quando `tituloId !== null`.

`app/actions/empresa/titulos.ts`: mesmo esqueleto. `baixarTitulo`:

```ts
const resultado = await database.$transaction(async (tx) => {
  const baixa = await tx.titulo.updateMany({
    where: { id, tenantId: SYSTEM_TENANT_ID, status: "ABERTO" },
    data: { status: "BAIXADO", baixadoEm: new Date(`${data}T00:00:00Z`), competenciaBaixa: competencia },
  });
  if (baixa.count === 0) {
    throw new StaffAuthError("FORBIDDEN", "Título já baixado ou cancelado.");
  }
  return await tx.lancamento.create({
    data: {
      tenantId: SYSTEM_TENANT_ID,
      competencia,
      data: new Date(`${data}T00:00:00Z`),
      conta: titulo.conta,
      descricao: titulo.descricao,
      valorCentavos: titulo.valorCentavos,
      contraparte: titulo.contraparte,
      tituloId: id,
    },
  });
});
```

onde `titulo` foi lido antes com `findFirst({ where: { id, tenantId: SYSTEM_TENANT_ID } })` — e o `updateMany` guardado por `status: "ABERTO"` é o que fecha a corrida entre a leitura e a escrita. Auditoria com `target` = `${tipo} · ${contraparte} · ${descricao}`, sem a nota.

- [ ] **Step 4: Ver passar, tipos, lint, commit**

```bash
cd apps/backoffice
npx vitest run __tests__/empresa-livro-action.test.ts __tests__/empresa-titulos-action.test.ts __tests__/no-cross-tenant-leak.test.ts
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write app/actions/empresa/livro.ts app/actions/empresa/titulos.ts __tests__/empresa-livro-action.test.ts __tests__/empresa-titulos-action.test.ts __tests__/no-cross-tenant-leak.test.ts
cd ../..
git add apps/backoffice/app/actions/empresa/livro.ts apps/backoffice/app/actions/empresa/titulos.ts apps/backoffice/__tests__/empresa-livro-action.test.ts apps/backoffice/__tests__/empresa-titulos-action.test.ts apps/backoffice/__tests__/no-cross-tenant-leak.test.ts
git commit -m "feat(backoffice): livro-razão e títulos — actions com baixa que gera o lançamento na mesma transação"
```

---

## Task 4: DRE e CAC passam a ler o livro

**Files:**
- Modify: `apps/backoffice/app/actions/empresa/financeiro.ts` (`montarDre`; remover `salvarLancamento` e `LancamentoSchema`; exportar `contasDoPlano`)
- Modify: `apps/backoffice/app/actions/empresa/cac.ts` (`lerCac` lê `lancamento`; `salvarParcelas` perde `contas`)
- Modify: `apps/backoffice/app/(staff)/empresa/financeiro/dre.tsx` (célula vira link)
- Modify: `apps/backoffice/app/(staff)/empresa/cac/painel.tsx` (seis parcelas viram leitura com link)
- Modify: `apps/backoffice/__tests__/empresa-financeiro-action.test.ts`, `apps/backoffice/__tests__/empresa-cac-action.test.ts`

**Interfaces:**
- Consumes: `agregarPorMes` (T2); `database.lancamento` (T1).
- Produces: `DreView` e `CacView` com a mesma forma de hoje, agora vindas do livro. `salvarLancamento` deixa de existir; `salvarParcelas` aceita só os campos de `CacPeriodo`.

- [ ] **Step 1: Ajustar os testes (RED)**

Em `empresa-financeiro-action.test.ts`: os mocks de `lancamentoMensal.findMany` viram `lancamento.findMany` devolvendo linhas (`{competencia, conta, valorCentavos}`); o teste do `lerDre` passa a ter duas linhas na mesma conta e afirma que a célula é a soma; os testes de `salvarLancamento` são removidos. Acrescentar: `lerDre` com `lancamento.findMany` filtrando `tenantId` e `competencia in`.

Em `empresa-cac-action.test.ts`: `lancamentoMensal.findMany` vira `lancamento.findMany` com `conta in CONTAS_DO_CAC`; os casos de `salvarParcelas` que enviavam `contas` são removidos, e um novo afirma que enviar `contas` é recusado pelo schema (`ok:false`), para que ninguém volte a gravar por ali.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/empresa-financeiro-action.test.ts __tests__/empresa-cac-action.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Trocar a origem**

Em `financeiro.ts`, `montarDre`:

```ts
const linhas = await database.lancamento.findMany({
  where: { tenantId: SYSTEM_TENANT_ID, competencia: { in: comps } },
  select: { competencia: true, conta: true, valorCentavos: true },
});
const agregado = agregarPorMes(linhas);
const porMes = comps.map((c) => agregado[c] ?? {});
```

O `select` estreito entra direto porque `agregarPorMes` recebe só os três campos (T2). O resto de `montarDre` não muda. `contasComLancamento` passa a vir das linhas. Remover `salvarLancamento`, `LancamentoSchema` e o import de `contaValida` se ficar órfão. Exportar `contasDoPlano` para a T3 (que já a importa — se a T3 duplicou, remover a cópia agora).

Em `cac.ts`, a leitura em torno da linha 184 passa a somar `lancamento` por conta (`totalPorConta` da T2, ou um `groupBy` do Prisma com `_sum` — o `groupBy` é o caminho lazy e evita trazer linhas). `ParcelasSchema` perde `contas`; a transação perde o ramo que escrevia `lancamentoMensal`; o comentário do topo que diz "escreve LancamentoMensal, não uma cópia" passa a dizer que lê o livro-razão e aponta para a aba Lançamentos.

- [ ] **Step 4: As telas**

`dre.tsx`: o `<input>` por célula vira um `<Link>` para `/empresa/financeiro?aba=lancamentos&de=<primeiro dia>&ate=<último dia>&conta=<conta>`, mostrando o valor formatado ou "—", com `aria-label` igual ao de hoje. Some `onLancar`, `salvarLancamento`, o estado de erro e o `useCallback`. O componente pode deixar de ser client se nada mais precisar de estado; se for o caso, tirar o `"use client"`.

`cac/painel.tsx`: as seis parcelas contábeis (`CONTAS_DO_CAC`) viram célula de leitura com o mesmo link; as demais parcelas continuam editáveis como hoje. O texto de ajuda da seção diz que as seis vêm do livro-razão.

- [ ] **Step 5: Ver passar, tipos, lint, commit**

```bash
cd apps/backoffice
npx vitest run __tests__/empresa-financeiro-action.test.ts __tests__/empresa-cac-action.test.ts __tests__/empresa-financeiro.test.ts __tests__/empresa-cac.test.ts
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write app/actions/empresa/financeiro.ts app/actions/empresa/cac.ts "app/(staff)/empresa/financeiro/dre.tsx" "app/(staff)/empresa/cac/painel.tsx" __tests__/empresa-financeiro-action.test.ts __tests__/empresa-cac-action.test.ts
cd ../..
git add apps/backoffice/app/actions/empresa/financeiro.ts apps/backoffice/app/actions/empresa/cac.ts "apps/backoffice/app/(staff)/empresa/financeiro/dre.tsx" "apps/backoffice/app/(staff)/empresa/cac/painel.tsx" apps/backoffice/__tests__/empresa-financeiro-action.test.ts apps/backoffice/__tests__/empresa-cac-action.test.ts
git commit -m "feat(backoffice): DRE e CAC leem o livro-razão; o valor por conta deixa de ser digitado na célula"
```

---

## Task 5: Aba Lançamentos

**Files:**
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/lancamentos.tsx`
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/lancamento-dialog.tsx`
- Modify: `apps/backoffice/app/(staff)/empresa/financeiro/page.tsx` (aba, leitura, `conta` na URL)
- Test: `apps/backoffice/__tests__/empresa-lancamentos.test.tsx`

**Interfaces:**
- Consumes: `listarLancamentos`, `criarLancamento`, `atualizarLancamento`, `excluirLancamento` (T3); `LinhaDoLivro`, `totalPorConta` (T2); `SeletorDaAba` (existente); `FiltroChips`, `Tabela`/`TableHead`/`TableRow`/`Celula`, `Campo`/`INPUT`/`Erro`/`BotaoPrimario`/`BotaoSecundario`, `ConfirmarAcao`, `WriteButton`, `formatarBRL`, `paraCentavos`.
- Produces: `Lancamentos` (client) e `LancamentoDialog`.

- [ ] **Step 1: Escrever o teste (RED)**

`__tests__/empresa-lancamentos.test.tsx`, jsdom, com `vi.mock("@/app/actions/empresa/livro")`. Fixture de quatro linhas em duas contas e dois centros. Casos:
1. Renderiza as linhas com data, conta, descrição, contraparte e valor formatado, e o total do período.
2. Chip de centro filtra pelas contas daquele centro (usa `centroDeCusto` das contas do payload).
3. Busca por texto filtra por descrição OU contraparte, sem acento e sem caixa.
4. "Novo lançamento" abre o diálogo; "Salvar" desabilitado até competência, data, conta, descrição e valor; com tudo, chama `criarLancamento` com `valorCentavos` em centavos a partir de "1.234,56" e `contraparte: null` quando vazio.
5. Editar uma linha abre o diálogo preenchido e o salvar chama `atualizarLancamento` com o `id`.
6. Excluir confirma em duas etapas e chama `excluirLancamento({id})`; linha com `tituloId` não mostra o botão de excluir e mostra "via título".
7. Com `podeEscrever={false}` não há "Novo lançamento", editar nem excluir.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/empresa-lancamentos.test.tsx`

- [ ] **Step 3: Escrever a aba**

`page.tsx`: `Aba` ganha `"lancamentos"` e `"titulos"`; `abaValida` aceita os dois; `Abas` ganha os dois links, na ordem DRE, Lançamentos, Títulos, Caixa, Plano; `searchParams` ganha `conta`; para a aba lancamentos o padrão de intervalo é o de competência e a leitura é `listarLancamentos({de, ate, conta})`. O `SeletorDaAba` já existe e recebe a aba; ele precisa preservar `conta` na URL ao aplicar um intervalo — estender `SeletorDaAba` com uma prop opcional `extra?: Record<string, string>` que entra na query.

`lancamentos.tsx` (`"use client"`): `useState(inicial)`, `recarregar()` chamando `listarLancamentos` com o intervalo atual; `FiltroChips` de centro (`comercial`, `produto-engenharia`, `ga`, com `ROTULO_CENTRO`) e chip da conta vinda da URL quando houver; input de busca; tabela com as colunas Data, Conta, Descrição, Contraparte, Valor, e ações; rodapé com total do que está visível e, quando há conta filtrada, o total daquela conta. Botão "Novo lançamento" com `WriteButton`. Exclusão com `ConfirmarAcao` presa à linha por `key`.

`lancamento-dialog.tsx`: `Dialog` do design system nos tokens; campos competência (`<input type="month">`), data (`<input type="date">`, padrão hoje), conta (`<select>` das ativas, agrupado por centro no rótulo), descrição, valor em reais, contraparte, documento, nota. Corpo desmonta ao fechar. Erro da action via `Erro` sem fechar.

- [ ] **Step 4: Ver passar, tipos, lint, commit**

```bash
cd apps/backoffice
npx vitest run __tests__/empresa-lancamentos.test.tsx __tests__/seletor-de-periodo.test.tsx
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write "app/(staff)/empresa/financeiro/lancamentos.tsx" "app/(staff)/empresa/financeiro/lancamento-dialog.tsx" "app/(staff)/empresa/financeiro/page.tsx" "app/(staff)/empresa/financeiro/seletor.tsx" __tests__/empresa-lancamentos.test.tsx
cd ../..
git add "apps/backoffice/app/(staff)/empresa/financeiro" apps/backoffice/__tests__/empresa-lancamentos.test.tsx
git commit -m "feat(backoffice): aba Lançamentos — livro-razão por intervalo com filtro, busca e diálogo"
```

---

## Task 6: Aba Títulos

**Files:**
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/titulos.tsx`
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/titulo-dialogs.tsx`
- Modify: `apps/backoffice/app/(staff)/empresa/financeiro/page.tsx` (leitura da aba)
- Test: `apps/backoffice/__tests__/empresa-titulos.test.tsx`

**Interfaces:**
- Consumes: `listarTitulos`, `criarTitulo`, `baixarTitulo`, `cancelarTitulo` (T3); `situacaoDoTitulo`, `envelhecimento`, `ROTULO_SITUACAO`, `TOM_SITUACAO`, `ROTULO_TIPO` (T2).
- Produces: `Titulos` (client), `NovoTituloDialog`, `BaixarDialog`, `CancelarDialog`.

- [ ] **Step 1: Escrever o teste (RED)**

`__tests__/empresa-titulos.test.tsx`, jsdom, `vi.mock("@/app/actions/empresa/titulos")`, relógio congelado com `vi.setSystemTime(new Date("2026-09-15T12:00:00Z"))`. Casos:
1. Duas listas, A pagar e A receber, cada uma com seus títulos; o cabeçalho mostra o envelhecimento com os totais por faixa.
2. Chips de situação (Abertos, Vencidos, Baixados, Cancelados) filtram; vencido aparece com o badge vermelho.
3. "Novo título": "Salvar" desabilitado até tipo, descrição, contraparte, conta, valor, emissão e vencimento; vencimento antes da emissão mantém desabilitado com aviso; com tudo, chama `criarTitulo` com centavos.
4. "Baixar": abre com data = hoje e competência = mês corrente; mudar a data para um mês diferente da competência mostra o aviso "Data e competência em meses diferentes"; confirmar chama `baixarTitulo({id, data, competencia})`.
5. "Cancelar": exige motivo com 10+ caracteres e confirma em duas etapas; chama `cancelarTitulo({id, motivo})`.
6. Título BAIXADO ou CANCELADO não mostra Baixar nem Cancelar.
7. `podeEscrever={false}` esconde as três escritas.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/empresa-titulos.test.tsx`

- [ ] **Step 3: Escrever a aba**

`page.tsx`: para `aba === "titulos"` lê `listarTitulos()` (sem intervalo; título é lista viva) e não renderiza o seletor de período. `titulos.tsx`: estado, `recarregar()`, envelhecimento no topo em cinco cartões pequenos (valor e quantidade), chips de situação, duas `SectionCard` (A pagar, A receber) com tabela Vencimento, Contraparte, Descrição, Conta, Valor, Situação, ações. `titulo-dialogs.tsx`: os três diálogos, corpo desmontado ao fechar, erro via `Erro`.

- [ ] **Step 4: Ver passar, tipos, lint, commit**

```bash
cd apps/backoffice
npx vitest run __tests__/empresa-titulos.test.tsx __tests__/empresa-lancamentos.test.tsx
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write "app/(staff)/empresa/financeiro/titulos.tsx" "app/(staff)/empresa/financeiro/titulo-dialogs.tsx" "app/(staff)/empresa/financeiro/page.tsx" __tests__/empresa-titulos.test.tsx
cd ../..
git add "apps/backoffice/app/(staff)/empresa/financeiro" apps/backoffice/__tests__/empresa-titulos.test.tsx
git commit -m "feat(backoffice): aba Títulos — a pagar e a receber, envelhecimento, baixa e cancelamento"
```

---

## Task 7: Verificação e registro

**Files:**
- Create: `.claude/completions/2026-09-06-livro-razao-e-titulos.md`
- Modify: `docs/financeiro/dre-modelo.md` (nota de origem) — se o arquivo não existir, `docs/financeiro/caixa-13-semanas.md` recebe a nota e o relatório diz o desvio
- Modify: `docs/runbooks/charter-em-producao.md` NÃO; criar `docs/runbooks/livro-razao-em-producao.md` com a verificação do §6

- [ ] **Step 1: Todas as suítes que a branch encosta**

```bash
cd apps/backoffice && npx vitest run
cd ../app && NODE_ENV=test npx vitest run
cd ../../packages/database && npx vitest run
cd ../provisioning && npx vitest run
```
Expected: tudo verde. A suíte do `apps/app` é obrigatória: é lá que vive o guard de chave única por tenant que já derrubou um push. Relatar os números reais.

- [ ] **Step 2: Tipos nos quatro pacotes**

`npx tsc --noEmit --emitDeclarationOnly false` em `apps/backoffice`, `apps/app`, `packages/database`, `packages/provisioning`. Zero erros.

- [ ] **Step 3: Migration no banco local**

```bash
cd packages/database
set -a; . ../../apps/app/.env.local; set +a
npx prisma migrate status
```
Expected: `Database schema is up to date!`. Repetir a consulta de divergência do T1 Step 5: `divergentes = 0`.

- [ ] **Step 4: Runbook de produção**

`docs/runbooks/livro-razao-em-producao.md`: a ordem (push → migration pelo build → conferir a linha `Applying migration 20260910000000_livro_razao_e_titulos` no log de build da Vercel → abrir `/empresa/financeiro?aba=dre` e comparar o mês corrente com o número anterior ao deploy), a consulta SQL de divergência para o SQL Editor do Supabase (a mesma do T1, é leitura), e o que fazer se divergir: nada apaga, `LancamentoMensal` continua lá, e a diferença aponta a conta e a competência.

- [ ] **Step 5: Completion**

`.claude/completions/2026-09-06-livro-razao-e-titulos.md` no formato de `2026-09-06-mapa-de-processos.md`: o que entrou por task com os commits, as decisões da seção "Decisões tomadas ao planejar" e as do ledger, os números da verificação, o que falta em produção, e o ponytail — o que foi cortado (DRE editável, escrita do CAC nas seis contas, `sinalDoGrupo`) e por quê.

- [ ] **Step 6: Commit**

```bash
git add .claude/completions/2026-09-06-livro-razao-e-titulos.md docs/runbooks/livro-razao-em-producao.md docs/financeiro
git commit -m "docs: registro do plano D-a — livro-razão e títulos"
```

---

## Produção

1. Push. A Vercel aplica `20260910000000_livro_razao_e_titulos`, que cria as tabelas e copia cada `LancamentoMensal` para uma linha de abertura.
2. Conferir `Applying migration` no log de build. Sem essa linha, nada rodou.
3. Abrir o DRE do mês corrente e comparar com o número de antes do deploy. Se bater, a migração foi bem. Se não bater, rodar a consulta de divergência do runbook: ela aponta a conta e a competência, e `LancamentoMensal` continua intacto para auditar.
4. Semear nada.
