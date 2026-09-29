"""Perfis do compose ligam as projeções no endereço padrão; URL explícita sempre vence."""

import os

import pytest

from app.config import Settings

BASE = {"database_url": "postgresql://x", "admin_database_url": "postgresql://y", "app_db_password": "z"}


@pytest.fixture(autouse=True)
def ambiente_limpo(monkeypatch):
    """A suíte roda com STEC_* apontando para os serviços reais; aqui só vale o que o teste passa."""
    for nome in [n for n in os.environ if n.startswith("STEC_")]:
        monkeypatch.delenv(nome)


def test_sem_perfil_nenhuma_projecao():
    s = Settings(_env_file=None, **BASE, projecoes="")
    assert (s.qdrant_url, s.neo4j_url, s.minio_endpoint) == ("", "", "")


def test_perfis_ligam_so_o_que_foi_pedido():
    s = Settings(_env_file=None, **BASE, projecoes="vetor, arquivo")
    assert s.qdrant_url == "http://qdrant:6333"
    assert s.minio_endpoint == "minio:9000"
    assert s.neo4j_url == ""


def test_url_explicita_vence_o_perfil():
    s = Settings(_env_file=None, **BASE, projecoes="vetor,grafo", qdrant_url="http://127.0.0.1:6333")
    assert s.qdrant_url == "http://127.0.0.1:6333"
    assert s.neo4j_url == "bolt://neo4j:7687"
