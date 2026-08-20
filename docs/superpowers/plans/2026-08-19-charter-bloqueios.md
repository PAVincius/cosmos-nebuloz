# Charter — os dois bloqueios do mapa de conformidade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar caller às duas peças que o PR #56 deixou inertes — versionamento de conjunto de exigências e vínculo de política — de modo que o mapa de conformidade pare de exibir selo verde apoiado em evidência zero.

**Architecture:** O bloqueio do versionamento é dividido pela fronteira de RLS que já existe: `CharterCoverage` tem `FORCE ROW LEVEL SECURITY` e o seed conecta sem contexto de tenant, então **o seed publica a norma** (cria conjunto global com `supersedesId`) e **o app adota** (transporta cobertura sob `withTenantDb`). O bloqueio do vínculo vira uma mudança de contrato na evidência: `POLICY_LINK` passa a reportar cobertura com denominador em vez de contagem crua, e ganha uma tela de vínculo em lote.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.9, Prisma 7 + PostgreSQL, Vitest + Testing Library, Biome (ultracite), pnpm + Turborepo.

## Global Constraints

- Spec de origem: `docs/superpowers/specs/2026-08-19-charter-bloqueios-design.md`. Em divergência, o spec vence.
- Toda action nova segue o padrão da casa: `requireCharterPermissionContext(perm)` ou `requireCharterContext()` → `withTenantDb(tenantId, fn)` → `logCharterAudit(db, ctx, …)` na mesma transação → `Result<T>` via `safeAction`.
- `safeAction` e `Result` moram em `apps/app/app/actions/_base.ts`. `GovernanceError`, `logCharterAudit` e `CharterEntity` moram em `apps/app/app/(charter)/actions/_shared.ts`.
- Violação de regra de negócio usa `GovernanceError(rule, message)` — nunca `throw new Error`.
- Leitura de conjunto de exigências **sempre** filtra `OR: [{ tenantId: ctx.tenantId }, { tenantId: null }]`. `CharterRequirementSet` e `CharterRequirement` não têm policy de RLS; esse filtro é a única defesa.
- **Não** aninhar `withTenantDb` dentro de `withTenantDb`: custa duas conexões do pool por request e tem forma de deadlock.
- Telas cliente buscam via `useCharterData(useCallback(() => action(), []))`. `revalidatePath` **não** atualiza essas telas.
- Verificação de cada task roda de dentro de `apps/app` com os binários locais: `./node_modules/.bin/vitest run <arquivo>` e `./node_modules/.bin/tsc --noEmit`. O `pnpm run test` da raiz passa pelo cache do Turbo e pode replicar log antigo.
- Testes de `packages/database` rodam de dentro de `packages/database`: `./node_modules/.bin/vitest run scripts/__tests__/<arquivo>`.
- Commits em português, formato conventional commits, **sem** trailer de atribuição.
- Rodar `./node_modules/.bin/biome check --write <arquivos>` antes de cada commit.

---

### Task 1: Seed recusa reescrever exigência de versão já publicada

Hoje `upsertCorpus` faz `charterRequirement.upsert` com `update: { citacao, resumo, texto, categoria }`. Se alguém edita o texto de uma exigência em `CORPORA` sem subir `versao`, o seed reescreve a exigência **por baixo de vereditos já dados**, sem aviso. Esta task transforma isso em erro.

A comparação é só sobre `resumo` e `texto` — os campos que mudam a obrigação. `citacao` e `categoria` continuam podendo ser corrigidos no lugar: mudar o formato da referência ou reclassificar a área não altera o que a exigência exige, e forçar versão nova para isso viraria burocracia que alguém contornaria.

**Files:**
- Modify: `packages/database/scripts/seed-regulacao.mts`
- Test: `packages/database/scripts/__tests__/seed-regulacao.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `upsertCorpus(seedDb, corpus)` passa a poder lançar `Error` com mensagem começando em `` `${codigo} mudou de texto na versão` ``.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `packages/database/scripts/__tests__/seed-regulacao.test.ts`:

```ts
it("recusa reescrever exigência cujo resumo mudou numa versão já publicada", async () => {
  const db = {
    charterRequirementSet: {
      findFirst: vi.fn().mockResolvedValue({ id: "set-existente" }),
      update: vi.fn().mockResolvedValue({ id: "set-existente" }),
      create: vi.fn(),
    },
    charterRequirement: {
      findMany: vi.fn().mockResolvedValue([
        { codigo: "1.1", resumo: "Resumo ANTIGO", texto: null },
      ]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  await expect(upsertCorpus(db as never, corpus)).rejects.toThrow(
    /1\.1 mudou de texto na versão "1"/
  );
  expect(db.charterRequirement.upsert).not.toHaveBeenCalled();
});

it("aceita citacao diferente sem exigir versão nova — não muda a obrigação", async () => {
  const db = {
    charterRequirementSet: {
      findFirst: vi.fn().mockResolvedValue({ id: "set-existente" }),
      update: vi.fn().mockResolvedValue({ id: "set-existente" }),
      create: vi.fn(),
    },
    charterRequirement: {
      findMany: vi.fn().mockResolvedValue([
        { codigo: "1.1", resumo: "Resumo", texto: null },
      ]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  const count = await upsertCorpus(db as never, {
    ...corpus,
    requisitos: [
      { codigo: "1.1", citacao: "Art. 1º (redação nova)", resumo: "Resumo" },
    ],
  });

  expect(count).toBe(1);
  expect(db.charterRequirement.upsert).toHaveBeenCalledTimes(1);
});

it("exigência nova numa versão existente entra sem erro", async () => {
  const db = {
    charterRequirementSet: {
      findFirst: vi.fn().mockResolvedValue({ id: "set-existente" }),
      update: vi.fn().mockResolvedValue({ id: "set-existente" }),
      create: vi.fn(),
    },
    charterRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  const count = await upsertCorpus(db as never, corpus);

  expect(count).toBe(1);
});
```

Os dois testes que já existem no arquivo passam `db` sem `charterRequirement.findMany`. Acrescentar `findMany: vi.fn().mockResolvedValue([])` ao stub dos dois, senão eles quebram quando a implementação passar a chamar essa leitura.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd packages/database && ./node_modules/.bin/vitest run scripts/__tests__/seed-regulacao.test.ts
```

Esperado: FAIL. O primeiro teste novo falha com "promise resolved instead of rejecting"; os dois testes antigos falham com `db.charterRequirement.findMany is not a function` só depois do Step 3 — por ora passam.

- [ ] **Step 3: Implementar**

Em `packages/database/scripts/seed-regulacao.mts`, dentro de `upsertCorpus`, **entre** o bloco que resolve `set` e o `for` que faz o upsert dos requisitos:

```ts
  // Exigência publicada não se reescreve. `resumo` e `texto` são o que muda a
  // obrigação; mudá-los sob um veredito já dado converte "o cliente respondeu
  // isto" em "o cliente respondeu outra coisa", sem que ninguém veja. `citacao`
  // e `categoria` ficam de fora de propósito: corrigir o formato da referência
  // ou reclassificar a área não altera o que a exigência exige.
  const publicadas = await seedDb.charterRequirement.findMany({
    where: { setId: set.id },
    select: { codigo: true, resumo: true, texto: true },
  });
  const publicadasPorCodigo = new Map(publicadas.map((p) => [p.codigo, p]));

  for (const req of corpus.requisitos) {
    const anterior = publicadasPorCodigo.get(req.codigo);
    if (!anterior) {
      continue;
    }
    const mudou =
      anterior.resumo !== req.resumo ||
      (anterior.texto ?? null) !== (req.texto ?? null);
    if (mudou) {
      throw new Error(
        `${req.codigo} mudou de texto na versão "${corpus.versao}" de ` +
          `"${corpus.nome}", que já está publicada. Exigência publicada não ` +
          "se reescreve: suba `versao` em CORPORA e rode o seed de novo."
      );
    }
  }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd packages/database && ./node_modules/.bin/vitest run scripts/__tests__/seed-regulacao.test.ts
```

Esperado: PASS, todos.

- [ ] **Step 5: Commit**

```bash
./node_modules/.bin/biome check --write packages/database/scripts/seed-regulacao.mts packages/database/scripts/__tests__/seed-regulacao.test.ts
git add packages/database/scripts/seed-regulacao.mts packages/database/scripts/__tests__/seed-regulacao.test.ts
git commit -m "fix(charter): seed recusa reescrever exigência de versão publicada"
```

---

### Task 2: Seed cria a versão nova ligada à anterior

Hoje, subir `versao` em `CORPORA` cria um conjunto **solto**: sem `supersedesId`, sem relação nenhuma com a versão anterior. O tenant passa a ver v1 (com os vereditos dele) e v2 (vazio) lado a lado, sem nada dizendo que um substitui o outro. Esta task grava a aresta.

**Files:**
- Modify: `packages/database/scripts/seed-regulacao.mts`
- Test: `packages/database/scripts/__tests__/seed-regulacao.test.ts`

**Interfaces:**
- Consumes: `upsertCorpus(seedDb, corpus)` da Task 1.
- Produces: conjuntos criados por `upsertCorpus` passam a ter `supersedesId` preenchido quando existe versão anterior global com o mesmo `nome`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it("versão nova nasce ligada à anterior por supersedesId", async () => {
  const db = {
    charterRequirementSet: {
      findFirst: vi
        .fn()
        // 1ª chamada: procura (nome, versao) — não existe, é versão nova
        .mockResolvedValueOnce(null)
        // 2ª chamada: procura a versão anterior mais recente do mesmo nome
        .mockResolvedValueOnce({ id: "set-v1" }),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "set-v2" }),
    },
    charterRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  await upsertCorpus(db as never, { ...corpus, versao: "2" });

  expect(db.charterRequirementSet.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ supersedesId: "set-v1", versao: "2" }),
    })
  );
});

it("corpus inédito nasce sem supersedesId", async () => {
  const db = {
    charterRequirementSet: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "set-novo" }),
    },
    charterRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };

  await upsertCorpus(db as never, corpus);

  expect(db.charterRequirementSet.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ supersedesId: null }),
    })
  );
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd packages/database && ./node_modules/.bin/vitest run scripts/__tests__/seed-regulacao.test.ts
```

Esperado: FAIL com `supersedesId` ausente do objeto passado a `create`.

- [ ] **Step 3: Implementar**

Em `upsertCorpus`, substituir o bloco que monta `setData` e decide entre `update` e `create` por:

```ts
  // Versão nova de um corpus que já existe: a aresta para a anterior é o que
  // permite ao tenant adotar a v2 carregando os vereditos da v1. Sem ela o
  // conjunto novo nasce órfão e o trabalho humano de responder o corpus
  // aparece como perdido.
  const anteriorGlobal = existing
    ? null
    : await seedDb.charterRequirementSet.findFirst({
        where: { nome: corpus.nome, tenantId: null },
        orderBy: { importadoEm: "desc" },
        select: { id: true },
      });

  const setData = {
    tenantId: null,
    nome: corpus.nome,
    origem: corpus.origem,
    editor: corpus.editor,
    jurisdicao: corpus.jurisdicao,
    licenca: corpus.licenca,
    versao: corpus.versao,
    notas: corpus.notas,
  };
  const set = existing
    ? await seedDb.charterRequirementSet.update({
        where: { id: existing.id },
        data: setData,
        select: { id: true },
      })
    : await seedDb.charterRequirementSet.create({
        data: { ...setData, supersedesId: anteriorGlobal?.id ?? null },
        select: { id: true },
      });
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd packages/database && ./node_modules/.bin/vitest run scripts/__tests__/seed-regulacao.test.ts
```

Esperado: PASS, todos.

- [ ] **Step 5: Commit**

```bash
./node_modules/.bin/biome check --write packages/database/scripts/seed-regulacao.mts packages/database/scripts/__tests__/seed-regulacao.test.ts
git add packages/database/scripts/seed-regulacao.mts packages/database/scripts/__tests__/seed-regulacao.test.ts
git commit -m "feat(charter): seed liga versão nova de regulação à anterior"
```

---

### Task 3: Extrair o transporte de cobertura para helper compartilhado

`publishSetVersion` já contém o algoritmo de transporte de cobertura (`compliance.ts:267-326`). A Task 4 precisa do mesmo algoritmo. Duplicá-lo garantiria que as duas cópias divergissem na primeira correção.

Esta task é **extração pura, sem mudança de comportamento**: os testes de `publishSetVersion` que já existem passam antes e depois, sem edição.

**Files:**
- Create: `apps/app/lib/charter/coverage-transfer.ts`
- Modify: `apps/app/app/(charter)/actions/compliance.ts:267-326`
- Test: `apps/app/__tests__/charter/coverage-transfer.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:

