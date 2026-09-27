"""Regras da memória: ingestão, versão, invalidação, apagamento, busca.

Ordem de toda escrita: grava no Postgres e commita, depois projeta. Projeção
que falha vira pendência; a escrita já está garantida no sistema de registro.
"""

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import psycopg
from psycopg.types.json import Jsonb

from . import db
from .embeddings import HashEmbedder, OllamaEmbedder
from .projecoes import Projecao
from .schemas import (
    AuditEntry,
    Governance,
    MemoryContent,
    MemoryIngest,
    MemoryInvalidate,
    MemoryMetadata,
    MemorySearch,
    MemorySupersede,
    MemoryVersion,
    Provenance,
    SearchHit,
)

APAGADO = "[apagado]"
RRF_K = 60


class NaoEncontrada(Exception):
    pass


class Conflito(Exception):
    pass


@dataclass(frozen=True)
class Contexto:
    tenant_id: str
    actor: str
    papel: str


@dataclass
class Motor:
    embedder: HashEmbedder | OllamaEmbedder
    projecoes: list[Projecao]

    # ── escrita ────────────────────────────────────────────────────────────

    def ingerir(self, ctx: Contexto, entrada: MemoryIngest) -> MemoryVersion:
        memory_id = uuid4()
        vetor = self.embedder.embed(entrada.content.text)
        with db.tenant_tx(ctx.tenant_id) as conn:
            linha = _inserir_versao(
                conn,
                tenant_id=ctx.tenant_id,
                memory_id=memory_id,
                version=1,
                agent_id=entrada.agent_id,
                project_id=entrada.project_id,
                kind=entrada.type.value,
                category=entrada.category.value,
                content=entrada.content,
                valid_from=entrada.temporal.valid_from,
                valid_to=entrada.temporal.valid_to,
                provenance=entrada.provenance,
                governance=entrada.governance,
                metadata=entrada.metadata,
                change_reason=None,
                supersedes=None,
                embedding=vetor,
                embedding_model=self.embedder.model,
            )
            _auditar(conn, ctx, "memory.ingested", memory_id, {"version": 1, "source": entrada.provenance.source})
        self._projetar(ctx.tenant_id, linha)
        return _para_versao(linha)

    def substituir(self, ctx: Contexto, memory_id: UUID, pedido: MemorySupersede) -> MemoryVersion:
        with db.tenant_tx(ctx.tenant_id) as conn:
            atual = _vigente_para_atualizar(conn, memory_id)
            conteudo = pedido.content or MemoryContent(
                text=atual["text"], entities=atual["entities"], relations=atual["relations"]
            )
            provenance = pedido.provenance or _provenance(atual)
            valid_from = pedido.temporal.valid_from if pedido.temporal else atual["valid_from"]
            valid_to = pedido.temporal.valid_to if pedido.temporal else atual["valid_to"]
            linha = self._nova_versao(
                conn,
                ctx,
                atual,
                conteudo,
                valid_from,
                valid_to,
                provenance,
                (pedido.category.value if pedido.category else atual["category"]),
                pedido.reason,
            )
            _auditar(conn, ctx, "memory.superseded", memory_id, {"version": linha["version"], "reason": pedido.reason})
        self._projetar(ctx.tenant_id, linha)
        return _para_versao(linha)

    def invalidar(self, ctx: Contexto, memory_id: UUID, pedido: MemoryInvalidate) -> MemoryVersion:
        """Fecha a validade sem apagar: a decisão revogada continua consultável
        para "o que valia em T" — a contradição fica viva, com a data."""
        with db.tenant_tx(ctx.tenant_id) as conn:
            atual = _vigente_para_atualizar(conn, memory_id)
            if pedido.valid_to <= atual["valid_from"]:
                raise Conflito("valid_to precisa ser depois de valid_from da memória")
            conteudo = MemoryContent(text=atual["text"], entities=atual["entities"], relations=atual["relations"])
            linha = self._nova_versao(
                conn,
                ctx,
                atual,
                conteudo,
                atual["valid_from"],
                pedido.valid_to,
                _provenance(atual),
                atual["category"],
                pedido.reason,
            )
            _auditar(
                conn,
                ctx,
                "memory.invalidated",
                memory_id,
                {"valid_to": pedido.valid_to.isoformat(), "reason": pedido.reason},
            )
        self._projetar(ctx.tenant_id, linha)
        return _para_versao(linha)

    def _nova_versao(
        self,
        conn: psycopg.Connection,
        ctx: Contexto,
        atual: dict[str, Any],
        conteudo: MemoryContent,
        valid_from: datetime,
        valid_to: datetime | None,
        provenance: Provenance,
        category: str,
        motivo: str,
    ) -> dict[str, Any]:
        agora = conn.execute("SELECT clock_timestamp() AS t").fetchone()["t"]
        conn.execute("UPDATE stec.memoria SET tx_to = %s WHERE version_id = %s", (agora, atual["version_id"]))
        return _inserir_versao(
            conn,
            tenant_id=ctx.tenant_id,
            memory_id=atual["memory_id"],
            version=atual["version"] + 1,
            agent_id=ctx.actor,
            project_id=atual["project_id"],
            kind=atual["kind"],
            category=category,
            content=conteudo,
            valid_from=valid_from,
            valid_to=valid_to,
            provenance=provenance,
            governance=_governance(atual),
            metadata=MemoryMetadata(domain=atual["domain"], tags=atual["tags"], importance_score=atual["importance"]),
            change_reason=motivo,
            supersedes=atual["version_id"],
            embedding=self.embedder.embed(conteudo.text),
            embedding_model=self.embedder.model,
            tx_from=agora,
        )

    def apagar_memoria(self, ctx: Contexto, memory_id: UUID, motivo: str) -> int:
        with db.tenant_tx(ctx.tenant_id) as conn:
            n = _apagar_versoes(conn, "memory_id = %s", (memory_id,), motivo)
            if n == 0:
                raise NaoEncontrada(str(memory_id))
            _auditar(conn, ctx, "memory.erased", memory_id, {"reason": motivo, "versions": n})
        self._apagar_projecoes(ctx.tenant_id, [memory_id])
        return n

    def apagar_por_origem(self, ctx: Contexto, source: str, source_id: str, motivo: str) -> list[UUID]:
        with db.tenant_tx(ctx.tenant_id) as conn:
            ids = [
                r["memory_id"]
                for r in conn.execute(
                    "SELECT DISTINCT memory_id FROM stec.memoria WHERE source = %s AND source_id = %s",
                    (source, source_id),
                ).fetchall()
            ]
            for memory_id in ids:
                n = _apagar_versoes(conn, "memory_id = %s", (memory_id,), motivo)
                _auditar(conn, ctx, "memory.erased", memory_id, {"reason": motivo, "versions": n, "by_source": source})
            # Registro do pedido sem o identificador em claro: a origem pode ser
            # o próprio titular.
            origem = hashlib.sha256(f"{source}:{source_id}".encode()).hexdigest()
            _auditar(
                conn, ctx, "erasure.requested", None, {"source": source, "source_hash": origem, "memories": len(ids)}
            )
        self._apagar_projecoes(ctx.tenant_id, ids)
        return ids

    def expirar(self, ctx: Contexto) -> list[UUID]:
        """Retenção: apaga a memória cujo prazo, contado da validade inicial,
        venceu. O prazo é da primeira versão, e vale para todas."""
        with db.tenant_tx(ctx.tenant_id) as conn:
            ids = [
                r["memory_id"]
                for r in conn.execute(
                    """
                    SELECT memory_id FROM stec.memoria
                    WHERE version = 1 AND erased_at IS NULL
                      AND valid_from + make_interval(days => retention_days) < now()
                    """
                ).fetchall()
            ]
            for memory_id in ids:
                n = _apagar_versoes(conn, "memory_id = %s", (memory_id,), "retenção vencida")
                _auditar(conn, ctx, "memory.expired", memory_id, {"versions": n})
        self._apagar_projecoes(ctx.tenant_id, ids)
        return ids

    def reindexar(self, ctx: Contexto) -> int:
        """Refaz os vetores com o modelo configurado. O texto é a fonte."""
        with db.tenant_tx(ctx.tenant_id) as conn:
            linhas = conn.execute("SELECT version_id, text FROM stec.memoria WHERE erased_at IS NULL").fetchall()
            for linha in linhas:
                conn.execute(
                    "UPDATE stec.memoria SET embedding = %s, embedding_model = %s WHERE version_id = %s",
                    (self.embedder.embed(linha["text"]), self.embedder.model, linha["version_id"]),
                )
            _auditar(conn, ctx, "memory.reindexed", None, {"versions": len(linhas), "model": self.embedder.model})
        self.reconstruir(ctx)
        return len(linhas)

    def reconstruir(self, ctx: Contexto) -> dict[str, int]:
        """Refaz todas as projeções a partir do Postgres (D-12: o índice é derivado)."""
        with db.tenant_tx(ctx.tenant_id) as conn:
            vigentes = conn.execute("SELECT * FROM stec.memoria WHERE tx_to IS NULL AND erased_at IS NULL").fetchall()
            apagadas = [
                r["memory_id"]
                for r in conn.execute(
                    "SELECT DISTINCT memory_id FROM stec.memoria WHERE erased_at IS NOT NULL"
                ).fetchall()
            ]
            conn.execute("DELETE FROM stec.projecao_pendente")
        for linha in vigentes:
            self._projetar(ctx.tenant_id, linha)
        self._apagar_projecoes(ctx.tenant_id, apagadas)
        return {"projected": len(vigentes), "erased": len(apagadas)}

    # ── leitura ────────────────────────────────────────────────────────────

    def historico(self, ctx: Contexto, memory_id: UUID) -> list[MemoryVersion]:
        with db.tenant_tx(ctx.tenant_id) as conn:
            linhas = conn.execute(
                "SELECT * FROM stec.memoria WHERE memory_id = %s ORDER BY version", (memory_id,)
            ).fetchall()
        if not linhas:
            raise NaoEncontrada(str(memory_id))
        return [_para_versao(linha) for linha in linhas]

    def listar(
        self,
        ctx: Contexto,
        *,
        project_id: str | None,
        kind: str | None,
        category: str | None,
        valid_at: datetime | None,
        known_at: datetime | None,
        limite: int,
    ) -> list[MemoryVersion]:
        filtro, parametros = _filtro_temporal(valid_at, known_at)
        for coluna, valor in (("project_id", project_id), ("kind", kind), ("category", category)):
            if valor is not None:
                filtro += f" AND {coluna} = %s"
                parametros.append(valor)
        with db.tenant_tx(ctx.tenant_id) as conn:
            linhas = conn.execute(
                f"SELECT * FROM stec.memoria WHERE {filtro} ORDER BY valid_from DESC LIMIT %s",
                [*parametros, limite],
            ).fetchall()
        return [_para_versao(linha) for linha in linhas]

    def buscar(self, ctx: Contexto, busca: MemorySearch) -> list[SearchHit]:
        filtro, parametros = _filtro_temporal(busca.valid_at, busca.known_at)
        for coluna, valor in (
            ("project_id", busca.project_id),
            ("kind", busca.type.value if busca.type else None),
            ("category", busca.category.value if busca.category else None),
        ):
            if valor is not None:
                filtro += f" AND {coluna} = %s"
                parametros.append(valor)
        vetor = self.embedder.embed(busca.query)
        candidatos = busca.top_k * 4
        # O Qdrant só guarda a versão vigente; consulta "o que sabíamos em T"
        # vai direto ao Postgres. Qdrant fora do ar também.
        ids_qdrant = self._candidatos_qdrant(ctx.tenant_id, vetor, candidatos) if busca.known_at is None else None
        with db.tenant_tx(ctx.tenant_id) as conn:
            if ids_qdrant is not None:
                por_vetor = conn.execute(
                    f"""
                    SELECT version_id FROM stec.memoria
                    WHERE {filtro} AND memory_id = ANY(%s)
                    ORDER BY array_position(%s, memory_id)
                    """,
                    [*parametros, ids_qdrant, ids_qdrant],
                ).fetchall()
            else:
                por_vetor = conn.execute(
                    f"""
                    SELECT version_id FROM stec.memoria
                    WHERE {filtro} AND embedding IS NOT NULL AND embedding_model = %s
                    ORDER BY embedding <=> %s LIMIT %s
                    """,
                    [*parametros, self.embedder.model, _vetor(vetor), candidatos],
                ).fetchall()
            por_texto = conn.execute(
                f"""
                SELECT version_id FROM stec.memoria
                WHERE {filtro} AND to_tsvector('portuguese', text) @@ plainto_tsquery('portuguese', %s)
                ORDER BY ts_rank(to_tsvector('portuguese', text), plainto_tsquery('portuguese', %s)) DESC
                LIMIT %s
                """,
                [*parametros, busca.query, busca.query, candidatos],
            ).fetchall()
            pontos: dict[UUID, float] = {}
            for lista in (por_vetor, por_texto):
                for posicao, linha in enumerate(lista, start=1):
                    pontos[linha["version_id"]] = pontos.get(linha["version_id"], 0.0) + 1.0 / (RRF_K + posicao)
            melhores = sorted(pontos.items(), key=lambda item: item[1], reverse=True)[: busca.top_k]
            linhas = {
                linha["version_id"]: linha
                for linha in conn.execute(
                    "SELECT * FROM stec.memoria WHERE version_id = ANY(%s)", ([v for v, _ in melhores],)
                ).fetchall()
            }
            _auditar(
                conn,
                ctx,
                "memory.searched",
                None,
                {"results": len(melhores), "query_hash": hashlib.sha256(busca.query.encode()).hexdigest()},
            )
        return [SearchHit(score=round(p, 6), memory=_para_versao(linhas[v])) for v, p in melhores if v in linhas]

    def auditoria(self, ctx: Contexto, limite: int) -> list[AuditEntry]:
        with db.tenant_tx(ctx.tenant_id) as conn:
            linhas = conn.execute(
                "SELECT at, actor, action, memory_id, detail FROM stec.auditoria ORDER BY id DESC LIMIT %s",
                (limite,),
            ).fetchall()
        return [AuditEntry(**linha) for linha in linhas]

    def pendencias(self, ctx: Contexto) -> int:
        with db.tenant_tx(ctx.tenant_id) as conn:
            return conn.execute("SELECT count(*) AS n FROM stec.projecao_pendente").fetchone()["n"]

    # ── projeções ──────────────────────────────────────────────────────────

    def _candidatos_qdrant(self, tenant_id: str, vetor: list[float], limite: int) -> list[UUID] | None:
        for projecao in self.projecoes:
            buscar = getattr(projecao, "buscar", None)
            if buscar is None:
                continue
            try:
                return [memory_id for memory_id, _ in buscar(tenant_id, vetor, limite)]
            except Exception:
                return None
        return None

    def _projetar(self, tenant_id: str, linha: dict[str, Any]) -> None:
        for projecao in self.projecoes:
            try:
                projecao.gravar(tenant_id, linha)
            except Exception as erro:
                _registrar_pendencia(tenant_id, linha["memory_id"], projecao.nome, erro)

    def _apagar_projecoes(self, tenant_id: str, ids: list[UUID]) -> None:
        for memory_id in ids:
            for projecao in self.projecoes:
                try:
                    projecao.apagar(tenant_id, memory_id)
                except Exception as erro:
                    _registrar_pendencia(tenant_id, memory_id, projecao.nome, erro)


