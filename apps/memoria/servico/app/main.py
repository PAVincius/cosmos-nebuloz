"""API HTTP do serviço de memória (Memory Control Plane).

O tenant sai da chave de API. Nenhuma rota confia em tenant_id vindo do
corpo ou da query: quando ele vem, só serve para conferir e recusar se
divergir da chave."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
from pydantic import AwareDatetime, BaseModel, Field

from . import db
from .acesso import autenticar_chave, pode
from .agentes import rota_mcp, servidor_mcp
from .config import get_settings
from .embeddings import criar_embedder
from .projecoes import criar_projecoes
from .schemas import (
    AuditEntry,
    Category,
    ErasureRequest,
    Kind,
    MemoryIngest,
    MemoryInvalidate,
    MemorySearch,
    MemorySupersede,
    MemoryVersion,
    SearchHit,
)
from .servico import Conflito, Contexto, Motor, NaoEncontrada


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    db.migrar(settings)
    db.abrir_pool(settings)
    app.state.motor = Motor(embedder=criar_embedder(settings), projecoes=criar_projecoes(settings))
    async with servidor_mcp.session_manager.run():
        yield
    db.fechar_pool()


app = FastAPI(
    title="Memória Nebuloz (Memory Control Plane)",
    description="Memória de longo prazo por tenant: Postgres como registro; Qdrant, Neo4j e MinIO como projeções.",
    version="0.1.0",
    lifespan=ciclo_de_vida,
)
# Os agentes (Maestri, Claude Code) falam MCP em /mcp, com a mesma chave de API.
app.router.routes.append(rota_mcp(lambda: app.state.motor))


def motor() -> Motor:
    return app.state.motor


def _autenticar(x_api_key: Annotated[str | None, Header()] = None) -> Contexto:
    if not x_api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "chave de API ausente")
    ctx = autenticar_chave(x_api_key)
    if ctx is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "chave de API inválida ou revogada")
    return ctx


def exige(papel: str):
    def dependencia(ctx: Annotated[Contexto, Depends(_autenticar)]) -> Contexto:
        if not pode(ctx, papel):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"precisa do papel {papel}")
        return ctx

    return dependencia


Leitura = Annotated[Contexto, Depends(exige("leitura"))]
Escrita = Annotated[Contexto, Depends(exige("escrita"))]
Admin = Annotated[Contexto, Depends(exige("admin"))]


def _conferir_tenant(ctx: Contexto, tenant_id: str | None) -> None:
    if tenant_id is not None and tenant_id != ctx.tenant_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "tenant_id não corresponde à chave de API")


def _traduzir(erro: Exception) -> HTTPException:
    if isinstance(erro, NaoEncontrada):
        return HTTPException(status.HTTP_404_NOT_FOUND, "memória não encontrada")
    if isinstance(erro, Conflito):
        return HTTPException(status.HTTP_409_CONFLICT, str(erro))
    raise erro


# ── ingestão e versões ─────────────────────────────────────────────────────


@app.post("/api/v1/memories/ingest", response_model=MemoryVersion, status_code=201)
def ingerir(entrada: MemoryIngest, ctx: Escrita) -> MemoryVersion:
    _conferir_tenant(ctx, entrada.tenant_id)
    return motor().ingerir(ctx, entrada)


class Lote(BaseModel):
    memories: list[MemoryIngest] = Field(min_length=1, max_length=100)


@app.post("/api/v1/memories/batch", status_code=201)
def ingerir_lote(lote: Lote, ctx: Escrita) -> dict[str, Any]:
    for entrada in lote.memories:
        _conferir_tenant(ctx, entrada.tenant_id)
    criadas = [motor().ingerir(ctx, entrada) for entrada in lote.memories]
    return {"count": len(criadas), "memories": criadas}


@app.post("/api/v1/memories/{memory_id}/supersede", response_model=MemoryVersion)
def substituir(memory_id: UUID, pedido: MemorySupersede, ctx: Escrita) -> MemoryVersion:
    try:
        return motor().substituir(ctx, memory_id, pedido)
    except (NaoEncontrada, Conflito) as erro:
        raise _traduzir(erro) from erro


@app.post("/api/v1/memories/{memory_id}/invalidate", response_model=MemoryVersion)
def invalidar(memory_id: UUID, pedido: MemoryInvalidate, ctx: Escrita) -> MemoryVersion:
    try:
        return motor().invalidar(ctx, memory_id, pedido)
    except (NaoEncontrada, Conflito) as erro:
        raise _traduzir(erro) from erro


# ── leitura ────────────────────────────────────────────────────────────────


@app.get("/api/v1/memories", response_model=list[MemoryVersion])
def listar(
    ctx: Leitura,
    tenant_id: str | None = None,
    project_id: str | None = None,
    type: Kind | None = None,
    category: Category | None = None,
    valid_at: AwareDatetime | None = None,
    known_at: AwareDatetime | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[MemoryVersion]:
    _conferir_tenant(ctx, tenant_id)
    return motor().listar(
        ctx,
        project_id=project_id,
        kind=type.value if type else None,
        category=category.value if category else None,
        valid_at=valid_at,
        known_at=known_at,
        limite=limit,
    )


@app.post("/api/v1/memories/search", response_model=list[SearchHit])
def buscar(busca: MemorySearch, ctx: Leitura) -> list[SearchHit]:
    _conferir_tenant(ctx, busca.tenant_id)
    return motor().buscar(ctx, busca)


@app.get("/api/v1/memories/{memory_id}/history", response_model=list[MemoryVersion])
def historico(memory_id: UUID, ctx: Leitura) -> list[MemoryVersion]:
    try:
        return motor().historico(ctx, memory_id)
    except NaoEncontrada as erro:
        raise _traduzir(erro) from erro


@app.get("/api/v1/memories/{memory_id}/provenance")
def proveniencia(memory_id: UUID, ctx: Leitura) -> dict[str, Any]:
    try:
        versoes = motor().historico(ctx, memory_id)
    except NaoEncontrada as erro:
        raise _traduzir(erro) from erro
    return {
        "memory_id": memory_id,
        "chain": [
            {
                "version": v.version,
                "provenance": v.provenance,
                "change_reason": v.change_reason,
                "tx_from": v.tx_from,
                "tx_to": v.tx_to,
                "erased": v.erased,
            }
            for v in versoes
        ],
    }


@app.get("/api/v1/graph/entities/{name}")
def vizinhos(name: str, ctx: Leitura) -> dict[str, Any]:
    grafo = next((p for p in motor().projecoes if p.nome == "neo4j"), None)
    if grafo is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "projeção de grafo desligada")
    return {"entity": name, "relations": grafo.vizinhos(ctx.tenant_id, name)}


# ── governança ─────────────────────────────────────────────────────────────


class Motivo(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


@app.delete("/api/v1/memories/{memory_id}")
def apagar(memory_id: UUID, pedido: Motivo, ctx: Admin) -> dict[str, Any]:
    try:
        versoes = motor().apagar_memoria(ctx, memory_id, pedido.reason)
    except NaoEncontrada as erro:
        raise _traduzir(erro) from erro
    return {"memory_id": memory_id, "versions_erased": versoes}


@app.post("/api/v1/governance/erasure")
def apagar_por_origem(pedido: ErasureRequest, ctx: Admin) -> dict[str, Any]:
    ids = motor().apagar_por_origem(ctx, pedido.source, pedido.source_id, pedido.reason)
    return {"memories_erased": len(ids), "memory_ids": ids}


@app.get("/api/v1/governance/audit", response_model=list[AuditEntry])
def auditoria(ctx: Admin, limit: Annotated[int, Query(ge=1, le=500)] = 100) -> list[AuditEntry]:
    return motor().auditoria(ctx, limit)


# ── manutenção ─────────────────────────────────────────────────────────────


@app.post("/api/v1/maintenance/expire")
def expirar(ctx: Admin) -> dict[str, Any]:
    ids = motor().expirar(ctx)
    return {"memories_expired": len(ids), "memory_ids": ids}


@app.post("/api/v1/maintenance/reindex")
def reindexar(ctx: Admin) -> dict[str, Any]:
    return {"versions_reindexed": motor().reindexar(ctx), "embedding_model": motor().embedder.model}


@app.post("/api/v1/maintenance/rebuild")
def reconstruir(ctx: Admin) -> dict[str, Any]:
    """Refaz Qdrant, Neo4j e MinIO a partir do Postgres. É também o reconcile."""
    return motor().reconstruir(ctx)


@app.get("/api/v1/maintenance/pending")
def pendencias(ctx: Admin) -> dict[str, int]:
    return {"pending_projections": motor().pendencias(ctx)}


# ── saúde ──────────────────────────────────────────────────────────────────


@app.get("/health")
def saude(response: Response) -> dict[str, Any]:
    servicos: dict[str, str] = {}
    try:
        with db.sem_tenant() as conn:
            conn.execute("SELECT 1")
        servicos["postgres"] = "ok"
    except Exception:
        servicos["postgres"] = "falhou"
    for projecao in motor().projecoes:
        servicos[projecao.nome] = "ok" if projecao.saude() else "falhou"
    for nome in ("qdrant", "neo4j", "minio"):
        servicos.setdefault(nome, "desligado")
    # Sem Postgres não há memória; projeção fora do ar só degrada.
    if servicos["postgres"] != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        estado = "fora"
    elif "falhou" in servicos.values():
        estado = "degradado"
    else:
        estado = "ok"
    return {"status": estado, "services": servicos, "checked_at": datetime.now().astimezone().isoformat()}
