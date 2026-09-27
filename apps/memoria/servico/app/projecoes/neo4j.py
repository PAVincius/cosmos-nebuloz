"""Projeção de grafo no Neo4j.

(:Memoria {tenant_id, memory_id, valid_from, valid_to})-[:MENCIONA]->(:Entidade)
(:Entidade)-[:RELACIONA {predicate, memory_id, valid_from, valid_to}]->(:Entidade)

Toda consulta filtra por tenant_id, e a chave de Entidade inclui o tenant:
duas empresas com um "Cliente X" são dois nós."""

from typing import Any
from uuid import UUID

from neo4j import GraphDatabase

_ESQUEMA = (
    "CREATE CONSTRAINT stec_memoria IF NOT EXISTS FOR (m:Memoria) REQUIRE (m.tenant_id, m.memory_id) IS UNIQUE",
    "CREATE CONSTRAINT stec_entidade IF NOT EXISTS FOR (e:Entidade) REQUIRE (e.tenant_id, e.name) IS UNIQUE",
)

# Três comandos separados: se a memória já não tiver nó, as arestas dela e as
# entidades órfãs ainda precisam sumir.
_APAGAR = (
    "MATCH (m:Memoria {tenant_id: $tenant_id, memory_id: $memory_id}) DETACH DELETE m",
    "MATCH (:Entidade {tenant_id: $tenant_id})-[r:RELACIONA {memory_id: $memory_id}]->(:Entidade) DELETE r",
    "MATCH (e:Entidade {tenant_id: $tenant_id}) WHERE NOT (e)--() DELETE e",
)

_GRAVAR = """
MERGE (m:Memoria {tenant_id: $tenant_id, memory_id: $memory_id})
SET m.version_id = $version_id, m.valid_from = $valid_from, m.valid_to = $valid_to,
    m.category = $category
WITH m
UNWIND $entities AS ent
  MERGE (e:Entidade {tenant_id: $tenant_id, name: ent.name})
  ON CREATE SET e.type = ent.type
  MERGE (m)-[:MENCIONA]->(e)
"""

_RELACIONAR = """
UNWIND $relations AS rel
  MERGE (s:Entidade {tenant_id: $tenant_id, name: rel.subject})
  MERGE (o:Entidade {tenant_id: $tenant_id, name: rel.object})
  CREATE (s)-[:RELACIONA {predicate: rel.predicate, memory_id: $memory_id,
                          valid_from: $valid_from, valid_to: $valid_to}]->(o)
"""

_VIZINHOS = """
MATCH (e:Entidade {tenant_id: $tenant_id, name: $name})-[r:RELACIONA]-(o:Entidade {tenant_id: $tenant_id})
RETURN r.predicate AS predicate, o.name AS other, startNode(r) = e AS outgoing,
       r.memory_id AS memory_id, r.valid_from AS valid_from, r.valid_to AS valid_to
ORDER BY r.valid_from DESC
LIMIT $limite
"""


class Neo4jProjecao:
    nome = "neo4j"

    def __init__(self, url: str, usuario: str, senha: str) -> None:
        self._driver = GraphDatabase.driver(url, auth=(usuario, senha))
        self._esquema_ok = False

    def _garantir_esquema(self) -> None:
        if self._esquema_ok:
            return
        with self._driver.session() as sessao:
            for comando in _ESQUEMA:
                sessao.run(comando)
        self._esquema_ok = True

    def gravar(self, tenant_id: str, versao: dict[str, Any]) -> None:
        self._garantir_esquema()
        parametros = {
            "tenant_id": tenant_id,
            "memory_id": str(versao["memory_id"]),
            "version_id": str(versao["version_id"]),
            "valid_from": versao["valid_from"].isoformat(),
            "valid_to": versao["valid_to"].isoformat() if versao["valid_to"] else None,
            "category": versao["category"],
            "entities": versao["entities"],
            "relations": versao["relations"],
        }
        with self._driver.session() as sessao:
            sessao.execute_write(lambda tx: self._apagar_tx(tx, tenant_id, parametros["memory_id"]))
            sessao.execute_write(lambda tx: tx.run(_GRAVAR, **parametros).consume())
            sessao.execute_write(lambda tx: tx.run(_RELACIONAR, **parametros).consume())

    def apagar(self, tenant_id: str, memory_id: UUID) -> None:
        self._garantir_esquema()
        with self._driver.session() as sessao:
            sessao.execute_write(lambda tx: self._apagar_tx(tx, tenant_id, str(memory_id)))

    @staticmethod
    def _apagar_tx(tx: Any, tenant_id: str, memory_id: str) -> None:
        for comando in _APAGAR:
            tx.run(comando, tenant_id=tenant_id, memory_id=memory_id).consume()

    def vizinhos(self, tenant_id: str, nome: str, limite: int = 50) -> list[dict[str, Any]]:
        with self._driver.session() as sessao:
            return sessao.execute_read(
                lambda tx: [r.data() for r in tx.run(_VIZINHOS, tenant_id=tenant_id, name=nome, limite=limite)]
            )

    def saude(self) -> bool:
        try:
            self._driver.verify_connectivity()
            return True
        except Exception:
            return False
