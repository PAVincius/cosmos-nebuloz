"""Memória para agentes, por MCP (Model Context Protocol), em /mcp.

É o mesmo serviço e a mesma chave de API da rota HTTP: o tenant, o papel e o
agente vêm da chave, nunca do que o agente declara. No Maestri, cada papel tem
a sua chave (scripts/cabecalho.sh escolhe pela pasta do papel). As ferramentas cobrem lembrar, buscar, listar,
substituir, revogar, histórico e relações. Apagar fica fora do MCP de
propósito: apagamento é decisão de gente, pela API de governança com chave
admin.
"""

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import anyio.to_thread
from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.streamable_http_manager import StreamableHTTPASGIApp
from mcp.server.transport_security import TransportSecuritySettings
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.types import Receive, Scope, Send

from .acesso import autenticar_chave, pode
from .config import get_settings
from .schemas import (
    Category,
    Confidence,
    Entity,
    Kind,
    MemoryContent,
    MemoryIngest,
    MemoryInvalidate,
    MemoryMetadata,
    MemorySearch,
    MemorySupersede,
    MemoryVersion,
    Provenance,
    Relation,
    Temporal,
)
from .servico import Conflito, Contexto, Motor, NaoEncontrada

INSTRUCOES = """\
Memória de longo prazo da Nebuloz. Dura anos: escreva para quem vai ler daqui a um ano, sem o contexto desta conversa.

Quando lembrar: decisão tomada (e o porquê), compromisso assumido, lição aprendida, fato estável, preferência de alguém.
Não lembre: rascunho, passo intermediário, o que já está no código ou no git,
segredo, chave, senha, dado pessoal de cliente.

Antes de decidir algo que pode já ter sido decidido, busque.
Achou a memória e ela mudou: use substituir, não crie outra.
Deixou de valer (decisão revogada): use revogar; a memória continua consultável na data em que valia.

Confiança, na escala da suíte: medido (há evidência verificável), estimado (inferência forte),
declarado (alguém afirmou).
"""

servidor_mcp = MCPServer(name="memoria-nebuloz", instructions=INSTRUCOES, version="0.2.0")

_obter_motor: Callable[[], Motor] | None = None


def _motor() -> Motor:
    if _obter_motor is None:
        raise ToolError("serviço de memória não iniciado")
    return _obter_motor()


def _contexto(ctx: Context, papel: str) -> Contexto:
    headers = ctx.headers or {}
    identidade = autenticar_chave(headers.get("x-api-key"))
    if identidade is None:
        raise ToolError("chave de API ausente, inválida ou revogada")
    if not pode(identidade, papel):
        raise ToolError(f"esta chave não tem o papel {papel}")
    return identidade


def _utc(valor: datetime | None) -> datetime | None:
    if valor is None or valor.tzinfo is not None:
        return valor
    return valor.replace(tzinfo=UTC)


def _iso(valor: datetime | None) -> str | None:
    return valor.isoformat() if valor else None


def _resumo(v: MemoryVersion) -> dict[str, Any]:
    return {
        "memory_id": str(v.memory_id),
        "versao": v.version,
        "texto": v.content.text,
        "categoria": v.category.value,
        "tipo": v.type.value,
        "agente": v.agent_id,
        "projeto": v.project_id,
        "valido_desde": _iso(v.valid_from),
        "valido_ate": _iso(v.valid_to),
        "registrado_em": _iso(v.tx_from),
        "substituido_em": _iso(v.tx_to),
        "confianca": v.provenance.confidence.value,
        "origem": f"{v.provenance.source}:{v.provenance.source_id}",
        "entidades": [e.name for e in v.content.entities],
        "tags": v.metadata.tags,
        "motivo_da_mudanca": v.change_reason,
        "apagada": v.erased,
    }


def _traduzir(erro: Exception) -> ToolError:
    if isinstance(erro, NaoEncontrada):
        return ToolError("memória não encontrada")
    return ToolError(str(erro))


@servidor_mcp.tool()
def lembrar(
    texto: str,
    categoria: Category,
    ctx: Context,
    tipo: Kind = Kind.semantic,
    confianca: Confidence = Confidence.declarado,
    projeto: str | None = None,
    entidades: list[Entity] | None = None,
    relacoes: list[Relation] | None = None,
    tags: list[str] | None = None,
    origem: str = "agente",
    origem_id: str | None = None,
    valido_desde: datetime | None = None,
) -> dict[str, Any]:
    """Grava uma memória nova. Quem lembra é o agente dono da chave (ex.: Crivo, Norte), não um parâmetro.
    `origem`/`origem_id` apontam de onde veio (ex.: "pr" / "PAVincius/cosmos-nebuloz#266") e permitem apagar
    tudo o que veio de uma origem. `valido_desde`: quando o fato passou a valer; padrão, agora."""
    identidade = _contexto(ctx, "escrita")
    entrada = MemoryIngest(
        agent_id=identidade.actor,
        project_id=projeto,
        type=tipo,
        category=categoria,
        content=MemoryContent(text=texto, entities=entidades or [], relations=relacoes or []),
        temporal=Temporal(valid_from=_utc(valido_desde) or datetime.now(UTC)),
        provenance=Provenance(
            source=origem,
            source_id=origem_id or f"mcp-{uuid4().hex[:12]}",
            extracted_by=f"mcp:{identidade.actor}",
            confidence=confianca,
        ),
        metadata=MemoryMetadata(tags=tags or []),
    )
    return _resumo(_motor().ingerir(identidade, entrada))


