"""Acesso ao Postgres.

Toda leitura e escrita de memória passa por `tenant_tx`, que abre uma
transação e fixa `app.tenant_id` só dentro dela. Sem isso a RLS devolve zero
linhas: esquecer o tenant falha fechado.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import psycopg
from pgvector.psycopg import register_vector
from psycopg import sql
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import Settings

MIGRACOES = Path(__file__).parent / "migrations"
APP_ROLE = "stec_app"

_pool: ConnectionPool | None = None


def _configurar(conn: psycopg.Connection) -> None:
    register_vector(conn)
    conn.row_factory = dict_row


def migrar(settings: Settings) -> None:
    """Aplica o esquema e cria o papel da API. Idempotente."""
    with psycopg.connect(settings.admin_database_url, autocommit=True) as conn:
        for arquivo in sorted(MIGRACOES.glob("*.sql")):
            conn.execute(arquivo.read_text(encoding="utf-8"))
        existe = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (APP_ROLE,)).fetchone()
        comando = "ALTER ROLE {} WITH LOGIN PASSWORD {}" if existe else "CREATE ROLE {} WITH LOGIN PASSWORD {}"
        conn.execute(sql.SQL(comando).format(sql.Identifier(APP_ROLE), sql.Literal(settings.app_db_password)))
        papel = sql.Identifier(APP_ROLE)
        for concessao in (
            "GRANT USAGE ON SCHEMA stec TO {}",
            "GRANT SELECT, INSERT, UPDATE ON stec.memoria TO {}",
            "GRANT SELECT, INSERT ON stec.auditoria TO {}",
            "GRANT SELECT, INSERT, DELETE ON stec.projecao_pendente TO {}",
            "GRANT USAGE ON ALL SEQUENCES IN SCHEMA stec TO {}",
            "GRANT EXECUTE ON FUNCTION stec.autenticar(text) TO {}",
            "REVOKE ALL ON stec.chave_api FROM {}",
            "REVOKE ALL ON stec.tenant FROM {}",
            "REVOKE EXECUTE ON FUNCTION stec.purgar_tenant(text) FROM {}",
        ):
            conn.execute(sql.SQL(concessao).format(papel))
        conn.execute("REVOKE EXECUTE ON FUNCTION stec.purgar_tenant(text) FROM PUBLIC")
        # O papel da API nunca pode furar a RLS.
        conn.execute(sql.SQL("ALTER ROLE {} NOSUPERUSER NOBYPASSRLS").format(papel))


def abrir_pool(settings: Settings) -> ConnectionPool:
    global _pool
    _pool = ConnectionPool(settings.database_url, min_size=1, max_size=10, configure=_configurar, open=True)
    return _pool


def fechar_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def pool() -> ConnectionPool:
    if _pool is None:
        raise RuntimeError("pool não aberto")
    return _pool


@contextmanager
def tenant_tx(tenant_id: str) -> Iterator[psycopg.Connection]:
    with pool().connection() as conn, conn.transaction():
        conn.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_id,))
        yield conn


@contextmanager
def sem_tenant() -> Iterator[psycopg.Connection]:
    """Conexão da API sem tenant fixado: só serve para autenticar e para saúde."""
    with pool().connection() as conn:
        yield conn


def conexao_admin(settings: Settings) -> psycopg.Connection:
    conn = psycopg.connect(settings.admin_database_url, autocommit=True)
    _configurar(conn)
    return conn
