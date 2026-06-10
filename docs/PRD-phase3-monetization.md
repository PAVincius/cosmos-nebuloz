# PRD — Phase 3: MRR Engine

> Esqueleto. Detalhe just-in-time quando a fase iniciar (após contas enterprise validadas).
> Roadmap: `docs/superpowers/plans/2026-06-09-INDEX-mrr-roadmap.md`.
>
> **Status:** skeleton · **Janela:** ~6-12 meses

---

## 1. Objetivo

Motor de receita escalável: transformar contas validadas em MRR previsível via pricing por tier, self-serve e marketplace de integrações.

## 2. Métrica de Sucesso

- 5-10 contas enterprise BR.
- MRR alvo por tier definido e crescendo.

## 3. Escopo

| Tema | Notas |
|------|-------|
| Pricing tiers | Starter (1 ART) / Growth (3+ ARTs) / Enterprise (on-prem + SLA) |
| Self-serve onboarding | reduzir CAC; trial → pago sem touch comercial |
| Billing / subscription | provider (Stripe?), faturamento, dunning, BR-specific (boleto/Pix?) |
| API marketplace | integrações custom de terceiros sobre a interface MeetingProvider/connectors |

## 4. Capítulos a detalhar (na ativação)

- **Pricing & packaging**: limites por tier (ARTs, usuários, storage, AI tokens), upgrade/downgrade.
- **Billing engine**: subscription lifecycle, webhooks de pagamento, reconciliação com LeanBudget/FinOps existente.
- **Self-serve**: signup → tenant provisioning → onboarding guiado (reusar onboarding atual).
- **Marketplace**: SDK/spec de connector, revisão, billing de terceiros.

## 5. Gates

- security-reviewer (billing, PII, PCI-adjacent).
- e2e-runner (fluxo self-serve crítico: signup → pagamento → ativação).
- database-reviewer (subscription/billing schema).

## 6. Riscos (preliminar)

- Billing BR (impostos, boleto/Pix, NF).
- Self-serve vs enterprise sales motion — não canibalizar deals high-touch.
- Abuso de tier free/trial.

> FRs detalhados via `/speckit-specify` na ativação da fase.
