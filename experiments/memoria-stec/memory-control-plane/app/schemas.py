"""Formato da memória na API.

Mantém o desenho do artefato STEC (tenant, agente, conteúdo, temporal,
proveniência, governança) com três mudanças, todas do registro de decisões:

- `category` (decisão, compromisso, lição, fato, preferência) ao lado de
  `type` (episódica, semântica, procedural): D-13.
- `provenance.confidence` usa a escala da suíte — medido, estimado, declarado —
  e não uma nota decimal. O mapa de fronteiras proíbe segunda escala (entidade 5).
- O tenant vem da chave de API, nunca do corpo. `tenant_id` no corpo é aceito
  só para conferência: se divergir da chave, a requisição é recusada.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field, model_validator


class Kind(StrEnum):
    episodic = "episodic"
    semantic = "semantic"
    procedural = "procedural"


class Category(StrEnum):
    decision = "decision"
    commitment = "commitment"
    lesson = "lesson"
    fact = "fact"
    preference = "preference"


class Confidence(StrEnum):
    medido = "medido"
    estimado = "estimado"
    declarado = "declarado"


class Classification(StrEnum):
    public = "public"
    internal = "internal"
    confidential = "confidential"
    restricted = "restricted"


class Entity(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type: str = Field(min_length=1, max_length=80)


class Relation(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    predicate: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z_][A-Za-z0-9_]*$")
    object: str = Field(min_length=1, max_length=200)


class MemoryContent(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    entities: list[Entity] = []
    relations: list[Relation] = []


class Temporal(BaseModel):
    valid_from: AwareDatetime
    valid_to: AwareDatetime | None = None

    @model_validator(mode="after")
    def _intervalo(self) -> "Temporal":
        if self.valid_to is not None and self.valid_to <= self.valid_from:
            raise ValueError("valid_to precisa ser depois de valid_from")
        return self


class Provenance(BaseModel):
    source: str = Field(min_length=1, max_length=80)
    source_id: str = Field(min_length=1, max_length=300)
    extracted_by: str = Field(min_length=1, max_length=200)
    confidence: Confidence


class Governance(BaseModel):
    classification: Classification = Classification.internal
    retention_days: int = Field(default=3650, gt=0, le=36_500)
    pii: bool = False


class MemoryMetadata(BaseModel):
    domain: str | None = Field(default=None, max_length=80)
    tags: list[str] = Field(default=[], max_length=30)
    importance_score: float = Field(default=0.5, ge=0.0, le=1.0)


class MemoryIngest(BaseModel):
    tenant_id: str | None = None
    agent_id: str = Field(min_length=1, max_length=200)
    project_id: str | None = Field(default=None, max_length=200)
    type: Kind
    category: Category
    content: MemoryContent
    temporal: Temporal
    provenance: Provenance
    governance: Governance = Governance()
    metadata: MemoryMetadata = MemoryMetadata()


class MemorySupersede(BaseModel):
    """Versão nova de uma memória. O que não vier, herda da versão vigente."""

    reason: str = Field(min_length=1, max_length=500)
    content: MemoryContent | None = None
    temporal: Temporal | None = None
    provenance: Provenance | None = None
    category: Category | None = None


class MemoryInvalidate(BaseModel):
    """O fato deixou de valer (decisão revogada, preferência que mudou)."""

    valid_to: AwareDatetime
    reason: str = Field(min_length=1, max_length=500)


class MemoryVersion(BaseModel):
    memory_id: UUID
    version_id: UUID
    version: int
    tenant_id: str
    agent_id: str
    project_id: str | None
    type: Kind
    category: Category
    content: MemoryContent
    valid_from: datetime
    valid_to: datetime | None
    tx_from: datetime
    tx_to: datetime | None
    provenance: Provenance
    governance: Governance
    metadata: MemoryMetadata
    change_reason: str | None
    supersedes: UUID | None
    erased: bool


class MemorySearch(BaseModel):
    tenant_id: str | None = None
    query: str = Field(min_length=1, max_length=2_000)
    project_id: str | None = None
    type: Kind | None = None
    category: Category | None = None
    # O que valia neste instante (tempo de validade). Padrão: agora.
    valid_at: AwareDatetime | None = None
    # O que o sistema sabia neste instante (tempo de transação). Padrão: agora.
    known_at: AwareDatetime | None = None
    top_k: int = Field(default=10, ge=1, le=50)


class SearchHit(BaseModel):
    score: float
    memory: MemoryVersion


class ErasureRequest(BaseModel):
    """Apaga toda memória derivada de uma origem.

    É o caminho para revogação de consentimento de reunião e para o pedido de
    titular da LGPD: a origem some, e o que foi derivado dela some junto.
    """

    source: str = Field(min_length=1, max_length=80)
    source_id: str = Field(min_length=1, max_length=300)
    reason: str = Field(min_length=1, max_length=500)


class AuditEntry(BaseModel):
    at: datetime
    actor: str
    action: str
    memory_id: UUID | None
    detail: dict[str, Any]
