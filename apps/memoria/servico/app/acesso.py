"""Chave de API → tenant, rótulo e papel. Usado pela API HTTP e pelo MCP."""

import hashlib

from . import db
from .servico import Contexto

PAPEIS = {"leitura": 0, "escrita": 1, "admin": 2}


def autenticar_chave(chave: str | None) -> Contexto | None:
    if not chave:
        return None
    digest = hashlib.sha256(chave.encode()).hexdigest()
    with db.sem_tenant() as conn:
        linha = conn.execute("SELECT * FROM stec.autenticar(%s)", (digest,)).fetchone()
    if linha is None:
        return None
    return Contexto(tenant_id=linha["tenant_id"], actor=linha["rotulo"], papel=linha["papel"])


def pode(ctx: Contexto, papel: str) -> bool:
    return PAPEIS[ctx.papel] >= PAPEIS[papel]
