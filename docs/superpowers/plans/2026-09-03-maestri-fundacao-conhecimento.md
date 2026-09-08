# Maestri — Fundação de Conhecimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produzir, por produto, um recorte do grafo de código, um índice e um resumo de memória versionados em `.maestri/knowledge/<produto>/`, mais a note de trabalho que cada especialista do Maestri lê ao acordar — e a rotina que mantém tudo atualizado.

**Architecture:** Três funções puras (`recortar`, `rotear`, `preservarSecoes`) testadas com fixtures pequenas, compostas por um exportador que lê `graphify-out/graph.json`, `.claude/completions/`, `docs/adr/` e a memória do usuário, e escreve arquivos. Fonte de verdade é o arquivo no repositório; as notes do Maestri são geradas a partir dele, nunca o contrário. Uma rotina diária refaz tudo.

**Tech Stack:** TypeScript em `.mts` rodado por `tsx` (padrão dos scripts da raiz), vitest na raiz (sem config — verificado), graphify CLI 0.9.x, Maestri CLI (`note`, `routine`, `floor`) executado de um terminal Maestro.

**Spec:** `docs/superpowers/specs/2026-09-03-maestri-fundacao-conhecimento-design.md`

## Global Constraints

- Contexto just-in-time: nenhum arquivo gerado é pensado para entrar inteiro num prompt; `note.md` tem no máximo 60 linhas (spec §3.3).
- Direção única arquivo → note. A rotina reescreve a note preservando `## Estado de tarefa` e `## Obstáculos`; note nunca alimenta arquivo (spec §3.4).
- Não passar `--force` ao `graphify update`; se o rebuild vier com menos nós, registrar e seguir com o anterior (spec §3.5, §5).
- Completion sem produto vai para `compartilhado`, nunca é descartada (spec §3.2, §5).
- Recorte com menos de 20 nós → aviso, não falha. Signal cai aqui de propósito (spec §5).
- Tudo em `.maestri/knowledge/` é versionado no git (spec §3.3).
- Scripts da raiz vivem em `scripts/` e rodam como `tsx scripts/<nome>.mts` via `pnpm <alias>` (convenção do repositório).
- Chave de arestas do `graph.json` é **`links`**, não `edges`; grafo é não-direcionado (`directed: false`); cada nó tem `id`, `source_file`, `community`; cada aresta tem `source`, `target`, `relation` (verificado no arquivo real).

---

## Fatos verificados antes deste plano

- **O grafo mestre está obsoleto.** `graphify-out/graph.json` foi construído no commit `62855137`, anterior à criação de `apps/app/app/(meridian)` (`52db9df2`) e `(scaffold)` (`66ad386d`). Meridian, Charter, Scaffold e `apps/backoffice` têm **zero nós**. A Tarefa 1 existe por isso.
- A skill do graphify está em 0.8.44 e o pacote em 0.9.20; `graphify install` atualiza.
- `vitest run --root <dir>` funciona na raiz sem arquivo de config.
- Não existe `.maestri/` no repositório nem entrada no `.gitignore`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `scripts/knowledge/tipos.mts` | Tipos `Grafo`, `No`, `Aresta`, `Produto`, `Roteamento` |
| `scripts/knowledge/produtos.mts` | Dados: prefixos por produto e palavras-chave de roteamento — só tabelas, sem lógica |
| `scripts/knowledge/recortar-grafo.mts` | `recortar(grafo, prefixos, hops)` — função pura |
| `scripts/knowledge/rotear-memoria.mts` | `rotear(nomeArquivo, titulo?)` — função pura |
| `scripts/knowledge/preservar-secoes.mts` | `preservarSecoes(noteAtual, noteGerada)` — função pura |
| `scripts/knowledge/exportar.mts` | Orquestra as três e escreve `.maestri/knowledge/` |
| `scripts/knowledge/__tests__/*.test.ts` | Um arquivo de teste por módulo puro |
| `.maestri/knowledge/<produto>/{index.md,graph.json,memory.md,note.md}` | Saída versionada |
| `.maestri/knowledge/maestro/{mapa.md,memoria-empresa.md,nao-roteados.md}` | Saída do Maestro |
| `docs/runbooks/maestri-conhecimento.md` | Os comandos `maestri` que só rodam de um terminal Maestro |
| `package.json` | Aliases `knowledge:refresh` e `test:knowledge` |

---

### Task 1: Reconstruir o grafo mestre

**Files:**
- Modify: `graphify-out/graph.json` (gerado)
- Test: verificação por script, sem arquivo de teste

**Interfaces:**
- Produces: `graphify-out/graph.json` com nós cujo `source_file` começa por `apps/app/app/(meridian)`, `(charter)`, `(scaffold)`, e `apps/backoffice`.

- [ ] **Step 1: Registrar a contagem atual, para comparar depois**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/.claude/worktrees/mapa-pendencias-criticas-803c5f
node -e 'const g=require("./graphify-out/graph.json");console.log("antes:",g.nodes.length,"nós,",g.links.length,"arestas, commit",g.built_at_commit)'
```
Esperado: `antes: 10189 nós, 15392 arestas, commit 628551371aed8f5e44493ec25ea3213dddaa69eb`

- [ ] **Step 2: Atualizar a skill do graphify**

```bash
graphify install --platform claude
```
Esperado: mensagem de skill copiada, sem o aviso `skill is from graphify 0.8.44`.

- [ ] **Step 3: Reconstruir**

```bash
graphify update .
```
Esperado: termina sem erro e reescreve `graphify-out/graph.json`.
**Se falhar por falta de chave de LLM na etapa de clustering**, rodar em duas etapas — extração sem cluster, depois cluster sem nomear comunidades:
```bash
graphify update . --no-cluster && graphify cluster-only . --no-label --no-viz
```
**Se recusar por "fewer nodes"**: não passar `--force`. Parar, registrar a contagem, e reportar — é o comportamento que a spec §5 pede.

- [ ] **Step 4: Verificar que os produtos ausentes agora existem**

```bash
node -e '
const g=require("./graphify-out/graph.json");
const c=p=>g.nodes.filter(n=>n.source_file.startsWith(p)).length;
const r={meridian:c("apps/app/app/(meridian)"),charter:c("apps/app/app/(charter)"),scaffold:c("apps/app/app/(scaffold)"),backoffice:c("apps/backoffice"),total:g.nodes.length};
console.log(r);
if(Object.entries(r).some(([k,v])=>k!=="total"&&v===0)){console.error("FALHA: produto sem nós");process.exit(1)}'
```
Esperado: os quatro com valor maior que zero, `total` maior que 10189, exit 0.

- [ ] **Step 5: Commit**

```bash
git add graphify-out/graph.json
git commit -m "chore(graphify): reconstrói o grafo mestre — Meridian, Charter, Scaffold e back-office entram

