"use server";

import { withTenantDb } from "@repo/database";
import { generateText } from "ai";
import { z } from "zod";
import { requireCharterPermissionContext } from "@/lib/charter/guards";
import {
  type CasoParaGeracao,
  type ExigenciaParaGeracao,
  type FornecedorParaGeracao,
  montarContextoGeracao,
} from "@/lib/charter/policy-generation";
import { RISK_CATEGORY_LABEL } from "@/lib/charter/rules";
import { type Result, safeAction } from "../../actions/_base";
import { GovernanceError, logCharterAudit } from "./_shared";

// Geração de rascunho de seção por IA (FR-2.7). Separado de policy.ts —
// que já reunia as outras ações de política — para não estourar o
// file-size-guard (teto de 800 linhas); `generatePolicyDraft` continua
// importável de "@/app/(charter)/actions/policy" via re-export naquele
// arquivo.

const GenerateDraftSchema = z.object({ sectionId: z.string().cuid() });

const MONTHLY_QUOTA = 30;
const MIN_RESPONSE_LENGTH = 200;
const RISK_THRESHOLD = 4;
const MS_PER_DAY = 86_400_000;

type RiskRow = {
  riskPrivacy: number;
  riskRegulatory: number;
  riskSecurity: number;
  riskBias: number;
  riskIp: number;
  riskOperational: number;
  riskReputational: number;
};

/** Rótulos pt-BR das categorias de risco com risco >= 4 — mesmo limiar usado
 *  na tela de caso de uso para destacar risco alto. */
function categoriasAltas(caso: RiskRow): string[] {
  const pares: [number, string][] = [
    [caso.riskPrivacy, RISK_CATEGORY_LABEL.PRIVACY],
    [caso.riskRegulatory, RISK_CATEGORY_LABEL.REGULATORY],
    [caso.riskSecurity, RISK_CATEGORY_LABEL.SECURITY],
    [caso.riskBias, RISK_CATEGORY_LABEL.BIAS],
    [caso.riskIp, RISK_CATEGORY_LABEL.IP],
    [caso.riskOperational, RISK_CATEGORY_LABEL.OPERATIONAL],
    [caso.riskReputational, RISK_CATEGORY_LABEL.REPUTATIONAL],
  ];
  return pares
    .filter(([risco]) => risco >= RISK_THRESHOLD)
    .map(([, label]) => label);
}

/**
 * Gera rascunho de seção por IA, grounded no inventário do tenant (casos de
 * uso, fornecedores, exigências de conformidade). Gerar ≠ salvar: quem
 * persiste é `saveGeneratedDraft`, no clique de "Aceitar" na tela — esta
 * action não escreve nada no banco além da trilha de auditoria.
 */
export async function generatePolicyDraft(input: {
  sectionId: string;
}): Promise<
  Result<{
    body: string;
    grounded: { id: string; codigo: string; citacao: string }[];
    fontes: { casos: number; fornecedores: number; exigencias: number };
  }>
> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("policy.edit");
    const data = GenerateDraftSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const section = await db.charterPolicySection.findFirst({
        where: { id: data.sectionId, tenantId: ctx.tenantId },
      });
      if (!section) {
        throw new GovernanceError("section.unknown", "Seção não encontrada.");
      }
      if (section.status !== "DRAFT") {
        throw new GovernanceError(
          "section.notDraft",
          "Seção publicada ou em revisão não recebe rascunho gerado — edite uma revisão."
        );
      }

      // Cota checada antes de chamar a IA — ela é o custo, e negar depois de
      // pagar o custo não protege ninguém.
      const { createRateLimiter, fixedWindow } = await import(
        "@repo/rate-limit"
      );
      const limiter = createRateLimiter({
        limiter: fixedWindow(MONTHLY_QUOTA, "30 d"),
        prefix: "charter:policy-gen",
      });
      const { success, reset } = await limiter.limit(ctx.tenantId);
      if (!success) {
        const dias = Math.max(1, Math.ceil((reset - Date.now()) / MS_PER_DAY));
        throw new GovernanceError(
          "draft.quota",
          `${MONTHLY_QUOTA} gerações de rascunho este mês; renova em ${dias} dia(s).`
        );
      }

      const casosRows = await db.charterUseCase.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          code: true,
          title: true,
          department: true,
          riskPrivacy: true,
          riskRegulatory: true,
          riskSecurity: true,
          riskBias: true,
          riskIp: true,
          riskOperational: true,
          riskReputational: true,
        },
      });
      const casos: CasoParaGeracao[] = casosRows.map((c) => ({
        code: c.code,
        title: c.title,
        department: c.department,
        categoriasAltas: categoriasAltas(c),
      }));

      const fornecedoresRows = await db.charterVendor.findMany({
        where: { tenantId: ctx.tenantId },
        select: { name: true, tier: true },
      });
      const fornecedores: FornecedorParaGeracao[] = fornecedoresRows;

      // Exigências candidatas: conjuntos em que o tenant já registrou alguma
      // cobertura — mesmo desenho de compliance.ts (setCoverage). Sem
      // cobertura nenhuma não há conjunto "visível" e a lista fica vazia; a
      // função pura de montarContextoGeracao lida bem com isso (bloco
      // "(nenhum cadastrado)").
      const coberturas = await db.charterCoverage.findMany({
        where: { tenantId: ctx.tenantId },
        select: { requirementId: true },
      });
      const idsComCobertura = coberturas.map((c) => c.requirementId);
      const requisitosCobertos = await db.charterRequirement.findMany({
        where: {
          id: { in: idsComCobertura },
          set: { OR: [{ tenantId: ctx.tenantId }, { tenantId: null }] },
        },
        select: { setId: true },
      });
      const setsCobertos = [...new Set(requisitosCobertos.map((r) => r.setId))];
      const exigenciasRows = await db.charterRequirement.findMany({
        where: {
          setId: { in: setsCobertos },
          set: { OR: [{ tenantId: ctx.tenantId }, { tenantId: null }] },
        },
        select: {
          id: true,
          codigo: true,
          citacao: true,
          resumo: true,
          categoria: true,
          peso: true,
          set: { select: { nome: true } },
        },
      });
      const exigencias: ExigenciaParaGeracao[] = exigenciasRows.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        citacao: r.citacao,
        resumo: r.resumo,
        categoria: r.categoria,
        peso: r.peso,
        conjunto: r.set.nome,
      }));

      const { system, prompt, grounded, fontes } = montarContextoGeracao({
        secaoNome: section.name,
        casos,
        fornecedores,
        exigencias,
      });

      // Import dinâmico pelo mesmo motivo de @repo/rate-limit acima: um
      // import estático de @repo/ai/lib/models força todo importador deste
      // arquivo a validar chave de provedor em tempo de import.
      const { getActiveProvider, getAIModel } = await import(
        "@repo/ai/lib/models"
      );
      const provider = getActiveProvider();
      if (provider === "none") {
        throw new GovernanceError(
          "ia.indisponivel",
          "Nenhum provedor de IA configurado."
        );
      }

      let text: string;
      try {
        const resultado = await generateText({
          model: getAIModel(provider),
          system,
          prompt,
        });
        text = resultado.text;
      } catch {
        throw new GovernanceError(
          "ia.falhou",
          "A geração falhou — tente de novo."
        );
      }
      if (text.trim().length < MIN_RESPONSE_LENGTH) {
        throw new GovernanceError(
          "ia.falhou",
          "A geração falhou — resposta curta demais. Tente de novo."
        );
      }

      await logCharterAudit(db, ctx, {
        action: "Gerou rascunho por IA",
        entityType: "charter.section",
        entityId: section.id,
        target: `S${String(section.ordinal).padStart(2, "0")} · ${section.name}`,
        note: `modelo ${provider} · ${fontes.exigencias} exigência(s), ${fontes.casos} caso(s), ${fontes.fornecedores} fornecedor(es)`,
      });

      return { body: text.trim(), grounded, fontes };
    });
  });
}
