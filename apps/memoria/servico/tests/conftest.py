"""Testes de integração: rodam contra Postgres, Qdrant, Neo4j e MinIO reais.

Suba a infraestrutura do laboratório e aponte as variáveis STEC_* para ela
(ver README). Sem STEC_ADMIN_DATABASE_URL os testes são pulados. Cada sessão
usa tenants com sufixo aleatório e os purga no fim.
"""

import hashlib
import os
import secrets
from collections.abc import Iterator
from dataclasses import dataclass
from uuid import uuid4

import pytest

if not os.environ.get("STEC_ADMIN_DATABASE_URL"):
    pytest.skip("defina STEC_ADMIN_DATABASE_URL para rodar a integração", allow_module_level=True)

from fastapi.testclient import TestClient  # noqa: E402

from app import db  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402


@dataclass
class Tenant:
    id: str
    leitura: dict[str, str]
    escrita: dict[str, str]
    admin: dict[str, str]


def _chave(conn, tenant_id: str, papel: str) -> dict[str, str]:
    valor = "stec_" + secrets.token_urlsafe(24)
    conn.execute(
        "INSERT INTO stec.chave_api (tenant_id, hash, rotulo, papel) VALUES (%s, %s, %s, %s)",
        (tenant_id, hashlib.sha256(valor.encode()).hexdigest(), f"teste-{papel}", papel),
    )
    return {"X-API-Key": valor}


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def tenants(client: TestClient) -> Iterator[tuple[Tenant, Tenant]]:
    settings = get_settings()
    sufixo = uuid4().hex[:8]
    criados: list[Tenant] = []
    with db.conexao_admin(settings) as conn:
        for nome in ("a", "b"):
            tenant_id = f"teste-{nome}-{sufixo}"
            conn.execute("INSERT INTO stec.tenant (id, nome) VALUES (%s, %s)", (tenant_id, tenant_id))
            criados.append(
                Tenant(
                    id=tenant_id,
                    leitura=_chave(conn, tenant_id, "leitura"),
                    escrita=_chave(conn, tenant_id, "escrita"),
                    admin=_chave(conn, tenant_id, "admin"),
                )
            )
    yield criados[0], criados[1]
    motor = app.state.motor
    with db.conexao_admin(settings) as conn:
        for tenant in criados:
            ids = [
                r["memory_id"]
                for r in conn.execute(
                    "SELECT DISTINCT memory_id FROM stec.memoria WHERE tenant_id = %s", (tenant.id,)
                ).fetchall()
            ]
            conn.execute("SELECT stec.purgar_tenant(%s)", (tenant.id,))
            for projecao in motor.projecoes:
                for memory_id in ids:
                    projecao.apagar(tenant.id, memory_id)


def memoria(texto: str, **extra) -> dict:
    corpo = {
        "agent_id": "agente-teste",
        "project_id": extra.pop("project_id", "proj-teste"),
        "type": extra.pop("type", "semantic"),
        "category": extra.pop("category", "decision"),
        "content": {
            "text": texto,
            "entities": extra.pop("entities", []),
            "relations": extra.pop("relations", []),
        },
        "temporal": {"valid_from": extra.pop("valid_from", "2025-01-01T00:00:00Z")},
        "provenance": {
            "source": extra.pop("source", "decision_log"),
            "source_id": extra.pop("source_id", f"dl-{uuid4().hex[:6]}"),
            "extracted_by": "teste",
            "confidence": extra.pop("confidence", "declarado"),
        },
        "governance": extra.pop("governance", {"classification": "internal", "retention_days": 3650}),
    }
    corpo.update(extra)
    return corpo
