-- Papéis só de leitura do Scaffold (seção d das decisões do Norte, 29/09).
-- Aditivo: nenhum membro existente muda de papel.
ALTER TYPE "ScaffoldRole" ADD VALUE IF NOT EXISTS 'SPONSOR';
ALTER TYPE "ScaffoldRole" ADD VALUE IF NOT EXISTS 'TEAM_LEAD';
