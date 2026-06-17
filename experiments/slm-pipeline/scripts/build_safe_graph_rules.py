"""
build_safe_graph_rules.py
==========================
Extrai grafo de conhecimento SAFe 6.0 do corpus Q&A via regras (sem API).

Estratégia:
  1. Detecta entidades SAFe conhecidas em cada Q&A (CANONICAL dict + padrões)
  2. Co-ocorrência no mesmo par → aresta "relacionado_a" (peso = frequência)
  3. Padrões léxicos simples detectam relações semânticas (calcula, contém, etc.)
  4. Salva os mesmos artefatos do build_safe_graph.py

Uso:
  cd experiments/slm-pipeline
  .venv/bin/python scripts/build_safe_graph_rules.py [--input safe_10k.jsonl]
"""
from __future__ import annotations

import argparse
import json
import logging
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA_IN_DEFAULT = ROOT / "data" / "raw" / "safe_10k.jsonl"
DATA_IN_FALLBACK = ROOT / "data" / "raw" / "comments_raw.jsonl"
GRAPH_DIR = ROOT / "data" / "graph"
GRAPH_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Entidades canônicas ────────────────────────────────────────────────────────
# (label, category, [aliases para match])
ENTITIES: list[tuple[str, str, list[str]]] = [
    # structure
    ("ART", "structure", ["art", "agile release train"]),
    ("Solution Train", "structure", ["solution train"]),
    ("Portfolio", "structure", ["portfolio"]),
    ("Value Stream", "structure", ["value stream"]),
    ("Agile Team", "structure", ["agile team", "time ágil"]),
    ("LACE", "structure", ["lace", "lean-agile center of excellence"]),
    ("CoP", "structure", ["cop", "community of practice", "comunidade de prática"]),
    # ceremony
    ("PI Planning", "ceremony", ["pi planning", "program increment planning"]),
    ("ART Sync", "ceremony", ["art sync"]),
    ("Inspect & Adapt", "ceremony", ["inspect & adapt", "inspect and adapt", "i&a"]),
    ("System Demo", "ceremony", ["system demo"]),
    ("IP Iteration", "ceremony", ["ip iteration", "innovation and planning", "innovation & planning"]),
    ("Iteration Planning", "ceremony", ["iteration planning"]),
    ("Daily Standup", "ceremony", ["daily standup", "daily scrum"]),
    ("Retrospectiva", "ceremony", ["retrospectiva", "retrospective"]),
    ("Portfolio Sync", "ceremony", ["portfolio sync"]),
    ("Solution Demo", "ceremony", ["solution demo"]),
    ("Pre-PI Planning", "ceremony", ["pre-pi planning"]),
    ("Post-PI Planning", "ceremony", ["post-pi planning"]),
    # role
    ("RTE", "role", ["rte", "release train engineer"]),
    ("Product Manager", "role", ["product manager", "pm"]),
    ("Product Owner", "role", ["product owner", "po"]),
    ("Team Coach", "role", ["team coach", "tc", "scrum master"]),
    ("System Architect", "role", ["system architect", "sa"]),
    ("Epic Owner", "role", ["epic owner"]),
    ("Business Owners", "role", ["business owners", "business owner", "bos"]),
    ("STE", "role", ["ste", "solution train engineer"]),
    ("SPC", "role", ["spc"]),
    # artifact
    ("ART Backlog", "artifact", ["art backlog"]),
    ("Team Backlog", "artifact", ["team backlog"]),
    ("Portfolio Kanban", "artifact", ["portfolio kanban"]),
    ("Epic Hypothesis", "artifact", ["epic hypothesis", "hypothesis statement"]),
    ("Lean Business Case", "artifact", ["lean business case"]),
    ("PI Objectives", "artifact", ["pi objectives", "pi objective"]),
    ("ROAM Board", "artifact", ["roam board", "roam"]),
    ("ART Planning Board", "artifact", ["art planning board", "planning board"]),
    ("DoD", "artifact", ["dod", "definition of done", "definição de done"]),
    ("ADR", "artifact", ["adr", "architecture decision record"]),
    # metric
    ("WSJF", "metric", ["wsjf", "weighted shortest job first"]),
    ("Flow Velocity", "metric", ["flow velocity"]),
    ("Flow Efficiency", "metric", ["flow efficiency", "eficiência de fluxo"]),
    ("Flow Time", "metric", ["flow time", "tempo de fluxo"]),
    ("Flow Load", "metric", ["flow load", "carga de fluxo"]),
    ("Flow Distribution", "metric", ["flow distribution", "distribuição de fluxo"]),
    ("Flow Predictability", "metric", ["flow predictability", "previsibilidade"]),
    ("Custo do Atraso", "metric", ["custo do atraso", "cost of delay", "cod"]),
    ("BAR", "metric", ["bar", "business agility rating"]),
    # concept
    ("Built-In Quality", "concept", ["built-in quality", "biq"]),
    ("Architectural Runway", "concept", ["architectural runway", "runway arquitetural"]),
    ("Lean-Agile Mindset", "concept", ["lean-agile mindset"]),
    ("PI", "concept", ["program increment", r"\bpi\b"]),
    ("WIP", "concept", ["wip", "work in progress"]),
    ("Dívida Técnica", "concept", ["dívida técnica", "technical debt"]),
    ("Enabler", "concept", ["enabler", "habilitador"]),
    ("Feature", "concept", ["feature"]),
    ("Epic", "concept", ["épico", "epic"]),
    ("Story", "concept", ["story", "história"]),
    ("Strategic Theme", "concept", ["strategic theme", "tema estratégico"]),
    ("MVP", "concept", ["mvp", "minimum viable product"]),
    ("Lei de Little", "concept", ["lei de little", "law of little"]),
    # competency
    ("LPM", "competency", ["lpm", "lean portfolio management", "gestão de portfólio"]),
    ("DevSecOps", "competency", ["devsecops", "devops"]),
    # practice
    ("TDD", "practice", ["tdd", "test-driven development"]),
    ("BDD", "practice", ["bdd", "behavior-driven development"]),
    ("CI/CD Pipeline", "practice", ["ci/cd", "continuous deployment", "continuous delivery"]),
    ("Feature Flag", "practice", ["feature flag", "feature toggle"]),
    ("ROAM", "practice", ["roam"]),
    ("Confidence Vote", "practice", ["confidence vote", "fist of five"]),
]

