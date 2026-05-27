"""
build_safe_graph.py
====================
Extrai grafo de conhecimento SAFe 6.0 do corpus Q&A.

Pipeline:
  1. Lê safe_10k.jsonl (fallback: comments_raw.jsonl)
  2. Processa em batches via Haiku → extrai triplas (sujeito, relação, objeto)
  3. Normaliza e deduplica nós e arestas
  4. Salva:
       data/graph/nodes.json       — {id: {label, category, description, sources}}
       data/graph/edges.json       — [{source, target, relation, weight}]
       data/graph/adjacency.json   — {node_id: [neighbor_ids]}
       data/graph/graph_stats.json — estatísticas do grafo

Uso:
  export ANTHROPIC_API_KEY=sk-ant-...
  cd experiments/slm-pipeline
  .venv/bin/python scripts/build_safe_graph.py [--input safe_10k.jsonl] [--batch 20]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import time
from collections import defaultdict
from pathlib import Path

import anthropic

# ── Config ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DATA_IN_DEFAULT = ROOT / "data" / "raw" / "safe_10k.jsonl"
DATA_IN_FALLBACK = ROOT / "data" / "raw" / "comments_raw.jsonl"
GRAPH_DIR = ROOT / "data" / "graph"
GRAPH_DIR.mkdir(parents=True, exist_ok=True)

MODEL = "claude-haiku-4-5-20251001"
BATCH_SIZE = 20
MAX_RETRIES = 4
BASE_BACKOFF = 2.0

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Categorias de entidades SAFe ──────────────────────────────────────────────
# Guia de normalização para o LLM
ENTITY_CATEGORIES = """
Categorias válidas de entidades SAFe:
- role: RTE, Product Manager, Product Owner, Team Coach, System Architect, Epic Owner, Business Owner, STE, SPC, LACE
- ceremony: PI Planning, ART Sync, Inspect & Adapt, System Demo, IP Iteration, Iteration Planning, Daily Standup, Retrospectiva, Portfolio Sync, Solution Demo, Pre-PI Planning, Post-PI Planning
- artifact: ART Backlog, Team Backlog, Portfolio Kanban, Epic Hypothesis, Lean Business Case, PI Objectives, ROAM Board, ART Planning Board, ADR, DoD
- metric: WSJF, Flow Velocity, Flow Efficiency, Flow Time, Flow Load, Flow Distribution, Flow Predictability, ART Predictability, BAR, Custo do Atraso
- structure: ART, Solution Train, Portfolio, Value Stream, Agile Team, LACE, CoP
- concept: Built-In Quality, Architectural Runway, Lean-Agile Mindset, Economic Framework, Financial Guardrails, PI, Iteration, IP Iteration, WIP, Dívida Técnica, Enabler, Feature, Epic, Story, Strategic Theme, MVP
- competency: Liderança Lean-Agile, Agilidade Técnica, Entrega Ágil de Produtos, Entrega de Soluções, LPM, Agilidade Organizacional, CLC
- practice: TDD, BDD, DevSecOps, Continuous Deployment, Feature Flag, DevOps, Pair Programming, ROAM, Planning Poker, WSJF Priorização
"""

# ── Prompt ─────────────────────────────────────────────────────────────────────
def build_extraction_prompt(pairs: list[dict]) -> str:
    text = "\n\n".join(
        f"Q: {p['comment']}\nA: {p['response']}" for p in pairs
    )
    return f"""Você é um extrator de grafo de conhecimento SAFe 6.0.

Analise os pares Q&A abaixo e extraia triplas de conhecimento no formato:
  (entidade_A, relação, entidade_B)

{ENTITY_CATEGORIES}

Relações válidas (use exatamente esses termos):
  "usa", "contém", "precede", "sucede", "define", "mede", "calcula",
  "produz", "consome", "depende_de", "participa_de", "responsável_por",
  "composto_de", "pertence_a", "relacionado_a", "avalia", "substitui",
  "habilita", "bloqueia", "sincroniza_com", "parte_de"

Regras:
1. Entidades: nomes canônicos SAFe (ex: "ART", "WSJF", "PI Planning")
2. Máximo 60 triplas por resposta
3. Apenas triplas com ALTO GRAU DE CERTEZA baseadas no texto
4. Normalize nomes: "Agile Release Train" → "ART", "Program Increment" → "PI"

Retorne APENAS um JSON array de objetos:
[
  {{"source": "ART", "relation": "contém", "target": "Agile Team", "source_category": "structure", "target_category": "structure"}},
  ...
]

