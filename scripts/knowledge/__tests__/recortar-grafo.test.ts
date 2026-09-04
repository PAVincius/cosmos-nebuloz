import { describe, expect, it } from "vitest";
import { pertence, recortar } from "../recortar-grafo.mts";
import type { Grafo } from "../tipos.mts";

// 12 nós, dois "produtos". X = x1..x4, Y = y1..y4, S = s1..s4 (compartilhado).
// Cadeia: x1—s1—s2—y1 ; x2—s3 ; y2—s4 ; x3, x4, y3, y4 isolados.
const fixture: Grafo = {
  directed: false,
  built_at_commit: "abc",
  nodes: [
    ...["x1", "x2", "x3", "x4"].map((id) => ({
      id,
      source_file: `apps/x/${id}.ts`,
      community: 1,
    })),
    ...["y1", "y2", "y3", "y4"].map((id) => ({
      id,
      source_file: `apps/y/${id}.ts`,
      community: 2,
    })),
    ...["s1", "s2", "s3", "s4"].map((id) => ({
      id,
      source_file: `packages/s/${id}.ts`,
      community: 3,
    })),
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

  it("aresta pendurada (target sem nó) não vaza id ausente do resultado", () => {
    const g: Grafo = {
      directed: false,
      nodes: [{ id: "a", source_file: "apps/x/a.ts" }],
      links: [{ source: "a", target: "ghost" }],
    };
    const r = recortar(g, ["apps/x"], { hops: 1 });
    expect(ids(r)).toEqual(["a"]);
    expect(r.links).toEqual([]);
  });
});