```ts
export type CoberturaStatus =
  | "ATENDE" | "PARCIAL" | "NAO_ATENDE"
  | "SEM_VEREDITO" | "REVISAR" | "NAO_APLICAVEL";

export type CoberturaAnterior = {
  requirementId: string;
  status: CoberturaStatus;
  comentario: string | null;
  capabilityId: string | null;
};

export type LinhaTransportada = {
  tenantId: string;
  requirementId: string;
  status: CoberturaStatus;
  comentario: string | null;
  capabilityId: string | null;
};

export function planejarTransporte(input: {
  tenantId: string;
  coberturas: CoberturaAnterior[];
  idAnteriorParaCodigo: Map<string, string>;
  novoPorCodigo: Map<string, { id: string }>;
  codigosMudados: Set<string>;
}): LinhaTransportada[];
```

Função pura: recebe o que já foi lido do banco e devolve as linhas a inserir. Não abre query nenhuma — é o que a torna testável sem stub de Prisma.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/charter/coverage-transfer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planejarTransporte } from "@/lib/charter/coverage-transfer";

const base = {
  tenantId: "t1",
  idAnteriorParaCodigo: new Map([
    ["req-antigo-a", "A-1"],
    ["req-antigo-b", "B-1"],
  ]),
  novoPorCodigo: new Map([
    ["A-1", { id: "req-novo-a" }],
    ["B-1", { id: "req-novo-b" }],
  ]),
};

