-- CharterUseCase.riskScoredAt — quando alguém pontuou o risco do caso.
--
-- O intake grava 1 em cada eixo por default, e a tela mostrava "1 · Baixo"
-- como se fosse medição (SRD do Charter, §5.5 e §7). A coluna separa "alguém
-- avaliou" de "é o default".
--
-- Só ADD COLUMN, sem UPDATE: caso com algum eixo fora de 1 (seed, dogfood)
-- continua pontuado pela leitura em caseRisk(). IF NOT EXISTS para reexecutar
-- sem falhar onde a coluna já estiver.

ALTER TABLE "CharterUseCase" ADD COLUMN IF NOT EXISTS "riskScoredAt" TIMESTAMP(3);
