"""Semeia e sincroniza a memória com o que a Nebuloz já registrou em arquivo.

Três fontes, todas com dono no repositório (D-12: a memória é índice derivado,
nunca a fonte):

- lições das áreas do Maestri (`.maestri/memoria/*.md`), uma por linha;
- ADRs (`docs/adr/NNNN-*.md`): título, status e a seção "Decisão";
- registro de decisões (`docs/produto/registro-de-decisoes.md`), um bloco por D-NN.

Rodar de novo sincroniza: texto igual não mexe, texto mudado vira versão nova
(com motivo), lição riscada com ~~ no Maestri vira memória revogada.
"""

import hashlib
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from . import db
from .schemas import (
    Category,
    Confidence,
    Kind,
    MemoryContent,
    MemoryIngest,
    MemoryInvalidate,
    MemoryMetadata,
    MemorySupersede,
    Provenance,
    Temporal,
)
from .servico import Contexto, Motor

LIMITE_TEXTO = 4_000
_DATA = re.compile(r"(\d{4}-\d{2}-\d{2})")
_LICAO = re.compile(r"^(~~)?(\d{4}-\d{2}-\d{2}) — (.+)$")
_DONO = re.compile(r"\*\*Dono:\*\*\s*([^.,(]+)")


@dataclass
class Item:
    source: str
    source_id: str
    texto: str
    categoria: Category
    agente: str
    valido_desde: datetime
    tags: list[str] = field(default_factory=list)
    revogado_por: str | None = None  # motivo, quando a fonte riscou o item


def _data(texto: str) -> datetime:
    achada = _DATA.search(texto)
    if achada is None:
        return datetime.now(UTC)
    return datetime.fromisoformat(achada.group(1)).replace(tzinfo=UTC)


def _curto(texto: str) -> str:
    texto = texto.strip()
    return texto if len(texto) <= LIMITE_TEXTO else texto[: LIMITE_TEXTO - 1].rstrip() + "…"


def _id_licao(texto: str) -> str:
    return hashlib.sha256(texto.strip().encode()).hexdigest()[:16]


def licoes(raiz: Path) -> Iterator[Item]:
    for arquivo in sorted((raiz / ".maestri" / "memoria").glob("*.md")):
        area = arquivo.stem
        relativo = arquivo.relative_to(raiz).as_posix()
        for linha in arquivo.read_text(encoding="utf-8").splitlines():
            achada = _LICAO.match(linha.strip())
            if achada is None:
                continue
            riscada, data, resto = achada.groups()
            if riscada:
                # "~~2026-09-01 — lição — origem~~ motivo": o id é o da linha original.
                original, _, motivo = f"{data} — {resto}".partition("~~")
                yield Item(
                    source="maestri-memoria",
                    source_id=f"{relativo}#{_id_licao(original)}",
                    texto=original.strip(),
                    categoria=Category.lesson,
                    agente=area,
                    valido_desde=_data(data),
                    tags=["maestri", area],
                    revogado_por=motivo.strip(" —-") or "riscada na memória do Maestri",
                )
                continue
            texto = f"{data} — {resto}"
            yield Item(
                source="maestri-memoria",
                source_id=f"{relativo}#{_id_licao(texto)}",
                texto=texto,
                categoria=Category.lesson,
                agente=area,
                valido_desde=_data(data),
                tags=["maestri", area],
            )


def _secao(texto: str, titulo: str) -> str:
    achada = re.search(rf"^## {titulo}\s*$(.*?)(?=^## |\Z)", texto, re.MULTILINE | re.DOTALL)
    return achada.group(1).strip() if achada else ""


def adrs(raiz: Path) -> Iterator[Item]:
    for arquivo in sorted((raiz / "docs" / "adr").glob("[0-9][0-9][0-9][0-9]-*.md")):
        texto = arquivo.read_text(encoding="utf-8")
        titulo = texto.splitlines()[0].lstrip("# ").strip() if texto else arquivo.stem
        status = re.search(r"\*\*Status\*\*:\s*(.+)", texto)
        data = re.search(r"\*\*Data\*\*:\s*(.+)", texto)
        decisao = _secao(texto, "Decisão")
        corpo = f"{titulo}\nStatus: {status.group(1).strip() if status else '?'}\n\n{decisao}"
        yield Item(
            source="adr",
            source_id=arquivo.relative_to(raiz).as_posix(),
            texto=_curto(corpo),
            categoria=Category.decision,
            agente="adr",
            valido_desde=_data(data.group(1)) if data else _data(texto),
            tags=["adr"],
        )


def registro(raiz: Path) -> Iterator[Item]:
    arquivo = raiz / "docs" / "produto" / "registro-de-decisoes.md"
    if not arquivo.exists():
        return
    relativo = arquivo.relative_to(raiz).as_posix()
    texto = arquivo.read_text(encoding="utf-8")
    for achada in re.finditer(r"^### (D-\d+) — (.+?)$(.*?)(?=^### |^## |\Z)", texto, re.MULTILINE | re.DOTALL):
        codigo, titulo, corpo = achada.groups()
        dono = _DONO.search(corpo)
        yield Item(
            source="registro-de-decisoes",
            source_id=f"{relativo}#{codigo}",
            texto=_curto(f"{codigo} — {titulo}\n\n{corpo.strip()}"),
            categoria=Category.decision,
            agente=dono.group(1).strip() if dono else "registro",
            valido_desde=_data(corpo),
            tags=["registro-de-decisoes", codigo],
        )


def todas(raiz: Path) -> Iterator[Item]:
    yield from licoes(raiz)
    yield from adrs(raiz)
    yield from registro(raiz)


def _vigente(ctx: Contexto, source: str, source_id: str) -> dict[str, Any] | None:
    with db.tenant_tx(ctx.tenant_id) as conn:
        return conn.execute(
            """
            SELECT memory_id, text, valid_to FROM stec.memoria
            WHERE source = %s AND source_id = %s AND tx_to IS NULL AND erased_at IS NULL
            ORDER BY version DESC LIMIT 1
            """,
            (source, source_id),
        ).fetchone()


def sincronizar(motor: Motor, ctx: Contexto, itens: Iterator[Item]) -> dict[str, int]:
    contagem = {"novas": 0, "atualizadas": 0, "revogadas": 0, "iguais": 0}
    for item in itens:
        atual = _vigente(ctx, item.source, item.source_id)
        memory_id: UUID | None = atual["memory_id"] if atual else None
        if item.revogado_por is not None:
            if atual is not None and atual["valid_to"] is None:
                motor.invalidar(ctx, memory_id, MemoryInvalidate(valid_to=datetime.now(UTC), reason=item.revogado_por))
                contagem["revogadas"] += 1
            continue
        if atual is None:
            motor.ingerir(
                ctx,
                MemoryIngest(
                    agent_id=item.agente,
                    type=Kind.semantic,
                    category=item.categoria,
                    content=MemoryContent(text=item.texto),
                    temporal=Temporal(valid_from=item.valido_desde),
                    provenance=Provenance(
                        source=item.source,
                        source_id=item.source_id,
                        extracted_by="importador",
                        confidence=Confidence.declarado,
                    ),
                    metadata=MemoryMetadata(tags=item.tags),
                ),
            )
            contagem["novas"] += 1
        elif atual["text"] != item.texto:
            motor.substituir(
                ctx,
                memory_id,
                MemorySupersede(reason=f"a fonte mudou: {item.source_id}", content=MemoryContent(text=item.texto)),
            )
            contagem["atualizadas"] += 1
        else:
            contagem["iguais"] += 1
    return contagem