# ── Padrões léxicos para relações direcionadas ─────────────────────────────────
# (regex_pattern, relation) — aplicado ao texto do Q&A
# Captura: grupo 1 = entidade antes, grupo 2 = entidade depois
RELATION_PATTERNS: list[tuple[str, str]] = [
    (r"(\w[\w\s]+?)\s+(?:calcula|computa|mede)\s+(\w[\w\s]+)", "calcula"),
    (r"(\w[\w\s]+?)\s+(?:contém|inclui|composto de)\s+(\w[\w\s]+)", "contém"),
    (r"(\w[\w\s]+?)\s+(?:precede|antecede|antes de)\s+(\w[\w\s]+)", "precede"),
    (r"(\w[\w\s]+?)\s+(?:depende de|requer|necessita)\s+(\w[\w\s]+)", "depende_de"),
    (r"(\w[\w\s]+?)\s+(?:produz|gera|resulta em)\s+(\w[\w\s]+)", "produz"),
    (r"(\w[\w\s]+?)\s+(?:define|especifica|estabelece)\s+(\w[\w\s]+)", "define"),
    (r"(\w[\w\s]+?)\s+(?:facilita|lidera|conduz)\s+(\w[\w\s]+)", "responsável_por"),
    (r"(\w[\w\s]+?)\s+(?:habilita|permite|viabiliza)\s+(\w[\w\s]+)", "habilita"),
    (r"(\w[\w\s]+?)\s+(?:participa|faz parte)\s+(?:do?a? )?\s*(\w[\w\s]+)", "participa_de"),
    (r"(\w[\w\s]+?)\s+(?:pertence|está no?a?)\s+(\w[\w\s]+)", "pertence_a"),
]

# ── Pré-compila entidade → (id, label, category, compiled_patterns) ───────────
def _build_entity_index() -> list[tuple[str, str, str, list[re.Pattern]]]:
    index = []
    for label, category, aliases in ENTITIES:
        eid = "safe:" + re.sub(r"[^a-z0-9_]", "_", label.lower()).strip("_")
        patterns = [
            re.compile(r"\b" + re.escape(a) + r"\b", re.IGNORECASE)
            if not a.startswith(r"\b") else re.compile(a, re.IGNORECASE)
            for a in aliases
        ]
        index.append((eid, label, category, patterns))
    return index


ENTITY_INDEX = _build_entity_index()


def detect_entities(text: str) -> list[tuple[str, str, str]]:
    """Retorna lista de (entity_id, label, category) presentes no texto."""
    found: dict[str, tuple[str, str]] = {}
    for eid, label, category, patterns in ENTITY_INDEX:
        for pat in patterns:
            if pat.search(text):
                found[eid] = (label, category)
                break
    return [(eid, label, cat) for eid, (label, cat) in found.items()]


