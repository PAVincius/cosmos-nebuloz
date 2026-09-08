-- CreateEnum
CREATE TYPE "EstadoDpa" AS ENUM ('EMBUTIDO', 'A_ASSINAR', 'ASSINADO', 'SEM_DOCUMENTO');

-- CreateEnum
CREATE TYPE "BaseLegal" AS ENUM ('SEM_DECISAO', 'CONSENTIMENTO', 'LEGITIMO_INTERESSE');

-- CreateEnum
CREATE TYPE "StatusParecer" AS ENUM ('PENDENTE', 'ENVIADO', 'RECEBIDO');

-- CreateTable
CREATE TABLE "FornecedorDpa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "estado" "EstadoDpa" NOT NULL,
    "classificacaoProvisoria" BOOLEAN NOT NULL DEFAULT false,
    "regiao" TEXT,
    "retencao" TEXT,
    "transferencia" TEXT,
    "dpaUrl" TEXT,
    "subprocessadoresUrl" TEXT,
    "evidenciaUrl" TEXT,
    "verificadoEm" TIMESTAMP(3) NOT NULL,
    "acaoPendente" TEXT,
    "donoPapel" TEXT,
    "bloqueiaVenda" BOOLEAN NOT NULL DEFAULT false,
    "pedidoEm" TIMESTAMP(3),
    "assinadoEm" TIMESTAMP(3),
    "exportadoAoCharterEm" TIMESTAMP(3),
    "notas" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FornecedorDpa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoDeConsentimento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ferramenta" TEXT,
    "prazoRetencao" TEXT,
    "contatoTitular" TEXT,
    "baseLegal" "BaseLegal" NOT NULL DEFAULT 'SEM_DECISAO',
    "standingHabilitavel" BOOLEAN,
    "parecer" "StatusParecer" NOT NULL DEFAULT 'PENDENTE',
    "parecerEnviadoEm" TIMESTAMP(3),
    "parecerRecebidoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisaoDeConsentimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerguntaAoParecer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "pergunta" TEXT NOT NULL,
    "donoPapel" TEXT NOT NULL,
    "resposta" TEXT,
    "respondidaEm" TIMESTAMP(3),

    CONSTRAINT "PerguntaAoParecer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LancamentoMensal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "nota" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LancamentoMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CacPeriodo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "entregaDiagnosticoCentavos" INTEGER,
    "clientesGanhos" INTEGER,
    "convLeadDiscoveryPercent" INTEGER,
    "convDiscoveryEvaluationPercent" INTEGER,
    "convEvaluationPropostaPercent" INTEGER,
    "convPropostaAceitaPercent" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CacPeriodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CacAlocacaoProduto" (
    "id" TEXT NOT NULL,
    "cacPeriodoId" TEXT NOT NULL,
    "produto" "ProductModule" NOT NULL,
    "pesoPercent" INTEGER NOT NULL,

    CONSTRAINT "CacAlocacaoProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemanaDeCaixa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "semanaInicio" DATE NOT NULL,
    "saldoInicialCentavos" INTEGER,
    "recebiveisCentavos" INTEGER,
    "contratosAssinadosCentavos" INTEGER,
    "pipelinePonderadoCentavos" INTEGER,
    "saidasPessoalCentavos" INTEGER,
    "saidasFornecedoresCentavos" INTEGER,
    "saidasComercialCentavos" INTEGER,
    "saidasImpostosCentavos" INTEGER,
    "saidasOutrasCentavos" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemanaDeCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FornecedorDpa_tenantId_estado_idx" ON "FornecedorDpa"("tenantId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "FornecedorDpa_tenantId_codigo_key" ON "FornecedorDpa"("tenantId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoDeConsentimento_tenantId_key" ON "DecisaoDeConsentimento"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PerguntaAoParecer_tenantId_numero_key" ON "PerguntaAoParecer"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "LancamentoMensal_tenantId_competencia_idx" ON "LancamentoMensal"("tenantId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "LancamentoMensal_tenantId_competencia_conta_key" ON "LancamentoMensal"("tenantId", "competencia", "conta");

-- CreateIndex
CREATE UNIQUE INDEX "CacPeriodo_tenantId_competencia_key" ON "CacPeriodo"("tenantId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "CacAlocacaoProduto_cacPeriodoId_produto_key" ON "CacAlocacaoProduto"("cacPeriodoId", "produto");

-- CreateIndex
CREATE UNIQUE INDEX "SemanaDeCaixa_tenantId_semanaInicio_key" ON "SemanaDeCaixa"("tenantId", "semanaInicio");

-- AddForeignKey
ALTER TABLE "FornecedorDpa" ADD CONSTRAINT "FornecedorDpa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoDeConsentimento" ADD CONSTRAINT "DecisaoDeConsentimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerguntaAoParecer" ADD CONSTRAINT "PerguntaAoParecer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LancamentoMensal" ADD CONSTRAINT "LancamentoMensal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CacPeriodo" ADD CONSTRAINT "CacPeriodo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CacAlocacaoProduto" ADD CONSTRAINT "CacAlocacaoProduto_cacPeriodoId_fkey" FOREIGN KEY ("cacPeriodoId") REFERENCES "CacPeriodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemanaDeCaixa" ADD CONSTRAINT "SemanaDeCaixa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS nas sete tabelas de Empresa, no mesmo ato da criação.
--
-- ADR-0012: declarar é correto, mas a policy fica INERTE enquanto a aplicação
-- conectar como superuser (BYPASSRLS implícito). O isolamento real hoje é o
-- filtro por tenant em toda query (SYSTEM_TENANT_ID no back-office).
--
-- ADR-0013: estas tabelas vivem no tenant de sistema e são lidas pelo
-- back-office sem app.tenant_id na sessão — o mesmo aviso que vale para
-- PlanoComercial e Engagement. Quando existir papel sem BYPASSRLS, o
-- back-office precisa de caminho próprio.
--
-- CacAlocacaoProduto não tem tenantId: herda o isolamento pelo CASCADE do
-- CacPeriodo, como ProposalItem herda de Proposal.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'FornecedorDpa',
    'DecisaoDeConsentimento',
    'PerguntaAoParecer',
    'LancamentoMensal',
    'CacPeriodo',
    'SemanaDeCaixa'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_isolation" ON %I USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id())',
      t
    );
  END LOOP;
END $$;