describe("planejarTransporte", () => {
  it("preserva o veredito quando o código não mudou de texto", () => {
    const linhas = planejarTransporte({
      ...base,
      codigosMudados: new Set(),
      coberturas: [
        {
          requirementId: "req-antigo-a",
          status: "ATENDE",
          comentario: "ok",
          capabilityId: "POLICY_LINK",
        },
      ],
    });

    expect(linhas).toEqual([
      {
        tenantId: "t1",
        requirementId: "req-novo-a",
        status: "ATENDE",
        comentario: "ok",
        capabilityId: "POLICY_LINK",
      },
    ]);
  });

  it("marca REVISAR só no código cujo texto mudou", () => {
    const linhas = planejarTransporte({
      ...base,
      codigosMudados: new Set(["A-1"]),
      coberturas: [
        { requirementId: "req-antigo-a", status: "ATENDE", comentario: null, capabilityId: null },
        { requirementId: "req-antigo-b", status: "ATENDE", comentario: null, capabilityId: null },
      ],
    });

    expect(linhas.find((l) => l.requirementId === "req-novo-a")?.status).toBe("REVISAR");
    expect(linhas.find((l) => l.requirementId === "req-novo-b")?.status).toBe("ATENDE");
  });

  it("descarta cobertura de código que sumiu da versão nova", () => {
    const linhas = planejarTransporte({
      ...base,
      novoPorCodigo: new Map([["A-1", { id: "req-novo-a" }]]),
      codigosMudados: new Set(),
      coberturas: [
        { requirementId: "req-antigo-b", status: "ATENDE", comentario: null, capabilityId: null },
      ],
    });

    expect(linhas).toEqual([]);
  });

  it("ignora cobertura cujo requisito não pertence ao conjunto anterior", () => {
    const linhas = planejarTransporte({
      ...base,
      codigosMudados: new Set(),
      coberturas: [
        { requirementId: "req-de-outro-conjunto", status: "ATENDE", comentario: null, capabilityId: null },
      ],
    });

    expect(linhas).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/coverage-transfer.test.ts
```

Esperado: FAIL com "Failed to resolve import @/lib/charter/coverage-transfer".

- [ ] **Step 3: Criar o helper**

Criar `apps/app/lib/charter/coverage-transfer.ts`:

```ts
/**
 * Transporte de cobertura entre duas versões de um conjunto de exigências.
 *
 * Os requisitos da versão nova são linhas com ids novos, e `getComplianceMap`
 * busca cobertura por id de requisito sem nunca percorrer `supersedesId` — sem
 * transportar, todo veredito (inclusive o que não mudou) some da vista no
 * instante seguinte à publicação.
 *
 * Função pura de propósito: recebe o que já foi lido do banco e devolve as
 * linhas a inserir. Quem chama abre as queries e a transação; aqui não há I/O,
 * o que torna a regra testável sem stub de Prisma.
 */

export type CoberturaStatus =
  | "ATENDE"
  | "PARCIAL"
  | "NAO_ATENDE"
  | "SEM_VEREDITO"
  | "REVISAR"
  | "NAO_APLICAVEL";

export type CoberturaAnterior = {
  requirementId: string;
  status: CoberturaStatus;
  comentario: string | null;
  capabilityId: string | null;
};

export type LinhaTransportada = {
  tenantId: string;
  requirementId: string;
  status: CoberturaStatus;
  comentario: string | null;
  capabilityId: string | null;
};

export function planejarTransporte(input: {
  tenantId: string;
  coberturas: CoberturaAnterior[];
  idAnteriorParaCodigo: Map<string, string>;
  novoPorCodigo: Map<string, { id: string }>;
  codigosMudados: Set<string>;
}): LinhaTransportada[] {
  const linhas: LinhaTransportada[] = [];

  for (const cobertura of input.coberturas) {
    const codigo = input.idAnteriorParaCodigo.get(cobertura.requirementId);
    if (!codigo) {
      continue;
    }
    // Código removido: a cobertura não tem para onde ir. Fica intocada no
    // conjunto antigo e só entra na contagem de removidas.
    const novoRequisito = input.novoPorCodigo.get(codigo);
    if (!novoRequisito) {
      continue;
    }
    linhas.push({
      tenantId: input.tenantId,
      requirementId: novoRequisito.id,
      status: input.codigosMudados.has(codigo) ? "REVISAR" : cobertura.status,
      comentario: cobertura.comentario,
      capabilityId: cobertura.capabilityId,
    });
  }

  return linhas;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/coverage-transfer.test.ts
```

Esperado: PASS, 4 testes.

- [ ] **Step 5: Trocar o bloco duplicado em `publishSetVersion`**

Em `apps/app/app/(charter)/actions/compliance.ts`, substituir o bloco das linhas 272-322 (de `const oldIdToCode = new Map(` até o fechamento do `if (paraTransportar.length > 0) { … }`) por:

```ts
      const oldIdToCode = new Map(
        oldRequisitos.map((anterior) => [anterior.id, anterior.codigo])
      );
      const oldCoverages = await db.charterCoverage.findMany({
        where: {
          tenantId: ctx.tenantId,
          requirementId: { in: oldRequisitos.map((anterior) => anterior.id) },
        },
      });

      const paraTransportar = planejarTransporte({
        tenantId: ctx.tenantId,
        coberturas: oldCoverages,
        idAnteriorParaCodigo: oldIdToCode,
        novoPorCodigo: newByCode,
        codigosMudados,
      });

      // Nunca criar cobertura onde não existia: ausência de linha já é
      // SEM_VEREDITO, e um insert aqui converteria "nunca avaliado" em
      // "avaliado e agora duvidoso" — afirmação que ninguém fez, e ainda
      // infla a contagem que o usuário lê.
      if (paraTransportar.length > 0) {
        await db.charterCoverage.createMany({ data: paraTransportar });
      }
```

Acrescentar ao topo do arquivo, junto dos outros imports de `@/lib`:

```ts
import { planejarTransporte } from "@/lib/charter/coverage-transfer";
```

- [ ] **Step 6: Confirmar que os testes de `publishSetVersion` seguem passando sem edição**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/compliance.test.ts && ./node_modules/.bin/tsc --noEmit
```

Esperado: PASS em todos os `describe("publishSetVersion")`, e `tsc` exit 0. **Se algum teste de `publishSetVersion` precisou ser editado, a extração mudou comportamento e está errada** — reverter o Step 5 e refazer.

- [ ] **Step 7: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/lib/charter/coverage-transfer.ts apps/app/app/\(charter\)/actions/compliance.ts apps/app/__tests__/charter/coverage-transfer.test.ts
git add apps/app/lib/charter/coverage-transfer.ts apps/app/app/\(charter\)/actions/compliance.ts apps/app/__tests__/charter/coverage-transfer.test.ts
git commit -m "refactor(charter): extrair transporte de cobertura para helper puro"
```

---

### Task 4: `adoptSetVersion` — o tenant adota a versão nova

O seed cria o conjunto global novo (Task 2), mas não consegue tocar em `CharterCoverage`: a tabela tem `FORCE ROW LEVEL SECURITY` e o seed conecta sem `SET LOCAL app.tenant_id`. O transporte precisa rodar sob `withTenantDb`, e por isso é o tenant quem adota.

**Files:**
- Modify: `apps/app/app/(charter)/actions/compliance.ts` (nova action ao fim da seção de versionamento)
- Test: `apps/app/__tests__/charter/compliance.test.ts`

**Interfaces:**
- Consumes: `planejarTransporte` da Task 3.
- Produces:

```ts
export async function adoptSetVersion(
  input: { setId: string }
): Promise<Result<{ transportadas: number; emRevisao: number; novas: number }>>
```

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `apps/app/__tests__/charter/compliance.test.ts`, importando `adoptSetVersion` junto dos outros no topo.

**Atenção ao formato do mock deste arquivo.** Ele não usa um objeto `dbMock`: usa handles hoisted (`h.setFindFirst`, `h.reqFindMany`, `h.covFindMany`, `h.covCreateMany`) declarados no `vi.hoisted` do topo e ligados às tabelas dentro do `vi.mock("@repo/database")`. Os testes abaixo usam esses handles.

```ts
describe("adoptSetVersion", () => {
  it("recusa conjunto que não substitui nenhum outro", async () => {
    h.setFindFirst.mockResolvedValueOnce({
      id: "set-v2",
      supersedesId: null,
      tenantId: null,
    });

    const res = await adoptSetVersion({ setId: "set-v2" });

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(
      /não substitui nenhum outro/
    );
  });

  it("recusa conjunto de outro tenant sem distinguir de inexistente", async () => {
    h.setFindFirst.mockResolvedValueOnce(null);

    const res = await adoptSetVersion({ setId: "set-de-outro" });

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/não encontrado/i);
  });

  it("transporta cobertura e marca REVISAR só no que mudou de texto", async () => {
    h.setFindFirst
      .mockResolvedValueOnce({ id: "set-v2", supersedesId: "set-v1", tenantId: null })
      .mockResolvedValueOnce({ id: "set-v1", tenantId: null });
    h.reqFindMany
      // exigências do antecessor
      .mockResolvedValueOnce([
        { id: "r1-v1", codigo: "A-1", resumo: "igual", texto: null },
        { id: "r2-v1", codigo: "B-1", resumo: "antigo", texto: null },
      ])
      // exigências do sucessor
      .mockResolvedValueOnce([
        { id: "r1-v2", codigo: "A-1", resumo: "igual", texto: null },
        { id: "r2-v2", codigo: "B-1", resumo: "NOVO", texto: null },
        { id: "r3-v2", codigo: "C-1", resumo: "inédita", texto: null },
      ]);
    h.covFindMany
      // cobertura do antecessor
      .mockResolvedValueOnce([
        { requirementId: "r1-v1", status: "ATENDE", comentario: null, capabilityId: "POLICY_LINK" },
        { requirementId: "r2-v1", status: "ATENDE", comentario: null, capabilityId: "POLICY_LINK" },
      ])
      // nada ainda no sucessor — a implementação lê as duas, nesta ordem
      .mockResolvedValueOnce([]);

    const res = await adoptSetVersion({ setId: "set-v2" });

    expect(res.ok).toBe(true);
    expect(res.ok && res.data).toEqual({
      transportadas: 2,
      emRevisao: 1,
      novas: 1,
    });
    expect(h.covCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ requirementId: "r1-v2", status: "ATENDE" }),
        expect.objectContaining({ requirementId: "r2-v2", status: "REVISAR" }),
      ]),
    });
  });

  it("não sobrescreve veredito já dado no sucessor — adotar duas vezes é idempotente", async () => {
    h.setFindFirst
      .mockResolvedValueOnce({ id: "set-v2", supersedesId: "set-v1", tenantId: null })
      .mockResolvedValueOnce({ id: "set-v1", tenantId: null });
    h.reqFindMany
      .mockResolvedValueOnce([{ id: "r1-v1", codigo: "A-1", resumo: "x", texto: null }])
      .mockResolvedValueOnce([{ id: "r1-v2", codigo: "A-1", resumo: "x", texto: null }]);
    h.covFindMany
      // cobertura do antecessor
      .mockResolvedValueOnce([
        { requirementId: "r1-v1", status: "ATENDE", comentario: null, capabilityId: null },
      ])
      // cobertura que já existe no sucessor (segunda adoção)
      .mockResolvedValueOnce([{ requirementId: "r1-v2" }]);

    const res = await adoptSetVersion({ setId: "set-v2" });

    expect(res.ok).toBe(true);
    expect(res.ok && res.data.transportadas).toBe(0);
    expect(h.covCreateMany).not.toHaveBeenCalled();
  });
});
```

Os handles `h.setFindFirst`, `h.reqFindMany`, `h.covFindMany` e `h.covCreateMany` já existem no `vi.hoisted` do arquivo — nada a acrescentar nesta task.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/compliance.test.ts -t adoptSetVersion
```

Esperado: FAIL com "adoptSetVersion is not a function" ou erro de import.

- [ ] **Step 3: Implementar**

Em `apps/app/app/(charter)/actions/compliance.ts`, depois de `publishSetVersion`:

```ts
// ── Adoção de versão publicada ───────────────────────────────────────────────

const AdoptVersionSchema = z.object({ setId: z.string().min(1) });

/**
 * O tenant passa a usar a versão nova de um conjunto, carregando os vereditos
 * que já deu.
 *
 * Existe porque o seed não pode fazer isso: `CharterCoverage` tem FORCE RLS e o
 * seed conecta sem `SET LOCAL app.tenant_id`. O seed publica a norma; a adoção
 * roda aqui, sob contexto de tenant. A divisão também é a de produto: o mapa é
 * artefato de auditoria, e mudar sozinho entre duas visitas é o que um time de
 * compliance não tolera — quem não adotar continua na versão anterior.
 */
export async function adoptSetVersion(
  input: z.infer<typeof AdoptVersionSchema>
): Promise<Result<{ transportadas: number; emRevisao: number; novas: number }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("compliance.edit");
    const data = AdoptVersionSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const sucessor = await db.charterRequirementSet.findFirst({
        where: {
          id: data.setId,
          OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
        },
      });
      if (!sucessor) {
        throw new GovernanceError(
          "set.unknown",
          "Conjunto de exigências não encontrado."
        );
      }
      if (!sucessor.supersedesId) {
        throw new GovernanceError(
          "set.noPredecessor",
          "Este conjunto não substitui nenhum outro."
        );
      }

      const antecessor = await db.charterRequirementSet.findFirst({
        where: {
          id: sucessor.supersedesId,
          OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
        },
      });
      if (!antecessor) {
        throw new GovernanceError(
          "set.unknown",
          "Conjunto de exigências não encontrado."
        );
      }

      const anteriores = await db.charterRequirement.findMany({
        where: { setId: antecessor.id },
        orderBy: { codigo: "asc" },
      });
      const novos = await db.charterRequirement.findMany({
        where: { setId: sucessor.id },
        orderBy: { codigo: "asc" },
      });

      const anteriorPorCodigo = new Map(anteriores.map((a) => [a.codigo, a]));
      const novoPorCodigo = new Map(novos.map((n) => [n.codigo, n]));

      const codigosMudados = new Set<string>();
      let novas = 0;
      for (const n of novos) {
        const anterior = anteriorPorCodigo.get(n.codigo);
        if (!anterior) {
          novas += 1;
          continue;
        }
        if (
          anterior.resumo !== n.resumo ||
          (anterior.texto ?? null) !== (n.texto ?? null)
        ) {
          codigosMudados.add(n.codigo);
        }
      }

      const coberturas = await db.charterCoverage.findMany({
        where: {
          tenantId: ctx.tenantId,
          requirementId: { in: anteriores.map((a) => a.id) },
        },
      });

      // Já adotado antes: qualquer cobertura no sucessor significa que este
      // transporte já rodou. Reexecutar sobrescreveria veredito dado depois da
      // primeira adoção — o inverso do que "adotar" promete.
      const jaNoSucessor = await db.charterCoverage.findMany({
        where: {
          tenantId: ctx.tenantId,
          requirementId: { in: novos.map((n) => n.id) },
        },
        select: { requirementId: true },
      });
      const ocupados = new Set(jaNoSucessor.map((c) => c.requirementId));

      const planejadas = planejarTransporte({
        tenantId: ctx.tenantId,
        coberturas,
        idAnteriorParaCodigo: new Map(anteriores.map((a) => [a.id, a.codigo])),
        novoPorCodigo,
        codigosMudados,
      });
      const paraTransportar = planejadas.filter(
        (linha) => !ocupados.has(linha.requirementId)
      );

      if (paraTransportar.length > 0) {
        await db.charterCoverage.createMany({ data: paraTransportar });
      }

      const emRevisao = paraTransportar.filter(
        (linha) => linha.status === "REVISAR"
      ).length;

      await logCharterAudit(db, ctx, {
        action: "Adotou nova versão do conjunto de exigências",
        entityType: "charter.requirementset",
        entityId: sucessor.id,
        target: `${sucessor.nome} · v${sucessor.versao}`,
        note: `${paraTransportar.length} coberturas transportadas, ${emRevisao} em revisão, ${novas} exigências novas sem veredito`,
      });

      return {
        transportadas: paraTransportar.length,
        emRevisao,
        novas,
      };
    });
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/compliance.test.ts && ./node_modules/.bin/tsc --noEmit
```