# ── Extração de triplas ────────────────────────────────────────────────────────
def extract_triples_from_pair(comment: str, response: str) -> list[dict]:
    text = f"{comment} {response}".lower()
    triples: list[dict] = []

    # 1. Entidades detectadas no par
    entities = detect_entities(text)
    eids = [e[0] for e in entities]

    # 2. Co-ocorrência: todas as combinações → "relacionado_a"
    for i, (src_id, src_label, src_cat) in enumerate(entities):
        for tgt_id, tgt_label, tgt_cat in entities[i + 1:]:
            if src_id == tgt_id:
                continue
            triples.append({
                "source": src_id,
                "source_label": src_label,
                "source_category": src_cat,
                "target": tgt_id,
                "target_label": tgt_label,
                "target_category": tgt_cat,
                "relation": "relacionado_a",
            })

    # 3. Padrões léxicos para relações semânticas
    full_text = f"{comment} {response}"
    for pattern_str, relation in RELATION_PATTERNS:
        for m in re.finditer(pattern_str, full_text, re.IGNORECASE):
            phrase_a = m.group(1).strip().lower()
            phrase_b = m.group(2).strip().lower()
            # Match contra entidades conhecidas
            src_match = next(
                ((eid, label, cat) for eid, label, cat, pats in ENTITY_INDEX
                 if any(p.search(phrase_a) for p in pats)), None
            )
            tgt_match = next(
                ((eid, label, cat) for eid, label, cat, pats in ENTITY_INDEX
                 if any(p.search(phrase_b) for p in pats)), None
            )
            if src_match and tgt_match and src_match[0] != tgt_match[0]:
                triples.append({
                    "source": src_match[0],
                    "source_label": src_match[1],
                    "source_category": src_match[2],
                    "target": tgt_match[0],
                    "target_label": tgt_match[1],
                    "target_category": tgt_match[2],
                    "relation": relation,
                })

    return triples


# ── Construção do grafo ────────────────────────────────────────────────────────
def build_graph(triples: list[dict]) -> tuple[dict, list[dict]]:
    nodes: dict[str, dict] = {}
    edge_counter: dict[tuple, int] = defaultdict(int)
    edge_meta: dict[tuple, dict] = {}

    for t in triples:
        src_id = t["source"]
        tgt_id = t["target"]
        relation = t["relation"]

        if src_id not in nodes:
            nodes[src_id] = {"label": t["source_label"], "category": t["source_category"], "degree": 0}
        if tgt_id not in nodes:
            nodes[tgt_id] = {"label": t["target_label"], "category": t["target_category"], "degree": 0}

        key = (src_id, tgt_id, relation)
        edge_counter[key] += 1
        edge_meta[key] = {"source": src_id, "target": tgt_id, "relation": relation}
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
        adj[e["target"]].append(e["source"])
    return {k: list(set(v)) for k, v in adj.items()}


# ── Main ────────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=None)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    if args.input:
        in_file = Path(args.input)
    elif DATA_IN_DEFAULT.exists():
        in_file = DATA_IN_DEFAULT
    else:
        in_file = DATA_IN_FALLBACK

    if not in_file.exists():
        log.error("Input not found: %s", in_file)
        return

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
        pairs = pairs[:args.limit]

    log.info("Loaded %d pairs from %s", len(pairs), in_file)

    all_triples: list[dict] = []
    for i, pair in enumerate(pairs):
        triples = extract_triples_from_pair(pair["comment"], pair["response"])
        all_triples.extend(triples)
        if (i + 1) % 200 == 0:
            log.info("  processed %d/%d pairs, triples so far: %d", i + 1, len(pairs), len(all_triples))

    log.info("Total raw triples: %d", len(all_triples))

    nodes, edges = build_graph(all_triples)
    adjacency = build_adjacency(edges)

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
        "relation_types": sorted({e["relation"] for e in edges}),
        "categories": sorted({v["category"] for v in nodes.values()}),
        "source": "rule-based (no LLM)",
        "corpus_size": len(pairs),
    }

    nodes_path = GRAPH_DIR / "nodes.json"
    edges_path = GRAPH_DIR / "edges.json"
    adj_path   = GRAPH_DIR / "adjacency.json"
    stats_path = GRAPH_DIR / "graph_stats.json"

    nodes_path.write_text(json.dumps(nodes, ensure_ascii=False, indent=2))
    edges_path.write_text(json.dumps(edges, ensure_ascii=False, indent=2))
    adj_path.write_text(json.dumps(adjacency, ensure_ascii=False, indent=2))
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2))

    log.info("Graph saved to %s/", GRAPH_DIR)
    log.info("  nodes=%d  edges=%d  avg_degree=%.1f", stats["nodes"], stats["edges"], stats["avg_degree"])
    log.info("  top-5: %s", [n["label"] for n in stats["top_nodes"][:5]])
    log.info("  relations: %s", stats["relation_types"])


if __name__ == "__main__":
    main()