O grafo estava no commit 62855137, anterior a três produtos e ao back-office.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Se `git add` disser que `graphify-out/` está ignorado, o grafo não é versionado neste repositório; pular o commit e registrar isso no relatório da tarefa.

---

### Task 2: Tipos e tabelas de produto

**Files:**
- Create: `scripts/knowledge/tipos.mts`
- Create: `scripts/knowledge/produtos.mts`
- Test: `scripts/knowledge/__tests__/produtos.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Produto = "meridian" | "charter" | "scaffold" | "cosmos" | "plataforma" | "signal";
  export type Destino = Produto | "compartilhado";
  export type No = { id: string; source_file: string; community?: number | string; label?: string; [k: string]: unknown };
  export type Aresta = { source: string; target: string; relation?: string; [k: string]: unknown };
  export type Grafo = { nodes: No[]; links: Aresta[]; directed?: boolean; [k: string]: unknown };
  export const PRODUTOS: Produto[];
  export const PREFIXOS: Record<Produto, string[]>;
  export const EXCLUSOES: Partial<Record<Produto, string[]>>;
  export const PALAVRAS_CHAVE: Array<{ produto: Produto; termos: string[] }>;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// scripts/knowledge/__tests__/produtos.test.ts
import { describe, expect, it } from "vitest";
import { EXCLUSOES, PALAVRAS_CHAVE, PREFIXOS, PRODUTOS } from "../produtos.mts";

describe("tabelas de produto", () => {
  it("todo produto exceto signal tem ao menos um prefixo", () => {
    for (const p of PRODUTOS) {
      if (p === "signal") {
        expect(PREFIXOS[p]).toEqual([]);
      } else {
        expect(PREFIXOS[p].length).toBeGreaterThan(0);
      }
    }
  });

  it("nenhum prefixo aparece em dois produtos", () => {
    const vistos = new Map<string, string>();
    for (const [p, lista] of Object.entries(PREFIXOS)) {
      for (const prefixo of lista) {
        expect(vistos.get(prefixo), `prefixo ${prefixo} em ${vistos.get(prefixo)} e ${p}`).toBeUndefined();
        vistos.set(prefixo, p);
      }
    }
  });

  it("toda exclusão pertence a um prefixo do mesmo produto", () => {
    for (const [p, lista] of Object.entries(EXCLUSOES)) {
      for (const ex of lista ?? []) {
        expect(PREFIXOS[p as keyof typeof PREFIXOS].some((pre) => ex.startsWith(pre))).toBe(true);
      }
    }
  });

  it("palavras-chave são minúsculas e sem duplicata entre produtos", () => {
    const vistos = new Set<string>();
    for (const { termos } of PALAVRAS_CHAVE) {
      for (const t of termos) {
        expect(t).toBe(t.toLowerCase());
        expect(vistos.has(t), `termo repetido: ${t}`).toBe(false);
        vistos.add(t);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/knowledge`
Expected: FAIL — `Cannot find module '../produtos.mts'`

- [ ] **Step 3: Write the types**

```ts
// scripts/knowledge/tipos.mts
export type Produto =
  | "meridian"
  | "charter"
  | "scaffold"
  | "cosmos"
  | "plataforma"
  | "signal";

export type Destino = Produto | "compartilhado";

/** Nó do graph.json do graphify. Só os campos que este módulo lê; o resto
 *  passa adiante intacto. */
export type No = {
  id: string;
  source_file: string;
  community?: number | string;
  label?: string;
  [k: string]: unknown;
};

/** Aresta. A chave no arquivo é `links`, não `edges` — verificado. */
export type Aresta = {
  source: string;
  target: string;
  relation?: string;
  [k: string]: unknown;
};

export type Grafo = {
  nodes: No[];
  links: Aresta[];
  directed?: boolean;
  [k: string]: unknown;
};

export type Roteamento = { destino: Destino; motivo: string };
```

- [ ] **Step 4: Write the tables**

```ts
// scripts/knowledge/produtos.mts
import type { Produto } from "./tipos.mts";

export const PRODUTOS: Produto[] = [
  "meridian",
  "charter",
  "scaffold",
  "cosmos",
  "plataforma",
  "signal",
];

/** Prefixos de `source_file` que pertencem ao produto. `packages/*` não
 *  listados entram por hop, nunca por prefixo (spec §3.1). */
export const PREFIXOS: Record<Produto, string[]> = {
  meridian: [
    "apps/app/app/(meridian)",
    "apps/app/app/meridian-responder",
    "apps/app/components/meridian",
    "apps/app/lib/meridian",
    "packages/database/prisma/schema/meridian.prisma",
  ],
  charter: [
    "apps/app/app/(charter)",
    "apps/app/lib/charter",
    "packages/database/prisma/schema/charter.prisma",
    "packages/rbac/src/charter",
  ],
  scaffold: [
    "apps/app/app/(scaffold)",
    "apps/app/lib/scaffold",
    "apps/app/lib/inngest/scaffold-",
    "packages/database/prisma/schema/scaffold.prisma",
    "packages/rbac/src/scaffold-",
  ],
  cosmos: [
    "apps/app/app/(cosmos)",
    "apps/app/components/cosmos",
    "apps/app/app/actions",
    "apps/app/lib/inngest",
    "packages/safe-engine",
  ],
  plataforma: [
    "apps/backoffice",
    "packages/provisioning",
    "packages/auth",
    "packages/database",
  ],
  signal: [],
};

/** Caminhos que casam um prefixo do produto mas pertencem a outro. Aplicado
 *  depois do prefixo: `apps/app/lib/inngest/scaffold-*` é do Scaffold, não do
 *  Cosmos; os `.prisma` de produto não são da plataforma. */
export const EXCLUSOES: Partial<Record<Produto, string[]>> = {
  cosmos: ["apps/app/lib/inngest/scaffold-"],
  plataforma: [
    "packages/database/prisma/schema/meridian.prisma",
    "packages/database/prisma/schema/charter.prisma",
    "packages/database/prisma/schema/scaffold.prisma",
  ],
};

