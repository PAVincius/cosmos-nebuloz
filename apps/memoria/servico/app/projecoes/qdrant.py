"""Projeção vetorial no Qdrant: uma coleção por tenant, um ponto por memória
(a versão vigente). O id do ponto é o memory_id, então gravar de novo
substitui e apagar é uma chamada só."""

from typing import Any
from uuid import UUID

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from . import colecao_do_tenant


class QdrantProjecao:
    nome = "qdrant"

    def __init__(self, url: str) -> None:
        self._cliente = QdrantClient(url=url, timeout=10)

    def _garantir_colecao(self, colecao: str, dim: int) -> None:
        if not self._cliente.collection_exists(colecao):
            self._cliente.create_collection(
                colecao, vectors_config=qm.VectorParams(size=dim, distance=qm.Distance.COSINE)
            )

    def gravar(self, tenant_id: str, versao: dict[str, Any]) -> None:
        embedding = versao.get("embedding")
        if embedding is None:
            self.apagar(tenant_id, versao["memory_id"])
            return
        # A coluna `vector` sem dimensão volta como pgvector.Vector.
        valores = embedding.to_list() if hasattr(embedding, "to_list") else embedding
        vetor = [float(x) for x in valores]
        colecao = colecao_do_tenant(tenant_id)
        self._garantir_colecao(colecao, len(vetor))
        self._cliente.upsert(
            colecao,
            points=[
                qm.PointStruct(
                    id=str(versao["memory_id"]),
                    vector=vetor,
                    payload={
                        "version_id": str(versao["version_id"]),
                        "embedding_model": versao["embedding_model"],
                    },
                )
            ],
            wait=True,
        )

    def apagar(self, tenant_id: str, memory_id: UUID) -> None:
        colecao = colecao_do_tenant(tenant_id)
        if self._cliente.collection_exists(colecao):
            self._cliente.delete(colecao, points_selector=qm.PointIdsList(points=[str(memory_id)]), wait=True)

    def buscar(self, tenant_id: str, vetor: list[float], limite: int) -> list[tuple[UUID, float]]:
        colecao = colecao_do_tenant(tenant_id)
        if not self._cliente.collection_exists(colecao):
            return []
        resultado = self._cliente.query_points(colecao, query=vetor, limit=limite, with_payload=False)
        return [(UUID(str(p.id)), float(p.score)) for p in resultado.points]

    def saude(self) -> bool:
        try:
            self._cliente.get_collections()
            return True
        except Exception:
            return False
