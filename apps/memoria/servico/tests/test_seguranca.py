"""Autenticação, isolamento entre tenants e imutabilidade — garantidas no banco."""

import psycopg
import pytest

from app import db
from app.config import get_settings

from .conftest import memoria


def test_sem_chave_ou_chave_invalida_recusa(client):
    assert client.get("/api/v1/memories").status_code == 401
    assert client.get("/api/v1/memories", headers={"X-API-Key": "stec_falsa"}).status_code == 401


def test_papel_leitura_nao_escreve(client, tenants):
    a, _ = tenants
    resposta = client.post("/api/v1/memories/ingest", json=memoria("x"), headers=a.leitura)
    assert resposta.status_code == 403


def test_tenant_do_corpo_divergente_e_recusado(client, tenants):
    a, b = tenants
    resposta = client.post("/api/v1/memories/ingest", json=memoria("x", tenant_id=b.id), headers=a.escrita)
    assert resposta.status_code == 403


def test_confianca_so_aceita_a_escala_da_suite(client, tenants):
    a, _ = tenants
    corpo = memoria("x")
    corpo["provenance"]["confidence"] = 0.92
    assert client.post("/api/v1/memories/ingest", json=corpo, headers=a.escrita).status_code == 422


def test_tenant_b_nao_ve_memoria_de_a(client, tenants):
    a, b = tenants
    criada = client.post(
        "/api/v1/memories/ingest", json=memoria("Orçamento de IA aprovado para 2026"), headers=a.escrita
    ).json()
    memory_id = criada["memory_id"]

    assert memory_id in {m["memory_id"] for m in client.get("/api/v1/memories", headers=a.leitura).json()}
    assert memory_id not in {m["memory_id"] for m in client.get("/api/v1/memories", headers=b.leitura).json()}
    busca = client.post("/api/v1/memories/search", json={"query": "orçamento de IA"}, headers=b.leitura).json()
    assert memory_id not in {h["memory"]["memory_id"] for h in busca}
    assert client.get(f"/api/v1/memories/{memory_id}/history", headers=b.leitura).status_code == 404
    supersede = client.post(f"/api/v1/memories/{memory_id}/supersede", json={"reason": "tentativa"}, headers=b.escrita)
    assert supersede.status_code == 404


def _conexao_app():
    settings = get_settings()
    return psycopg.connect(settings.database_url, autocommit=True)


def test_papel_da_api_sem_tenant_nao_enxerga_nada(tenants):
    with _conexao_app() as conn:
        n = conn.execute("SELECT count(*) FROM stec.memoria").fetchone()[0]
    assert n == 0


def test_papel_da_api_nao_grava_em_outro_tenant(tenants):
    a, b = tenants
    with _conexao_app() as conn, pytest.raises(psycopg.errors.InsufficientPrivilege), conn.transaction():
        conn.execute("SELECT set_config('app.tenant_id', %s, true)", (b.id,))
        conn.execute(
            """
                INSERT INTO stec.memoria (memory_id, version, tenant_id, agent_id, kind, category, text,
                  valid_from, source, source_id, extracted_by, confidence, classification, retention_days)
                VALUES (gen_random_uuid(), 1, %s, 'x', 'semantic', 'fact', 'x', now(), 's', 's', 's',
                  'declarado', 'internal', 1)
                """,
            (a.id,),
        )


def test_papel_da_api_nao_le_chaves(tenants):
    with _conexao_app() as conn, pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("SELECT * FROM stec.chave_api").fetchall()


def test_memoria_nao_se_edita_direto(client, tenants):
    a, _ = tenants
    criada = client.post("/api/v1/memories/ingest", json=memoria("fato imutável"), headers=a.escrita).json()
    with _conexao_app() as conn, pytest.raises(psycopg.errors.RaiseException), conn.transaction():
        conn.execute("SELECT set_config('app.tenant_id', %s, true)", (a.id,))
        conn.execute("UPDATE stec.memoria SET text = 'reescrito' WHERE memory_id = %s", (criada["memory_id"],))


def test_papel_da_api_nao_tem_delete_nem_update_na_auditoria(tenants):
    a, _ = tenants
    for comando in ("DELETE FROM stec.memoria", "UPDATE stec.auditoria SET action = 'x'", "DELETE FROM stec.auditoria"):
        with _conexao_app() as conn, pytest.raises(psycopg.errors.InsufficientPrivilege), conn.transaction():
            conn.execute("SELECT set_config('app.tenant_id', %s, true)", (a.id,))
            conn.execute(comando)


def test_nem_o_dono_reescreve_memoria_ou_auditoria(client, tenants):
    """A trigger vale até para o superusuário: imutabilidade não depende de grant."""
    a, _ = tenants
    criada = client.post("/api/v1/memories/ingest", json=memoria("para auditar"), headers=a.escrita).json()
    with db.conexao_admin(get_settings()) as conn:
        for comando, parametros in (
            ("UPDATE stec.memoria SET text = 'reescrito' WHERE memory_id = %s", (criada["memory_id"],)),
            ("DELETE FROM stec.memoria WHERE memory_id = %s", (criada["memory_id"],)),
            ("UPDATE stec.auditoria SET action = 'x' WHERE tenant_id = %s", (a.id,)),
            ("DELETE FROM stec.auditoria WHERE tenant_id = %s", (a.id,)),
        ):
            with pytest.raises(psycopg.errors.RaiseException):
                conn.execute(comando, parametros)