/** Ordem importa: a primeira lista que casar decide (spec §3.2). */
export const PALAVRAS_CHAVE: Array<{ produto: Produto; termos: string[] }> = [
  { produto: "meridian", termos: ["meridian"] },
  { produto: "charter", termos: ["charter"] },
  { produto: "scaffold", termos: ["scaffold"] },
  {
    produto: "cosmos",
    termos: ["kanban", "pi-planning", "epic", "meeting", "cosmos", "story-0", "wsjf"],
  },
  {
    produto: "plataforma",
    termos: ["lgpd", "rbac", "isolamento", "tenant", "rls", "platformdb", "backoffice", "seed"],
  },
];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run scripts/knowledge`
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add scripts/knowledge/tipos.mts scripts/knowledge/produtos.mts scripts/knowledge/__tests__/produtos.test.ts
git commit -m "feat(knowledge): tipos do grafo e tabelas de produto

Prefixos e palavras-chave em tabela, sem lógica, para o recorte e o
roteamento serem funções puras sobre dados que se leem de uma vez.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Recorte do grafo por prefixo com hops

**Files:**
- Create: `scripts/knowledge/recortar-grafo.mts`
- Test: `scripts/knowledge/__tests__/recortar-grafo.test.ts`

**Interfaces:**
- Consumes: `Grafo`, `No`, `Aresta` de `tipos.mts`
- Produces:
  ```ts
  export function pertence(sourceFile: string, prefixos: string[], exclusoes?: string[]): boolean;
  export function recortar(grafo: Grafo, prefixos: string[], opts?: { hops?: number; exclusoes?: string[] }): Grafo;
  ```
  O retorno preserva `directed` e demais chaves de topo do grafo de entrada; `nodes` são os selecionados por prefixo mais os alcançados em até `hops` (padrão 2); `links` são só as arestas com ambas as pontas no resultado.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/knowledge/__tests__/recortar-grafo.test.ts
import { describe, expect, it } from "vitest";
import type { Grafo } from "../tipos.mts";
import { pertence, recortar } from "../recortar-grafo.mts";

// 12 nós, dois "produtos". X = x1..x4, Y = y1..y4, S = s1..s4 (compartilhado).
// Cadeia: x1—s1—s2—y1 ; x2—s3 ; y2—s4 ; x3, x4, y3, y4 isolados.
const fixture: Grafo = {
  directed: false,
  built_at_commit: "abc",
  nodes: [
    ...["x1", "x2", "x3", "x4"].map((id) => ({ id, source_file: `apps/x/${id}.ts`, community: 1 })),
    ...["y1", "y2", "y3", "y4"].map((id) => ({ id, source_file: `apps/y/${id}.ts`, community: 2 })),
    ...["s1", "s2", "s3", "s4"].map((id) => ({ id, source_file: `packages/s/${id}.ts`, community: 3 })),
  ],
  links: [
    { source: "x1", target: "s1", relation: "imports" },
    { source: "s1", target: "s2", relation: "imports" },
    { source: "s2", target: "y1", relation: "imports" },
    { source: "x2", target: "s3", relation: "imports" },
    { source: "y2", target: "s4", relation: "imports" },
  ],
};

const ids = (g: Grafo) => g.nodes.map((n) => n.id).sort();

describe("pertence", () => {
  it("casa por prefixo e respeita exclusão", () => {
    expect(pertence("apps/x/a.ts", ["apps/x"])).toBe(true);
    expect(pertence("apps/xy/a.ts", ["apps/x"])).toBe(true); // prefixo é textual
    expect(pertence("apps/z/a.ts", ["apps/x"])).toBe(false);
    expect(pertence("apps/x/nao.ts", ["apps/x"], ["apps/x/nao"])).toBe(false);
  });
});

describe("recortar", () => {
  it("hops=0 devolve só os nós do prefixo e nenhuma aresta que saia deles", () => {
    const r = recortar(fixture, ["apps/x"], { hops: 0 });
    expect(ids(r)).toEqual(["x1", "x2", "x3", "x4"]);
    expect(r.links).toEqual([]);
  });

  it("hops=1 traz vizinhos diretos, mas não o que está a dois passos", () => {
    const r = recortar(fixture, ["apps/x"], { hops: 1 });
    expect(ids(r)).toEqual(["s1", "s3", "x1", "x2", "x3", "x4"]);
    expect(r.links.map((l) => [l.source, l.target])).toEqual([
      ["x1", "s1"],
      ["x2", "s3"],
    ]);
  });

  it("hops=2 (padrão) chega em s2 mas não em y1, que está a três passos", () => {
    const r = recortar(fixture, ["apps/x"]);
    expect(ids(r)).toEqual(["s1", "s2", "s3", "x1", "x2", "x3", "x4"]);
    expect(ids(r)).not.toContain("y1");
  });

  it("nenhum nó só de Y sem caminho aparece, em nenhum hop", () => {
    const r = recortar(fixture, ["apps/x"], { hops: 5 });
    for (const y of ["y2", "y3", "y4", "s4"]) {
      expect(ids(r)).not.toContain(y);
    }
  });

  it("arestas do resultado só ligam nós do resultado", () => {
    const r = recortar(fixture, ["apps/x"], { hops: 1 });
    const dentro = new Set(r.nodes.map((n) => n.id));
    for (const l of r.links) {
      expect(dentro.has(l.source)).toBe(true);
      expect(dentro.has(l.target)).toBe(true);
    }
  });

  it("preserva community e as chaves de topo do grafo", () => {
    const r = recortar(fixture, ["apps/x"], { hops: 1 });
    expect(r.directed).toBe(false);
    expect(r.built_at_commit).toBe("abc");
    expect(r.nodes.find((n) => n.id === "s1")?.community).toBe(3);
  });

  it("prefixo sem nó nenhum devolve grafo vazio, sem erro", () => {
    const r = recortar(fixture, ["apps/signal"]);
    expect(r.nodes).toEqual([]);
    expect(r.links).toEqual([]);
  });

  it("não muta o grafo de entrada", () => {
    const antes = JSON.stringify(fixture);
    recortar(fixture, ["apps/x"]);
    expect(JSON.stringify(fixture)).toBe(antes);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/knowledge/__tests__/recortar-grafo.test.ts`
Expected: FAIL — `Cannot find module '../recortar-grafo.mts'`

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/knowledge/recortar-grafo.mts
import type { Aresta, Grafo, No } from "./tipos.mts";

export function pertence(
  sourceFile: string,
  prefixos: string[],
  exclusoes: string[] = []
): boolean {
  if (exclusoes.some((e) => sourceFile.startsWith(e))) {
    return false;
  }
  return prefixos.some((p) => sourceFile.startsWith(p));
}

/** Índice de adjacência, não-direcionado: o graph.json é `directed: false`
 *  e uma aresta liga as duas pontas nos dois sentidos. */
function adjacencia(links: Aresta[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!adj.has(a)) {
      adj.set(a, new Set());
    }
    adj.get(a)?.add(b);
  };
  for (const l of links) {
    add(l.source, l.target);
    add(l.target, l.source);
  }
  return adj;
}

/**
 * Subgrafo induzido pelos nós cujo `source_file` casa um prefixo, expandido
 * `hops` níveis pelas arestas. Puro: não muta a entrada.
 *
 * `packages/*` não listados entram aqui por hop, nunca por prefixo — é o que
 * faz o recorte de um produto conter só o compartilhado que ele de fato toca.
 */
