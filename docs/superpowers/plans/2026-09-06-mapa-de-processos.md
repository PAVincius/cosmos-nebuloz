# Mapa de processos — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma tela em Ferramentas que mostra os processos da casa como grafo navegável — nó por processo, aresta pelo que dispara/alimenta/exige — com criar, editar e excluir processo e ligação, e export `.canvas` (JSON Canvas).

**Architecture:** Duas tabelas novas no tenant `system` (`StaffProcess`, `StaffProcessEdge`), um módulo puro com o layout polar e as regras derivadas, um arquivo de actions no padrão `safeAction` do back-office, e uma tela client com SVG próprio (pan/zoom/arrasto), painel lateral do nó selecionado e um diálogo de formulário. O status do processo é derivado, não coluna.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (schema multi-arquivo), zod 4, Vitest 4 + jsdom, Biome, tokens do design system do back-office.

**Spec:** [`docs/superpowers/specs/2026-09-06-mapa-de-processos-design.md`](../specs/2026-09-06-mapa-de-processos-design.md)

**Design de referência:** projeto Claude Design `691f7fe5-e623-458e-aa9f-92b8c46dbbd9`, arquivos `backoffice-process-map.jsx` (grafo, layout, JSON Canvas) e `backoffice-process-map-screen.jsx` (tela, painel). O controller entrega os trechos relevantes no brief de cada task; nenhum implementer precisa ler o projeto inteiro.

## Global Constraints

- Trabalhar no worktree `/Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/.claude/worktrees/mapa-pendencias-criticas-803c5f`, branch `claude/telas-empresa-modelo`. Nunca `cd` para o checkout principal. Nunca `git stash`.
- A árvore tem ~112 arquivos modificados alheios ao trabalho. Não tocar, não reverter, não dar `git add` neles. Fazer stage só dos próprios arquivos.
- NUNCA `pnpm fix` nem `pnpm check` na raiz — reformata mais de cem arquivos. Lint só nos arquivos próprios: `../../node_modules/.bin/biome check --write <arquivos>`.
- Teste escopado é `cd apps/backoffice && npx vitest run __tests__/<arquivo>`. `pnpm --filter backoffice test -- <arquivo>` NÃO escopa: roda a suíte inteira.
- Usar `/usr/bin/grep` e `/usr/bin/git` (o hook do rtk atrapalha os do PATH).
- Nenhum implementer despacha subagentes.
- Commits em português, no formato `tipo(escopo): descrição`. Sem trailer `Co-Authored-By`.
- Tenant é sempre `system` (`SYSTEM_TENANT_ID` de `@/lib/guard`). Nenhuma leitura cruza tenant.
- Toda action passa por `safeAction` + `requirePlatformStaff`; escrita adiciona `assertCanWrite`, `logPlatformAudit` e `revalidatePath("/ferramentas/processos")`.
- Módulo `lib/` é puro: só `import type` de `@repo/database` e do kit. Nada de `app/actions` dentro de `lib/`.
- Só tokens CSS (`var(--surface)`, `var(--hairline)`, `var(--ink)`, `var(--accent)`, `var(--r-lg)`…). Nenhum hex no JSX. A única exceção é o arquivo `.canvas` exportado, que precisa de cor literal porque o Obsidian não conhece os tokens.
- Biome: nada de ternário aninhado, nada de `noLeakedRender` (pré-calcular booleanos em `const`), nada de componente definido dentro de componente, complexidade cognitiva resolvida com helpers pequenos. `Celula` não aceita `className`.
- Módulo `"use server"` exporta apenas funções `async` e tipos. Uma constante exportada de lá derruba a rota inteira em runtime.
- Arquivo com mais de ~600 linhas deve ser dividido por responsabilidade, no padrão `x.tsx` + `x-partes.tsx` já usado em `funil`.
- Verificação de cada task: `npx vitest run <seus testes>` verde, `npx tsc --noEmit --emitDeclarationOnly false` com zero erros em `apps/backoffice`, Biome limpo nos arquivos tocados.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/database/prisma/schema/processos.prisma` | Os dois modelos novos |
| `packages/database/prisma/migrations/20260909000000_mapa_de_processos/migration.sql` | DDL + RLS |
| `packages/provisioning/src/processos-nebuloz.ts` | Os 21 processos e 23 ligações como dado versionado |
| `apps/backoffice/lib/ferramentas/processos.ts` | Regras puras: domínios, níveis, status derivado, layout polar, busca, JSON Canvas |
| `apps/backoffice/app/actions/processos.ts` | Leitura e escrita, com guard e auditoria |
| `apps/backoffice/app/(staff)/ferramentas/processos/page.tsx` | Server: guard, leitura, cabeçalho |
| `apps/backoffice/app/(staff)/ferramentas/processos/mapa.tsx` | Client raiz: estado, busca, filtros, recarga |
| `apps/backoffice/app/(staff)/ferramentas/processos/grafo.tsx` | SVG apresentacional: anéis, manchas, arestas, nós, pan/zoom |
| `apps/backoffice/app/(staff)/ferramentas/processos/painel.tsx` | Painel do nó selecionado, incluindo ligações |
| `apps/backoffice/app/(staff)/ferramentas/processos/processo-dialog.tsx` | Formulário de criar/editar |
| `packages/database/scripts/2026-09-seed-processos.sql` | Seed de produção, create-only |

---

## Task 1: Schema, migration e dado de seed

**Files:**
- Create: `packages/database/prisma/schema/processos.prisma`
- Create: `packages/database/prisma/migrations/20260909000000_mapa_de_processos/migration.sql`
- Create: `packages/provisioning/src/processos-nebuloz.ts`
- Create: `packages/provisioning/src/__tests__/processos-nebuloz.test.ts`
- Modify: `packages/database/prisma/schema/governance.prisma` (retro-relação em `StaffDiagram`)
- Modify: `apps/app/scripts/seed-empresa-nebuloz.ts` (mais uma etapa)

**Interfaces:**
- Produces: modelos `database.staffProcess` e `database.staffProcessEdge`; `PROCESSOS_NEBULOZ: ProcessoSeed[]` e `LIGACOES_NEBULOZ: LigacaoSeed[]` de `@repo/provisioning/src/processos-nebuloz`.

- [ ] **Step 1: Escrever o schema**

Criar `packages/database/prisma/schema/processos.prisma`:

```prisma
/// Um processo da casa no mapa de processos. O tenant é sempre `system`: o
/// processo é artefato da Nebuloz, não do cliente. O campo existe para a mesma
/// trilha de auditoria e o mesmo escopo que o resto do painel usa.
model StaffProcess {
  id        String @id @default(cuid())
  tenantId  String
  /// Código curto e estável, "PZ-01". É o identificador do nó no .canvas
  /// exportado, então mudar isso quebra arquivo que alguém já salvou.
  codigo    String
  nome      String
  descricao String @db.Text
  /// COMERCIAL | DELIVERY | GOVERNANCA | PLATAFORMA | LAB | MEDICAO
  dominio   String
  /// 1 estratégico · 2 tático · 3 operacional. Decide o anel no layout polar.
  nivel     Int
  /// CORE | APOIO
  tipo      String
  donoNome  String?
  revisadoEm DateTime?
  tags      String[]
  /// Modelo BPMN que descreve o processo. SetNull porque o processo sobrevive
  /// ao diagrama — é conhecimento da casa, o diagrama é uma representação.
  diagramId String?
  /// Onde o documento vive quando não há BPMN. Link, não integração.
  docUrl    String?

  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  diagram  StaffDiagram?      @relation(fields: [diagramId], references: [id], onDelete: SetNull)
  saidas   StaffProcessEdge[] @relation("de")
  entradas StaffProcessEdge[] @relation("para")

  @@unique([tenantId, codigo])
  @@index([tenantId, dominio])
}