# ── funções de apoio ───────────────────────────────────────────────────────


def _inserir_versao(conn: psycopg.Connection, **c: Any) -> dict[str, Any]:
    content: MemoryContent = c["content"]
    provenance: Provenance = c["provenance"]
    governance: Governance = c["governance"]
    metadata: MemoryMetadata = c["metadata"]
    return conn.execute(
        """
        INSERT INTO stec.memoria (
          memory_id, version, tenant_id, agent_id, project_id, kind, category,
          text, entities, relations, valid_from, valid_to, tx_from,
          source, source_id, extracted_by, confidence,
          classification, retention_days, pii, domain, tags, importance,
          change_reason, supersedes, embedding, embedding_model
        ) VALUES (
          %(memory_id)s, %(version)s, %(tenant_id)s, %(agent_id)s, %(project_id)s, %(kind)s, %(category)s,
          %(text)s, %(entities)s, %(relations)s, %(valid_from)s, %(valid_to)s, coalesce(%(tx_from)s, clock_timestamp()),
          %(source)s, %(source_id)s, %(extracted_by)s, %(confidence)s,
          %(classification)s, %(retention_days)s, %(pii)s, %(domain)s, %(tags)s, %(importance)s,
          %(change_reason)s, %(supersedes)s, %(embedding)s, %(embedding_model)s
        ) RETURNING *
        """,
        {
            "memory_id": c["memory_id"],
            "version": c["version"],
            "tenant_id": c["tenant_id"],
            "agent_id": c["agent_id"],
            "project_id": c["project_id"],
            "kind": c["kind"],
            "category": c["category"],
            "text": content.text,
            "entities": Jsonb([e.model_dump() for e in content.entities]),
            "relations": Jsonb([r.model_dump() for r in content.relations]),
            "valid_from": c["valid_from"],
            "valid_to": c["valid_to"],
            "tx_from": c.get("tx_from"),
            "source": provenance.source,
            "source_id": provenance.source_id,
            "extracted_by": provenance.extracted_by,
            "confidence": provenance.confidence.value,
            "classification": governance.classification.value,
            "retention_days": governance.retention_days,
            "pii": governance.pii,
            "domain": metadata.domain,
            "tags": metadata.tags,
            "importance": metadata.importance_score,
            "change_reason": c["change_reason"],
            "supersedes": c["supersedes"],
            "embedding": _vetor(c["embedding"]),
            "embedding_model": c["embedding_model"],
        },
    ).fetchone()


