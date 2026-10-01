-- Reverte 20260930130000_meridian_override_kind. Perde a distinção: as
-- confirmações viram linhas comuns de override (fromScore = toScore).
ALTER TABLE "MeridianOverride" DROP COLUMN "kind";
DROP TYPE "MeridianOverrideKind";