/// "de → para: rótulo". Ex.: PZ-01 → PZ-02 "converte em".
model StaffProcessEdge {
  id       String @id @default(cuid())
  tenantId String
  deId     String
  paraId   String
  rotulo   String

  de   StaffProcess @relation("de", fields: [deId], references: [id], onDelete: Cascade)
  para StaffProcess @relation("para", fields: [paraId], references: [id], onDelete: Cascade)

  @@unique([deId, paraId])
  @@index([tenantId])
}
```

Em `packages/database/prisma/schema/governance.prisma`, dentro do bloco `model StaffDiagram`, junto das outras relações, acrescentar:

```prisma
  processos StaffProcess[]
```

- [ ] **Step 2: Validar o schema**

Run: `cd packages/database && npx prisma validate`
Expected: `The schema at prisma/schema is valid 🚀`

- [ ] **Step 3: Gerar a migration**

O `migrate dev` não serve aqui: o banco local tem drift e o Prisma 7 não aceita `--shadow-database-url`. Gerar o SQL por diff:

```bash
cd packages/database
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script \
  > /tmp/processos.sql
```

Criar `prisma/migrations/20260909000000_mapa_de_processos/migration.sql` com o conteúdo de `/tmp/processos.sql` — conferindo que ele contém apenas `CREATE TABLE "StaffProcess"`, `CREATE TABLE "StaffProcessEdge"`, seus índices e as duas foreign keys. Qualquer DDL de outra tabela é drift do banco local e deve ser removido à mão.

Acrescentar ao FIM do arquivo o bloco de RLS, byte a byte no padrão de `20260907000000_conta_do_plano/migration.sql`:

```sql
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'StaffProcess',
    'StaffProcessEdge'
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

- [ ] **Step 4: Aplicar no banco local e gerar o client**

```bash
cd packages/database
set -a; . ../../apps/app/.env.local; set +a
npx prisma migrate deploy
npx prisma generate --no-hints
```
Expected: `1 migration found` / `Applying migration 20260909000000_mapa_de_processos` e `Generated Prisma Client`.

- [ ] **Step 5: Escrever o teste do dado de seed (RED)**

Criar `packages/provisioning/src/__tests__/processos-nebuloz.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LIGACOES_NEBULOZ, PROCESSOS_NEBULOZ } from "../processos-nebuloz";

describe("processos da Nebuloz", () => {
  it("tem os 21 processos e 23 ligações do design", () => {
    expect(PROCESSOS_NEBULOZ).toHaveLength(21);
    expect(LIGACOES_NEBULOZ).toHaveLength(23);
  });

  it("códigos são únicos e no formato PZ-nn", () => {
    const codigos = PROCESSOS_NEBULOZ.map((p) => p.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const c of codigos) {
      expect(c).toMatch(/^PZ-\d{2}$/);
    }
  });

  it("toda ligação aponta para processos que existem e nunca para si mesma", () => {
    const codigos = new Set(PROCESSOS_NEBULOZ.map((p) => p.codigo));
    for (const l of LIGACOES_NEBULOZ) {
      expect(codigos.has(l.de)).toBe(true);
      expect(codigos.has(l.para)).toBe(true);
      expect(l.de).not.toBe(l.para);
    }
  });

  it("nível é 1, 2 ou 3 e domínio é um dos seis", () => {
    const dominios = new Set([
      "COMERCIAL",
      "DELIVERY",
      "GOVERNANCA",
      "PLATAFORMA",
      "LAB",
      "MEDICAO",
    ]);
    for (const p of PROCESSOS_NEBULOZ) {
      expect([1, 2, 3]).toContain(p.nivel);
      expect(dominios.has(p.dominio)).toBe(true);
      expect(["CORE", "APOIO"]).toContain(p.tipo);
    }
  });
});
```

- [ ] **Step 6: Rodar o teste e ver falhar**

Run: `cd packages/provisioning && npx vitest run src/__tests__/processos-nebuloz.test.ts`
Expected: FAIL — `Failed to resolve import "../processos-nebuloz"`.

- [ ] **Step 7: Escrever o dado de seed**

Criar `packages/provisioning/src/processos-nebuloz.ts`. Cabeçalho no padrão de `funil-nebuloz.ts` (só dados e tipos, sem import de valor de `@repo/database`), tipos:

```ts
export type ProcessoSeed = {
  codigo: string;
  nome: string;
  descricao: string;
  dominio:
    | "COMERCIAL"
    | "DELIVERY"
    | "GOVERNANCA"
    | "PLATAFORMA"
    | "LAB"
    | "MEDICAO";
  nivel: 1 | 2 | 3;
  tipo: "CORE" | "APOIO";
  donoNome: string | null;
  revisadoEm: string | null;
  tags: string[];
};

export type LigacaoSeed = { de: string; para: string; rotulo: string };
```

O controller entrega, no brief desta task, a lista literal dos 21 processos e das 23 ligações traduzida de `PROC_NODES`/`PROC_EDGES` do design: `domain` em maiúsculas, `owner` vira `donoNome`, `reviewed` vira `revisadoEm` em ISO (`"28 ago 2026"` → `"2026-08-28"`, `"—"` → `null`), `desc` vira `descricao`, `kind` vira `tipo` (`core` → `CORE`, `support` → `APOIO`). `source`, `bpmn`, `docs` e `status` do design NÃO viram coluna: o status é derivado (spec §0) e não existe `StaffDiagram` correspondente no banco, então `diagramId` e `docUrl` nascem nulos e são preenchidos pela tela.