def _vetor(valores: list[float]) -> Any:
    import numpy as np

    return np.array(valores, dtype=np.float32)


def _vigente_para_atualizar(conn: psycopg.Connection, memory_id: UUID) -> dict[str, Any]:
    linha = conn.execute(
        "SELECT * FROM stec.memoria WHERE memory_id = %s AND tx_to IS NULL FOR UPDATE", (memory_id,)
    ).fetchone()
    if linha is None:
        raise NaoEncontrada(str(memory_id))
    if linha["erased_at"] is not None:
        raise Conflito("memória apagada não recebe versão nova")
    return linha


def _apagar_versoes(conn: psycopg.Connection, where: str, parametros: tuple[Any, ...], motivo: str) -> int:
    cursor = conn.execute(
        f"""
        UPDATE stec.memoria
        SET text = %s, entities = '[]'::jsonb, relations = '[]'::jsonb, tags = '{{}}',
            domain = NULL, embedding = NULL, erased_at = clock_timestamp(), erased_reason = %s
        WHERE {where} AND erased_at IS NULL
        """,
        (APAGADO, motivo, *parametros),
    )
    return cursor.rowcount


def _auditar(
    conn: psycopg.Connection, ctx: Contexto, acao: str, memory_id: UUID | None, detalhe: dict[str, Any]
) -> None:
    conn.execute(
        "INSERT INTO stec.auditoria (tenant_id, actor, action, memory_id, detail) VALUES (%s, %s, %s, %s, %s)",
        (ctx.tenant_id, ctx.actor, acao, memory_id, Jsonb(detalhe)),
    )


