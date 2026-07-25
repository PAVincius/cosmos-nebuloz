-- Task 10: LeanBudget guardrail spend fields (GuardrailsModal — spend limit
-- + approval threshold). Backfilled: applied to dev via `prisma db push`
-- on 2026-07-23 (commit c9f206f7), never got a migration file until now.

ALTER TABLE "LeanBudget" ADD COLUMN "spendLimitUsd" DOUBLE PRECISION;
ALTER TABLE "LeanBudget" ADD COLUMN "approvalThresholdUsd" DOUBLE PRECISION;