Esperado: PASS, `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/app/\(charter\)/actions/compliance.ts apps/app/__tests__/charter/compliance.test.ts
git add apps/app/app/\(charter\)/actions/compliance.ts apps/app/__tests__/charter/compliance.test.ts
git commit -m "feat(charter): tenant adota versão nova carregando os vereditos"
```

---

### Task 5: `listRequirementSets` passa a saber de sucessão

A tela não tem como oferecer "adotar a v2" se não sabe que existe v2. `SetRow` hoje não carrega `supersedesId` e a action não filtra nem deriva a aresta inversa.

**Files:**
- Modify: `apps/app/app/(charter)/actions/compliance.ts:579-602`
- Test: `apps/app/__tests__/charter/compliance.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:

```ts
type SetRow = {
  id: string; nome: string; origem: string; versao: string; total: number;
  supersedesId: string | null;
  supersededById: string | null;
  diff: { alteradas: number; novas: number; removidas: number } | null;
};
```

`diff` é preenchido só quando `supersededById` não é null — é o resumo do que muda ao adotar o sucessor. `null` nos demais.

- [ ] **Step 1: Escrever o teste que falha**

**O mock deste arquivo não tem `charterRequirementSet.findMany`** — hoje só `create` e `findFirst`. Antes de escrever os testes, acrescentar o handle:

No `vi.hoisted` do topo, junto dos outros:

```ts
  setFindMany: vi.fn(),
```

E no `vi.mock("@repo/database")`, na entrada `charterRequirementSet`:

```ts
      charterRequirementSet: {
        create: h.setCreate,
        findFirst: h.setFindFirst,
        findMany: h.setFindMany,
      },
