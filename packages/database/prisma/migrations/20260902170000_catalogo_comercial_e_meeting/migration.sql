-- Alcança o schema que já estava em `main` sem migration.
--
-- Os modelos do catálogo comercial (`PlanoComercial`, `PrecoDeModulo`,
-- `TermoDeContrato`, `AddOnComercial`) e as colunas novas de `Proposal` e
-- `Service` entraram em 33513541 `feat(comercial): catálogo de preços no
-- banco`; a churn de constraint em `MeetingParticipant` veio junto. Nenhum dos
-- dois gerou arquivo de migration, então `main` tinha schema que
-- `prisma migrate deploy` não sabia produzir.
--
-- Está aqui, e não dentro da migration do Scaffold, porque não é do Scaffold.

-- DropForeignKey
ALTER TABLE "MeetingParticipant" DROP CONSTRAINT "MeetingParticipant_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MeetingParticipant" DROP CONSTRAINT "MeetingParticipant_transcriptId_fkey";

-- AlterTable
ALTER TABLE "MeetingParticipant" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "acvCentavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "addOnSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "assentos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contatoEmail" TEXT,
ADD COLUMN     "modulos" "ProductModule"[] DEFAULT ARRAY[]::"ProductModule"[],
ADD COLUMN     "planoSlug" TEXT,
ADD COLUMN     "tcvCentavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tenantProvisionadoSlug" TEXT,
ADD COLUMN     "termoSlug" TEXT,
ADD COLUMN     "umaVezCentavos" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "duracao" TEXT,
ADD COLUMN     "entregaveis" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "exigeLab" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moduloVinculado" "ProductModule",
ADD COLUMN     "papeis" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preRequisitos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "trilha" TEXT NOT NULL DEFAULT 'readiness',
ADD COLUMN     "unidadeDeCobranca" TEXT NOT NULL DEFAULT 'PROJETO';

-- CreateTable
CREATE TABLE "PlanoComercial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "precoAssentoCentavos" INTEGER NOT NULL,
    "minimoAssentos" INTEGER NOT NULL DEFAULT 1,
    "limiteUsuarios" INTEGER,
    "permiteRolesCustom" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanoComercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecoDeModulo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "modulo" "ProductModule" NOT NULL,
    "precoMensalCentavos" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoDeModulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermoDeContrato" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "meses" INTEGER NOT NULL,
    "descontoPercent" INTEGER NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TermoDeContrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOnComercial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nota" TEXT,
    "precoCentavos" INTEGER NOT NULL,
    "recorrente" BOOLEAN NOT NULL DEFAULT true,
    "exigeRolesCustom" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AddOnComercial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanoComercial_tenantId_ativo_idx" ON "PlanoComercial"("tenantId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "PlanoComercial_tenantId_slug_key" ON "PlanoComercial"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "PrecoDeModulo_tenantId_modulo_key" ON "PrecoDeModulo"("tenantId", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "TermoDeContrato_tenantId_slug_key" ON "TermoDeContrato"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "AddOnComercial_tenantId_ativo_idx" ON "AddOnComercial"("tenantId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "AddOnComercial_tenantId_slug_key" ON "AddOnComercial"("tenantId", "slug");

-- AddForeignKey
ALTER TABLE "PlanoComercial" ADD CONSTRAINT "PlanoComercial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoDeModulo" ADD CONSTRAINT "PrecoDeModulo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoDeContrato" ADD CONSTRAINT "TermoDeContrato_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOnComercial" ADD CONSTRAINT "AddOnComercial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "MeetingTranscript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

