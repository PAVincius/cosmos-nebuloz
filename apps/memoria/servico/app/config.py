"""Configuração lida do ambiente. Nenhum segredo tem valor padrão."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STEC_", env_file=".env", extra="ignore")

    # Conexão da API: papel sem superuser, sujeito à RLS.
    database_url: str
    # Conexão de migração e administração (dono do esquema). Só a CLI e a
    # subida do serviço usam; nunca atende requisição.
    admin_database_url: str
    # Senha do papel da API, criada pela migração.
    app_db_password: str

    # Embeddings: "hash" é local e determinístico (sem semântica, serve para
    # teste e para subir sem modelo); "ollama" usa o modelo abaixo.
    embedding_provider: str = Field(default="hash", pattern="^(hash|ollama)$")
    embedding_dim: int = 256
    ollama_url: str = "http://ollama:11434"
    ollama_embedding_model: str = "nomic-embed-text"

    # Projeções. Vazio = desligada; o Postgres continua sendo a fonte.
    qdrant_url: str = ""
    neo4j_url: str = ""
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    minio_endpoint: str = ""
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket: str = "stec-memoria"
    minio_secure: bool = False

    # Host aceito no /mcp (proteção contra DNS rebinding). JSON no ambiente.
    mcp_allowed_hosts: list[str] = ["127.0.0.1:*", "localhost:*", "[::1]:*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
