"""Projeções da memória fora do Postgres.

Cada projeção recebe só a versão vigente de uma memória, ou a ordem de
apagá-la. Nenhuma é fonte: a API relê o Postgres antes de devolver qualquer
coisa, então uma projeção atrasada nunca ressuscita memória apagada ou
substituída. Falha de projeção vira pendência, e o reconcile refaz a partir
do Postgres.
"""

import hashlib
from typing import Any, Protocol
from uuid import UUID

from ..config import Settings


def colecao_do_tenant(tenant_id: str) -> str:
    """Nome físico por tenant. Isolamento que não depende de lembrar filtro."""
    return "stec_" + hashlib.sha256(tenant_id.encode()).hexdigest()[:24]


class Projecao(Protocol):
    nome: str

    def gravar(self, tenant_id: str, versao: dict[str, Any]) -> None: ...

    def apagar(self, tenant_id: str, memory_id: UUID) -> None: ...

    def saude(self) -> bool: ...


class VetorialProjecao(Projecao, Protocol):
    def buscar(self, tenant_id: str, vetor: list[float], limite: int) -> list[tuple[UUID, float]]: ...


def criar_projecoes(settings: Settings) -> list[Projecao]:
    projecoes: list[Projecao] = []
    if settings.qdrant_url:
        from .qdrant import QdrantProjecao

        projecoes.append(QdrantProjecao(settings.qdrant_url))
    if settings.neo4j_url:
        from .neo4j import Neo4jProjecao

        projecoes.append(Neo4jProjecao(settings.neo4j_url, settings.neo4j_user, settings.neo4j_password))
    if settings.minio_endpoint:
        from .minio import MinioProjecao

        projecoes.append(
            MinioProjecao(
                settings.minio_endpoint,
                settings.minio_access_key,
                settings.minio_secret_key,
                settings.minio_bucket,
                settings.minio_secure,
            )
        )
    return projecoes
