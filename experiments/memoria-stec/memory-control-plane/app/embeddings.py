"""Embeddings. O vetor é cache (D-12): o texto no Postgres é o que dura, e o
reindex refaz o vetor quando o modelo muda."""

import hashlib
import math
import re
import unicodedata

import httpx

from .config import Settings

_TOKEN = re.compile(r"\w+", re.UNICODE)


def _normalizar(texto: str) -> list[str]:
    sem_acento = unicodedata.normalize("NFKD", texto.lower())
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return _TOKEN.findall(sem_acento)


class HashEmbedder:
    """Hashing de termos e bigramas. Determinístico e local, sem semântica:
    aproxima textos que compartilham palavras. Serve para teste e para subir o
    laboratório sem baixar modelo."""

    def __init__(self, dim: int) -> None:
        self.dim = dim
        self.model = f"hash-{dim}"

    def embed(self, texto: str) -> list[float]:
        vetor = [0.0] * self.dim
        tokens = _normalizar(texto)
        termos = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:], strict=False)]
        for termo in termos:
            digest = hashlib.blake2b(termo.encode(), digest_size=8).digest()
            indice = int.from_bytes(digest[:4], "big") % self.dim
            sinal = 1.0 if digest[4] & 1 else -1.0
            vetor[indice] += sinal
        norma = math.sqrt(sum(v * v for v in vetor)) or 1.0
        return [v / norma for v in vetor]


class OllamaEmbedder:
    def __init__(self, url: str, model: str) -> None:
        self.url = url.rstrip("/")
        self.model = f"ollama-{model}"
        self._modelo = model
        self._cliente = httpx.Client(timeout=30.0)

    def embed(self, texto: str) -> list[float]:
        resposta = self._cliente.post(f"{self.url}/api/embeddings", json={"model": self._modelo, "prompt": texto})
        resposta.raise_for_status()
        return resposta.json()["embedding"]


def criar_embedder(settings: Settings) -> HashEmbedder | OllamaEmbedder:
    if settings.embedding_provider == "ollama":
        return OllamaEmbedder(settings.ollama_url, settings.ollama_embedding_model)
    return HashEmbedder(settings.embedding_dim)
