"""MCP em /mcp: a mesma chave, o mesmo tenant e o mesmo papel da API HTTP."""

import json
from itertools import count

import pytest

_ids = count(1)
HOST = {"Host": "localhost:8003"}


def _rpc(client, chave: dict[str, str] | None, metodo: str, params: dict | None = None, host=HOST):
    corpo = {"jsonrpc": "2.0", "id": next(_ids), "method": metodo, "params": params or {}}
    headers = {**host, "Accept": "application/json, text/event-stream", **(chave or {})}
    return client.post("/mcp", json=corpo, headers=headers)


def _iniciar(client, chave):
    resposta = _rpc(
        client,
        chave,
        "initialize",
        {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "teste", "version": "0"}},
    )
    assert resposta.status_code == 200, resposta.text
    return resposta.json()["result"]


def _chamar(client, chave, ferramenta: str, **argumentos):
    resposta = _rpc(client, chave, "tools/call", {"name": ferramenta, "arguments": argumentos})
    assert resposta.status_code == 200, resposta.text
    resultado = resposta.json()["result"]
    if resultado.get("isError"):
        return None, resultado["content"][0]["text"]
    estruturado = resultado.get("structuredContent")
    if estruturado is not None:
        return estruturado.get("result", estruturado), None
    return json.loads(resultado["content"][0]["text"]), None


def test_mcp_exige_chave(client, tenants):
    assert _rpc(client, None, "tools/list").status_code == 401
    assert _rpc(client, {"X-API-Key": "stec_falsa"}, "tools/list").status_code == 401


def test_mcp_recusa_host_estranho(client, tenants):
    a, _ = tenants
    resposta = _rpc(client, a.leitura, "tools/list", host={"Host": "atacante.example:80"})
    assert resposta.status_code in (400, 403, 421)


def test_mcp_lista_ferramentas_sem_apagar(client, tenants):
    a, _ = tenants
    info = _iniciar(client, a.leitura)
    assert "Memória de longo prazo" in (info.get("instructions") or "")
    nomes = {t["name"] for t in _rpc(client, a.leitura, "tools/list").json()["result"]["tools"]}
    assert {"lembrar", "buscar", "listar", "substituir", "revogar", "historico", "relacionadas"} <= nomes
    assert not {n for n in nomes if "apag" in n or "erase" in n or "delete" in n}


def test_mcp_lembra_busca_e_isola_tenant(client, tenants):
    a, b = tenants
    criada, erro = _chamar(
        client,
        a.escrita,
        "lembrar",
        texto="Postgres é a fonte da verdade da memória; Qdrant é projeção",
        categoria="decision",
        agente="Pilar",
        projeto="proj-mcp",
        confianca="medido",
        entidades=[{"name": "Qdrant", "type": "sistema"}],
    )
    assert erro is None, erro
    assert criada["agente"] == "Pilar" and criada["confianca"] == "medido"

    achados, _ = _chamar(client, a.leitura, "buscar", consulta="fonte da verdade da memória", projeto="proj-mcp")
    assert achados and achados[0]["memory_id"] == criada["memory_id"]

    do_outro, _ = _chamar(client, b.leitura, "buscar", consulta="fonte da verdade da memória", projeto="proj-mcp")
    assert do_outro == []
    _, erro = _chamar(client, b.leitura, "historico", memory_id=criada["memory_id"])
    assert erro and "não encontrada" in erro


def test_mcp_respeita_papel(client, tenants):
    a, _ = tenants
    _, erro = _chamar(client, a.leitura, "lembrar", texto="não deveria gravar", categoria="fact")
    assert erro and "escrita" in erro


def test_mcp_substitui_e_revoga_sem_perder_historico(client, tenants):
    a, _ = tenants
    criada, _ = _chamar(
        client, a.escrita, "lembrar", texto="Deploy às sextas é proibido", categoria="decision", projeto="proj-mcp2"
    )
    nova, erro = _chamar(
        client,
        a.escrita,
        "substituir",
        memory_id=criada["memory_id"],
        texto="Deploy às sextas só com dupla aprovação",
        motivo="retro de setembro",
    )
    assert erro is None, erro
    assert nova["versao"] == 2
    revogada, erro = _chamar(client, a.escrita, "revogar", memory_id=criada["memory_id"], motivo="política extinta")
    assert erro is None, erro
    assert revogada["valido_ate"] is not None

    versoes, _ = _chamar(client, a.leitura, "historico", memory_id=criada["memory_id"])
    textos = [v["texto"] for v in versoes]
    assert textos[:2] == ["Deploy às sextas é proibido", "Deploy às sextas só com dupla aprovação"]
    vigentes, _ = _chamar(client, a.leitura, "listar", projeto="proj-mcp2")
    assert criada["memory_id"] not in {m["memory_id"] for m in vigentes}


@pytest.mark.parametrize("valor", ["nao-e-uuid"])
def test_mcp_memory_id_invalido(client, tenants, valor):
    a, _ = tenants
    _, erro = _chamar(client, a.leitura, "historico", memory_id=valor)
    assert erro and "UUID" in erro
