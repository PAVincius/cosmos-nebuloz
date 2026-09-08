-- Janela de capacidade em StaffPerson.
--
-- Três colunas nullable, sem backfill: quem já está cadastrado é capacidade
-- permanente sem data de entrada registrada, que é exatamente o que NULL diz.
-- Preencher com `criadoEm` inventaria uma data de entrada no plano que ninguém
-- decidiu.
--
-- Ter `saiEm` é o que distingue capacidade temporária (terceiro) da permanente;
-- não há coluna booleana separada.

ALTER TABLE "StaffPerson"
  ADD COLUMN "entraEm" TIMESTAMP(3),
  ADD COLUMN "saiEm" TIMESTAMP(3),
  ADD COLUMN "observacao" TEXT;
