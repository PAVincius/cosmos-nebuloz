"""Administração: migrar, criar tenant, emitir e revogar chave, purgar tenant.

    python -m app.cli migrar
    python -m app.cli criar-tenant nebuloz "Nebuloz"
    python -m app.cli criar-chave nebuloz "agente-pesquisa" escrita
    python -m app.cli revogar-chave <hash-prefixo>
    python -m app.cli purgar-tenant nebuloz --confirmo

A chave aparece uma vez, na criação. O banco guarda só o hash.
"""

import argparse
import hashlib
import secrets
import sys

from . import db
from .config import get_settings
from .projecoes import criar_projecoes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="app.cli")
    sub = parser.add_subparsers(dest="comando", required=True)
    sub.add_parser("migrar")
    tenant = sub.add_parser("criar-tenant")
    tenant.add_argument("id")
    tenant.add_argument("nome")
    chave = sub.add_parser("criar-chave")
    chave.add_argument("tenant")
    chave.add_argument("rotulo")
    chave.add_argument("papel", choices=["leitura", "escrita", "admin"])
    revogar = sub.add_parser("revogar-chave")
    revogar.add_argument("prefixo", help="primeiros caracteres do hash da chave")
    purga = sub.add_parser("purgar-tenant")
    purga.add_argument("tenant")
    purga.add_argument("--confirmo", action="store_true")
    args = parser.parse_args(argv)

    settings = get_settings()
    if args.comando == "migrar":
        db.migrar(settings)
        print("esquema aplicado")
        return 0

    with db.conexao_admin(settings) as conn:
        if args.comando == "criar-tenant":
            conn.execute(
                "INSERT INTO stec.tenant (id, nome) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING",
                (args.id, args.nome),
            )
            print(f"tenant {args.id} pronto")
        elif args.comando == "criar-chave":
            valor = "stec_" + secrets.token_urlsafe(32)
            digest = hashlib.sha256(valor.encode()).hexdigest()
            conn.execute(
                "INSERT INTO stec.chave_api (tenant_id, hash, rotulo, papel) VALUES (%s, %s, %s, %s)",
                (args.tenant, digest, args.rotulo, args.papel),
            )
            print(valor)
            print(f"hash: {digest[:12]}… (guarde a chave agora; ela não aparece de novo)", file=sys.stderr)
        elif args.comando == "revogar-chave":
            n = conn.execute(
                "UPDATE stec.chave_api SET revogada_em = now() WHERE hash LIKE %s AND revogada_em IS NULL",
                (args.prefixo + "%",),
            ).rowcount
            print(f"{n} chave(s) revogada(s)")
        elif args.comando == "purgar-tenant":
            if not args.confirmo:
                print("purga apaga toda a memória do tenant; repita com --confirmo", file=sys.stderr)
                return 2
            ids = [
                r["memory_id"]
                for r in conn.execute(
                    "SELECT DISTINCT memory_id FROM stec.memoria WHERE tenant_id = %s", (args.tenant,)
                ).fetchall()
            ]
            n = conn.execute("SELECT stec.purgar_tenant(%s) AS n", (args.tenant,)).fetchone()["n"]
            falhas = 0
            for projecao in criar_projecoes(settings):
                for memory_id in ids:
                    try:
                        projecao.apagar(args.tenant, memory_id)
                    except Exception as erro:
                        falhas += 1
                        print(f"{projecao.nome}: {memory_id}: {erro}", file=sys.stderr)
            print(f"{n} versão(ões) purgada(s) no Postgres; {len(ids)} memória(s) removida(s) das projeções")
            if falhas:
                print(
                    f"{falhas} remoção(ões) de projeção falharam; os ids estão acima, para remover à mão",
                    file=sys.stderr,
                )
                return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