export function recortar(
  grafo: Grafo,
  prefixos: string[],
  opts: { hops?: number; exclusoes?: string[] } = {}
): Grafo {
  const hops = opts.hops ?? 2;
  const selecionados = new Set(
    grafo.nodes
      .filter((n) => pertence(n.source_file, prefixos, opts.exclusoes))
      .map((n) => n.id)
  );

  const adj = adjacencia(grafo.links);
  let fronteira = new Set(selecionados);
  for (let i = 0; i < hops; i++) {
    const proxima = new Set<string>();
    for (const id of fronteira) {
      for (const v of adj.get(id) ?? []) {
        if (!selecionados.has(v)) {
          selecionados.add(v);
          proxima.add(v);
        }
      }
    }
    if (proxima.size === 0) {
      break;
    }
    fronteira = proxima;
  }

  const nodes: No[] = grafo.nodes.filter((n) => selecionados.has(n.id));
  const links: Aresta[] = grafo.links.filter(
    (l) => selecionados.has(l.source) && selecionados.has(l.target)
  );

  const { nodes: _n, links: _l, ...topo } = grafo;
  return { ...topo, nodes, links };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/knowledge/__tests__/recortar-grafo.test.ts`
Expected: PASS — 9 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/knowledge/recortar-grafo.mts scripts/knowledge/__tests__/recortar-grafo.test.ts
git commit -m "feat(knowledge): recorte do grafo por prefixo com expansão por hops

Função pura sobre o graph.json. packages/* entra por hop, não por prefixo,
para o recorte de um produto conter só o compartilhado que ele toca.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Roteador de memória

**Files:**
- Create: `scripts/knowledge/rotear-memoria.mts`
- Test: `scripts/knowledge/__tests__/rotear-memoria.test.ts`

**Interfaces:**
- Consumes: `PALAVRAS_CHAVE` de `produtos.mts`; `Roteamento` de `tipos.mts`
- Produces:
  ```ts
  export function rotear(nomeArquivo: string, titulo?: string): Roteamento;
  ```
  `motivo` é o termo que casou, ou `"sem palavra-chave"`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/knowledge/__tests__/rotear-memoria.test.ts
import { describe, expect, it } from "vitest";
import { rotear } from "../rotear-memoria.mts";

// Nomes reais de .claude/completions em 2026-09-03.
const casos: Array<[string, string]> = [
  ["2026-08-28-meridian-diagnose.md", "meridian"],
  ["2026-07-30-charter-case-detail-risk-screens.md", "charter"],
  ["2026-07-30-charter-e2e.md", "charter"],
  ["2026-09-02-scaffold-us2-gate-engine.md", "scaffold"],
  ["2026-09-02-scaffold-mvp-ligacao-meridian.md", "scaffold"],
  ["2026-05-26-kanban-card-review.md", "cosmos"],
  ["2026-06-10-stories-021-025-pi-planning.md", "cosmos"],
  ["2026-07-27-epic-drilldown-story-task.md", "cosmos"],
  ["2026-06-09-meeting-intelligence-foundation.md", "cosmos"],
  ["2026-07-19-cosmos-6-screens.md", "cosmos"],
  ["2026-06-11-story-028.md", "cosmos"],
  ["2026-06-10-story-034-lgpd-audit-isolation.md", "plataforma"],
  ["2026-06-10-story-038-rbac-enforcement.md", "plataforma"],
  ["2026-07-28-isolamento-tenant.md", "plataforma"],
  ["2026-07-28-seed-entrypoint-guard.md", "plataforma"],
  ["2026-06-10-ci-green-step-c.md", "compartilhado"],
  ["2026-05-31-ux-lab-cosmos.md", "cosmos"],
];

describe("rotear", () => {
  it.each(casos)("%s → %s", (nome, esperado) => {
    expect(rotear(nome).destino).toBe(esperado);
  });

  it("a primeira lista que casa decide: scaffold-mvp-ligacao-meridian é scaffold, não meridian", () => {
    expect(rotear("2026-09-02-scaffold-mvp-ligacao-meridian.md").destino).toBe("scaffold");
  });

  it("story-034-lgpd: 'story-0' é cosmos mas 'lgpd' é plataforma — quem vence?", () => {
    // A ordem das listas em PALAVRAS_CHAVE põe cosmos antes de plataforma, e
    // "story-0" casa. A tabela de casos acima diz que o esperado é plataforma.
    // Resolver na implementação: termos mais específicos vencem os genéricos.
    expect(rotear("2026-06-10-story-034-lgpd-audit-isolation.md").destino).toBe("plataforma");
  });

  it("título conta quando o nome não diz nada", () => {
    expect(rotear("2026-09-01-nota.md", "Ajuste no Charter interno").destino).toBe("charter");
  });

  it("é case-insensitive", () => {
    expect(rotear("MERIDIAN-Rollout.md").destino).toBe("meridian");
  });

  it("sem palavra-chave vai para compartilhado com motivo explícito", () => {
    const r = rotear("2026-01-01-nada.md");
    expect(r).toEqual({ destino: "compartilhado", motivo: "sem palavra-chave" });
  });

  it("motivo é o termo que casou", () => {
    expect(rotear("x-wsjf-y.md").motivo).toBe("wsjf");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/knowledge/__tests__/rotear-memoria.test.ts`
Expected: FAIL — `Cannot find module '../rotear-memoria.mts'`

- [ ] **Step 3: Write minimal implementation**

O teste `story-034-lgpd` fixa uma regra que a spec deixou implícita: **termo específico vence genérico**. `story-0` e `epic` são genéricos do Cosmos; `lgpd`, `rbac`, `isolamento` são específicos da plataforma. Implementação: casar todos os termos de todas as listas, e escolher o mais longo — empate resolve pela ordem das listas.

```ts
// scripts/knowledge/rotear-memoria.mts
import { PALAVRAS_CHAVE } from "./produtos.mts";
import type { Roteamento } from "./tipos.mts";

/**
 * Decide o produto de um arquivo de memória pelo nome e, se houver, título.
 *
 * Regra: entre todos os termos que casam, vence o mais longo — termo
 * específico ("lgpd", "isolamento") bate genérico ("story-0", "epic"). Empate
 * de comprimento resolve pela ordem de PALAVRAS_CHAVE. Sem termo nenhum,
 * "compartilhado" com motivo explícito, para a note do Maestro listar.
 */
export function rotear(nomeArquivo: string, titulo = ""): Roteamento {
  const alvo = `${nomeArquivo} ${titulo}`.toLowerCase();
  let melhor: Roteamento | null = null;
  let melhorTamanho = -1;

  for (const { produto, termos } of PALAVRAS_CHAVE) {
    for (const termo of termos) {
      if (alvo.includes(termo) && termo.length > melhorTamanho) {
        melhor = { destino: produto, motivo: termo };
        melhorTamanho = termo.length;
      }
    }
  }

  return melhor ?? { destino: "compartilhado", motivo: "sem palavra-chave" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/knowledge/__tests__/rotear-memoria.test.ts`
Expected: PASS — todos. Se `story-028` falhar: `story-0` (7) casa cosmos e nada mais casa; passa. Se `scaffold-mvp-ligacao-meridian` falhar: `scaffold` (8) e `meridian` (8) empatam; a ordem da tabela põe meridian primeiro — **isso quebra o teste**. Correção esperada: mudar a comparação para `>=` **não** resolve (daria o último). Resolver mantendo `>` e reordenando `PALAVRAS_CHAVE` em `produtos.mts` para `scaffold` vir antes de `meridian`, com comentário: *"scaffold antes de meridian: uma completion do Scaffold que menciona a ligação com o Meridian é do Scaffold."* Rodar o teste de `produtos.test.ts` de novo depois.

- [ ] **Step 5: Commit**

```bash
git add scripts/knowledge/rotear-memoria.mts scripts/knowledge/__tests__/rotear-memoria.test.ts scripts/knowledge/produtos.mts
git commit -m "feat(knowledge): roteador de memória por palavra-chave

Termo específico vence genérico: story-034-lgpd é da plataforma, não do
Cosmos. Testado contra os nomes reais das 29 completions.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Preservar as seções do especialista na note

**Files:**
- Create: `scripts/knowledge/preservar-secoes.mts`
- Test: `scripts/knowledge/__tests__/preservar-secoes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const SECOES_RESERVADAS: readonly ["## Estado de tarefa", "## Obstáculos"];
  export function extrairSecao(markdown: string, titulo: string): string | null;
  export function preservarSecoes(noteAtual: string | null, noteGerada: string): { note: string; avisos: string[] };
  ```
  `noteGerada` sempre contém as duas seções vazias no fim. `preservarSecoes` substitui o corpo delas pelo que `noteAtual` tinha. Se `noteAtual` não tem uma seção, mantém vazia e adiciona aviso.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/knowledge/__tests__/preservar-secoes.test.ts
import { describe, expect, it } from "vitest";
import { extrairSecao, preservarSecoes } from "../preservar-secoes.mts";

const gerada = [
  "# meridian",
  "",
  "Resumo regenerado pela rotina.",
  "",
  "## Estado de tarefa",
  "",
  "## Obstáculos",
  "",
].join("\n");

describe("extrairSecao", () => {
  it("devolve o corpo entre o título e o próximo ## ou o fim", () => {
    const md = "# t\n\n## A\nlinha a1\nlinha a2\n\n## B\nlinha b\n";
    expect(extrairSecao(md, "## A")).toBe("linha a1\nlinha a2");
    expect(extrairSecao(md, "## B")).toBe("linha b");
  });

  it("seção ausente → null; seção vazia → string vazia", () => {
    expect(extrairSecao("# t\n## A\n", "## B")).toBeNull();
    expect(extrairSecao("# t\n## A\n\n## B\n", "## A")).toBe("");
  });
});

describe("preservarSecoes", () => {
  it("mantém byte a byte o que o especialista escreveu nas duas seções", () => {
    const atual = [
      "# meridian",
      "",
      "Resumo VELHO que a rotina vai substituir.",
      "",
      "## Estado de tarefa",
      "- [ ] G-02 em andamento",
      "  detalhe com   espaços   e `código`",
      "",
      "## Obstáculos",
      "Plano do Fireflies não expõe participants — confirmar.",
      "",
    ].join("\n");

    const { note, avisos } = preservarSecoes(atual, gerada);
    expect(avisos).toEqual([]);
    expect(note).toContain("Resumo regenerado pela rotina.");
    expect(note).not.toContain("Resumo VELHO");
    expect(extrairSecao(note, "## Estado de tarefa")).toBe(
      "- [ ] G-02 em andamento\n  detalhe com   espaços   e `código`"
    );
    expect(extrairSecao(note, "## Obstáculos")).toBe(
      "Plano do Fireflies não expõe participants — confirmar."
    );
  });

  it("note atual nula (primeira execução) → devolve a gerada, sem aviso", () => {
    const { note, avisos } = preservarSecoes(null, gerada);
    expect(note).toBe(gerada);
    expect(avisos).toEqual([]);
  });

  it("especialista apagou uma seção → recria vazia e avisa (spec §5)", () => {
    const semObstaculos = "# meridian\n\n## Estado de tarefa\nfoo\n";
    const { note, avisos } = preservarSecoes(semObstaculos, gerada);
    expect(extrairSecao(note, "## Estado de tarefa")).toBe("foo");
    expect(extrairSecao(note, "## Obstáculos")).toBe("");
    expect(avisos).toEqual(['seção "## Obstáculos" ausente na note atual — recriada vazia']);
  });

  it("é idempotente: aplicar duas vezes dá o mesmo resultado", () => {
    const atual = "# m\n\n## Estado de tarefa\nx\n\n## Obstáculos\ny\n";
    const uma = preservarSecoes(atual, gerada).note;
    const duas = preservarSecoes(uma, gerada).note;
    expect(duas).toBe(uma);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/knowledge/__tests__/preservar-secoes.test.ts`
Expected: FAIL — `Cannot find module '../preservar-secoes.mts'`

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/knowledge/preservar-secoes.mts
export const SECOES_RESERVADAS = ["## Estado de tarefa", "## Obstáculos"] as const;

/** Corpo de uma seção `## Título`: da linha seguinte ao título até a próxima
 *  linha que comece com `## ` ou o fim. Sem trims internos — o que o
 *  especialista escreveu volta byte a byte; só as linhas em branco das bordas
 *  saem, porque são separação de seção, não conteúdo. */
export function extrairSecao(markdown: string, titulo: string): string | null {
  const linhas = markdown.split("\n");
  const inicio = linhas.findIndex((l) => l.trimEnd() === titulo);
  if (inicio === -1) {
    return null;
  }
  let fim = linhas.length;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (linhas[i].startsWith("## ")) {
      fim = i;
      break;
    }
  }
  const corpo = linhas.slice(inicio + 1, fim);
  while (corpo.length && corpo[0].trim() === "") {
    corpo.shift();
  }
  while (corpo.length && corpo[corpo.length - 1].trim() === "") {
    corpo.pop();
  }
  return corpo.join("\n");
}

