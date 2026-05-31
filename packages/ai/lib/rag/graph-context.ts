/**
 * graph-context.ts
 * ================
 * Graph RAG context builder — porta TypeScript de query_safe_graph.py.
 *
 * Lê os artefatos do grafo SAFe 6.0 pré-construído (nodes, edges, adjacency)
 * e retorna contexto estrutural para enriquecer prompts RAG.
 *
 * Uso:
 *   import { graphRagContext } from "./graph-context";
 *   const ctx = graphRagContext("Como calcular WSJF?");
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────────
type GraphNode = {
  label: string;
  category: string;
  degree: number;
};

type GraphEdge = {
  source: string;
  target: string;
  relation: string;
  weight: number;
};

type Graph = {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  adjacency: Record<string, string[]>;
};

// ── Lazy singleton ─────────────────────────────────────────────────────────────
let _graph: Graph | null = null;

function loadGraph(): Graph {
  if (_graph) {
    return _graph;
  }

  const dir = join(__dirname, "../../data/graph");

  try {
    _graph = {
      nodes: JSON.parse(readFileSync(join(dir, "nodes.json"), "utf-8")),
      edges: JSON.parse(readFileSync(join(dir, "edges.json"), "utf-8")),
      adjacency: JSON.parse(readFileSync(join(dir, "adjacency.json"), "utf-8")),
    };
  } catch {
    // Graph not built yet — return empty graph (no-op)
    _graph = { nodes: {}, edges: [], adjacency: {} };
  }

  return _graph;
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "para",
  "como",
  "que",
  "uma",
  "com",
  "são",
  "ser",
  "foi",
  "dos",
  "das",
  "por",
  "não",
  "mas",
  "quando",
  "quais",
  "qual",
  "the",
  "and",
  "for",
  "what",
  "how",
  "is",
  "are",
  "in",
  "of",
]);

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const w of text.toLowerCase().matchAll(/[a-zA-ZÀ-ÿ0-9]+/g)) {
    if (w[0].length >= 3 && !STOP_WORDS.has(w[0])) {
      tokens.add(w[0]);
    }
  }
  return tokens;
}

// ── Entry node selection ───────────────────────────────────────────────────────
function findEntryNodes(
  query: string,
  nodes: Record<string, GraphNode>,
  topK = 5
): string[] {
  const qTokens = tokenize(query);
  const scores: [number, string][] = [];

  for (const [nodeId, node] of Object.entries(nodes)) {
    const allTokens = new Set([
      ...tokenize(node.label),
      ...tokenize(node.category),
    ]);
    const overlap = [...qTokens].filter((t) => allTokens.has(t)).length;
    if (overlap === 0) {
      continue;
    }

    const label = node.label.toLowerCase();
    const bonus =
      label.includes(query.toLowerCase()) ||
      [...qTokens].some((q) => label.includes(q))
        ? 2.0
        : 0.0;

    scores.push([overlap + bonus + node.degree * 0.01, nodeId]);
  }

  scores.sort((a, b) => b[0] - a[0]);
  return scores.slice(0, topK).map(([, id]) => id);
}

// ── BFS traversal ─────────────────────────────────────────────────────────────
function bfsNeighborhood(
  startNodes: string[],
  adjacency: Record<string, string[]>,
  depth = 2
): Set<string> {
  const visited = new Set<string>();
  const queue: [string, number][] = startNodes.map((n) => [n, 0]);

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) {
      break;
    }
    const [nodeId, level] = next;
    if (visited.has(nodeId) || level > depth) {
      continue;
    }
    visited.add(nodeId);
    for (const neighbor of adjacency[nodeId] ?? []) {
      if (!visited.has(neighbor)) {
        queue.push([neighbor, level + 1]);
      }
    }
  }

  return visited;
}

// ── Public API ────────────────────────────────────────────────────────────────
export type GraphRagOptions = {
  depth?: number;
  topK?: number;
  maxContextNodes?: number;
};

/**
 * Retorna contexto estrutural do grafo SAFe para enriquecer prompts RAG.
 * Retorna string vazia se grafo não estiver disponível ou query não tiver match.
 */
export function graphRagContext(
  query: string,
  { depth = 2, topK = 5, maxContextNodes = 20 }: GraphRagOptions = {}
): string {
  const { nodes, edges, adjacency } = loadGraph();

  if (Object.keys(nodes).length === 0) {
    return "";
  }

  // 1. Entry nodes por keyword
  const entryNodes = findEntryNodes(query, nodes, topK);
  if (entryNodes.length === 0) {
    return "";
  }

  // 2. BFS neighborhood
  const neighborhood = bfsNeighborhood(entryNodes, adjacency, depth);

  // 3. Top nodes por grau
  const sorted = [...neighborhood]
    .sort((a, b) => (nodes[b]?.degree ?? 0) - (nodes[a]?.degree ?? 0))
    .slice(0, maxContextNodes);

  // 4. Arestas internas ao neighborhood
  const relevantEdges = edges
    .filter((e) => neighborhood.has(e.source) && neighborhood.has(e.target))
    .sort((a, b) => b.weight - a.weight);

  // 5. Format
  const nodeLines = sorted.map((nid) => {
    const n = nodes[nid];
    return `  • ${n?.label ?? nid} [${n?.category ?? "?"}] — grau ${n?.degree ?? 0}`;
  });

  const edgeLines: string[] = [];
  const seen = new Set<string>();
  for (const e of relevantEdges.slice(0, 30)) {
    const src = nodes[e.source]?.label ?? e.source;
    const tgt = nodes[e.target]?.label ?? e.target;
    const key = `${src}|${e.relation}|${tgt}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    edgeLines.push(`  ${src} → ${e.relation} → ${tgt} (peso: ${e.weight})`);
  }

  if (nodeLines.length === 0 && edgeLines.length === 0) {
    return "";
  }

  const sections = ["=== Grafo de Conhecimento SAFe (contexto estrutural) ==="];
  if (nodeLines.length) {
    sections.push(`Conceitos relevantes:\n${nodeLines.join("\n")}`);
  }
  if (edgeLines.length) {
    sections.push(`Relações:\n${edgeLines.join("\n")}`);
  }

  return sections.join("\n\n");
}