```

Sem isso os testes falham com `db.charterRequirementSet.findMany is not a function`, que é ruído — não a falha que se quer ver no Step 2.

```ts
describe("listRequirementSets — sucessão", () => {
  it("aponta o sucessor e resume o que muda ao adotá-lo", async () => {
    h.setFindMany.mockResolvedValueOnce([
      { id: "set-v1", nome: "Reg", origem: "REGULACAO", versao: "1", supersedesId: null, _count: { requirements: 2 } },
      { id: "set-v2", nome: "Reg", origem: "REGULACAO", versao: "2", supersedesId: "set-v1", _count: { requirements: 3 } },
    ]);
    h.reqFindMany.mockResolvedValueOnce([
      { setId: "set-v1", codigo: "A-1", resumo: "igual", texto: null },
      { setId: "set-v1", codigo: "B-1", resumo: "antigo", texto: null },
      { setId: "set-v2", codigo: "A-1", resumo: "igual", texto: null },
      { setId: "set-v2", codigo: "B-1", resumo: "NOVO", texto: null },
      { setId: "set-v2", codigo: "C-1", resumo: "inédita", texto: null },
    ]);

    const res = await listRequirementSets();

    expect(res.ok).toBe(true);
    const v1 = res.ok && res.data.find((s) => s.id === "set-v1");
    expect(v1 && v1.supersededById).toBe("set-v2");
    expect(v1 && v1.diff).toEqual({ alteradas: 1, novas: 1, removidas: 0 });

    const v2 = res.ok && res.data.find((s) => s.id === "set-v2");
    expect(v2 && v2.supersededById).toBe(null);
    expect(v2 && v2.diff).toBe(null);
  });

  it("conjunto sem sucessor não carrega diff", async () => {
    h.setFindMany.mockResolvedValueOnce([
      { id: "solo", nome: "RFP", origem: "RFP", versao: "1", supersedesId: null, _count: { requirements: 1 } },
    ]);
    h.reqFindMany.mockResolvedValueOnce([]);

    const res = await listRequirementSets();

    expect(res.ok && res.data[0].supersededById).toBe(null);
    expect(res.ok && res.data[0].diff).toBe(null);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/compliance.test.ts -t "sucessão"
```

Esperado: FAIL — `supersededById` é `undefined`.

- [ ] **Step 3: Implementar**

Substituir o corpo de `listRequirementSets` (`compliance.ts:579-602`) por:

```ts
export async function listRequirementSets(): Promise<Result<SetRow[]>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("compliance.map");

    return withTenantDb(ctx.tenantId, async (db) => {
      // Do tenant OU global — mesmo cuidado de getComplianceMap: esta tabela
      // não tem RLS, então "todos os conjuntos" sem o OR vazaria RFP entre
      // tenants.
      const sets = await db.charterRequirementSet.findMany({
        where: { OR: [{ tenantId: ctx.tenantId }, { tenantId: null }] },
        include: { _count: { select: { requirements: true } } },
        orderBy: { importadoEm: "desc" },
      });

      // A aresta só existe para trás no schema. A inversa é derivada aqui para
      // a tela conseguir dizer "há versão nova" olhando o conjunto que o tenant
      // usa hoje, em vez de o cliente cruzar a lista consigo mesma.
      const sucessorPorAntecessor = new Map<string, string>();
      for (const s of sets) {
        if (s.supersedesId) {
          sucessorPorAntecessor.set(s.supersedesId, s.id);
        }
      }

      // Uma leitura só para todas as exigências envolvidas. O diff é calculado
      // aqui, e não na tela, para não custar um segundo round-trip só para
      // saber se vale mostrar o aviso de versão nova.
      const requisitos = await db.charterRequirement.findMany({
        where: { setId: { in: sets.map((s) => s.id) } },
        select: { setId: true, codigo: true, resumo: true, texto: true },
      });
      const porSet = new Map<
        string,
        { codigo: string; resumo: string; texto: string | null }[]
      >();
      for (const r of requisitos) {
        const lista = porSet.get(r.setId) ?? [];
        lista.push({ codigo: r.codigo, resumo: r.resumo, texto: r.texto });
        porSet.set(r.setId, lista);
      }

      return sets.map((s) => {
        const supersededById = sucessorPorAntecessor.get(s.id) ?? null;
        return {
          id: s.id,
          nome: s.nome,
          origem: s.origem,
          versao: s.versao,
          total: s._count.requirements,
          supersedesId: s.supersedesId,
          supersededById,
          diff: supersededById
            ? diffEntreVersoes(
                porSet.get(s.id) ?? [],
                porSet.get(supersededById) ?? []
              )
            : null,
        };
      });
    });
  });
}

/** Alterada = mesmo código com resumo ou texto diferente. Nova = código que não
 *  existia. Removida = código que sumiu. `citacao` fica de fora de propósito:
 *  mudar o formato da referência não altera a obrigação. */
function diffEntreVersoes(
  antes: { codigo: string; resumo: string; texto: string | null }[],
  depois: { codigo: string; resumo: string; texto: string | null }[]
): { alteradas: number; novas: number; removidas: number } {
  const antesPorCodigo = new Map(antes.map((r) => [r.codigo, r]));
  const depoisCodigos = new Set(depois.map((r) => r.codigo));

  let alteradas = 0;
  let novas = 0;
  for (const r of depois) {
    const anterior = antesPorCodigo.get(r.codigo);
    if (!anterior) {
      novas += 1;
      continue;
    }
    if (
      anterior.resumo !== r.resumo ||
      (anterior.texto ?? null) !== (r.texto ?? null)
    ) {
      alteradas += 1;
    }
  }
  const removidas = antes.filter((r) => !depoisCodigos.has(r.codigo)).length;

  return { alteradas, novas, removidas };
}
```

Atualizar o `type SetRow` no mesmo arquivo para os campos novos.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/compliance.test.ts && ./node_modules/.bin/tsc --noEmit
```

Esperado: PASS, `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/app/\(charter\)/actions/compliance.ts apps/app/__tests__/charter/compliance.test.ts
git add apps/app/app/\(charter\)/actions/compliance.ts apps/app/__tests__/charter/compliance.test.ts
git commit -m "feat(charter): listRequirementSets aponta sucessor e resume o diff"
```

---

### Task 6: `POLICY_LINK` vira cobertura com denominador

Hoje a capacidade conta linhas de `CharterPolicyLink` e o rótulo promete "política vinculada a caso de uso e fornecedor". Com uma política por tenant, 17 vínculos não significam nada sozinhos — o que significa é *quantos dos que existem* estão cobertos.

**Files:**
- Modify: `apps/app/lib/charter/capabilities.ts:28` (tipo) e `:122-139` (POLICY_LINK)
- Test: `apps/app/__tests__/charter/capabilities.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:

```ts
export type Evidencia = {
  total: number;
  amostra: string[];
  de?: number;
  lacunas?: string[];
  href?: string;
};
```

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `apps/app/__tests__/charter/capabilities.test.ts`. O stub deste arquivo chama-se **`dbStub`** e é compartilhado por todos os testes, com valores definidos uma vez via `mockResolvedValue`. Usar `mockResolvedValueOnce` nos testes novos, para não contaminar os que já existem (`RISK_SCORING` e `VENDOR_TIER` leem `charterUseCase` e `charterVendor` com os valores padrão).

```ts
it("POLICY_LINK reporta cobertura com denominador e nomeia o que falta", async () => {
  // O stub precisa ter caso vinculado E caso solto. Com listas vazias, `de` e
  // `lacunas` nunca são exercitados e o teste passaria sem provar nada — foi
  // esse exatamente o defeito que uma review pegou neste arquivo antes.
  dbStub.charterUseCase.findMany.mockResolvedValueOnce([
    { id: "uc-1", code: "UC-001", title: "Triagem de currículos" },
    { id: "uc-2", code: "UC-002", title: "Sumarizador de reunião" },
  ]);
  dbStub.charterVendor.findMany.mockResolvedValueOnce([
    { id: "v-1", code: "V-001", name: "OpenAI" },
  ]);
  dbStub.charterPolicyLink.findMany.mockResolvedValueOnce([
    { alvoTipo: "USE_CASE", alvoId: "uc-1" },
    { alvoTipo: "VENDOR", alvoId: "v-1" },
  ]);

  const cap = CAPABILITIES.find((c) => c.id === "POLICY_LINK");
  const ev = await cap!.evidencia("t1");

  expect(ev.total).toBe(2);
  expect(ev.de).toBe(3);
  expect(ev.lacunas).toEqual(["USE_CASE · UC-002 Sumarizador de reunião"]);
  expect(ev.href).toBe("/charter/policy");
});

it("POLICY_LINK sem nenhum caso nem fornecedor não divide por zero", async () => {
  dbStub.charterUseCase.findMany.mockResolvedValueOnce([]);
  dbStub.charterVendor.findMany.mockResolvedValueOnce([]);
  dbStub.charterPolicyLink.findMany.mockResolvedValueOnce([]);

  const cap = CAPABILITIES.find((c) => c.id === "POLICY_LINK");
  const ev = await cap!.evidencia("t1");

  expect(ev.total).toBe(0);
  expect(ev.de).toBe(0);
  expect(ev.lacunas).toEqual([]);
});

it("o rótulo do POLICY_LINK afirma cobertura, não contagem", () => {
  const cap = CAPABILITIES.find((c) => c.id === "POLICY_LINK");
  expect(cap!.label).toBe(
    "Todo caso de uso e fornecedor sob a política publicada"
  );
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/capabilities.test.ts -t POLICY_LINK
```

Esperado: FAIL — `ev.de` é `undefined` e o rótulo é o antigo.

- [ ] **Step 3: Implementar**

Em `apps/app/lib/charter/capabilities.ts`, trocar o tipo `Evidencia`:

```ts
/**
 * `de` e `lacunas` são opcionais porque só fazem sentido onde a contagem crua
 * não basta. `POLICY_ATTESTATION` responde "37 aceites" e 37 é 37; `POLICY_LINK`
 * responde "12 vínculos", que não significa nada sem saber de quantos.
 *
 * `amostra` continua sendo "exemplos do que existe" em TODAS as capacidades.
 * Inverter esse sentido só numa delas seria rasteira garantida para quem ler o
 * catálogo depois — daí `lacunas` ser campo novo, com nome que diz o que é.
 */
export type Evidencia = {
  total: number;
  amostra: string[];
  de?: number;
  lacunas?: string[];
  href?: string;
};
```

E substituir a entrada `POLICY_LINK` inteira por:

```ts
  {
    id: "POLICY_LINK",
    // O rótulo antigo — "Política vinculada a caso de uso e fornecedor" —
    // prometia mais do que a contagem entregava: com uma política por tenant,
    // vincular é quase tautologia, e o que prova algo é a cobertura estar
    // completa. Mesmo movimento já feito no RISK_SCORING abaixo.
    label: "Todo caso de uso e fornecedor sob a política publicada",
    evidencia: (tenantId) =>
      withTenantDb(tenantId, async (db) => {
        const [casos, vendors, links] = await Promise.all([
          db.charterUseCase.findMany({
            where: { tenantId },
            select: { id: true, code: true, title: true },
            orderBy: { code: "asc" },
          }),
          db.charterVendor.findMany({
            where: { tenantId },
            select: { id: true, code: true, name: true },
            orderBy: { code: "asc" },
          }),
          db.charterPolicyLink.findMany({
            where: { tenantId },
            select: { alvoTipo: true, alvoId: true },
          }),
        ]);

        const vinculados = new Set(
          links.map((l) => `${l.alvoTipo}:${l.alvoId}`)
        );
        const alvos = [
          ...casos.map((c) => ({
            chave: `USE_CASE:${c.id}`,
            rotulo: `USE_CASE · ${c.code} ${c.title}`,
          })),
          ...vendors.map((v) => ({
            chave: `VENDOR:${v.id}`,
            rotulo: `VENDOR · ${v.code} ${v.name}`,
          })),
        ];

        const cobertos = alvos.filter((a) => vinculados.has(a.chave));
        const faltando = alvos.filter((a) => !vinculados.has(a.chave));

        return {
          total: cobertos.length,
          de: alvos.length,
          amostra: cobertos.slice(0, 3).map((a) => a.rotulo),
          lacunas: faltando.map((a) => a.rotulo),
          href: "/charter/policy",
        };
      }),
  },
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/capabilities.test.ts && ./node_modules/.bin/tsc --noEmit
```

Esperado: PASS, `tsc` exit 0. `dbStub` já tem `charterUseCase`, `charterVendor` e `charterPolicyLink` com `findMany` — nada a acrescentar.

Rodar o arquivo **inteiro**, não só os testes novos: `POLICY_LINK` deixou de chamar `charterPolicyLink.count`, e os testes de `RISK_SCORING` e `VENDOR_TIER` leem as mesmas tabelas do stub compartilhado. Se algum deles quebrar, é o `mockResolvedValueOnce` tendo sido consumido fora de ordem.

- [ ] **Step 5: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/lib/charter/capabilities.ts apps/app/__tests__/charter/capabilities.test.ts
git add apps/app/lib/charter/capabilities.ts apps/app/__tests__/charter/capabilities.test.ts
git commit -m "feat(charter): POLICY_LINK reporta cobertura em vez de contagem"
```

---

### Task 7: O mapa mostra a fração e as lacunas

`EvidenceBlock` renderiza `{row.evidencia.total} {noun}` e nada mais. Com o denominador da Task 6, um selo "Atende" com dois casos fora precisa exibir a incoerência **na mesma linha**, para o mesmo comprador que lê o selo.

**Files:**
- Modify: `apps/app/components/charter/screens/compliance.tsx:51-59` (noun) e `:159-199` (`EvidenceBlock`)
- Test: `apps/app/__tests__/screens/compliance.test.tsx`

**Interfaces:**
- Consumes: `Evidencia` com `de`/`lacunas` da Task 6.
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `apps/app/__tests__/screens/compliance.test.tsx` (criar o arquivo se não existir, seguindo o padrão de `__tests__/screens/measure.test.tsx`):

```tsx
it("mostra a fração e nomeia as lacunas quando a evidência tem denominador", async () => {
  getComplianceMapMock.mockResolvedValue({
    ok: true,
    data: {
      linhas: [
        {
          requirementId: "r1",
          codigo: "A-1",
          citacao: "§1",
          resumo: "Exigência",
          status: "ATENDE",
          capabilityId: "POLICY_LINK",
          comentario: null,
          evidencia: {
            total: 12,
            de: 14,
            amostra: ["USE_CASE · UC-001 Triagem"],
            lacunas: [
              "USE_CASE · UC-013 Sumarizador",
              "USE_CASE · UC-014 Chat interno",
            ],
          },
          evidenciaErro: null,
        },
      ],
      semVeredito: 0,
      total: 1,
    },
  });

  render(<ComplianceScreen />);

  expect(await screen.findByText("12 de 14")).toBeInTheDocument();
  expect(screen.getByText(/2 fora da política/)).toBeInTheDocument();
  expect(screen.getByText(/UC-013 Sumarizador/)).toBeInTheDocument();
});

it("evidência sem denominador segue mostrando só a contagem", async () => {
  getComplianceMapMock.mockResolvedValue({
    ok: true,
    data: {
      linhas: [
        {
          requirementId: "r1",
          codigo: "A-1",
          citacao: "§1",
          resumo: "Exigência",
          status: "ATENDE",
          capabilityId: "POLICY_ATTESTATION",
          comentario: null,
          evidencia: { total: 37, amostra: [] },
          evidenciaErro: null,
        },
      ],
      semVeredito: 0,
      total: 1,
    },
  });

  render(<ComplianceScreen />);

  expect(await screen.findByText("37 aceites")).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/screens/compliance.test.tsx
```

Esperado: FAIL — "Unable to find an element with the text: 12 de 14".

- [ ] **Step 3: Implementar**

Em `apps/app/components/charter/screens/compliance.tsx`, trocar o noun do `POLICY_LINK`:

```ts
  POLICY_LINK: "sob a política",
```

E substituir o ramo `if (row.evidencia)` de `EvidenceBlock` por:

```tsx
  if (row.evidencia) {
    const noun = row.capabilityId
      ? (EVIDENCE_NOUN[row.capabilityId] ?? "registros")
      : "registros";
    const lacunas = row.evidencia.lacunas ?? [];
    return (
      <div>
        <div
          className="mono"
          style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}
        >
          {row.evidencia.de === undefined
            ? `${row.evidencia.total} ${noun}`
            : `${row.evidencia.total} de ${row.evidencia.de}`}
        </div>
        {/* A lacuna aparece na mesma linha do selo de propósito: um "Atende"
            com dois casos fora precisa ser incoerente à vista de quem lê o
            selo, que é o comprador. O veredito continua sendo escolha humana —
            setCoverage não vira juiz de evidência —, mas a escolha passa a ser
            feita com o número na frente. */}
        {lacunas.length > 0 && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--amber-text)",
              marginTop: 2,
              lineHeight: 1.45,
            }}
          >
            {lacunas.length} fora da política: {lacunas.slice(0, 3).join(", ")}
            {lacunas.length > 3 ? ` e mais ${lacunas.length - 3}` : ""}
          </div>
        )}
      </div>
    );
  }
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/screens/compliance.test.tsx && ./node_modules/.bin/tsc --noEmit
```

Esperado: PASS, `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/components/charter/screens/compliance.tsx apps/app/__tests__/screens/compliance.test.tsx
git add apps/app/components/charter/screens/compliance.tsx apps/app/__tests__/screens/compliance.test.tsx
git commit -m "feat(charter): mapa mostra a fração de cobertura e nomeia as lacunas"
```

---

### Task 8: Teste para `unlinkPolicy`

`unlinkPolicy` existe desde o PR #56 e **não tem teste nenhum** — `policy-link.test.ts` só importa `linkPolicy`. O caso que importa é o silencioso: desvincular o que não existe precisa recusar, não devolver sucesso.

**Files:**
- Test: `apps/app/__tests__/charter/policy-link.test.ts`

**Interfaces:**
- Consumes: `unlinkPolicy` de `apps/app/app/(charter)/actions/policy.ts:583`.
- Produces: nada.

- [ ] **Step 1: Escrever o teste**

Acrescentar `unlinkPolicy` ao import do topo do arquivo (`import { linkPolicy, unlinkPolicy } from "../../app/(charter)/actions/policy";`).

Este arquivo também usa handles hoisted, não um objeto `dbMock`: o de interesse aqui é `h.linkDeleteMany`, já ligado a `charterPolicyLink.deleteMany`.

```ts
describe("unlinkPolicy", () => {
  it("remove o vínculo existente", async () => {
    h.linkDeleteMany.mockResolvedValue({ count: 1 });

    const res = await unlinkPolicy({
      policyId: "pol-1",
      alvoTipo: "USE_CASE",
      alvoId: "uc-1",
    });

    expect(res.ok).toBe(true);
    expect(h.linkDeleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: expect.any(String),
        policyId: "pol-1",
        alvoTipo: "USE_CASE",
        alvoId: "uc-1",
      },
    });
  });

  it("recusa desvincular o que não existe em vez de devolver sucesso calado", async () => {
    h.linkDeleteMany.mockResolvedValue({ count: 0 });

    const res = await unlinkPolicy({
      policyId: "pol-1",
      alvoTipo: "VENDOR",
      alvoId: "inexistente",
    });

    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/não encontrado/i);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que passa direto**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/policy-link.test.ts
```

Esperado: PASS. `unlinkPolicy` já está implementado corretamente — esta task fecha a lacuna de cobertura, não corrige comportamento. **Se algum dos dois falhar, é bug real em `unlinkPolicy`**: corrigir a implementação, não o teste.

- [ ] **Step 3: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/__tests__/charter/policy-link.test.ts
git add apps/app/__tests__/charter/policy-link.test.ts
git commit -m "test(charter): cobrir unlinkPolicy, que entrou sem teste"
```

---

### Task 9: `getPolicyScope` — quem está sob a política

A tela de alcance precisa de uma leitura que já devolva o cruzamento. Sem ela a tela faria N+1 ou o cliente cruzaria duas listas.

**Files:**
- Modify: `apps/app/app/(charter)/actions/policy.ts` (nova action ao fim do arquivo)
- Test: `apps/app/__tests__/charter/policy-link.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces:

```ts
export type PolicyScopeView = {
  policyId: string;
  casos: { id: string; rotulo: string; vinculado: boolean }[];
  vendors: { id: string; rotulo: string; vinculado: boolean }[];
};

export async function getPolicyScope(): Promise<Result<PolicyScopeView | null>>
```

Devolve `null` quando o tenant ainda não tem política — mesma convenção de `getPolicy`.

- [ ] **Step 1: Escrever o teste que falha**

**O mock deste arquivo precisa de três acréscimos antes dos testes.** Hoje ele só mocka `requireCharterPermissionContext`, e as tabelas só expõem `findFirst`. `getPolicyScope` usa `requireCharterContext` e três `findMany` — sem os acréscimos os testes falham por ruído de mock, não pela ausência da função.

No `vi.hoisted`:

```ts
  requireContext: vi.fn(),
  useCaseFindMany: vi.fn(),
  vendorFindMany: vi.fn(),
  linkFindMany: vi.fn(),
```

No `vi.mock("@/lib/charter/guards")`:

```ts
vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
  requireCharterContext: h.requireContext,
}));
```

E nas tabelas do `vi.mock("@repo/database")`:

```ts
      charterUseCase: { findFirst: h.useCaseFindFirst, findMany: h.useCaseFindMany },
      charterVendor: { findFirst: h.vendorFindFirst, findMany: h.vendorFindMany },
      charterPolicyLink: {
        create: h.linkCreate,
        deleteMany: h.linkDeleteMany,
        findMany: h.linkFindMany,
      },
```

No `beforeEach`, `h.requireContext.mockResolvedValue(ctx)` — o mesmo `ctx` que o arquivo já usa para `h.requireCtx`.

```ts
describe("getPolicyScope", () => {
  it("marca vinculado por alvo e devolve os dois lados", async () => {
    h.policyFindFirst.mockResolvedValue({ id: "pol-1" });
    h.useCaseFindMany.mockResolvedValue([
      { id: "uc-1", code: "UC-001", title: "Triagem" },
      { id: "uc-2", code: "UC-002", title: "Sumarizador" },
    ]);
    h.vendorFindMany.mockResolvedValue([
      { id: "v-1", code: "V-001", name: "OpenAI" },
    ]);
    h.linkFindMany.mockResolvedValue([
      { alvoTipo: "USE_CASE", alvoId: "uc-1" },
    ]);

    const res = await getPolicyScope();

    expect(res.ok).toBe(true);
    expect(res.ok && res.data).toEqual({
      policyId: "pol-1",
      casos: [
        { id: "uc-1", rotulo: "UC-001 Triagem", vinculado: true },
        { id: "uc-2", rotulo: "UC-002 Sumarizador", vinculado: false },
      ],
      vendors: [{ id: "v-1", rotulo: "V-001 OpenAI", vinculado: false }],
    });
  });

  it("devolve null quando o tenant não tem política", async () => {
    h.policyFindFirst.mockResolvedValue(null);

    const res = await getPolicyScope();

    expect(res.ok && res.data).toBe(null);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/policy-link.test.ts -t getPolicyScope
```

Esperado: FAIL com "getPolicyScope is not a function".

- [ ] **Step 3: Implementar**

Ao fim de `apps/app/app/(charter)/actions/policy.ts`:

```ts
export type PolicyScopeView = {
  policyId: string;
  casos: { id: string; rotulo: string; vinculado: boolean }[];
  vendors: { id: string; rotulo: string; vinculado: boolean }[];
};

/**
 * Quem está — e quem não está — sob a política publicada.
 *
 * Sem permissão específica, com `requireCharterContext()`, igual ao `getPolicy`
 * acima: ler quem está sob a política tem a mesma sensibilidade que ler a
 * política. Quem *escreve* segue precisando de `policy.edit`, que só COMPLIANCE
 * e LEGAL têm.
 *
 * O valor desta leitura não é a lista dos vinculados — é a dos que faltam. Com
 * uma política por tenant, vincular é quase tautologia; o que prova governança
 * é não sobrar ninguém de fora.
 */
export async function getPolicyScope(): Promise<Result<PolicyScopeView | null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();

    return withTenantDb(ctx.tenantId, async (db) => {
      const policy = await db.charterPolicy.findFirst({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!policy) {
        return null;
      }

      const [casos, vendors, links] = await Promise.all([
        db.charterUseCase.findMany({
          where: { tenantId: ctx.tenantId },
          select: { id: true, code: true, title: true },
          orderBy: { code: "asc" },
        }),
        db.charterVendor.findMany({
          where: { tenantId: ctx.tenantId },
          select: { id: true, code: true, name: true },
          orderBy: { code: "asc" },
        }),
        db.charterPolicyLink.findMany({
          where: { tenantId: ctx.tenantId, policyId: policy.id },
          select: { alvoTipo: true, alvoId: true },
        }),
      ]);

      const vinculados = new Set(links.map((l) => `${l.alvoTipo}:${l.alvoId}`));

      return {
        policyId: policy.id,
        casos: casos.map((c) => ({
          id: c.id,
          rotulo: `${c.code} ${c.title}`,
          vinculado: vinculados.has(`USE_CASE:${c.id}`),
        })),
        vendors: vendors.map((v) => ({
          id: v.id,
          rotulo: `${v.code} ${v.name}`,
          vinculado: vinculados.has(`VENDOR:${v.id}`),
        })),
      };
    });
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/charter/policy-link.test.ts && ./node_modules/.bin/tsc --noEmit
```

Esperado: PASS, `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/app/\(charter\)/actions/policy.ts apps/app/__tests__/charter/policy-link.test.ts
git add apps/app/app/\(charter\)/actions/policy.ts apps/app/__tests__/charter/policy-link.test.ts
git commit -m "feat(charter): getPolicyScope devolve quem está e quem falta sob a política"
```

---

### Task 10: Tela de alcance da política

Sem esta task, `linkPolicy` continua sem caller e o denominador da Task 6 mostra lacunas que ninguém consegue fechar.

**Files:**
- Create: `apps/app/components/charter/screens/policy-scope.tsx`
- Modify: `apps/app/components/charter/screens/policy.tsx` (montar a seção)
- Test: `apps/app/__tests__/screens/policy-scope.test.tsx`

**Interfaces:**
- Consumes: `getPolicyScope()` da Task 9; `linkPolicy`/`unlinkPolicy` de `actions/policy.ts`.
- Produces: `<PolicyScope />`, sem props.

Arquivo próprio porque `policy.tsx` já tem 33 KB. É o padrão que `settings.tsx` usa com `settings-members-tab.tsx`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/screens/policy-scope.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPolicyScopeMock = vi.hoisted(() => vi.fn());
const linkPolicyMock = vi.hoisted(() => vi.fn());
const unlinkPolicyMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/(charter)/actions/policy", () => ({
  getPolicyScope: (...a: unknown[]) => getPolicyScopeMock(...a),
  linkPolicy: (...a: unknown[]) => linkPolicyMock(...a),
  unlinkPolicy: (...a: unknown[]) => unlinkPolicyMock(...a),
}));

