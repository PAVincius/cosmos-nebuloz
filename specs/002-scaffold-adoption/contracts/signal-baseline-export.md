# Contract — Export do caso de negócio para o Signal

**Requisito:** S-06 · **Critério de aceite:** SC-004 · **Direção:** Scaffold → Signal (out)

O Scaffold é a fonte da verdade: emite o artefato assinado, imutável e
versionado. O Signal apura contra ele e **nunca o edita**.

O Signal ainda não existe no repositório (`research.md` §R10). Este contrato é
o que o Scaffold **emite**; nenhuma chamada ao Signal é feita.

---

## Superfície

Server action `exportBusinessCase({ businessCaseId })` → `Result<SignalBaselineV2>`,
disponível apenas para versão em estado `SIGNED`. Versão em `DRAFT`, `AWAITING`
ou `CONTESTED` retorna `NOT_SIGNED` — o Signal não pode apurar contra promessa
não assinada, e é isso que o faz mostrar a iniciativa como *"aguardando
promessa"* em vez de zero.

---

## Shape v2 — o que o Scaffold emite

```jsonc
{
  "schema": "nebuloz.signal.baseline/2",
  "business_case_id": "cuid",
  "business_case_code": "BC-104",
  "version": "v2",
  "content_hash": "a7f3c2e9",          // prova de que o artefato não mudou
  "track_id": "cuid",
  "process_name": "Triagem de autorizações prévias",
  "tenant_id": "cuid",

  "signed_by": "cuid",
  "signed_by_label": "Otto Braga",
  "signed_at": "2026-06-18T14:32:00Z",

  "window": {
    "start": "2026-07-01",
    "months": 12,
    "cadence": "monthly",              // monthly | quarterly
    "first_read": "2026-07-31"
  },

  "metrics": [
    {
      "key": "cycle",
      "label": "Cycle time da triagem",
      "unit": "min",
      "base": 46,
      "target": 34,
      "direction": "down",             // down | up
      "confidence": "measured",        // measured | estimated | declared
      "source": "Vanta Core · export semanal",
      "sample": "4 semanas · 1.360 casos"
    }
  ],

  "benefit": {
    "kind": "cost_avoided",            // cost_avoided | revenue_protected | revenue_new
    "hard": true,
    "annual_cents": 140000000,
    "currency": "BRL",
    "basis": "6 FTE × custo hora × horas liberadas",
    "finance_reviewed_at": "2026-06-17"
  }
}
```

### Regras

- **`content_hash` é a chave de idempotência.** O Signal reimportando o mesmo
  hash não cria leitura nova.
- Métricas são **N**, não três fixas, e cada uma carrega `confidence`. Achatar
  isso perderia a distinção entre número medido e número declarado — que é
  exatamente sobre o que patrocinadores contestam.
- `annual_cents` é inteiro em centavos, como todo dinheiro no monorepo. Nunca
  float.
- Nenhum artefato, anexo ou `objectKey` atravessa. O contrato é numérico.

---

## Shape v1 — compat com o SRD §6

O SRD §6 especificou um shape achatado com três métricas fixas. Ele é mantido
como **derivação**, não como schema interno, e só é emitido quando o caso de
negócio tem métricas com as `key` canônicas:

```jsonc
{
  "track_id": "uuid",
  "process_name": "string",
  "captured_at": "iso8601",
  "signed_by": "uuid",
  "metrics": {
    "volume_per_period": 340,
    "period": "week",                  // day | week | month
    "cycle_time_minutes": 46,
    "error_rate": 0.082,               // 0–1, não percentual
    "headcount_touching": 6
  },
  "notes": "string"
}
```

Mapeamento: `volume` → `volume_per_period`, `cycle` → `cycle_time_minutes`,
`error` → `error_rate` (dividido por 100 — o v2 guarda percentual, o v1 pede
fração). Métrica ausente vira `null`; o v1 **não** falha por isso.

Emitido por `exportBusinessCase({ businessCaseId, shape: "v1" })`.

---

## Teste de aceite (SC-004)

Uma fixture do `BC-104` (o caso assinado do protótipo, `scaffold-baseline.jsx`)
valida contra o schema Zod de ambos os shapes e importa **sem transformação**.
O teste vive em `apps/app/__tests__/scaffold/signal-export.test.ts` e é o que
prova que a fronteira não precisa de adaptador do outro lado.