function substituirSecao(markdown: string, titulo: string, corpo: string): string {
  const linhas = markdown.split("\n");
  const inicio = linhas.findIndex((l) => l.trimEnd() === titulo);
  if (inicio === -1) {
    return `${markdown.replace(/\n*$/, "")}\n\n${titulo}\n${corpo}\n`;
  }
  let fim = linhas.length;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (linhas[i].startsWith("## ")) {
      fim = i;
      break;
    }
  }
  const novoCorpo = corpo === "" ? [""] : [...corpo.split("\n"), ""];
  return [...linhas.slice(0, inicio + 1), ...novoCorpo, ...linhas.slice(fim)].join("\n");
}

/**
 * Regenera a note preservando o que só o especialista escreve.
 * Direção única: o gerado substitui tudo, exceto as seções reservadas, que
 * voltam da note atual. Seção ausente na atual vira aviso, não erro.
 */
export function preservarSecoes(
  noteAtual: string | null,
  noteGerada: string
): { note: string; avisos: string[] } {
  if (noteAtual === null) {
    return { note: noteGerada, avisos: [] };
  }
  const avisos: string[] = [];
  let note = noteGerada;
  for (const titulo of SECOES_RESERVADAS) {
    const corpo = extrairSecao(noteAtual, titulo);
    if (corpo === null) {
      avisos.push(`seção "${titulo}" ausente na note atual — recriada vazia`);
      continue;
    }
    note = substituirSecao(note, titulo, corpo);
  }
  return { note, avisos };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/knowledge/__tests__/preservar-secoes.test.ts`
Expected: PASS — 6 tests. Se o teste de idempotência falhar por diferença de linhas em branco no fim, ajustar `substituirSecao` para normalizar o fim de arquivo em exatamente um `\n` — e só isso.

- [ ] **Step 5: Commit**

```bash
git add scripts/knowledge/preservar-secoes.mts scripts/knowledge/__tests__/preservar-secoes.test.ts
git commit -m "feat(knowledge): preserva Estado de tarefa e Obstáculos ao regerar a note

Direção única arquivo → note. O que o especialista escreveu volta byte a
byte; seção apagada é recriada vazia com aviso, nunca erro.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Exportador

**Files:**
- Create: `scripts/knowledge/exportar.mts`
- Create: `.maestri/knowledge/**` (gerado pelo script)
- Modify: `package.json` (dois aliases)
- Test: execução contra o repositório, com checagens por script

**Interfaces:**
- Consumes: `recortar`, `rotear`, `preservarSecoes`, `PRODUTOS`, `PREFIXOS`, `EXCLUSOES`
- Produces: `.maestri/knowledge/<produto>/{index.md,graph.json,memory.md,note.md}` e `.maestri/knowledge/maestro/{mapa.md,memoria-empresa.md,nao-roteados.md}`; alias `pnpm knowledge:refresh`.

- [ ] **Step 1: Adicionar os aliases no package.json**

Em `package.json`, dentro de `"scripts"`, depois da linha `"cosmos:graph": ...`:

```json
    "knowledge:refresh": "tsx scripts/knowledge/exportar.mts",
    "test:knowledge": "vitest run scripts/knowledge",
```

- [ ] **Step 2: Write the exporter**

```ts
// scripts/knowledge/exportar.mts
/**
 * Fundação de conhecimento por produto para o Maestri.
 *
 *   pnpm knowledge:refresh
 *
 * Lê graphify-out/graph.json, .claude/completions, docs/adr e a memória do
 * usuário; escreve .maestri/knowledge/<produto>/. Fonte de verdade é o
 * arquivo — a note do Maestri é gerada daqui, nunca o contrário
 * (docs/superpowers/specs/2026-09-03-maestri-fundacao-conhecimento-design.md).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { preservarSecoes, SECOES_RESERVADAS } from "./preservar-secoes.mts";
import { EXCLUSOES, PREFIXOS, PRODUTOS } from "./produtos.mts";
import { recortar } from "./recortar-grafo.mts";
import { rotear } from "./rotear-memoria.mts";
import type { Destino, Grafo, Produto } from "./tipos.mts";

const RAIZ = process.cwd();
const SAIDA = join(RAIZ, ".maestri", "knowledge");
const GRAFO_MESTRE = join(RAIZ, "graphify-out", "graph.json");
const COMPLETIONS = join(RAIZ, ".claude", "completions");
const SESSOES = join(RAIZ, ".claude", "sessions");
const ADRS = join(RAIZ, "docs", "adr");
const MEMORIA_USUARIO = join(
  homedir(),
  ".claude",
  "projects",
  "-Users-azos-Documents-Github-web-backoffice-my-cosmos-nebuloz",
  "memory"
);
const MIN_NOS = 20;
const MAX_PALAVRAS_RESUMO = 200;
const MAX_LINHAS_NOTE = 60;

type Doc = { arquivo: string; titulo: string; corpo: string; destino: Destino; motivo: string };

function lerMd(dir: string): Array<{ arquivo: string; titulo: string; corpo: string }> {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "MEMORY.md")
    .sort()
    .reverse()
    .map((f) => {
      const corpo = readFileSync(join(dir, f), "utf8");
      const titulo = corpo.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? f;
      return { arquivo: f, titulo, corpo };
    });
}

function resumir(corpo: string, maxPalavras: number): string {
  const semTitulo = corpo.replace(/^#.*$/m, "").replace(/^---[\s\S]*?---/m, "");
  const palavras = semTitulo.split(/\s+/).filter(Boolean);
  const corte = palavras.slice(0, maxPalavras).join(" ");
  return palavras.length > maxPalavras ? `${corte} …` : corte;
}

function rotearTodos(dir: string): Doc[] {
  return lerMd(dir).map((d) => ({ ...d, ...rotear(d.arquivo, d.titulo) }));
}

function escrever(caminho: string, conteudo: string): void {
  mkdirSync(join(caminho, ".."), { recursive: true });
  writeFileSync(caminho, conteudo);
}

function indexMd(p: Produto, grafo: Grafo, adrs: Doc[], completions: Doc[], avisos: string[]): string {
  const cmd = `.maestri/knowledge/${p}/graph.json`;
  return [
    `# ${p} — índice de conhecimento`,
    "",
    `Gerado por \`pnpm knowledge:refresh\`. Fonte de verdade: os arquivos abaixo. Não editar à mão.`,
    "",
    "## Onde o código vive",
    ...(PREFIXOS[p].length ? PREFIXOS[p].map((x) => `- \`${x}\``) : ["- *nenhum caminho — este produto ainda não tem código*"]),
    "",
    "## Grafo",
    `- ${grafo.nodes.length} nós, ${grafo.links.length} arestas (recorte do mestre com 2 hops)`,
    ...avisos.map((a) => `- ⚠ ${a}`),
    "",
    "Consultar sem carregar o arquivo:",
    "```bash",
    `graphify explain "<nó>" --graph ${cmd}`,
    `graphify path "<a>" "<b>" --graph ${cmd}`,
    "```",
    "",
    "## ADRs que valem aqui",
    ...(adrs.length ? adrs.map((a) => `- [${a.titulo}](../../../docs/adr/${a.arquivo})`) : ["- nenhum roteado"]),
    "",
    "## Memória de execução",
    `- ${completions.length} completions em \`memory.md\``,
    "",
  ].join("\n");
}

