"""Tempo de validade e de transação, busca, apagamento e retenção."""

import time
from datetime import UTC, datetime

from .conftest import memoria


def _agora() -> str:
    return datetime.now(UTC).isoformat()


def test_substituicao_preserva_o_que_se_sabia_antes(client, tenants):
    a, _ = tenants
    v1 = client.post("/api/v1/memories/ingest", json=memoria("Fornecedor de LLM: OpenAI"), headers=a.escrita).json()
    time.sleep(0.05)
    antes_da_troca = _agora()
    time.sleep(0.05)
    v2 = client.post(
        f"/api/v1/memories/{v1['memory_id']}/supersede",
        json={"reason": "comitê trocou o fornecedor", "content": {"text": "Fornecedor de LLM: Anthropic"}},
        headers=a.escrita,
    )
    assert v2.status_code == 200, v2.text
    v2 = v2.json()
    assert v2["version"] == 2
    assert v2["supersedes"] == v1["version_id"]

    agora = client.get("/api/v1/memories", params={"project_id": "proj-teste"}, headers=a.leitura).json()
    textos_agora = {m["content"]["text"] for m in agora if m["memory_id"] == v1["memory_id"]}
    assert textos_agora == {"Fornecedor de LLM: Anthropic"}

    naquele_dia = client.get(
        "/api/v1/memories", params={"project_id": "proj-teste", "known_at": antes_da_troca}, headers=a.leitura
    ).json()
    textos_antes = {m["content"]["text"] for m in naquele_dia if m["memory_id"] == v1["memory_id"]}
    assert textos_antes == {"Fornecedor de LLM: OpenAI"}

    historico = client.get(f"/api/v1/memories/{v1['memory_id']}/history", headers=a.leitura).json()
    assert [h["version"] for h in historico] == [1, 2]
    assert historico[0]["tx_to"] is not None and historico[1]["tx_to"] is None
    assert historico[1]["change_reason"] == "comitê trocou o fornecedor"


def test_invalidacao_mantem_a_decisao_revogada_consultavel(client, tenants):
    a, _ = tenants
    criada = client.post(
        "/api/v1/memories/ingest",
        json=memoria("Home office às sextas", valid_from="2025-01-01T00:00:00Z", project_id="proj-inval"),
        headers=a.escrita,
    ).json()
    resposta = client.post(
        f"/api/v1/memories/{criada['memory_id']}/invalidate",
        json={"valid_to": "2025-07-01T00:00:00Z", "reason": "política revogada"},
        headers=a.escrita,
    )
    assert resposta.status_code == 200, resposta.text

    hoje = client.get("/api/v1/memories", params={"project_id": "proj-inval"}, headers=a.leitura).json()
    assert criada["memory_id"] not in {m["memory_id"] for m in hoje}
    em_marco = client.get(
        "/api/v1/memories", params={"project_id": "proj-inval", "valid_at": "2025-03-01T00:00:00Z"}, headers=a.leitura
    ).json()
    assert criada["memory_id"] in {m["memory_id"] for m in em_marco}


def test_busca_hibrida_traz_o_relevante_primeiro(client, tenants):
    a, _ = tenants
    for texto in (
        "Reunião de planejamento do PI 12 definiu três objetivos",
        "O cliente prefere comunicação assíncrona por escrito",
        "Política de retenção de logs em 90 dias",
    ):
        client.post("/api/v1/memories/ingest", json=memoria(texto, project_id="proj-busca"), headers=a.escrita)
    hits = client.post(
        "/api/v1/memories/search",
        json={"query": "comunicação assíncrona do cliente", "project_id": "proj-busca", "top_k": 3},
        headers=a.leitura,
    ).json()
    assert hits and hits[0]["memory"]["content"]["text"] == "O cliente prefere comunicação assíncrona por escrito"


def test_apagamento_por_origem_tira_a_memoria_de_todo_lugar(client, tenants):
    a, _ = tenants
    origem = {"source": "meeting_transcript", "source_id": "reuniao-777"}
    ids = [
        client.post(
            "/api/v1/memories/ingest", json=memoria(texto, project_id="proj-lgpd", **origem), headers=a.escrita
        ).json()["memory_id"]
        for texto in ("Maria pediu revisão do contrato", "Maria prefere reuniões curtas")
    ]
    outra = client.post(
        "/api/v1/memories/ingest",
        json=memoria("Decisão sem relação com a reunião", project_id="proj-lgpd"),
        headers=a.escrita,
    ).json()["memory_id"]

    assert (
        client.post("/api/v1/governance/erasure", json={**origem, "reason": "x"}, headers=a.escrita).status_code == 403
    )
    resposta = client.post(
        "/api/v1/governance/erasure", json={**origem, "reason": "consentimento revogado"}, headers=a.admin
    ).json()
    assert resposta["memories_erased"] == 2

    vivas = {
        m["memory_id"]
        for m in client.get("/api/v1/memories", params={"project_id": "proj-lgpd"}, headers=a.leitura).json()
    }
    assert vivas == {outra}
    hits = client.post("/api/v1/memories/search", json={"query": "Maria"}, headers=a.leitura).json()
    assert not set(ids) & {h["memory"]["memory_id"] for h in hits}
    historico = client.get(f"/api/v1/memories/{ids[0]}/history", headers=a.leitura).json()
    assert historico[0]["erased"] and historico[0]["content"]["text"] == "[apagado]"

    auditoria = client.get("/api/v1/governance/audit", headers=a.admin).json()
    assert all("Maria" not in str(e["detail"]) and "reuniao-777" not in str(e["detail"]) for e in auditoria)


def test_retencao_vencida_apaga(client, tenants):
    a, _ = tenants
    velha = client.post(
        "/api/v1/memories/ingest",
        json=memoria(
            "Log de sessão antigo",
            project_id="proj-ret",
            valid_from="2020-01-01T00:00:00Z",
            governance={"classification": "internal", "retention_days": 30},
        ),
        headers=a.escrita,
    ).json()
    nova = client.post(
        "/api/v1/memories/ingest",
        json=memoria("Decisão recente", project_id="proj-ret", valid_from=_agora()),
        headers=a.escrita,
    ).json()
    expiradas = client.post("/api/v1/maintenance/expire", headers=a.admin).json()["memory_ids"]
    assert velha["memory_id"] in expiradas and nova["memory_id"] not in expiradas


def test_memoria_apagada_nao_recebe_versao(client, tenants):
    a, _ = tenants
    criada = client.post("/api/v1/memories/ingest", json=memoria("temporária"), headers=a.escrita).json()
    client.request("DELETE", f"/api/v1/memories/{criada['memory_id']}", json={"reason": "teste"}, headers=a.admin)
    resposta = client.post(
        f"/api/v1/memories/{criada['memory_id']}/supersede", json={"reason": "volta"}, headers=a.escrita
    )
    assert resposta.status_code == 409
