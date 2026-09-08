# Contrato · Export do plano (legível por máquina)

FR-025. Consumido pelo Scaffold e por qualquer produto que precise sequenciar trabalho a partir de um diagnóstico. Estável: campo removido é quebra de contrato.

```json
{
  "assessment": "AS-104",
  "template_version": "v3.2",
  "generated_at": "2026-08-28T12:00:00.000Z",
  "axes": [
    {
      "axis": "governance",
      "score": 66,
      "status": "overridden",
      "confidence": 0.91
    }
  ],
  "gaps": [
    {
      "id": "G-01",
      "axis": "data",
      "severity": "high",
      "effort": "L",
      "cost_of_delay": 88,
      "finding_confidence": "measured",
      "depends_on": [],
      "target_quarter": "Q1",
      "state": "promoted",
      "promoted_to": { "product": "cosmos", "entity_id": "EP-2140" }
    }
  ],
  "plan": {
    "capacity_assumption": "1 squad interna + retainer",
    "items": 8
  }
}
```

## Regras

- `axis` e `severity` em minúsculas; `effort` em maiúsculas (`S`/`M`/`L`), igual ao domínio.
- `score` é o final: `override` quando existe, `computed` caso contrário. `status` diz qual dos dois.
- `confidence` com duas casas decimais.
- `depends_on` lista códigos de gap, não ids internos — o consumidor não conhece cuid.
- `target_quarter` é `"Q1".."Q4"`; item sem plano gerado não aparece no export.
- `promoted_to` é omitido quando o gap não foi promovido ou a promoção foi revogada.
- Nenhum campo identifica pessoa. Autor de override e de promoção ficam na trilha de auditoria, não no export.