def _registrar_pendencia(tenant_id: str, memory_id: UUID, alvo: str, erro: Exception) -> None:
    with db.tenant_tx(tenant_id) as conn:
        conn.execute(
            "INSERT INTO stec.projecao_pendente (tenant_id, memory_id, target, error) VALUES (%s, %s, %s, %s)",
            (tenant_id, memory_id, alvo, f"{type(erro).__name__}: {erro}"[:500]),
        )


def _filtro_temporal(valid_at: datetime | None, known_at: datetime | None) -> tuple[str, list[Any]]:
    """Consulta bitemporal. Sem known_at: a versão vigente. Com known_at: a
    versão em que o sistema acreditava naquele instante. valid_at filtra o
    que valia no mundo; padrão, agora. Memória apagada nunca volta."""
    parametros: list[Any] = []
    if known_at is None:
        filtro = "tx_to IS NULL"
    else:
        filtro = "tx_from <= %s AND (tx_to IS NULL OR tx_to > %s)"
        parametros += [known_at, known_at]
    momento = valid_at or datetime.now(UTC)
    filtro += " AND valid_from <= %s AND (valid_to IS NULL OR valid_to > %s) AND erased_at IS NULL"
    parametros += [momento, momento]
    return filtro, parametros


def _provenance(linha: dict[str, Any]) -> Provenance:
    return Provenance(
        source=linha["source"],
        source_id=linha["source_id"],
        extracted_by=linha["extracted_by"],
        confidence=linha["confidence"],
    )


def _governance(linha: dict[str, Any]) -> Governance:
    return Governance(classification=linha["classification"], retention_days=linha["retention_days"], pii=linha["pii"])


def _para_versao(linha: dict[str, Any]) -> MemoryVersion:
    return MemoryVersion(
        memory_id=linha["memory_id"],
        version_id=linha["version_id"],
        version=linha["version"],
        tenant_id=linha["tenant_id"],
        agent_id=linha["agent_id"],
        project_id=linha["project_id"],
        type=linha["kind"],
        category=linha["category"],
        content=MemoryContent(text=linha["text"], entities=linha["entities"], relations=linha["relations"]),
        valid_from=linha["valid_from"],
        valid_to=linha["valid_to"],
        tx_from=linha["tx_from"],
        tx_to=linha["tx_to"],
        provenance=_provenance(linha),
        governance=_governance(linha),
        metadata=MemoryMetadata(domain=linha["domain"], tags=linha["tags"], importance_score=linha["importance"]),
        change_reason=linha["change_reason"],
        supersedes=linha["supersedes"],
        erased=linha["erased_at"] is not None,
    )
