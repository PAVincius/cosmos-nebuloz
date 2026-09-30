-- Reverte 20260930120000_scaffold_trilha_framework.
-- Falha, de propósito, se houver ScaffoldTemplate com archetype nulo (SET NOT
-- NULL): resolva esses templates antes; o down não escolhe uma forma por você.
-- Perde as requirementRefs já gravadas.
ALTER TABLE "ScaffoldDeliverableTemplate" DROP CONSTRAINT "ScaffoldDeliverableTemplate_requirementRefs_lista";
ALTER TABLE "ScaffoldDeliverableTemplate" DROP COLUMN "requirementRefs";
ALTER TABLE "ScaffoldTemplate" ALTER COLUMN "archetype" SET NOT NULL;
