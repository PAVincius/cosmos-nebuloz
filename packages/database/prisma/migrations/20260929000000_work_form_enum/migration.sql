-- X-02 — WorkForm: as 5 formas de trabalho do handoff (correcoes.pdf, seção 01),
-- compartilhadas por Scaffold, Signal e Charter.
--
-- Não cria tipo novo: renomeia ScaffoldArchetype (TRIAGE, DOC_REVIEW,
-- REPORTING), o que preserva o dado das colunas ScaffoldTemplate.archetype e
-- ScaffoldTrack.archetype sem reescrever linha, e soma CONVERSATIONAL e
-- ANALYSIS. As colunas acompanham o tipo renomeado sozinhas.
ALTER TYPE "ScaffoldArchetype" RENAME TO "WorkForm";
ALTER TYPE "WorkForm" ADD VALUE IF NOT EXISTS 'CONVERSATIONAL';
ALTER TYPE "WorkForm" ADD VALUE IF NOT EXISTS 'ANALYSIS';
