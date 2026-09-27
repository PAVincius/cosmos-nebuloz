"""Projeção de arquivo no MinIO: um JSON por versão, em
<tenant>/<memory_id>/v<n>.json. É a camada fria (D-16) — o histórico em
objeto imutável que se reindexa. Apagar remove todas as versões da memória."""

import io
import json
from datetime import datetime
from typing import Any
from uuid import UUID

from minio import Minio
from minio.deleteobjects import DeleteObject

from . import colecao_do_tenant


def _json(valor: Any) -> Any:
    if isinstance(valor, datetime):
        return valor.isoformat()
    if isinstance(valor, UUID):
        return str(valor)
    raise TypeError(type(valor).__name__)


class MinioProjecao:
    nome = "minio"

    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str, secure: bool) -> None:
        self._cliente = Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)
        self._bucket = bucket
        self._bucket_ok = False

    def _garantir_bucket(self) -> None:
        if self._bucket_ok:
            return
        if not self._cliente.bucket_exists(self._bucket):
            self._cliente.make_bucket(self._bucket)
        self._bucket_ok = True

    def _prefixo(self, tenant_id: str, memory_id: UUID | str) -> str:
        return f"{colecao_do_tenant(tenant_id)}/{memory_id}/"

    def gravar(self, tenant_id: str, versao: dict[str, Any]) -> None:
        self._garantir_bucket()
        corpo = {k: v for k, v in versao.items() if k != "embedding"}
        dados = json.dumps(corpo, default=_json, ensure_ascii=False).encode()
        nome = f"{self._prefixo(tenant_id, versao['memory_id'])}v{versao['version']}.json"
        self._cliente.put_object(self._bucket, nome, io.BytesIO(dados), len(dados), content_type="application/json")

    def apagar(self, tenant_id: str, memory_id: UUID) -> None:
        self._garantir_bucket()
        objetos = self._cliente.list_objects(self._bucket, prefix=self._prefixo(tenant_id, memory_id), recursive=True)
        alvos = [DeleteObject(o.object_name) for o in objetos]
        if alvos:
            erros = list(self._cliente.remove_objects(self._bucket, alvos))
            if erros:
                raise RuntimeError(f"MinIO não apagou {len(erros)} objeto(s)")

    def versoes(self, tenant_id: str, memory_id: UUID) -> list[str]:
        self._garantir_bucket()
        objetos = self._cliente.list_objects(self._bucket, prefix=self._prefixo(tenant_id, memory_id), recursive=True)
        return sorted(o.object_name for o in objetos)

    def saude(self) -> bool:
        try:
            self._cliente.list_buckets()
            return True
        except Exception:
            return False