- [ ] **Step 8: Rodar o teste e ver passar**

Run: `cd packages/provisioning && npx vitest run src/__tests__/processos-nebuloz.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 9: Ligar no script de seed**

Em `apps/app/scripts/seed-empresa-nebuloz.ts`, no mesmo formato das etapas de `EstagioDoFunil`/`CanalDeLead` já existentes (linhas ~93-105), acrescentar uma etapa que cria os processos com `createMany({ skipDuplicates: true })` e, depois, as ligações — resolvendo `de`/`para` de código para id com um `findMany` dos processos do tenant. Atualizar o comentário do topo do arquivo, que lista o que o script semeia, com as duas linhas novas.

- [ ] **Step 10: Commit**

```bash
git add packages/database/prisma/schema/processos.prisma \
  packages/database/prisma/schema/governance.prisma \
  packages/database/prisma/migrations/20260909000000_mapa_de_processos \
  packages/provisioning/src/processos-nebuloz.ts \
  packages/provisioning/src/__tests__/processos-nebuloz.test.ts \
  apps/app/scripts/seed-empresa-nebuloz.ts
git commit -m "feat(database): mapa de processos — StaffProcess, StaffProcessEdge e o dado dos 21 processos"
```

---

## Task 2: Regras puras do mapa

**Files:**
- Create: `apps/backoffice/lib/ferramentas/processos.ts`
- Test: `apps/backoffice/__tests__/processos.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores (módulo puro; os tipos são declarados aqui).
- Produces: `DOMINIOS`, `NIVEIS`, `STATUS`, `Dominio`, `Nivel`, `Status`, `Processo`, `Ligacao`, `Ponto`, `statusDe`, `tomCssDoDominio`, `layoutPolar`, `vizinhos`, `buscar`, `paraJsonCanvas`.

- [ ] **Step 1: Escrever o teste (RED)**

Criar `apps/backoffice/__tests__/processos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buscar,
  DOMINIOS,
  layoutPolar,
  type Processo,
  paraJsonCanvas,
  statusDe,
  vizinhos,
} from "@/lib/ferramentas/processos";

function p(over: Partial<Processo> & { codigo: string }): Processo {
  return {
    id: over.codigo,
    codigo: over.codigo,
    nome: over.nome ?? "Processo",
    descricao: over.descricao ?? "",
    dominio: over.dominio ?? "COMERCIAL",
    nivel: over.nivel ?? 2,
    tipo: over.tipo ?? "CORE",
    donoNome: over.donoNome ?? null,
    revisadoEm: over.revisadoEm ?? null,
    tags: over.tags ?? [],
    diagramId: over.diagramId ?? null,
    docUrl: over.docUrl ?? null,
    diagram: over.diagram ?? null,
  };
}

describe("statusDe", () => {
  it("com BPMN é modelado, com documento é rascunho, sem nada é não mapeado", () => {
    expect(statusDe(p({ codigo: "PZ-01", diagramId: "d1" }))).toBe("MODELADO");
    expect(statusDe(p({ codigo: "PZ-02", docUrl: "https://x" }))).toBe(
      "RASCUNHO"
    );
    expect(statusDe(p({ codigo: "PZ-03" }))).toBe("NAO_MAPEADO");
  });

  it("BPMN ganha do documento — o modelo é a verdade mais forte", () => {
    expect(
      statusDe(p({ codigo: "PZ-04", diagramId: "d1", docUrl: "https://x" }))
    ).toBe("MODELADO");
  });
});

describe("layoutPolar", () => {
  const nos = [
    p({ codigo: "PZ-01", dominio: "COMERCIAL", nivel: 1 }),
    p({ codigo: "PZ-02", dominio: "COMERCIAL", nivel: 3 }),
    p({ codigo: "PZ-03", dominio: "COMERCIAL", nivel: 3 }),
    p({ codigo: "PZ-04", dominio: "LAB", nivel: 2 }),
  ];

  it("é determinístico", () => {
    expect(layoutPolar(nos).pos).toEqual(layoutPolar(nos).pos);
  });

  it("nível 1 fica mais perto do centro que nível 3", () => {
    const { pos, cx, cy } = layoutPolar(nos);
    const raio = (id: string) =>
      Math.hypot(pos[id].x - cx, pos[id].y - cy);
    expect(raio("PZ-01")).toBeLessThan(raio("PZ-02"));
  });

  it("dois nós do mesmo domínio e nível não caem no mesmo ponto", () => {
    const { pos } = layoutPolar(nos);
    expect(pos["PZ-02"]).not.toEqual(pos["PZ-03"]);
  });

  it("devolve uma posição para cada nó, e só para eles", () => {
    const { pos } = layoutPolar(nos);
    expect(Object.keys(pos).sort()).toEqual([
      "PZ-01",
      "PZ-02",
      "PZ-03",
      "PZ-04",
    ]);
  });
});

describe("vizinhos", () => {
  const ligacoes = [
    { id: "e1", deId: "PZ-01", paraId: "PZ-02", rotulo: "converte em" },
    { id: "e2", deId: "PZ-03", paraId: "PZ-01", rotulo: "alimenta" },
  ];

  it("separa saída de entrada", () => {
    expect(vizinhos("PZ-01", ligacoes)).toEqual([
      { outro: "PZ-02", dir: "out", rotulo: "converte em", ligacaoId: "e1" },
      { outro: "PZ-03", dir: "in", rotulo: "alimenta", ligacaoId: "e2" },
    ]);
  });

  it("nó sem ligação devolve lista vazia", () => {
    expect(vizinhos("PZ-99", ligacoes)).toEqual([]);
  });
});

describe("buscar", () => {
  const nos = [
    p({ codigo: "PZ-01", nome: "Funil de leads", tags: ["cac", "estágio"] }),
    p({ codigo: "PZ-02", nome: "Gate de fase", descricao: "Critérios ou override" }),
  ];

  it("consulta vazia não filtra nada", () => {
    expect(buscar("", nos).ids).toBeNull();
  });

  it("ignora acento e caixa", () => {
    expect([...(buscar("ESTAGIO", nos).ids ?? [])]).toEqual(["PZ-01"]);
  });

  it("acha pela descrição", () => {
    expect([...(buscar("override", nos).ids ?? [])]).toEqual(["PZ-02"]);
  });

  it("exige todos os termos, não qualquer um", () => {
    expect([...(buscar("funil override", nos).ids ?? [])]).toEqual([]);
  });

  it("palavra de menos de três letras não conta como termo", () => {
    expect(buscar("de", nos).ids).toBeNull();
  });
});

describe("paraJsonCanvas", () => {
  const nos = [
    p({ codigo: "PZ-01", nome: "Funil de leads", dominio: "COMERCIAL" }),
    p({ codigo: "PZ-02", nome: "Gate de fase", dominio: "DELIVERY" }),
  ];
  const ligacoes = [
    { id: "e1", deId: "PZ-01", paraId: "PZ-02", rotulo: "exige" },
  ];

  it("emite um grupo por domínio presente e um nó por processo", () => {
    const doc = paraJsonCanvas(nos, ligacoes, layoutPolar(nos).pos);
    const grupos = doc.nodes.filter((n) => n.type === "group");
    const arquivos = doc.nodes.filter((n) => n.type === "file");
    expect(grupos).toHaveLength(2);
    expect(arquivos).toHaveLength(2);
  });

  it("nomeia o arquivo do nó pelo código e por um slug sem acento", () => {
    const doc = paraJsonCanvas(nos, ligacoes, layoutPolar(nos).pos);
    const no = doc.nodes.find((n) => n.id === "PZ-01");
    expect(no?.file).toBe("processos/PZ-01-funil-de-leads.md");
  });

  it("cada aresta carrega rótulo e seta, com lados vindos da geometria", () => {
    const doc = paraJsonCanvas(nos, ligacoes, layoutPolar(nos).pos);
    expect(doc.edges).toHaveLength(1);
    expect(doc.edges[0].label).toBe("exige");
    expect(doc.edges[0].toEnd).toBe("arrow");
    expect(["top", "right", "bottom", "left"]).toContain(doc.edges[0].fromSide);
  });

  it("descarta aresta cujo nó está fora do conjunto visível", () => {
    const doc = paraJsonCanvas([nos[0]], ligacoes, layoutPolar([nos[0]]).pos);
    expect(doc.edges).toEqual([]);
  });
});

describe("DOMINIOS", () => {
  it("tem os seis domínios do design, cada um com rótulo e tom", () => {
    expect(Object.keys(DOMINIOS)).toEqual([
      "COMERCIAL",
      "DELIVERY",
      "GOVERNANCA",
      "PLATAFORMA",
      "LAB",
      "MEDICAO",
    ]);
    for (const d of Object.values(DOMINIOS)) {
      expect(d.rotulo.length).toBeGreaterThan(0);
      expect(d.tom.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/processos.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ferramentas/processos"`.

