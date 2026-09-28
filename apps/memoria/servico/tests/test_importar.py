"""Importador: semeia, sincroniza sem duplicar, versiona o que mudou e revoga o que foi riscado."""

from app import importar
from app.main import app
from app.servico import Contexto

LICAO = "2026-09-01 — conferir o deploy antes de dizer que subiu — PR #250"


def _repo(raiz, licoes: str, decisao: str) -> None:
    (raiz / ".maestri" / "memoria").mkdir(parents=True)
    (raiz / ".maestri" / "memoria" / "engenharia.md").write_text(f"# Memória\n\n## Lições\n{licoes}\n")
    (raiz / "docs" / "adr").mkdir(parents=True)
    (raiz / "docs" / "adr" / "0001-teste.md").write_text(
        "# ADR-0001 — Teste\n\n**Status**: Accepted\n**Data**: 2026-08-01\n\n"
        f"## Contexto\n\nx\n\n## Decisão\n\n{decisao}\n"
    )
    (raiz / "docs" / "produto").mkdir(parents=True)
    (raiz / "docs" / "produto" / "registro-de-decisoes.md").write_text(
        "# Registro\n\n## 1. Seção\n\n### D-01 — Primeira\n\n**Estado:** Decidida em 2026-09-27. **Dono:** Norte.\n\n"
        "Corpo da D-01.\n\n### D-02 — Segunda\n\nCorpo da D-02.\n"
    )


def test_importador_sincroniza(client, tenants, tmp_path):
    a, _ = tenants
    motor = app.state.motor
    ctx = Contexto(tenant_id=a.id, actor="importador", papel="admin")

    _repo(tmp_path, LICAO, "Usar Postgres.")
    assert importar.sincronizar(motor, ctx, importar.todas(tmp_path)) == {
        "novas": 4,
        "atualizadas": 0,
        "revogadas": 0,
        "iguais": 0,
    }
    assert importar.sincronizar(motor, ctx, importar.todas(tmp_path))["iguais"] == 4

    (tmp_path / "docs" / "adr" / "0001-teste.md").write_text(
        "# ADR-0001 — Teste\n\n**Status**: Superseded\n\n## Decisão\n\nUsar Postgres com pgvector.\n"
    )
    (tmp_path / ".maestri" / "memoria" / "engenharia.md").write_text(
        f"## Lições\n~~{LICAO}~~ — errada: o deploy se confere no Vercel, não no PR\n"
    )
    contagem = importar.sincronizar(motor, ctx, importar.todas(tmp_path))
    assert contagem["atualizadas"] == 1 and contagem["revogadas"] == 1

    decisoes = client.get("/api/v1/memories", params={"category": "decision"}, headers=a.leitura).json()
    adr = next(m for m in decisoes if m["provenance"]["source"] == "adr")
    assert adr["version"] == 2 and "pgvector" in adr["content"]["text"]
    d01 = next(m for m in decisoes if m["provenance"]["source_id"].endswith("#D-01"))
    assert d01["agent_id"] == "Norte"

    licoes = client.get("/api/v1/memories", params={"category": "lesson"}, headers=a.leitura).json()
    assert not [m for m in licoes if m["provenance"]["source"] == "maestri-memoria"]
