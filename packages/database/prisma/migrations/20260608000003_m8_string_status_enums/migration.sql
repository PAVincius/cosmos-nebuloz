-- M8: Convert top-5 String status/category fields to Prisma enums

-- ChargeCategory enum (BillingEntry.chargeCategory)
CREATE TYPE "ChargeCategory" AS ENUM ('Usage', 'Purchase', 'Tax', 'Credit', 'Adjustment', 'Refund');

ALTER TABLE "BillingEntry"
  ALTER COLUMN "chargeCategory" DROP DEFAULT,
  ALTER COLUMN "chargeCategory" TYPE "ChargeCategory"
    USING "chargeCategory"::"ChargeCategory",
  ALTER COLUMN "chargeCategory" SET DEFAULT 'Usage'::"ChargeCategory";

-- CostAnomalyStatus enum (CostAnomaly.status)
CREATE TYPE "CostAnomalyStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE');

ALTER TABLE "CostAnomaly"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CostAnomalyStatus"
    USING "status"::"CostAnomalyStatus",
  ALTER COLUMN "status" SET DEFAULT 'OPEN'::"CostAnomalyStatus";

-- IntegrationDraftStatus enum + add status column to IntegrationDraft
CREATE TYPE "IntegrationDraftStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

ALTER TABLE "IntegrationDraft"
  ADD COLUMN "status" "IntegrationDraftStatus" NOT NULL DEFAULT 'PENDING'::"IntegrationDraftStatus";

-- TrendDirection enum (MemberThroughputBaseline.trend + TeamCapacitySnapshot.teamTrend)
CREATE TYPE "TrendDirection" AS ENUM ('UP', 'DOWN', 'NEUTRAL');

ALTER TABLE "MemberThroughputBaseline"
  ALTER COLUMN "trend" DROP DEFAULT,
  ALTER COLUMN "trend" TYPE "TrendDirection"
    USING "trend"::"TrendDirection",
  ALTER COLUMN "trend" SET DEFAULT 'NEUTRAL'::"TrendDirection";

ALTER TABLE "TeamCapacitySnapshot"
  ALTER COLUMN "teamTrend" DROP DEFAULT,
  ALTER COLUMN "teamTrend" TYPE "TrendDirection"
    USING "teamTrend"::"TrendDirection",
  ALTER COLUMN "teamTrend" SET DEFAULT 'NEUTRAL'::"TrendDirection";