- [ ] **Step 3: Escrever o módulo**

Criar `apps/backoffice/lib/ferramentas/processos.ts`. Sem I/O, sem React, sem Prisma de valor. Conteúdo:

```ts
export const DOMINIOS = {
  COMERCIAL: { rotulo: "Comercial", tom: "amber" },
  DELIVERY: { rotulo: "Delivery", tom: "blue" },
  GOVERNANCA: { rotulo: "Governança", tom: "accent" },
  PLATAFORMA: { rotulo: "Plataforma", tom: "purple" },
  LAB: { rotulo: "LAB", tom: "green" },
  MEDICAO: { rotulo: "Medição", tom: "neutral" },
} as const;

export const NIVEIS = {
  1: {
    rotulo: "Estratégico",
    curto: "Estr.",
    descricao: "Define regra, meta e método. Muda pouco, muda tudo.",
  },
  2: {
    rotulo: "Tático",
    curto: "Tát.",
    descricao: "Decide dentro da regra: gate, revisão, aprovação.",
  },
  3: {
    rotulo: "Operacional",
    curto: "Oper.",
    descricao: "Executa no dia a dia. Volume alto, cadência curta.",
  },
} as const;

export const STATUS = {
  MODELADO: {
    rotulo: "Modelado",
    tom: "green",
    descricao: "BPMN versionado e revisado",
  },
  RASCUNHO: {
    rotulo: "Rascunho",
    tom: "amber",
    descricao: "Existe documento, não existe modelo",
  },
  NAO_MAPEADO: {
    rotulo: "Não mapeado",
    tom: "red",
    descricao: "Roda na cabeça de alguém",
  },
} as const;
```

`statusDe(p)` devolve `"MODELADO"` quando `p.diagramId` é verdadeiro, `"RASCUNHO"` quando `p.docUrl` é verdadeiro, senão `"NAO_MAPEADO"` — nessa ordem, sem ternário aninhado.

`tomCssDoDominio(dominio)` traduz `"neutral"` para `"blue"` e devolve os demais tons como estão. O motivo é o mesmo do funil: não existe token `--neutral`, e emitir `var(--neutral)` deixa o elemento sem cor. Esta é a única tradução; nenhum outro arquivo repete a regra.

`layoutPolar(processos)` porta o `PROC_LAYOUT` do design: `W = 1560`, `H = 940`, `cx = W / 2`, `cy = H / 2`, anéis `{1: {rx: 250, ry: 128}, 2: {rx: 470, ry: 268}, 3: {rx: 670, ry: 392}}`. Cada domínio ocupa um setor angular de `2π / 6`, na ordem das chaves de `DOMINIOS`, começando em `-π/2`. Dentro de um par (setor, anel), os nós se espalham em arco com passo `min(setor * 0.72 / n, 0.42)` centrado no meio do setor, e o raio alterna `×1.09` / `×0.93` conforme o índice para que dois nós não caiam na mesma altura. Devolve `{ W, H, cx, cy, aneis, pos }`, com `pos` indexado por `id` do processo. O controller entrega o trecho literal do design no brief.

`vizinhos(id, ligacoes)` devolve, na ordem em que as ligações aparecem, `{ outro, dir, rotulo, ligacaoId }` — `dir: "out"` quando `deId === id`, `"in"` quando `paraId === id`.

`buscar(q, processos)` normaliza com `.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()`, quebra em termos de três letras ou mais, e devolve `{ ids: null, primeiro: null }` quando não sobra termo. Com termos, um processo entra se TODOS os termos aparecem em `nome + descricao + tags`. Devolve `{ ids: Set<string>, primeiro: string | null }`, ordenado por quantidade de termos batidos.