function memoryMd(p: Produto, docs: Doc[]): string {
  return [
    `# ${p} — memória de execução`,
    "",
    ...docs.flatMap((d) => [
      `## ${d.titulo}`,
      `*${d.arquivo}* · roteado por "${d.motivo}"`,
      "",
      resumir(d.corpo, MAX_PALAVRAS_RESUMO),
      "",
    ]),
  ].join("\n");
}

function noteMd(p: Produto, grafo: Grafo, adrs: Doc[], completions: Doc[], avisos: string[]): string {
  const linhas = [
    `# ${p}`,
    "",
    `Você é o especialista em **${p}**. Leia isto ao acordar; consulte o resto sob demanda.`,
    "",
    `- Código: ${PREFIXOS[p].length ? PREFIXOS[p].map((x) => `\`${x}\``).join(", ") : "*ainda não existe*"}`,
    `- Grafo: ${grafo.nodes.length} nós — \`graphify explain "<nó>" --graph .maestri/knowledge/${p}/graph.json\``,
    `- Índice completo: \`.maestri/knowledge/${p}/index.md\``,
    `- Memória: \`.maestri/knowledge/${p}/memory.md\` (${completions.length} completions)`,
    ...avisos.map((a) => `- ⚠ ${a}`),
    "",
    "## ADRs",
    ...adrs.slice(0, 8).map((a) => `- ${a.titulo}`),
    ...(adrs.length > 8 ? [`- … e mais ${adrs.length - 8} no index.md`] : []),
    "",
    "## Últimas execuções",
    ...completions.slice(0, 5).map((c) => `- ${c.titulo} (${c.arquivo.slice(0, 10)})`),
    "",
    ...SECOES_RESERVADAS.flatMap((s) => [s, ""]),
  ];
  return linhas.slice(0, MAX_LINHAS_NOTE).join("\n");
}

