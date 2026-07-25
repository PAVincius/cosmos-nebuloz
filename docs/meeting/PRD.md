# PRD — Meeting Intelligence (Phase 0)

> Epic: `epic-009-meeting-intelligence`. Blocker do primeiro trial pago.
> SRD: `docs/srd-epic-009.md`. Stories: `docs/stories/epic-009/`.
>
> **Criado:** 2026-06-09 · **Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** ART

---

## 1. Problema

Decisões, riscos e ações de cerimônias SAFe (PI Planning, ROAM, retrospectivas, Scrum of Scrums) ficam presas em transcrições de Meet/Teams. O RTE re-digita manualmente em ferramentas separadas — coordination tax que transforma Agile em waterfall.

Cosmos já é a camada onde as cerimônias acontecem, mas o **output falado** não entra automaticamente. Esse é o último elo faltando para o trial enterprise.

## 2. Persona & JTBD

**Persona:** RTE (Release Train Engineer) — P-01.

**Job-To-Be-Done:**
> "Quando termino uma cerimônia, quero que decisões, riscos e ações virem itens rastreáveis no Cosmos sem digitar, para manter o ART alinhado sem trabalho manual."

## 3. Solução (estratégia)

Integrar ferramentas de transcrição existentes via **webhook/API** — **não construir bot**.

Ordem de adoção:
1. **Fireflies** (1º) — melhor API: webhook (`Transcription completed`) + GraphQL (`summary { overview action_items keywords }`). HMAC-SHA256 via `x-hub-signature`.
2. **Fathom** (2º) — adapter na mesma interface.
3. **Otter** (3º) — API limitada; confirmar disponibilidade antes.

## 4. Use Case Principal

```
RTE conecta Fireflies (Settings → Integrations)
   → grava PI Planning no Meet (Fireflies transcreve)
   → Fireflies dispara webhook "Transcription completed"
   → Cosmos busca transcript+summary via GraphQL
   → AI mapeia: action_items → Tasks; decisões → DecisionLog; riscos → Risks (ROAM)
   → RTE revisa draft de insights → aprova
   → entidades criadas, vinculadas ao PI ativo
```

## 5. Escopo (FRs — ver SRD)

| FR | Título | Priority |
|----|--------|----------|
| FR-901 | Conectar provider de meeting (Fireflies) | Must |
| FR-902 | Receber webhook de transcrição | Must |
| FR-903 | Buscar transcript + summary via GraphQL | Must |
| FR-904 | Mapear insights → entidades SAFe (AI) | Must |
| FR-905 | Revisão humana antes de persistir | Should |
| FR-906 | Timeline de cerimônias | Should |

## 6. Fora de Escopo

- Bot próprio de gravação/transcrição.
- Transcrição em tempo real (só pós-processamento).
- Otter (fase posterior).

## 7. Métrica de Sucesso

RTE conclui 1 cerimônia → insights aparecem no Cosmos automaticamente, vinculados ao PI ativo, com taxa de ruído aceitável (revisão humana aprova ≥70% sem edição). **TOTVS inicia trial.**

## 8. Riscos

- **Ruído de AI mapping** → FR-905 (human review) mitiga.
- **Otter API** → adiada; Fireflies+Fathom cobrem o trial.
- **Vínculo ao PI errado** → usar `clientReferenceId` + janela de timestamp da cerimônia.
