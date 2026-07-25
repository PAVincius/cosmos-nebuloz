"""
ETL: data_firecrawl → data/processed/train.jsonl

Fontes:
  - 7_core_competencies_of_safe.md  → Claude gera pares Q&A
  - whats_new_safe_6.md             → Claude gera pares Q&A
  - cooper.pdf / mcbride.pdf / mathews.pdf → extrai Q&A existente

Saída: JSONL no formato [INST] ... [/INST] ...
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import pdfplumber
import anthropic

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DATA_IN = Path("/Users/azos/Documents/Github/web-backoffice/my/data_firecrawl")
DATA_OUT = ROOT / "data" / "processed"
DATA_OUT.mkdir(parents=True, exist_ok=True)

PERSONA = "Cosmos AI — SAFe 6.0 Expert"

# ── Claude client ─────────────────────────────────────────────────────────────
client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY from env


# ── PDF extraction ────────────────────────────────────────────────────────────

def extract_pdf_text(pdf_path: Path) -> str:
    """Extrai texto de PDF usando pdfplumber."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n".join(pages)


def parse_qa_from_exam_text(text: str) -> list[dict[str, str]]:
    """
    Parseia pares Q&A de exam dumps.
    Padrões reconhecidos:
      Q: <question> ... A: <answer>
      Question N: ... Answer: ...
      <número>. <pergunta> ... Answer: <letra>. <explicação>
    """
    records = []

    # Padrão 1: linhas "Q:" e "A:" ou "Correct Answer:"
    blocks = re.split(r'\n(?=Q\d*[:.)]|\bQuestion\s*\d+)', text, flags=re.IGNORECASE)

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Extrai pergunta
        q_match = re.match(
            r'^(?:Q\d*[:.)]?|Question\s*\d+[:.)]?)\s*(.+?)(?=\n[A-D][.)]\s|\nAnswer|\nCorrect)',
            block, re.DOTALL | re.IGNORECASE
        )
        if not q_match:
            continue
        question = q_match.group(1).strip().replace('\n', ' ')

        # Extrai resposta/explicação
        ans_match = re.search(
            r'(?:Answer|Correct[^:]*)[:\s]+([A-D][.)]\s*.+?)(?=\n\n|$)',
            block, re.DOTALL | re.IGNORECASE
        )
        if not ans_match:
            # Fallback: pega opção correta + qualquer explicação
            ans_match = re.search(r'[A-D][.)]\s*(.{20,200})', block, re.DOTALL)

        if not ans_match:
            continue

        answer = ans_match.group(1).strip().replace('\n', ' ')
        answer = re.sub(r'\s+', ' ', answer)

        if len(question) > 20 and len(answer) > 10:
            records.append({"comment": question, "response": answer})

    return records


# ── Markdown → Q&A via Claude ─────────────────────────────────────────────────

CHUNK_SIZE = 3000  # chars por chunk enviado ao Claude


def chunk_markdown(text: str, size: int = CHUNK_SIZE) -> list[str]:
    """Divide markdown em chunks por seção (##) respeitando tamanho máximo."""
    sections = re.split(r'\n(?=#{1,3} )', text)
    chunks = []
    current = ""
    for section in sections:
        if len(current) + len(section) < size:
            current += "\n" + section
        else:
            if current.strip():
                chunks.append(current.strip())
            current = section
    if current.strip():
        chunks.append(current.strip())
    return chunks


def generate_qa_from_chunk(chunk: str, source_label: str) -> list[dict[str, str]]:
    """Usa Claude Haiku para gerar pares Q&A a partir de um chunk de markdown."""
    prompt = f"""Você é um especialista SAFe 6.0. A partir do conteúdo abaixo, gere EXATAMENTE 5 pares de pergunta e resposta sobre SAFe 6.0.

REGRAS:
- Perguntas devem ser diretas, como as de um praticante SAFe real
- Respostas máximo 100 palavras, tom direto e prático
- Inclua pelo menos 1 dado concreto (número, fórmula, nome de artefato)
- Termine cada resposta com "— {PERSONA}"
- Retorne APENAS JSON válido, sem markdown, sem explicações

FORMATO EXATO:
[
  {{"comment": "pergunta aqui?", "response": "resposta aqui — {PERSONA}"}},
  ...
]

CONTEÚDO:
{chunk[:2500]}
"""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip()

        # Limpa markdown code fences se existirem
        raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.MULTILINE)
        raw = re.sub(r'\s*```$', '', raw, flags=re.MULTILINE)

        pairs = json.loads(raw)
        # Valida estrutura
        valid = [
            p for p in pairs
            if isinstance(p, dict)
            and "comment" in p and "response" in p
            and len(p["comment"]) > 15
            and len(p["response"]) > 20
        ]
        print(f"  ✓ {source_label}: {len(valid)} pares gerados")
        return valid

    except (json.JSONDecodeError, Exception) as e:
        print(f"  ✗ {source_label}: erro — {e}")
        return []


# ── Formatter ─────────────────────────────────────────────────────────────────

def to_instruction_format(comment: str, response: str) -> dict[str, str]:
    """Converte par Q&A para formato [INST] ... [/INST] ..."""
    text = f"[INST] {comment} [/INST] {response}"
    return {"text": text}


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run():
    all_records: list[dict[str, str]] = []

    # ── 1. PDFs (exam Q&A) ───────────────────────────────────────────────────
    pdfs = [
        ("cooper.pdf", "expert-designed-scaled-agile-safe-agilist-leading-safe-sa-6.0-exam-study-material-by-cooper.pdf"),
        ("mcbride.pdf", "explore-scaled-agile-safe-agilist-leading-safe-sa-6.0-questions-by-mcbride.pdf"),
        ("mathews.pdf", "scaled-agile-safe-agilist-dumps-by-mathews.pdf"),
    ]

    print("\n📄 Processando PDFs (extração direta de Q&A)...")
    for label, filename in pdfs:
        path = DATA_IN / filename
        if not path.exists():
            print(f"  ✗ {label}: não encontrado")
            continue
        text = extract_pdf_text(path)
        pairs = parse_qa_from_exam_text(text)
        print(f"  ✓ {label}: {len(pairs)} pares extraídos")

        for p in pairs:
            record = to_instruction_format(p["comment"], p["response"])
            all_records.append(record)

    # ── 2. Markdowns (Claude gera Q&A) ───────────────────────────────────────
    mds = [
        ("7_core_competencies_of_safe.md", "7 Core Competencies"),
        ("whats_new_safe_6.md", "What's New SAFe 6.0"),
    ]

    print("\n🤖 Processando Markdowns (Claude Haiku gera Q&A)...")
    for filename, label in mds:
        path = DATA_IN / filename
        if not path.exists():
            print(f"  ✗ {label}: não encontrado")
            continue

        text = path.read_text(encoding="utf-8")
        chunks = chunk_markdown(text)
        print(f"  → {label}: {len(chunks)} chunks")

        for i, chunk in enumerate(chunks):
            pairs = generate_qa_from_chunk(chunk, f"{label} chunk {i+1}")
            for p in pairs:
                record = to_instruction_format(p["comment"], p["response"])
                all_records.append(record)
            time.sleep(0.3)  # rate limit gentil

    # ── 3. Salvar JSONL ───────────────────────────────────────────────────────
    out_path = DATA_OUT / "train.jsonl"
    with out_path.open("w", encoding="utf-8") as f:
        for record in all_records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"\n✅ Total: {len(all_records)} pares → {out_path}")
    print(f"   Tokens estimados: ~{len(all_records) * 80} (80 tokens/par médio)")


if __name__ == "__main__":
    run()
