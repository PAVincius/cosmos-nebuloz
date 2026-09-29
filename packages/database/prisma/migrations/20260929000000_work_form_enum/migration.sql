-- X-02 — WorkForm: as 5 formas de trabalho do handoff (correcoes.pdf, seção 01),
-- compartilhadas por Scaffold, Signal e Charter. Só cria o tipo; quem usa
-- referencia em migration própria.
CREATE TYPE "WorkForm" AS ENUM ('CONVERSATIONAL_ASSISTANT', 'ANALYSIS_PRIORITIZATION', 'DOCUMENT_REVIEW', 'DEMAND_TRIAGE', 'RECURRING_REPORTS');