@servidor_mcp.tool()
def buscar(
    consulta: str,
    ctx: Context,
    projeto: str | None = None,
    categoria: Category | None = None,
    valido_em: datetime | None = None,
    sabido_em: datetime | None = None,
    k: int = 8,
) -> list[dict[str, Any]]:
    """Busca híbrida (vetor + texto) nas memórias vigentes. `valido_em`: o que valia naquela data.
    `sabido_em`: o que a memória sabia naquela data, antes de correções posteriores."""
    identidade = _contexto(ctx, "leitura")
    busca = MemorySearch(
        query=consulta,
        project_id=projeto,
        category=categoria,
        valid_at=_utc(valido_em),
        known_at=_utc(sabido_em),
        top_k=max(1, min(k, 50)),
    )
    return [{"pontuacao": h.score, **_resumo(h.memory)} for h in _motor().buscar(identidade, busca)]


@servidor_mcp.tool()
def listar(
    ctx: Context,
    projeto: str | None = None,
    categoria: Category | None = None,
    valido_em: datetime | None = None,
    limite: int = 20,
) -> list[dict[str, Any]]:
    """Lista as memórias vigentes, das mais recentes para as mais antigas."""
    identidade = _contexto(ctx, "leitura")
    versoes = _motor().listar(
        identidade,
        project_id=projeto,
        kind=None,
        category=categoria.value if categoria else None,
        valid_at=_utc(valido_em),
        known_at=None,
        limite=max(1, min(limite, 100)),
    )
    return [_resumo(v) for v in versoes]


@servidor_mcp.tool()
def substituir(memory_id: str, texto: str, motivo: str, ctx: Context) -> dict[str, Any]:
    """Cria a versão nova de uma memória que mudou. A anterior fica no histórico, com a data em que deixou de ser
    a vigente."""
    identidade = _contexto(ctx, "escrita")
    pedido = MemorySupersede(reason=motivo, content=MemoryContent(text=texto))
    try:
        return _resumo(_motor().substituir(identidade, _uuid(memory_id), pedido))
    except (NaoEncontrada, Conflito) as erro:
        raise _traduzir(erro) from erro


@servidor_mcp.tool()
def revogar(memory_id: str, motivo: str, ctx: Context, valido_ate: datetime | None = None) -> dict[str, Any]:
    """Marca que o fato deixou de valer (ex.: decisão revogada). Não apaga: a memória segue consultável na data em
    que valia. `valido_ate`: padrão, agora."""
    identidade = _contexto(ctx, "escrita")
    pedido = MemoryInvalidate(valid_to=_utc(valido_ate) or datetime.now(UTC), reason=motivo)
    try:
        return _resumo(_motor().invalidar(identidade, _uuid(memory_id), pedido))
    except (NaoEncontrada, Conflito) as erro:
        raise _traduzir(erro) from erro


@servidor_mcp.tool()
def historico(memory_id: str, ctx: Context) -> list[dict[str, Any]]:
    """Todas as versões de uma memória, com o motivo de cada mudança."""
    identidade = _contexto(ctx, "leitura")
    try:
        return [_resumo(v) for v in _motor().historico(identidade, _uuid(memory_id))]
    except NaoEncontrada as erro:
        raise _traduzir(erro) from erro


@servidor_mcp.tool()
def relacionadas(entidade: str, ctx: Context) -> dict[str, Any]:
    """Entidades e memórias ligadas a uma entidade no grafo (pessoa, produto, sistema, decisão)."""
    identidade = _contexto(ctx, "leitura")
    grafo = next((p for p in _motor().projecoes if p.nome == "neo4j"), None)
    if grafo is None:
        raise ToolError("projeção de grafo desligada")
    return {"entidade": entidade, "relacoes": grafo.vizinhos(identidade.tenant_id, entidade)}


def _uuid(valor: str) -> UUID:
    try:
        return UUID(valor)
    except ValueError as erro:
        raise ToolError("memory_id não é um UUID") from erro


class _ExigeChave:
    """Recusa, antes do protocolo, requisição sem chave válida."""

    def __init__(self, app: StreamableHTTPASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            chave = dict(scope["headers"]).get(b"x-api-key")
            identidade = await anyio.to_thread.run_sync(autenticar_chave, chave.decode() if chave else None)
            if identidade is None:
                resposta = JSONResponse({"detail": "chave de API ausente, inválida ou revogada"}, status_code=401)
                await resposta(scope, receive, send)
                return
        await self.app(scope, receive, send)


def rota_mcp(obter_motor: Callable[[], Motor]) -> Route:
    global _obter_motor
    _obter_motor = obter_motor
    settings = get_settings()
    # Sem sessão no servidor: cada chamada é independente, e reiniciar o serviço não derruba os agentes.
    servidor_mcp.streamable_http_app(
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=settings.mcp_allowed_hosts,
            allowed_origins=[f"http://{h}" for h in settings.mcp_allowed_hosts],
        ),
    )
    return Route("/mcp", endpoint=_ExigeChave(StreamableHTTPASGIApp(servidor_mcp.session_manager)))