`paraJsonCanvas(processos, ligacoes, pos)` emite o JSON Canvas 1.0: nó de 168×52 centrado em `pos`, grupos por domínio com margem 22/34/22/18, arestas com `fromSide`/`toSide` decididos pela geometria (a função `ladosDaAresta` do design), `fromEnd: "none"`, `toEnd: "arrow"` e `label`. As cores literais por domínio ficam neste arquivo, em `HEX_DO_DOMINIO`, com um comentário dizendo que são a exceção à regra de tokens porque o arquivo exportado é lido fora do back-office.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd apps/backoffice && npx vitest run __tests__/processos.test.ts`
Expected: PASS.

- [ ] **Step 5: Tipos e lint**

```bash
cd apps/backoffice
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write lib/ferramentas/processos.ts __tests__/processos.test.ts
```
Expected: zero erros; Biome sem apontamentos.

- [ ] **Step 6: Commit**

```bash
git add apps/backoffice/lib/ferramentas/processos.ts apps/backoffice/__tests__/processos.test.ts
git commit -m "feat(backoffice): mapa de processos — regras puras, layout polar e export JSON Canvas"
```

---

## Task 3: Actions

**Files:**
- Create: `apps/backoffice/app/actions/processos.ts`
- Test: `apps/backoffice/__tests__/processos-action.test.ts`

**Interfaces:**
- Consumes: `database.staffProcess` e `database.staffProcessEdge` (Task 1); `Processo`, `Ligacao` (Task 2).
- Produces: `listarProcessos()`, `criarProcesso(input)`, `atualizarProcesso(input)`, `excluirProcesso(input)`, `criarLigacao(input)`, `excluirLigacao(input)`, e os tipos `ProcessoRow`, `LigacaoRow`, `DiagramaRow`, `PayloadMapa`.
- **Compatibilidade de tipo (obrigatória):** `ProcessoRow` tem que satisfazer estruturalmente o `Processo` da Task 2, e `LigacaoRow` o `Ligacao` — mesmos nomes de campo, `revisadoEm` como `string | null` em ISO, `diagram` como `{ id, nome, slug } | null`. As telas passam a linha da action direto para o módulo puro, sem função de conversão: no funil v2 essa conversão existiu, foi copiada para cinco arquivos e teve que ser centralizada depois. Aqui os dois tipos nascem alinhados.

- [ ] **Step 1: Escrever o teste (RED)**

Criar `apps/backoffice/__tests__/processos-action.test.ts` no mesmo formato de `__tests__/funil-config.test.ts` (mock de `@repo/database`, de `@/lib/guard` e de `next/cache`). Casos obrigatórios:

1. `listarProcessos` filtra por `tenantId: SYSTEM_TENANT_ID` nas três consultas (processos, ligações, diagramas BPMN).
2. `criarProcesso` com código já existente devolve `ok: false` e a mensagem `Já existe PZ-01.`, sem chamar `create`.
3. `criarProcesso` recusa código fora do formato: `"PZ-1"` e `"X-01"` devolvem `ok: false`.
4. `criarProcesso` grava `logPlatformAudit` e chama `revalidatePath("/ferramentas/processos")`.
5. `criarProcesso` com `diagramId` de um diagrama que não é `BPMN` devolve `ok: false`.
6. `criarLigacao` com `deId === paraId` devolve `ok: false` e não chama `create`.
7. `criarLigacao` num par que já existe devolve `ok: false` com `Ligação já existe.`.
8. `excluirProcesso` chama `delete` e registra código e nome na auditoria.
9. Papel MEMBER é recusado em cada uma das quatro escritas (`criarProcesso`, `atualizarProcesso`, `excluirProcesso`, `criarLigacao`), porque `assertCanWrite` lança.
10. `atualizarProcesso` usa `updateMany` com o `tenantId` no `where` e trata `count === 0` como erro — mesma guarda que o funil v2 adotou depois da revisão.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/processos-action.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Escrever as actions**

Criar `apps/backoffice/app/actions/processos.ts` com `"use server"` na primeira linha. Só funções `async` e tipos são exportados; qualquer constante (como a rota) fica local ao módulo — constante exportada de um `"use server"` derruba a rota inteira em runtime, e foi exatamente isso que quebrou `/empresa/*` uma vez.

Schemas zod 4:

```ts
const CODIGO = /^PZ-\d{2,3}$/;

const ProcessoSchema = z.object({
  codigo: z.string().trim().regex(CODIGO, "Código no formato PZ-01."),
  nome: z.string().trim().min(2).max(80),
  descricao: z.string().trim().min(1).max(500),
  dominio: z.enum([
    "COMERCIAL",
    "DELIVERY",
    "GOVERNANCA",
    "PLATAFORMA",
    "LAB",
    "MEDICAO",
  ]),
  nivel: z.number().int().min(1).max(3),
  tipo: z.enum(["CORE", "APOIO"]),
  donoNome: z.string().trim().max(60).nullable(),
  revisadoEm: z.iso.date().nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12),
  diagramId: z.string().trim().min(1).nullable(),
  docUrl: z.url().max(500).nullable(),
});

const LigacaoSchema = z.object({
  deId: z.string().trim().min(1),
  paraId: z.string().trim().min(1),
  rotulo: z.string().trim().min(2).max(40),
});
```

`listarProcessos()` devolve `Result<PayloadMapa>` com `{ processos, ligacoes, diagramas }`, todos do tenant `system`, processos ordenados por `codigo` e diagramas restritos a `kind: "BPMN"`. Datas saem como string ISO (`.toISOString()`), como o resto do back-office faz — o payload atravessa a fronteira do servidor e `Date` bruto ali já custou uma tela.

As quatro escritas seguem o padrão de `app/actions/funil-config.ts`: `requirePlatformStaff` → `assertCanWrite` → validação → checagem de unicidade → escrita → `logPlatformAudit` → `revalidatePath`. `atualizarProcesso` usa `updateMany` com `{ id, tenantId: SYSTEM_TENANT_ID }` no `where` e lança `StaffAuthError` quando `count === 0`. A exclusão de processo não precisa apagar arestas à mão: o `onDelete: Cascade` do schema já faz isso.

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd apps/backoffice && npx vitest run __tests__/processos-action.test.ts`
Expected: PASS.

- [ ] **Step 5: Conferir o guard de vazamento entre tenants**

Run: `cd apps/backoffice && npx vitest run __tests__/no-cross-tenant-leak.test.ts`
Expected: PASS — o arquivo novo não pode introduzir consulta sem `tenantId`.

- [ ] **Step 6: Tipos, lint e commit**

```bash
cd apps/backoffice
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write app/actions/processos.ts __tests__/processos-action.test.ts
cd ../..
git add apps/backoffice/app/actions/processos.ts apps/backoffice/__tests__/processos-action.test.ts
git commit -m "feat(backoffice): mapa de processos — actions de processo e ligação com guarda e auditoria"
```

---

## Task 4: O grafo

**Files:**
- Create: `apps/backoffice/app/(staff)/ferramentas/processos/grafo.tsx`
- Modify: `packages/design-system/cosmos/icons.tsx` (ícone `graph`)
- Test: `apps/backoffice/__tests__/processos-grafo.test.tsx`

**Interfaces:**
- Consumes: `layoutPolar`, `vizinhos`, `statusDe`, `tomCssDoDominio`, `DOMINIOS`, `NIVEIS`, `STATUS`, `Processo`, `Ligacao` (Task 2).
- Produces: `Grafo`, componente apresentacional puro. Props: `processos: Processo[]`, `ligacoes: Ligacao[]`, `selecionado: string | null`, `quente: string | null`, `onSelecionar: (id: string | null) => void`, `onExportar: () => void`.

- [ ] **Step 1: Acrescentar o ícone**

Em `packages/design-system/cosmos/icons.tsx`, junto dos demais, acrescentar a entrada `graph` com os traços do design (`backoffice-process-map.jsx`, bloco `Object.assign(ICON_PATHS, …)`):

```tsx
graph: (
  <>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="8" r="2.5" />
    <circle cx="9" cy="18" r="2.5" />
    <circle cx="19" cy="17" r="2" />
    <path d="m8.2 7.2 7.4 0.6M7.2 8.3l1.2 7.3M11.4 17.6l5.6-.4M16.3 10.2l2 4.9" />
  </>
),
```

- [ ] **Step 2: Escrever o teste (RED)**

Criar `apps/backoffice/__tests__/processos-grafo.test.tsx`, em jsdom, no mesmo formato de `__tests__/funil-board.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Grafo } from "@/app/(staff)/ferramentas/processos/grafo";

const PROCESSOS = [
  {
    id: "a",
    codigo: "PZ-01",
    nome: "Funil de leads",
    descricao: "",
    dominio: "COMERCIAL" as const,
    nivel: 2 as const,
    tipo: "CORE" as const,
    donoNome: null,
    revisadoEm: null,
    tags: [],
    diagramId: "d1",
    docUrl: null,
    diagram: null,
  },
  {
    id: "b",
    codigo: "PZ-02",
    nome: "Gate de fase",
    descricao: "",
    dominio: "DELIVERY" as const,
    nivel: 3 as const,
    tipo: "CORE" as const,
    donoNome: null,
    revisadoEm: null,
    tags: [],
    diagramId: null,
    docUrl: null,
    diagram: null,
  },
];
const LIGACOES = [
  { id: "e1", deId: "a", paraId: "b", rotulo: "exige" },
];

describe("Grafo", () => {
  it("desenha um nó por processo, rotulado por código e nome", () => {
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={vi.fn()}
        onSelecionar={vi.fn()}
        processos={PROCESSOS}
        quente={null}
        selecionado={null}
      />
    );
    expect(screen.getByLabelText("PZ-01 Funil de leads")).toBeTruthy();
    expect(screen.getByLabelText("PZ-02 Gate de fase")).toBeTruthy();
  });

  it("clicar num nó o seleciona", () => {
    const onSelecionar = vi.fn();
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={vi.fn()}
        onSelecionar={onSelecionar}
        processos={PROCESSOS}
        quente={null}
        selecionado={null}
      />
    );
    fireEvent.click(screen.getByLabelText("PZ-01 Funil de leads"));
    expect(onSelecionar).toHaveBeenCalledWith("a");
  });

  it("o botão de exportar chama onExportar", () => {
    const onExportar = vi.fn();
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={onExportar}
        onSelecionar={vi.fn()}
        processos={PROCESSOS}
        quente={null}
        selecionado={null}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\.canvas/i }));
    expect(onExportar).toHaveBeenCalledTimes(1);
  });

  it("conta nós e arestas no rodapé", () => {
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={vi.fn()}
        onSelecionar={vi.fn()}
        processos={PROCESSOS}
        quente={null}
        selecionado={null}
      />
    );
    expect(screen.getByText(/2 NÓS/)).toBeTruthy();
    expect(screen.getByText(/1 ARESTA/)).toBeTruthy();
  });

  it("aresta cujo nó sumiu do filtro não é desenhada", () => {
    render(
      <Grafo
        ligacoes={LIGACOES}
        onExportar={vi.fn()}
        onSelecionar={vi.fn()}
        processos={[PROCESSOS[0]]}
        quente={null}
        selecionado={null}
      />
    );
    expect(screen.getByText(/0 ARESTAS/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/processos-grafo.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 4: Escrever o componente**

Criar `grafo.tsx` com `"use client"`. Apresentacional: nenhuma chamada de action dentro. Camadas, de baixo para cima, como no design:

1. Fundo de pontos (`<pattern>` que acompanha o pan).
2. Três elipses de nível, com o rótulo `"2 · TÁTICO"` na borda.
3. Círculo do núcleo no centro.
4. Uma mancha desfocada por domínio (`<filter>` com `feGaussianBlur`), na cor do domínio, opacidade menor quando há seleção; clicar na mancha seleciona o primeiro nó daquele domínio.
5. Rótulo do domínio, `"COMERCIAL · 4"`.
6. Arestas retas com `marker` de seta; realçadas com o rótulo em pílula quando tocam o nó selecionado, esmaecidas quando não.
7. Nós: círculo com a inicial, que vira pílula com nome e `"N2 · Modelado"` no hover ou na seleção. Raio cresce com o grau do nó e com nível 1. `role="button"`, `tabIndex={0}`, `aria-label={`${codigo} ${nome}`}`, `Enter` seleciona.

Interação: roda do mouse dá pan; `⌘`/`ctrl` + roda dá zoom no cursor, preso entre 0,3× e 3×; arrastar o fundo dá pan; arrastar um nó move só na sessão e ele volta para a posição de layout ao soltar a mais de 190 px dela; `Esc` limpa a seleção. Botões de aproximar, afastar e enquadrar no canto inferior direito; botão `.canvas` no canto superior direito. Rodapé com `"N NÓS · G GRUPOS · A ARESTAS"` e o zoom em porcentagem.

Sem animação de deriva, sem molas, sem tema próprio do céu, sem seleção por retângulo: são cortes registrados na spec §0.

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `cd apps/backoffice && npx vitest run __tests__/processos-grafo.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 6: Tipos, lint e commit**

```bash
cd apps/backoffice
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write "app/(staff)/ferramentas/processos/grafo.tsx" __tests__/processos-grafo.test.tsx ../../packages/design-system/cosmos/icons.tsx
cd ../..
git add "apps/backoffice/app/(staff)/ferramentas/processos/grafo.tsx" apps/backoffice/__tests__/processos-grafo.test.tsx packages/design-system/cosmos/icons.tsx
git commit -m "feat(backoffice): mapa de processos — grafo em SVG com anéis por nível e manchas por área"
```

---

## Task 5: Tela, painel e navegação

**Files:**
- Create: `apps/backoffice/app/(staff)/ferramentas/processos/page.tsx`
- Create: `apps/backoffice/app/(staff)/ferramentas/processos/mapa.tsx`
- Create: `apps/backoffice/app/(staff)/ferramentas/processos/painel.tsx`
- Modify: `apps/backoffice/components/nav.ts`
- Test: `apps/backoffice/__tests__/processos-mapa.test.tsx`

**Interfaces:**
- Consumes: `listarProcessos` e os tipos de payload (Task 3); `Grafo` (Task 4); o módulo puro (Task 2).
- Produces: `Mapa` (client raiz) e `Painel`. O diálogo entra na Task 6; até lá, `onNovo` e `onEditar` mostram um aviso "Diálogo chega na próxima tarefa".

- [ ] **Step 1: Escrever o teste (RED)**

Criar `apps/backoffice/__tests__/processos-mapa.test.tsx` em jsdom, com `vi.mock("@/app/actions/processos")`. Casos:

1. Com três processos, a busca por um termo que só bate em um deixa o grafo com um nó e a linha `"1 processo para “…”"` aparece.
2. Filtrar por domínio esconde os nós dos outros domínios.
3. Selecionar um nó abre o painel com o nome, o código e a contagem de ligações.
4. Clicar numa ligação do painel chama a seleção do outro nó.
5. Com `podeEscrever={false}`, os botões "Novo processo", "Editar" e "Excluir" não aparecem, e o botão `.canvas` continua aparecendo.
6. "Excluir" pede confirmação: o primeiro clique não chama a action, o segundo chama.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/processos-mapa.test.tsx`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Escrever a página server**

`page.tsx`: `export const dynamic = "force-dynamic";` e

```tsx
const [staff, res] = await Promise.all([
  requirePlatformStaff(),
  listarProcessos(),
]);
```

`PageHeader` com `eyebrow="Ferramentas · mapa de processos"`, `tone="accent"`, `title="Mapa de processos"` e o subtítulo do design, sem a frase sobre fontes conectadas: `"Cada processo é uma estrela da cor da sua área; a área é a nebulosa que a densidade desenha. Anéis por nível — estratégico no centro, operacional na borda."`. Em `meta`, três `Badge`: `N modelados` (green, `dot`), `N rascunhos` (amber, `dot`) e, só quando maior que zero, `N não mapeados` (red, `dot`). Erro de leitura cai num `<Erro>` abaixo do cabeçalho. O botão "Novo processo" vive dentro de `Mapa`, não no cabeçalho — a lição do funil v2: `WriteButton` precisa de `onClick`, que server component não fornece, e um componente-ponte só para isso é peso morto.

- [ ] **Step 4: Escrever o client raiz**

`mapa.tsx` com `"use client"`. Guarda o payload inteiro em `useState(inicial)` e tem `recarregar()`, que chama `listarProcessos()` e substitui o estado — nunca remenda o estado local depois de uma escrita. Estado local: `q` (busca), `dominio`, `nivel`, `status`, `selecionado`. Os processos visíveis saem de `buscar(q, processos)` cruzado com os três filtros. `FiltroChips` para domínio, nível e status, separados por um traço vertical fino, como no design. Sem resultado, mostra um vazio com botão "Limpar". Exportar monta o `Blob` a partir de `paraJsonCanvas` e dispara o download de `nebuloz-processos.canvas`.

- [ ] **Step 5: Escrever o painel**

`painel.tsx`: `<aside>` grudado no topo, faixa lateral na cor do domínio, eyebrow `"PZ-01 · Comercial · nível 2 tático · núcleo"`, nome, descrição. Quatro cartões: Status (badge), BPMN (nome do diagrama ligado, ou "sem modelo" em âmbar), Dono, Revisado. Bloco do documento com link "Abrir" quando há `docUrl`. Lista de ligações com seta de direção, nome do outro processo e o rótulo; cada linha leva à seleção do outro nó, e ganha um botão `×` quando `podeEscrever`. Tags em pílulas. Rodapé com "Abrir no modelador" (link para `/ferramentas/bpmn`), "Editar" e "Excluir". A exclusão confirma em duas etapas no próprio botão, no padrão de `components/confirmar-acao.tsx`.

- [ ] **Step 6: Ligar na navegação**

Em `apps/backoffice/components/nav.ts`, na seção `Ferramentas`, inserir antes de "Modelagem BPMN":

```ts
{
  href: "/ferramentas/processos",
  icon: "graph",
  label: "Mapa de processos",
},
```

- [ ] **Step 7: Rodar os testes e ver passar**

Run: `cd apps/backoffice && npx vitest run __tests__/processos-mapa.test.tsx __tests__/processos-grafo.test.tsx`
Expected: PASS.

- [ ] **Step 8: Tipos, lint e commit**

```bash
cd apps/backoffice
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write "app/(staff)/ferramentas/processos" components/nav.ts __tests__/processos-mapa.test.tsx
cd ../..
git add "apps/backoffice/app/(staff)/ferramentas/processos" apps/backoffice/components/nav.ts apps/backoffice/__tests__/processos-mapa.test.tsx
git commit -m "feat(backoffice): mapa de processos — tela, painel do nó e item de navegação"
```

---

## Task 6: Diálogo de processo e ligações

**Files:**
- Create: `apps/backoffice/app/(staff)/ferramentas/processos/processo-dialog.tsx`
- Modify: `apps/backoffice/app/(staff)/ferramentas/processos/mapa.tsx` (ligar o diálogo)
- Modify: `apps/backoffice/app/(staff)/ferramentas/processos/painel.tsx` (formulário de nova ligação)
- Test: `apps/backoffice/__tests__/processos-dialog.test.tsx`

**Interfaces:**
- Consumes: `criarProcesso`, `atualizarProcesso`, `criarLigacao`, `excluirLigacao` (Task 3); `Mapa` e `Painel` (Task 5).
- Produces: `ProcessoDialog`. Props: `aberto: boolean`, `processo: ProcessoRow | null` (nulo cria, preenchido edita), `diagramas: DiagramaRow[]`, `onFechar: () => void`, `onSalvar: (input) => Promise<Result<unknown>>`.

- [ ] **Step 1: Escrever o teste (RED)**

Criar `apps/backoffice/__tests__/processos-dialog.test.tsx` em jsdom, copiando os stubs de Radix de `__tests__/funil-dialogs.test.tsx`. Casos:

1. Aberto sem processo, o título é "Novo processo" e "Salvar" começa desabilitado.
2. Preenchendo código, nome e descrição, "Salvar" libera e o clique chama `onSalvar` com `tags` como array — `"cac, estágio"` vira `["cac", "estágio"]`.
3. Código no formato errado (`"PZ-1"`) mantém "Salvar" desabilitado.
4. Aberto com um processo, o título é "Editar processo" e os campos vêm preenchidos.
5. `onSalvar` devolvendo `{ ok: false, error: "Já existe PZ-01." }` mostra a mensagem dentro do diálogo e não fecha.
6. No painel, "Nova ligação" com destino e rótulo chama `criarLigacao` com os dois ids e o rótulo.

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd apps/backoffice && npx vitest run __tests__/processos-dialog.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Escrever o diálogo**

`processo-dialog.tsx` com `"use client"`, usando `Dialog`/`DialogContent` de `@repo/design-system/components/ui/dialog`, estilizado nos tokens, e os campos de `components/campo.tsx` (`Campo`, `INPUT`, `Erro`, `BotaoPrimario`, `rotuloSalvar`). Campos: código, nome, descrição (textarea), chips de domínio, três chips de nível mostrando o `descricao` do nível, chips de tipo, dono, revisado em (`<input type="date">`), tags separadas por vírgula, select do diagrama BPMN com opção "nenhum", e URL do documento. O formulário desmonta ao fechar, para não guardar rascunho de um processo em outro.

Ligar em `mapa.tsx`: estado `dialogoAberto` e `processoEmEdicao`; ao salvar com sucesso, fechar e `recarregar()`. Ligar em `painel.tsx`: mini-formulário de nova ligação com select do destino (todos os processos menos o atual) e campo de rótulo.

- [ ] **Step 4: Rodar todos os testes da tela**

Run: `cd apps/backoffice && npx vitest run __tests__/processos-dialog.test.tsx __tests__/processos-mapa.test.tsx __tests__/processos-grafo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Tipos, lint e commit**

```bash
cd apps/backoffice
npx tsc --noEmit --emitDeclarationOnly false
../../node_modules/.bin/biome check --write "app/(staff)/ferramentas/processos" __tests__/processos-dialog.test.tsx
cd ../..
git add "apps/backoffice/app/(staff)/ferramentas/processos" apps/backoffice/__tests__/processos-dialog.test.tsx
git commit -m "feat(backoffice): mapa de processos — diálogo de processo e formulário de ligação"
```

---

## Task 7: Verificação, seed de produção e registro

**Files:**
- Create: `packages/database/scripts/2026-09-seed-processos.sql`
- Create: `.claude/completions/2026-09-06-mapa-de-processos.md`
- Modify: `docs/comercial/mapa-de-processo.md` (nota apontando para a tela)

- [ ] **Step 1: Rodar a suíte inteira do back-office**

Run: `cd apps/backoffice && npx vitest run`
Expected: tudo verde. Relatar o número real de testes; falha se reporta como falha, não se esconde.

- [ ] **Step 2: Rodar os tipos dos quatro pacotes tocados**

```bash
cd apps/backoffice && npx tsc --noEmit --emitDeclarationOnly false
cd ../app && npx tsc --noEmit --emitDeclarationOnly false
cd ../../packages/database && npx tsc --noEmit --emitDeclarationOnly false
cd ../provisioning && npx tsc --noEmit --emitDeclarationOnly false
```
Expected: zero erros nos quatro.

- [ ] **Step 3: Conferir o estado das migrations no banco local**

```bash
cd packages/database
set -a; . ../../apps/app/.env.local; set +a
npx prisma migrate status
```
Expected: `Database schema is up to date!`, com 109 migrations.

- [ ] **Step 4: Conferir as contagens locais**

Rodar o seed e conferir 21 processos e 23 ligações no tenant `system`. Script descartável vai no scratchpad da sessão, nunca no repositório.

- [ ] **Step 5: Escrever o seed de produção**

Criar `packages/database/scripts/2026-09-seed-processos.sql`, gerado a partir de `processos-nebuloz.ts` e no formato de `2026-09-seed-funil.sql`: cabeçalho explicando o que semeia, que é create-only e qual é a ordem de deploy (primeiro a migration pelo build da Vercel, depois este arquivo no SQL Editor); `BEGIN`/`COMMIT`; um `INSERT … ON CONFLICT ("tenantId","codigo") DO NOTHING` por processo, com ids estáveis no padrão `proc_pz01`; um `INSERT` por ligação, resolvendo `deId`/`paraId` por subconsulta em `StaffProcess` pelo par tenant e código, com `ON CONFLICT ("deId","paraId") DO NOTHING`; e o `SELECT` final devolvendo as duas contagens. Resultado esperado: `21 | 23`.

- [ ] **Step 6: Escrever o registro**

Criar `.claude/completions/2026-09-06-mapa-de-processos.md` no formato de `.claude/completions/2026-09-06-funil-v2.md`: o que entrou por task com os commits, as decisões tomadas durante a execução, o resultado da verificação, os passos que faltam em produção e a seção de ponytail — o que foi cortado do design e por quê.

Em `docs/comercial/mapa-de-processo.md`, acrescentar ao topo uma nota curta dizendo que o mapa navegável dos processos da casa agora vive em `/ferramentas/processos`, e que este documento continua sendo a descrição em prosa do processo comercial.

- [ ] **Step 7: Commit**

```bash
git add packages/database/scripts/2026-09-seed-processos.sql \
  .claude/completions/2026-09-06-mapa-de-processos.md \
  docs/comercial/mapa-de-processo.md
git commit -m "docs: registro do subprojeto C — mapa de processos"
```

---

## Produção

1. O usuário empurra. O build da Vercel aplica `20260909000000_mapa_de_processos`.
2. O usuário roda `packages/database/scripts/2026-09-seed-processos.sql` no SQL Editor do Supabase. Esperado: `21 | 23`.
3. Conferir os dois deploys READY, a ausência de erro novo de runtime e a rota `/ferramentas/processos`.

Até o passo 2 rodar, a tela abre vazia com o estado de "nenhum processo" — não quebra.