Pares Q&A para analisar:
{text[:6000]}"""


# ── Parse e normalização ────────────────────────────────────────────────────────
CANONICAL: dict[str, str] = {
    "agile release train": "ART",
    "program increment": "PI",
    "wsjf": "WSJF",
    "weighted shortest job first": "WSJF",
    "cost of delay": "Custo do Atraso",
    "cod": "Custo do Atraso",
    "release train engineer": "RTE",
    "product manager": "Product Manager",
    "product owner": "Product Owner",
    "team coach": "Team Coach",
    "system architect": "System Architect",
    "solution train engineer": "STE",
    "lean portfolio management": "LPM",
    "inspect and adapt": "Inspect & Adapt",
    "inspect & adapt": "Inspect & Adapt",
    "ip iteration": "IP Iteration",
    "innovation and planning": "IP Iteration",
    "innovation & planning": "IP Iteration",
    "pi planning": "PI Planning",
    "art sync": "ART Sync",
    "confidence vote": "Confidence Vote",
    "fist of five": "Confidence Vote",
    "lean business case": "Lean Business Case",
    "built-in quality": "Built-In Quality",
    "architectural runway": "Architectural Runway",
    "definition of done": "DoD",
    "dod": "DoD",
    "lean-agile mindset": "Lean-Agile Mindset",
    "flow velocity": "Flow Velocity",
    "flow efficiency": "Flow Efficiency",
    "flow time": "Flow Time",
    "flow load": "Flow Load",
    "flow distribution": "Flow Distribution",
    "flow predictability": "Flow Predictability",
    "wip": "WIP",
    "art backlog": "ART Backlog",
    "portfolio kanban": "Portfolio Kanban",
    "value stream": "Value Stream",
    "solution train": "Solution Train",
    "lpm": "LPM",
    "clc": "CLC",
    "lace": "LACE",
    "spc": "SPC",
    "pi objectives": "PI Objectives",
    "team pi objectives": "PI Objectives",
    "art pi objectives": "PI Objectives",
    "epic hypothesis": "Epic Hypothesis",
    "lean ux": "Lean UX",
    "devsecops": "DevSecOps",
    "ci/cd": "CI/CD Pipeline",
    "continuous deployment": "Continuous Deployment",
    "continuous delivery pipeline": "CI/CD Pipeline",
    "feature flag": "Feature Flag",
    "roam": "ROAM",
    "cop": "CoP",
    "community of practice": "CoP",
    "bar": "BAR",
    "business agility rating": "BAR",
    "measure and grow": "Measure and Grow",
    "law of little": "Lei de Little",
    "lei de little": "Lei de Little",
}


def normalize_entity(name: str) -> str:
    key = name.lower().strip()
    return CANONICAL.get(key, name.strip())


def entity_id(name: str) -> str:
    return "safe:" + re.sub(r"[^a-z0-9_]", "_", name.lower().strip()).strip("_")


# ── Extração via Haiku ──────────────────────────────────────────────────────────
def extract_triples(
    client: anthropic.Anthropic,
    pairs: list[dict],
) -> list[dict]:
    prompt = build_extraction_prompt(pairs)

    for attempt in range(MAX_RETRIES):
        try:
            msg = client.messages.create(
                model=MODEL,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()
            triples = json.loads(raw)
            return [
                t for t in triples
                if isinstance(t, dict)
                and all(k in t for k in ("source", "relation", "target"))
                and len(t["source"]) > 1
                and len(t["target"]) > 1
            ]
        except anthropic.RateLimitError:
            wait = BASE_BACKOFF ** (attempt + 2)
            log.warning("rate limit, waiting %.1fs", wait)
            time.sleep(wait)
        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            log.warning("parse error: %s (attempt %d)", exc, attempt + 1)
            time.sleep(BASE_BACKOFF * (attempt + 1))

    return []


# ── Construção do grafo ─────────────────────────────────────────────────────────
def build_graph(triples: list[dict]) -> tuple[dict, list[dict]]:
    """
    Retorna:
      nodes: {node_id: {label, category, description, degree}}
      edges: [{source, target, relation, weight}]
    """
    nodes: dict[str, dict] = {}
    edge_counter: dict[tuple, int] = defaultdict(int)
    edge_meta: dict[tuple, dict] = {}

    for t in triples:
        src_label = normalize_entity(t["source"])
        tgt_label = normalize_entity(t["target"])
        relation = t.get("relation", "relacionado_a")
        src_cat = t.get("source_category", "concept")
        tgt_cat = t.get("target_category", "concept")

        src_id = entity_id(src_label)
        tgt_id = entity_id(tgt_label)

        # Register nodes
        if src_id not in nodes:
            nodes[src_id] = {"label": src_label, "category": src_cat, "degree": 0}
        if tgt_id not in nodes:
            nodes[tgt_id] = {"label": tgt_label, "category": tgt_cat, "degree": 0}

        # Accumulate edge weight (frequency)
        key = (src_id, tgt_id, relation)
        edge_counter[key] += 1
        edge_meta[key] = {"source": src_id, "target": tgt_id, "relation": relation}

        # Degree count
        nodes[src_id]["degree"] += 1
        nodes[tgt_id]["degree"] += 1

    edges = [
        {**meta, "weight": edge_counter[key]}
        for key, meta in edge_meta.items()
    ]
    return nodes, edges


def build_adjacency(edges: list[dict]) -> dict[str, list[str]]:
    adj: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        adj[e["source"]].append(e["target"])
        adj[e["target"]].append(e["source"])  # undirected for traversal
    return {k: list(set(v)) for k, v in adj.items()}


# ── Main ────────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=None, help="JSONL corpus file")
    parser.add_argument("--batch", type=int, default=BATCH_SIZE)
    parser.add_argument("--limit", type=int, default=0, help="Max pairs to process (0=all)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    # Resolve input file
    if args.input:
        in_file = Path(args.input)
    elif DATA_IN_DEFAULT.exists():
        in_file = DATA_IN_DEFAULT
    else:
        in_file = DATA_IN_FALLBACK

    if not in_file.exists():
        log.error("Input file not found: %s", in_file)
        return

    # Load corpus
    pairs: list[dict] = []
    with in_file.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                pairs.append({"comment": rec["comment"], "response": rec["response"]})
            except (json.JSONDecodeError, KeyError):
                pass

    if args.limit:
        pairs = pairs[: args.limit]

    log.info("Loaded %d pairs from %s", len(pairs), in_file)

    if args.dry_run:
        log.info("DRY RUN — first batch prompt preview:")
        print(build_extraction_prompt(pairs[: args.batch])[:1000])
        return

    client = anthropic.Anthropic()
    all_triples: list[dict] = []

    for i in range(0, len(pairs), args.batch):
        batch = pairs[i : i + args.batch]
        log.info(
            "[%d/%d] Extracting triples from pairs %d-%d",
            i // args.batch + 1,
            (len(pairs) + args.batch - 1) // args.batch,
            i,
            i + len(batch),
        )
        triples = extract_triples(client, batch)
        all_triples.extend(triples)
        log.info("  triples so far: %d", len(all_triples))
        time.sleep(0.8)  # polite delay

    log.info("Total raw triples: %d", len(all_triples))

    # Build graph structures
    nodes, edges = build_graph(all_triples)
    adjacency = build_adjacency(edges)

    # Stats
    stats = {
        "nodes": len(nodes),
        "edges": len(edges),
        "avg_degree": (
            sum(n["degree"] for n in nodes.values()) / len(nodes) if nodes else 0
        ),
        "top_nodes": sorted(
            [{"id": k, "label": v["label"], "degree": v["degree"]} for k, v in nodes.items()],
            key=lambda x: x["degree"],
            reverse=True,
        )[:20],
        "relation_types": list({e["relation"] for e in edges}),
        "categories": list({v["category"] for v in nodes.values()}),
    }

    # Save
    nodes_path = GRAPH_DIR / "nodes.json"
    edges_path = GRAPH_DIR / "edges.json"
    adj_path = GRAPH_DIR / "adjacency.json"
    stats_path = GRAPH_DIR / "graph_stats.json"

    nodes_path.write_text(json.dumps(nodes, ensure_ascii=False, indent=2))
    edges_path.write_text(json.dumps(edges, ensure_ascii=False, indent=2))
    adj_path.write_text(json.dumps(adjacency, ensure_ascii=False, indent=2))
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2))

    log.info("Graph saved to %s/", GRAPH_DIR)
    log.info("  nodes=%d  edges=%d  avg_degree=%.1f", stats["nodes"], stats["edges"], stats["avg_degree"])
    log.info("  top-5 nodes: %s", [n["label"] for n in stats["top_nodes"][:5]])


if __name__ == "__main__":
    main()