function main(): void {
  const mestre: Grafo = JSON.parse(readFileSync(GRAFO_MESTRE, "utf8"));
  const completions = [...rotearTodos(COMPLETIONS), ...rotearTodos(SESSOES)];
  const adrs = rotearTodos(ADRS);
  const relatorio: string[] = [`# refresh ${new Date().toISOString().slice(0, 10)}`, ""];

  for (const p of PRODUTOS) {
    const avisos: string[] = [];
    const grafo = recortar(mestre, PREFIXOS[p], { hops: 2, exclusoes: EXCLUSOES[p] });
    if (grafo.nodes.length < MIN_NOS) {
      avisos.push(`recorte com ${grafo.nodes.length} nós (< ${MIN_NOS}) — ${p === "signal" ? "esperado: sem código" : "conferir prefixos"}`);
    }
    const adrsP = adrs.filter((a) => a.destino === p);
    const compP = completions.filter((c) => c.destino === p);
    const dir = join(SAIDA, p);

    escrever(join(dir, "graph.json"), JSON.stringify(grafo));
    escrever(join(dir, "index.md"), indexMd(p, grafo, adrsP, compP, avisos));
    escrever(join(dir, "memory.md"), memoryMd(p, compP));

    const noteAtual = existsSync(join(dir, "note.md")) ? readFileSync(join(dir, "note.md"), "utf8") : null;
    const { note, avisos: avisosNote } = preservarSecoes(noteAtual, noteMd(p, grafo, adrsP, compP, avisos));
    escrever(join(dir, "note.md"), note);

    relatorio.push(`- **${p}**: ${grafo.nodes.length} nós · ${adrsP.length} ADRs · ${compP.length} completions${[...avisos, ...avisosNote].map((a) => ` · ⚠ ${a}`).join("")}`);
  }

  const naoRoteados = [...completions, ...adrs].filter((d) => d.destino === "compartilhado");
  const memoriaEmpresa = lerMd(MEMORIA_USUARIO);
  const maestro = join(SAIDA, "maestro");
  escrever(join(maestro, "mapa.md"), [
    "# mapa — um produto por linha",
    "",
    ...PRODUTOS.map((p) => `- **${p}** → \`.maestri/knowledge/${p}/index.md\``),
    "",
  ].join("\n"));
  escrever(join(maestro, "memoria-empresa.md"), [
    "# memória de empresa (do usuário, não de produto)",
    "",
    ...memoriaEmpresa.flatMap((m) => [`## ${m.titulo}`, "", resumir(m.corpo, MAX_PALAVRAS_RESUMO), ""]),
  ].join("\n"));
  escrever(join(maestro, "nao-roteados.md"), [
    "# não roteados — decidir o produto à mão",
    "",
    ...(naoRoteados.length ? naoRoteados.map((d) => `- \`${d.arquivo}\` — ${d.titulo}`) : ["- nenhum"]),
    "",
  ].join("\n"));
  relatorio.push("", `- não roteados: ${naoRoteados.length} (ver maestro/nao-roteados.md)`);

  escrever(join(SAIDA, `refresh-${new Date().toISOString().slice(0, 10)}.md`), relatorio.join("\n"));
  console.log(relatorio.join("\n"));
}

main();
```

- [ ] **Step 3: Run against the repository**

Run: `pnpm knowledge:refresh`
Expected: imprime uma linha por produto com contagens; `signal` com o aviso `esperado: sem código`; nenhum produto além de `signal` abaixo de 20 nós (se houver, os prefixos da Tarefa 2 estão errados para aquele produto — corrigir lá, não aqui).

- [ ] **Step 4: Verify the outputs by script**

```bash
node -e '
const fs=require("fs");const P=["meridian","charter","scaffold","cosmos","plataforma","signal"];
for(const p of P){for(const f of ["index.md","graph.json","memory.md","note.md"]){if(!fs.existsSync(`.maestri/knowledge/${p}/${f}`)){console.error("FALTA",p,f);process.exit(1)}}
 const n=fs.readFileSync(`.maestri/knowledge/${p}/note.md`,"utf8");
 if(n.split("\n").length>61){console.error("note longa demais",p);process.exit(1)}
 if(!n.includes("## Estado de tarefa")||!n.includes("## Obstáculos")){console.error("note sem seções reservadas",p);process.exit(1)}}
for(const f of ["mapa.md","memoria-empresa.md","nao-roteados.md"]){if(!fs.existsSync(`.maestri/knowledge/maestro/${f}`)){console.error("FALTA maestro",f);process.exit(1)}}
console.log("ok: 6 produtos × 4 arquivos + maestro × 3")'
```
Expected: `ok: 6 produtos × 4 arquivos + maestro × 3`

- [ ] **Step 5: Verify preservation end-to-end**

```bash
printf '\n- [ ] tarefa de teste do especialista\n' >> .maestri/knowledge/meridian/note.md
pnpm knowledge:refresh >/dev/null
grep -c "tarefa de teste do especialista" .maestri/knowledge/meridian/note.md
```
Expected: `1` — a linha sobreviveu ao refresh porque estava sob `## Obstáculos` (última seção). Depois remover a linha de teste: rodar `git checkout -- .maestri/knowledge/meridian/note.md` **só se** o arquivo já estiver commitado; senão, editar a linha fora à mão e rodar `pnpm knowledge:refresh` de novo.

