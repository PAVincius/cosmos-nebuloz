"""
query_safe_graph.py
====================
Graph RAG query engine para o grafo de conhecimento SAFe 6.0.

Uso como módulo:
  from scripts.query_safe_graph import graph_rag_context
  ctx = graph_rag_context("Como calcular WSJF?", depth=2, top_k=5)

Uso CLI:
  cd experiments/slm-pipeline
  .venv/bin/python scripts/query_safe_graph.py "Como calcular WSJF?"
"""
from __future__ import annotations

import json
import re
import sys
from collections import deque
from pathlib import Path
from typing import Any

# ── Config ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
GRAPH_DIR = ROOT / "data" / "graph"


# ── Carrega grafo (lazy, singleton) ────────────────────────────────────────────
_graph: dict[str, Any] | None = None


def _load_graph() -> dict[str, Any]:
    global _graph
    if _graph is not None:
        return _graph

    nodes_path = GRAPH_DIR / "nodes.json"
    edges_path = GRAPH_DIR / "edges.json"
    adj_path = GRAPH_DIR / "adjacency.json"

    if not nodes_path.exists():
        raise FileNotFoundError(
            f"Graph not built yet. Run: python scripts/build_safe_graph.py"
        )

    _graph = {
        "nodes": json.loads(nodes_path.read_text()),
        "edges": json.loads(edges_path.read_text()),
        "adjacency": json.loads(adj_path.read_text()),
    }
    return _graph


# ── Entry point: keyword match → node IDs ──────────────────────────────────────
def _tokenize(text: str) -> set[str]:
    """Extrai tokens significativos (3+ chars, sem stop words)."""
    stop = {
        "para", "como", "que", "uma", "com", "são", "ser", "foi",
        "dos", "das", "por", "não", "mas", "quando", "quais", "qual",
        "the", "and", "for", "what", "how", "is", "are", "in", "of",
    }
    return {
        w for w in re.findall(r"[a-zA-ZÀ-ÿ0-9]+", text.lower())
        if len(w) >= 3 and w not in stop
    }


def find_entry_nodes(query: str, nodes: dict, top_k: int = 5) -> list[str]:
    """
    Keyword scoring: soma de tokens compartilhados entre query e node label/category.
    Retorna até top_k node_ids ordenados por score decrescente.
    """
    q_tokens = _tokenize(query)
    scores: list[tuple[float, str]] = []

    for node_id, node in nodes.items():
        label_tokens = _tokenize(node.get("label", ""))
        cat_tokens = _tokenize(node.get("category", ""))
        all_tokens = label_tokens | cat_tokens

        overlap = len(q_tokens & all_tokens)
        if overlap == 0:
            continue

        # Bonus para match exato de substring
        label = node.get("label", "").lower()
        bonus = 2.0 if any(label in query.lower() or q in label for q in q_tokens) else 0.0

        score = overlap + bonus + node.get("degree", 0) * 0.01  # tie-break por grau
        scores.append((score, node_id))

    scores.sort(reverse=True)
    return [nid for _, nid in scores[:top_k]]


# ── BFS traversal ──────────────────────────────────────────────────────────────
def bfs_neighborhood(
    start_nodes: list[str],
    adjacency: dict,
    depth: int = 2,
) -> set[str]:
    """BFS a partir dos entry nodes, profundidade `depth`."""
    visited: set[str] = set()
    queue: deque[tuple[str, int]] = deque((n, 0) for n in start_nodes)

    while queue:
        node_id, level = queue.popleft()
        if node_id in visited or level > depth:
            continue
        visited.add(node_id)
        for neighbor in adjacency.get(node_id, []):
            if neighbor not in visited:
                queue.append((neighbor, level + 1))

    return visited


# ── Context builder ─────────────────────────────────────────────────────────────
def graph_rag_context(
    query: str,
    depth: int = 2,
    top_k: int = 5,
    max_context_nodes: int = 20,
) -> str:
    """
    Retorna contexto de grafo para uso em prompts RAG.

    Formato:
      === Grafo de Conhecimento SAFe (contexto estrutural) ===
      Nós relevantes:
        • ART [structure] — grau 47
        • WSJF [metric] — grau 31
        ...
      Relações encontradas:
        ART → contém → Agile Team (peso: 12)
        WSJF → calcula → Custo do Atraso (peso: 8)
        ...
    """
    g = _load_graph()
    nodes = g["nodes"]
    edges = g["edges"]
    adjacency = g["adjacency"]

    # 1. Find entry nodes by keyword match
    entry_nodes = find_entry_nodes(query, nodes, top_k=top_k)
    if not entry_nodes:
        return ""  # no graph context

    # 2. BFS neighborhood
    neighborhood = bfs_neighborhood(entry_nodes, adjacency, depth=depth)

    # 3. Limit to top nodes by degree (most connected = most important)
    neighborhood_sorted = sorted(
        neighborhood,
        key=lambda nid: nodes.get(nid, {}).get("degree", 0),
        reverse=True,
    )[:max_context_nodes]

    # 4. Collect relevant edges within neighborhood
    relevant_edges = [
        e for e in edges
        if e["source"] in neighborhood and e["target"] in neighborhood
    ]
    relevant_edges.sort(key=lambda e: e.get("weight", 1), reverse=True)

    # 5. Format context
    node_lines = []
    for nid in neighborhood_sorted:
        n = nodes.get(nid, {})
        node_lines.append(
            f"  • {n.get('label', nid)} [{n.get('category', '?')}] — grau {n.get('degree', 0)}"
        )

    edge_lines = []
    seen_edges: set[tuple] = set()
    for e in relevant_edges[:30]:
        src_label = nodes.get(e["source"], {}).get("label", e["source"])
        tgt_label = nodes.get(e["target"], {}).get("label", e["target"])
        key = (src_label, e["relation"], tgt_label)
        if key in seen_edges:
            continue
        seen_edges.add(key)
        edge_lines.append(
            f"  {src_label} → {e['relation']} → {tgt_label} (peso: {e.get('weight', 1)})"
        )

    if not node_lines and not edge_lines:
        return ""

    sections = ["=== Grafo de Conhecimento SAFe (contexto estrutural) ==="]
    if node_lines:
        sections.append("Conceitos relevantes:\n" + "\n".join(node_lines))
    if edge_lines:
        sections.append("Relações:\n" + "\n".join(edge_lines))

    return "\n\n".join(sections)


# ── CLI ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python query_safe_graph.py '<query>'")
        sys.exit(1)

    query = " ".join(sys.argv[1:])
    print(f"\nQuery: {query}\n")

    try:
        ctx = graph_rag_context(query, depth=2, top_k=5)
        if ctx:
            print(ctx)
        else:
            print("(nenhum nó encontrado para essa query)")
    except FileNotFoundError as e:
        print(f"Erro: {e}")