const { default: PolicyScope } = await import(
  "@/components/charter/screens/policy-scope"
);

describe("PolicyScope", () => {
  beforeEach(() => {
    getPolicyScopeMock.mockReset();
    linkPolicyMock.mockReset();
    unlinkPolicyMock.mockReset();
    getPolicyScopeMock.mockResolvedValue({
      ok: true,
      data: {
        policyId: "pol-1",
        casos: [
          { id: "uc-1", rotulo: "UC-001 Triagem", vinculado: true },
          { id: "uc-2", rotulo: "UC-002 Sumarizador", vinculado: false },
        ],
        vendors: [{ id: "v-1", rotulo: "V-001 OpenAI", vinculado: false }],
      },
    });
  });

  it("mostra os que estão fora antes dos que estão dentro", async () => {
    render(<PolicyScope />);

    expect(await screen.findByText(/2 fora da política/)).toBeInTheDocument();
    const rotulos = screen
      .getAllByTestId("alvo-rotulo")
      .map((n) => n.textContent);
    expect(rotulos.slice(0, 2)).toEqual([
      "UC-002 Sumarizador",
      "V-001 OpenAI",
    ]);
  });

  it("vincular chama linkPolicy com o alvo certo e recarrega", async () => {
    linkPolicyMock.mockResolvedValue({ ok: true, data: null });
    render(<PolicyScope />);
    await screen.findByText("UC-002 Sumarizador");

    fireEvent.click(screen.getByTestId("vincular-uc-2"));

    await waitFor(() =>
      expect(linkPolicyMock).toHaveBeenCalledWith({
        policyId: "pol-1",
        alvoTipo: "USE_CASE",
        alvoId: "uc-2",
      })
    );
    await waitFor(() =>
      expect(getPolicyScopeMock.mock.calls.length).toBeGreaterThan(1)
    );
  });

  it("desvincular chama unlinkPolicy", async () => {
    unlinkPolicyMock.mockResolvedValue({ ok: true, data: null });
    render(<PolicyScope />);
    await screen.findByText("UC-001 Triagem");

    fireEvent.click(screen.getByTestId("desvincular-uc-1"));

    await waitFor(() =>
      expect(unlinkPolicyMock).toHaveBeenCalledWith({
        policyId: "pol-1",
        alvoTipo: "USE_CASE",
        alvoId: "uc-1",
      })
    );
  });

  it("tenant sem política não quebra a tela", async () => {
    getPolicyScopeMock.mockResolvedValue({ ok: true, data: null });
    render(<PolicyScope />);

    expect(
      await screen.findByText(/Nenhuma política nesta organização/)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/screens/policy-scope.test.tsx
```

Esperado: FAIL com erro de import de `policy-scope`.

- [ ] **Step 3: Implementar**

Criar `apps/app/components/charter/screens/policy-scope.tsx`:

```tsx
"use client";

import { Button, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useTransition } from "react";
import {
  getPolicyScope,
  linkPolicy,
  unlinkPolicy,
} from "@/app/(charter)/actions/policy";
import { useCharterData } from "../use-charter-data";

// policy-scope.tsx — quem está e quem não está sob a política publicada.
//
// Em lote e aqui, e não um controle em case-detail, por três razões: fechar
// catorze lacunas visitando catorze telas é tedioso o bastante para não ser
// feito; `linkPolicy` exige `policy.edit`, que SECURITY não tem apesar de
// decidir caso de uso; e o `href` da capacidade POLICY_LINK já aponta para
// /charter/policy, então quem clica na evidência do mapa cai exatamente onde
// fecha a lacuna.

type Alvo = {
  id: string;
  rotulo: string;
  vinculado: boolean;
  tipo: "USE_CASE" | "VENDOR";
};

export default function PolicyScope() {
  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getPolicyScope(), [])
  );
  const [pending, startTransition] = useTransition();

  if (loading || error || !data) {
    return (
      <SectionCard
        subtitle="Todo caso de uso e fornecedor precisa estar sob a política"
        title="Alcance da política"
      >
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
          {error ?? "Carregando…"}
        </div>
      </SectionCard>
    );
  }

  if (data === null) {
    return (
      <SectionCard
        subtitle="Todo caso de uso e fornecedor precisa estar sob a política"
        title="Alcance da política"
      >
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
          Nenhuma política nesta organização. O seed inicial cria a estrutura.
        </div>
      </SectionCard>
    );
  }

  const alvos: Alvo[] = [
    ...data.casos.map((c) => ({ ...c, tipo: "USE_CASE" as const })),
    ...data.vendors.map((v) => ({ ...v, tipo: "VENDOR" as const })),
  ];
  // Fora primeiro: a lista existe para fechar lacuna, e o que falta é o que
  // precisa estar à vista.
  const ordenados = [
    ...alvos.filter((a) => !a.vinculado),
    ...alvos.filter((a) => a.vinculado),
  ];
  const fora = alvos.filter((a) => !a.vinculado).length;

  const alternar = (alvo: Alvo) =>
    startTransition(async () => {
      const args = {
        policyId: data.policyId,
        alvoTipo: alvo.tipo,
        alvoId: alvo.id,
      };
      const res = alvo.vinculado
        ? await unlinkPolicy(args)
        : await linkPolicy(args);
      if (res.ok) {
        reload();
      }
    });

  return (
    <SectionCard
      subtitle="Todo caso de uso e fornecedor precisa estar sob a política"
      title="Alcance da política"
    >
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: fora > 0 ? "var(--amber-text)" : "var(--green-text)",
          marginBottom: 10,
        }}
      >
        {fora > 0
          ? `${fora} fora da política, de ${alvos.length}`
          : `${alvos.length} de ${alvos.length} sob a política`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ordenados.map((alvo) => (
          <div
            key={`${alvo.tipo}-${alvo.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span
              data-testid="alvo-rotulo"
              style={{
                flex: 1,
                fontSize: 13,
                color: alvo.vinculado ? "var(--ink)" : "var(--amber-text)",
              }}
            >
              {alvo.rotulo}
            </span>
            <Button
              data-testid={`${alvo.vinculado ? "desvincular" : "vincular"}-${alvo.id}`}
              disabled={pending}
              onClick={() => alternar(alvo)}
              size="sm"
              variant={alvo.vinculado ? "secondary" : "primary"}
            >
              {alvo.vinculado ? "Remover" : "Vincular"}
            </Button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
```

- [ ] **Step 4: Montar na tela de política**

Em `apps/app/components/charter/screens/policy.tsx`, importar e renderizar depois da `SectionCard` de "Seções":

```tsx
import PolicyScope from "./policy-scope";
```

```tsx
          <PolicyScope />
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/screens/policy-scope.test.tsx && ./node_modules/.bin/tsc --noEmit
```

Esperado: PASS, `tsc` exit 0.

- [ ] **Step 6: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/components/charter/screens/policy-scope.tsx apps/app/components/charter/screens/policy.tsx apps/app/__tests__/screens/policy-scope.test.tsx
git add apps/app/components/charter/screens/policy-scope.tsx apps/app/components/charter/screens/policy.tsx apps/app/__tests__/screens/policy-scope.test.tsx
git commit -m "feat(charter): tela de alcance da política fecha as lacunas de vínculo"
```

---

### Task 11: Aviso e botão de adotar a versão nova

Sem esta task, `adoptSetVersion` fica sem caller e o `supersededById` da Task 5 não vira nada visível.

**Files:**
- Modify: `apps/app/components/charter/screens/compliance.tsx`
- Test: `apps/app/__tests__/screens/compliance.test.tsx`

**Interfaces:**
- Consumes: `SetRow` com `supersededById`/`diff` da Task 5; `adoptSetVersion` da Task 4.
- Produces: nada.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
it("oferece adotar quando o conjunto em uso tem sucessor", async () => {
  listRequirementSetsMock.mockResolvedValue({
    ok: true,
    data: [
      {
        id: "set-v1", nome: "Reg", origem: "REGULACAO", versao: "1", total: 2,
        supersedesId: null, supersededById: "set-v2",
        diff: { alteradas: 7, novas: 2, removidas: 1 },
      },
    ],
  });
  adoptSetVersionMock.mockResolvedValue({
    ok: true,
    data: { transportadas: 9, emRevisao: 7, novas: 2 },
  });

  render(<ComplianceScreen />);

  expect(
    await screen.findByText(/7 alteradas, 2 novas, 1 removida/)
  ).toBeInTheDocument();

  fireEvent.click(screen.getByText("Adotar a versão nova"));

  await waitFor(() =>
    expect(adoptSetVersionMock).toHaveBeenCalledWith({ setId: "set-v2" })
  );
});

it("conjunto sem sucessor não mostra aviso de versão", async () => {
  listRequirementSetsMock.mockResolvedValue({
    ok: true,
    data: [
      {
        id: "solo", nome: "RFP", origem: "RFP", versao: "1", total: 1,
        supersedesId: null, supersededById: null, diff: null,
      },
    ],
  });

  render(<ComplianceScreen />);
  await screen.findByText("RFP");

  expect(screen.queryByText("Adotar a versão nova")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/screens/compliance.test.tsx -t "adotar"
```

Esperado: FAIL — "Unable to find an element with the text: Adotar a versão nova".

- [ ] **Step 3: Implementar**

Em `compliance.tsx`, importar `adoptSetVersion` junto das outras actions e acrescentar, no bloco que renderiza cada linha de conjunto em `setsState`:

```tsx
{set.supersededById && set.diff && (
  <div
    style={{
      marginTop: 8,
      padding: "8px 10px",
      borderRadius: "var(--r-md)",
      background: "rgba(var(--accent-rgb),.08)",
      border: "1px solid var(--hairline)",
    }}
  >
    <div style={{ fontSize: 12.5, color: "var(--ink)" }}>
      Há uma versão nova deste conjunto — {set.diff.alteradas} alteradas,{" "}
      {set.diff.novas} novas, {set.diff.removidas} removida.
    </div>
    {/* Adotar é escolha, não automatismo: o mapa é artefato de auditoria e
        mudar sozinho entre duas visitas é o que um time de compliance não
        tolera. Quem não clicar continua na versão atual, com os vereditos
        intactos. */}
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await runWithToast(
            () => adoptSetVersion({ setId: set.supersededById as string }),
            {
              loading: "Adotando a versão nova…",
              success: (d) =>
                `${d.transportadas} vereditos transportados, ${d.emRevisao} em revisão`,
            }
          );
          if (res.ok) {
            setsState.reload();
            reload();
          }
        })
      }
      size="sm"
      style={{ marginTop: 6 }}
      variant="primary"
    >
      Adotar a versão nova
    </Button>
  </div>
)}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/screens/compliance.test.tsx && ./node_modules/.bin/tsc --noEmit
```

Esperado: PASS, `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/components/charter/screens/compliance.tsx apps/app/__tests__/screens/compliance.test.tsx
git add apps/app/components/charter/screens/compliance.tsx apps/app/__tests__/screens/compliance.test.tsx
git commit -m "feat(charter): mapa oferece adotar a versão nova do conjunto"
```

---

### Task 12: Import como nova versão de um conjunto existente

Fecha o bloqueio original: `publishSetVersion` passa a ter caller. O formulário de importação ganha um seletor opcional.

**Files:**
- Modify: `apps/app/components/charter/screens/compliance.tsx:711-728`
- Test: `apps/app/__tests__/screens/compliance.test.tsx`

**Interfaces:**
- Consumes: `publishSetVersion` de `actions/compliance.ts:159`; `SetRow` da Task 5.
- Produces: nada.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
it("importar com conjunto selecionado publica versão em vez de conjunto novo", async () => {
  listRequirementSetsMock.mockResolvedValue({
    ok: true,
    data: [
      {
        id: "set-v1", nome: "RFP Cliente", origem: "RFP", versao: "1", total: 1,
        supersedesId: null, supersededById: null, diff: null,
      },
    ],
  });
  publishSetVersionMock.mockResolvedValue({ ok: true, data: { id: "set-v2", afetadas: 1 } });

  render(<ComplianceScreen />);
  fireEvent.click(await screen.findByText("Importar conjunto"));

  fireEvent.change(await screen.findByLabelText("Nome do conjunto"), {
    target: { value: "RFP Cliente" },
  });
  fireEvent.change(screen.getByLabelText("Exigências"), {
    target: { value: "A-1 | §1 | Resumo" },
  });
  fireEvent.change(screen.getByLabelText("Substitui um conjunto existente"), {
    target: { value: "set-v1" },
  });
  fireEvent.change(screen.getByLabelText("Versão"), {
    target: { value: "2" },
  });
  fireEvent.click(screen.getByText("Importar"));

  await waitFor(() =>
    expect(publishSetVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({ supersedesId: "set-v1", versao: "2" })
    )
  );
  expect(importRequirementSetMock).not.toHaveBeenCalled();
});

it("importar sem selecionar conjunto segue criando conjunto novo", async () => {
  importRequirementSetMock.mockResolvedValue({ ok: true, data: { id: "novo", total: 1 } });

  render(<ComplianceScreen />);
  fireEvent.click(await screen.findByText("Importar conjunto"));

  fireEvent.change(await screen.findByLabelText("Nome do conjunto"), {
    target: { value: "RFP Nova" },
  });
  fireEvent.change(screen.getByLabelText("Exigências"), {
    target: { value: "A-1 | §1 | Resumo" },
  });
  fireEvent.click(screen.getByText("Importar"));

  await waitFor(() => expect(importRequirementSetMock).toHaveBeenCalled());
  expect(publishSetVersionMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/screens/compliance.test.tsx -t "versão em vez de conjunto novo"
```

Esperado: FAIL — "Unable to find a label with the text of: Substitui um conjunto existente".

- [ ] **Step 3: Implementar**

No componente do formulário de import, acrescentar estado e campos:

```tsx
  const [supersedesId, setSupersedesId] = useState("");
  const [versao, setVersao] = useState("");
```

```tsx
        <div>
          <label htmlFor="import-supersedes" style={fieldLabelStyle}>
            Substitui um conjunto existente
          </label>
          <select
            id="import-supersedes"
            onChange={(e) => setSupersedesId(e.target.value)}
            style={inputStyle}
            value={supersedesId}
          >
            <option value="">Não — é um conjunto novo</option>
            {(setsState.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} (v{s.versao})
              </option>
            ))}
          </select>
        </div>
        {supersedesId !== "" && (
          <div>
            <label htmlFor="import-versao" style={fieldLabelStyle}>
              Versão
            </label>
            <input
              id="import-versao"
              onChange={(e) => setVersao(e.target.value)}
              placeholder="2"
              style={inputStyle}
              value={versao}
            />
          </div>
        )}
```

E trocar o `submit`:

```tsx
  const submit = () =>
    startTransition(async () => {
      // Com conjunto selecionado o caminho é outro: publishSetVersion grava
      // supersedesId e transporta a cobertura, marcando REVISAR no que mudou de
      // texto. Importar como conjunto novo perderia todos os vereditos já
      // dados sobre a versão anterior.
      const res = supersedesId
        ? await runWithToast(
            () =>
              publishSetVersion({
                supersedesId,
                nome,
                versao,
                requisitos: parsed.requisitos,
              }),
            {
              loading: "Publicando nova versão…",
              success: (d) => `Nova versão publicada · ${d.afetadas} em revisão`,
            }
          )
        : await runWithToast(
            () =>
              importRequirementSet({
                nome,
                origem: "RFP",
                requisitos: parsed.requisitos,
              }),
            {
              loading: "Importando conjunto…",
              success: (d) => `${d.total} exigência(s) importada(s)`,
            }
          );
      if (res.ok) {
        onDone();
      }
    });
```

Acrescentar à condição de `reason` que desabilita o botão:

```tsx
    (supersedesId !== "" && versao.trim() === ""
      ? "Informe a versão do conjunto novo"
      : null) ??
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
cd apps/app && ./node_modules/.bin/vitest run __tests__/screens/compliance.test.tsx && ./node_modules/.bin/tsc --noEmit
```

Esperado: PASS, `tsc` exit 0.

- [ ] **Step 5: Verificação final da branch inteira**

```bash
cd apps/app && ./node_modules/.bin/tsc --noEmit && NODE_ENV=test ./node_modules/.bin/vitest run
cd ../../packages/database && ./node_modules/.bin/vitest run scripts/__tests__/
```

Esperado: `tsc` exit 0 e zero falhas nas duas suítes. Rodar **contra o resultado rebaseado com `origin/main`** — é a verificação cuja ausência derrubou o deploy deste repositório duas vezes.

- [ ] **Step 6: Commit**

```bash
./node_modules/.bin/biome check --write apps/app/components/charter/screens/compliance.tsx apps/app/__tests__/screens/compliance.test.tsx
git add apps/app/components/charter/screens/compliance.tsx apps/app/__tests__/screens/compliance.test.tsx
git commit -m "feat(charter): importar conjunto como nova versão de um existente"
```

---

## Verificação de que os bloqueios fecharam

Depois da Task 12, os dois greps que originaram este trabalho precisam devolver caller de produção, não só teste:

```bash
grep -rn "publishSetVersion\|adoptSetVersion\|linkPolicy\|unlinkPolicy" apps/app/components/
```

Esperado: pelo menos uma ocorrência de cada um dos quatro em `components/charter/screens/`. **Se algum aparecer só em `__tests__/`, o bloqueio não fechou** — a peça continua inerte, que é exatamente a doença que este plano existe para curar.
