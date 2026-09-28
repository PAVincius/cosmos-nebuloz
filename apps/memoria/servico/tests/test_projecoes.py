"""Qdrant, Neo4j e MinIO seguem o Postgres: gravam a vigente, somem no apagamento."""

import pytest

from app.main import app
from app.projecoes import colecao_do_tenant

from .conftest import memoria


def _projecao(nome: str):
    projecao = next((p for p in app.state.motor.projecoes if p.nome == nome), None)
    if projecao is None:
        pytest.skip(f"projeção {nome} desligada")
    return projecao


def _ingerir_com_grafo(client, tenant):
    return client.post(
        "/api/v1/memories/ingest",
        json=memoria(
            "Nebuloz escolheu o Charter para governar o uso de IA",
            project_id="proj-proj",
            entities=[{"name": "Nebuloz", "type": "Organization"}, {"name": "Charter", "type": "Product"}],
            relations=[{"subject": "Nebuloz", "predicate": "GOVERNA_COM", "object": "Charter"}],
        ),
        headers=tenant.escrita,
    ).json()


def test_saude_reporta_cada_servico(client):
    corpo = client.get("/health").json()
    assert corpo["services"]["postgres"] == "ok"
    assert corpo["status"] in {"ok", "degradado"}


def test_projecao_nao_falha_em_silencio(client, tenants):
    """Falha de projeção vira pendência. Depois de gravar, não pode haver nenhuma."""
    a, _ = tenants
    _ingerir_com_grafo(client, a)
    assert client.get("/api/v1/maintenance/pending", headers=a.admin).json() == {"pending_projections": 0}


def test_qdrant_guarda_so_a_vigente_por_tenant(client, tenants):
    qdrant = _projecao("qdrant")
    a, b = tenants
    criada = _ingerir_com_grafo(client, a)
    pontos = qdrant._cliente.retrieve(colecao_do_tenant(a.id), ids=[criada["memory_id"]])
    assert len(pontos) == 1
    assert not qdrant._cliente.collection_exists(colecao_do_tenant(b.id)) or not qdrant._cliente.retrieve(
        colecao_do_tenant(b.id), ids=[criada["memory_id"]]
    )
    client.request("DELETE", f"/api/v1/memories/{criada['memory_id']}", json={"reason": "t"}, headers=a.admin)
    assert qdrant._cliente.retrieve(colecao_do_tenant(a.id), ids=[criada["memory_id"]]) == []


def test_neo4j_relaciona_entidades_do_tenant(client, tenants):
    _projecao("neo4j")
    a, b = tenants
    criada = _ingerir_com_grafo(client, a)
    grafo = client.get("/api/v1/graph/entities/Nebuloz", headers=a.leitura).json()
    assert {"predicate": "GOVERNA_COM", "other": "Charter"}.items() <= grafo["relations"][0].items()
    assert client.get("/api/v1/graph/entities/Nebuloz", headers=b.leitura).json()["relations"] == []
    client.request("DELETE", f"/api/v1/memories/{criada['memory_id']}", json={"reason": "t"}, headers=a.admin)
    assert all(
        r["memory_id"] != criada["memory_id"]
        for r in client.get("/api/v1/graph/entities/Nebuloz", headers=a.leitura).json()["relations"]
    )


def test_minio_arquiva_cada_versao_e_apaga_todas(client, tenants):
    minio = _projecao("minio")
    a, _ = tenants
    criada = _ingerir_com_grafo(client, a)
    client.post(f"/api/v1/memories/{criada['memory_id']}/supersede", json={"reason": "correção"}, headers=a.escrita)
    nomes = minio.versoes(a.id, criada["memory_id"])
    assert [n.rsplit("/", 1)[1] for n in nomes] == ["v1.json", "v2.json"]
    client.request("DELETE", f"/api/v1/memories/{criada['memory_id']}", json={"reason": "t"}, headers=a.admin)
    assert minio.versoes(a.id, criada["memory_id"]) == []


def test_rebuild_refaz_as_projecoes_do_postgres(client, tenants):
    qdrant = _projecao("qdrant")
    a, _ = tenants
    criada = _ingerir_com_grafo(client, a)
    qdrant.apagar(a.id, criada["memory_id"])
    assert qdrant._cliente.retrieve(colecao_do_tenant(a.id), ids=[criada["memory_id"]]) == []
    resultado = client.post("/api/v1/maintenance/rebuild", headers=a.admin).json()
    assert resultado["projected"] >= 1
    assert len(qdrant._cliente.retrieve(colecao_do_tenant(a.id), ids=[criada["memory_id"]])) == 1