- [ ] **Step 6: Run the full knowledge test suite**

Run: `pnpm test:knowledge`
Expected: PASS — todos os arquivos de `scripts/knowledge/__tests__`.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/knowledge/exportar.mts .maestri/knowledge
git commit -m "feat(knowledge): exportador da fundação de conhecimento por produto

Escreve .maestri/knowledge/<produto>/{index,graph,memory,note} e o
diretório do Maestro. A note tem no máximo 60 linhas e duas seções que só o
especialista escreve, preservadas a cada refresh. Signal sai com grafo vazio
e o índice diz isso.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Runbook dos comandos Maestri e a rotina

**Files:**
- Create: `docs/runbooks/maestri-conhecimento.md`
- Test: leitura — os comandos só executam de um terminal Maestro

**Interfaces:**
- Consumes: os arquivos de `.maestri/knowledge/` da Tarefa 6
- Produces: instruções executáveis para criar as notes, o floor e a rotina.

- [ ] **Step 1: Confirmar a sintaxe de `note` dentro do Maestri**

De um terminal Maestro (esta sessão está fora; o executor precisa estar dentro):

```bash
maestri note --help
```
Anotar se `create`/`write` recebem conteúdo por `--file` ou por argumento posicional. Isso decide a forma dos comandos no passo 2 — a spec §3.4 deixou marcado como "a confirmar".

- [ ] **Step 2: Write the runbook**

```markdown
# Runbook: fundação de conhecimento no Maestri

Os arquivos em `.maestri/knowledge/` são a fonte de verdade e são versionados.
As notes no canvas são geradas a partir deles. **Nunca o contrário.**

Tudo abaixo roda de um terminal com Modo Maestro ligado, na raiz do repositório.

## 1. Primeira vez — criar as notes

Uma note por produto, mais a do Maestro. Se `maestri note create` receber
conteúdo por `--file`:

```bash
for p in meridian charter scaffold cosmos plataforma signal; do
  maestri note create "$p" --file ".maestri/knowledge/$p/note.md"
done
maestri note create "maestro" --file ".maestri/knowledge/maestro/mapa.md"
```

Se receber por argumento:

```bash
for p in meridian charter scaffold cosmos plataforma signal; do
  maestri note create "$p" "$(cat ".maestri/knowledge/$p/note.md")"
done
maestri note create "maestro" "$(cat .maestri/knowledge/maestro/mapa.md)"
```

## 2. Floor da rotina

Sem git, para não disputar com trabalho ativo de especialista:

```bash
maestri floor create "conhecimento" --no-git
```

## 3. A rotina

```bash
maestri routine create "refresh-conhecimento" \
  --daily 06:00 \
  --terminal "conhecimento" \
  --command "graphify update . && pnpm knowledge:refresh && for p in meridian charter scaffold cosmos plataforma signal; do maestri note write \"\$p\" --file \".maestri/knowledge/\$p/note.md\"; done && maestri note write maestro --file .maestri/knowledge/maestro/mapa.md"
```

Ajustar `--file` para a forma confirmada no passo 1. Testar uma vez, sem
esperar o horário:

```bash
maestri routine run "refresh-conhecimento"
```

## 4. O que a rotina respeita

- `graphify update` sem `--force`: se o rebuild vier com menos nós, o
  graphify recusa, o exportador roda com o mestre anterior, e o
  `refresh-<data>.md` registra a contagem.
- As seções `## Estado de tarefa` e `## Obstáculos` de cada note sobrevivem
  ao `note write`, porque o exportador as preserva antes de escrever.
- Um `refresh-<data>.md` por dia em `.maestri/knowledge/`; o de ontem não é
  sobrescrito.

## 5. Quando algo dá errado

| Sintoma | Causa provável | Ação |
|---|---|---|
| Produto com menos de 20 nós no relatório | prefixo errado em `scripts/knowledge/produtos.mts` | corrigir a tabela, rodar `pnpm test:knowledge`, refresh |
| `nao-roteados.md` crescendo | completion nova sem palavra-chave | acrescentar termo em `PALAVRAS_CHAVE` ou aceitar como compartilhado |
| note perdeu o "Estado de tarefa" | alguém apagou a seção à mão | a rotina recria vazia e avisa no `refresh-<data>.md` |
| `graphify` recusa o rebuild | rebuild com menos nós | não forçar; investigar o que sumiu do código |
```

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/maestri-conhecimento.md
git commit -m "docs(runbooks): comandos Maestri da fundação de conhecimento

Notes, floor e rotina. A sintaxe de note fica em duas formas até ser
confirmada de dentro de um terminal Maestro.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** §3.1 recorte → Tarefa 3 (mais Tarefa 1, porque o mestre estava obsoleto — fato que a spec não sabia). §3.2 roteador e fontes → Tarefas 4 e 6. §3.3 exportador e os quatro arquivos → Tarefa 6. §3.4 notes e direção única → Tarefas 5 e 7. §3.5 rotina → Tarefa 7. §5 degradação: menos de 20 nós → Tarefa 6 (`MIN_NOS`); não roteado → Tarefa 6 (`nao-roteados.md`); seção apagada → Tarefa 5; rebuild recusado → Tarefa 1 e runbook. §6 testes → Tarefas 3, 4, 5, e a verificação por script da 6.

**Gap encontrado e fechado:** a spec diz "a rotina reescreve a note preservando as seções", mas quem preserva é o exportador *antes* do `note write` — a Tarefa 6 lê `note.md` atual do disco, não a note do canvas. Isso só está certo se o especialista escrever no arquivo e não na note. **Decisão registrada aqui:** no V1, o especialista escreve Estado de tarefa e Obstáculos **no arquivo `note.md`** (que está no repositório onde ele trabalha), e a rotina empurra para o canvas. Escrever na note do canvas e ter isso puxado de volta é o caminho note → arquivo que a spec proíbe. O role do especialista (sub-projeto 2) precisa dizer isso.

**Placeholder scan:** nenhum "TBD"/"TODO". O único "a confirmar" é a sintaxe de `note --help`, com as duas formas escritas por extenso.

**Type consistency:** `Grafo.links` em todas as tarefas; `rotear` devolve `Roteamento{destino,motivo}` e o exportador lê `.destino`/`.motivo`; `preservarSecoes(noteAtual, noteGerada)` devolve `{note, avisos}` e o exportador desestrutura os dois nomes; `PREFIXOS`/`EXCLUSOES` tipados por `Produto` e usados por chave em `recortar(...)`.
