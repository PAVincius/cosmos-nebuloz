"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { precificarProposta } from "@/lib/comercial/precificar";
import {
  calcularCac,
  type ParcelasCac,
  pesosSomam100,
  type ResultadoCac,
} from "@/lib/empresa/cac";
import { competenciaValida } from "@/lib/empresa/financeiro";
import { CONTAS_DO_CAC, type ContaDoCac } from "@/lib/empresa/plano-de-contas";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * CAC totalmente carregado (docs/comercial/cac-modelo.md).
 *
 * Seis das oito parcelas são as contas 4.1–4.6 do DRE: esta action lê e
 * escreve LancamentoMensal, não uma cópia. É o que faz o numerador do CAC e a
 * linha "Comercial" do DRE baterem por construção.
 */

const ROTA_CAC = "/empresa/cac";

/** Plano e termo que dão a mensalidade de referência do payback
 *  (cac-modelo.md §3): Scale, mínimo de assentos, termo anual. */
const PLANO_REFERENCIA = "scale";
const TERMO_REFERENCIA = "ANUAL";

const PRODUTOS = [
  "COSMOS",
  "CHARTER",
  "SIGNAL",
  "MERIDIAN",
  "SCAFFOLD",
] as const;

export type ConversaoView = {
  convLeadDiscoveryPercent: number | null;
  convDiscoveryEvaluationPercent: number | null;
  convEvaluationPropostaPercent: number | null;
  convPropostaAceitaPercent: number | null;
};

export type CacView = {
  competencia: string;
  parcelas: ParcelasCac;
  conversao: ConversaoView;
  alocacoes: { produto: string; pesoPercent: number }[];
  resultado: ResultadoCac;
  mensalidadeReferenciaCentavos: number | null;
  /** Propostas ACEITA atualizadas no mês — sugestão, não valor. */
  sugestaoClientesGanhos: number;
};

const Competencia = z
  .string()
  .refine(competenciaValida, "Competência no formato AAAA-MM.");
const Centavos = z.number().int().min(0).nullable();
const Percent = z.number().int().min(0).max(100).nullable();

function chaveCac(competencia: string) {
  return { tenantId_competencia: { tenantId: SYSTEM_TENANT_ID, competencia } };
}

async function mensalidadeReferencia(): Promise<number | null> {
  const [plano, termo] = await Promise.all([
    database.planoComercial.findUnique({
      where: {
        tenantId_slug: { tenantId: SYSTEM_TENANT_ID, slug: PLANO_REFERENCIA },
      },
      select: { precoAssentoCentavos: true, minimoAssentos: true },
    }),
    database.termoDeContrato.findUnique({
      where: {
        tenantId_slug: { tenantId: SYSTEM_TENANT_ID, slug: TERMO_REFERENCIA },
      },
      select: { meses: true, descontoPercent: true },
    }),
  ]);
  if (!(plano && termo)) {
    return null;
  }
  return precificarProposta(
    { plano, modulos: [], termo, addOns: [], servicos: [] },
    { assentos: plano.minimoAssentos, descontoPercent: 0 }
  ).liquidoMensalCentavos;
}

function limitesDoMes(competencia: string): { inicio: Date; fim: Date } {
  const [ano, mes] = competencia.split("-").map(Number);
  return {
    inicio: new Date(Date.UTC(ano, mes - 1, 1)),
    fim: new Date(Date.UTC(ano, mes, 1)),
  };
}

async function montar(competencia: string): Promise<CacView> {
  const { inicio, fim } = limitesDoMes(competencia);
  const [lancamentos, periodo, mensalidade, sugestao] = await Promise.all([
    database.lancamentoMensal.findMany({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        competencia,
        conta: { in: [...CONTAS_DO_CAC] },
      },
      select: { conta: true, valorCentavos: true },
    }),
    database.cacPeriodo.findUnique({
      where: chaveCac(competencia),
      select: {
        id: true,
        entregaDiagnosticoCentavos: true,
        clientesGanhos: true,
        convLeadDiscoveryPercent: true,
        convDiscoveryEvaluationPercent: true,
        convEvaluationPropostaPercent: true,
        convPropostaAceitaPercent: true,
        alocacoes: {
          select: { produto: true, pesoPercent: true },
          orderBy: { produto: "asc" },
        },
      },
    }),
    mensalidadeReferencia(),
    database.proposal.count({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        status: "ACEITA",
        atualizadoEm: { gte: inicio, lt: fim },
      },
    }),
  ]);

  const porConta = new Map(lancamentos.map((l) => [l.conta, l.valorCentavos]));
  const parcelas = {
    ...(Object.fromEntries(
      CONTAS_DO_CAC.map((c) => [c, porConta.get(c) ?? null])
    ) as Record<ContaDoCac, number | null>),
    entregaDiagnosticoCentavos: periodo?.entregaDiagnosticoCentavos ?? null,
    clientesGanhos: periodo?.clientesGanhos ?? null,
  };
  const conversao: ConversaoView = {
    convLeadDiscoveryPercent: periodo?.convLeadDiscoveryPercent ?? null,
    convDiscoveryEvaluationPercent:
      periodo?.convDiscoveryEvaluationPercent ?? null,
    convEvaluationPropostaPercent:
      periodo?.convEvaluationPropostaPercent ?? null,
    convPropostaAceitaPercent: periodo?.convPropostaAceitaPercent ?? null,
  };
  const alocacoes = (periodo?.alocacoes ?? []).map((a) => ({
    produto: String(a.produto),
    pesoPercent: a.pesoPercent,
  }));

  return {
    competencia,
    parcelas,
    conversao,
    alocacoes,
    resultado: calcularCac(parcelas, alocacoes, mensalidade),
    mensalidadeReferenciaCentavos: mensalidade,
    sugestaoClientesGanhos: sugestao,
  };
}

export async function lerCac(input: {
  competencia: string;
}): Promise<Result<CacView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await montar(Competencia.parse(input.competencia));
  });
}

async function auditar(
  staff: { userId: string; name: string | null },
  action: string,
  competencia: string,
  diff: [string, string, string][]
) {
  await logPlatformAudit(database, {
    tenantId: SYSTEM_TENANT_ID,
    actorUserId: staff.userId,
    actorName: staff.name,
    action,
    entityType: "CacPeriodo",
    entityId: competencia,
    target: `CAC ${competencia}`,
    diff,
  });
  revalidatePath(ROTA_CAC);
}

/** Upsert em CacPeriodo com só os campos enviados; devolve o id. */
async function upsertPeriodo(
  competencia: string,
  update: Record<string, unknown>
): Promise<string> {
  const p = await database.cacPeriodo.upsert({
    where: chaveCac(competencia),
    create: { tenantId: SYSTEM_TENANT_ID, competencia, ...update },
    update,
    select: { id: true },
  });
  return p.id;
}

const ParcelasSchema = z.object({
  competencia: Competencia,
  contas: z.partialRecord(z.enum(CONTAS_DO_CAC), Centavos).optional(),
  entregaDiagnosticoCentavos: Centavos.optional(),
  clientesGanhos: z.number().int().min(0).nullable().optional(),
});

export async function salvarParcelas(
  input: z.infer<typeof ParcelasSchema>
): Promise<Result<CacView>> {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Transaction requires multiple conditional branches
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, contas, entregaDiagnosticoCentavos, clientesGanhos } =
      ParcelasSchema.parse(input);
    const diff: [string, string, string][] = [];
    const escritas: unknown[] = [];

    for (const [conta, valor] of Object.entries(contas ?? {})) {
      const where = { tenantId: SYSTEM_TENANT_ID, competencia, conta };
      if (valor === null) {
        escritas.push(database.lancamentoMensal.deleteMany({ where }));
      } else {
        escritas.push(
          database.lancamentoMensal.upsert({
            where: { tenantId_competencia_conta: where },
            create: { ...where, valorCentavos: valor },
            update: { valorCentavos: valor },
          })
        );
      }
      diff.push([conta, "", valor === null ? "" : String(valor)]);
    }

    const update: Record<string, unknown> = {};
    if (entregaDiagnosticoCentavos !== undefined) {
      update.entregaDiagnosticoCentavos = entregaDiagnosticoCentavos;
    }
    if (clientesGanhos !== undefined) {
      update.clientesGanhos = clientesGanhos;
    }
    if (Object.keys(update).length > 0) {
      escritas.push(
        database.cacPeriodo.upsert({
          where: chaveCac(competencia),
          create: { tenantId: SYSTEM_TENANT_ID, competencia, ...update },
          update,
          select: { id: true },
        })
      );
      for (const [k, v] of Object.entries(update)) {
        diff.push([k, "", String(v ?? "")]);
      }
    }

    if (escritas.length) {
      // biome-ignore lint/suspicious/noExplicitAny: Prisma $transaction requires PrismaPromise array
      await database.$transaction(escritas as any);
    }

    await auditar(staff, "empresa.cac.parcelas", competencia, diff);
    return await montar(competencia);
  });
}

const ConversaoSchema = z.object({
  competencia: Competencia,
  convLeadDiscoveryPercent: Percent.optional(),
  convDiscoveryEvaluationPercent: Percent.optional(),
  convEvaluationPropostaPercent: Percent.optional(),
  convPropostaAceitaPercent: Percent.optional(),
});

export async function salvarConversao(
  input: z.infer<typeof ConversaoSchema>
): Promise<Result<CacView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, ...campos } = ConversaoSchema.parse(input);
    const update = Object.fromEntries(
      Object.entries(campos).filter(([, v]) => v !== undefined)
    );
    await upsertPeriodo(competencia, update);
    await auditar(
      staff,
      "empresa.cac.conversao",
      competencia,
      Object.entries(update).map(([k, v]) => [k, "", String(v ?? "")])
    );
    return await montar(competencia);
  });
}

const AlocacaoSchema = z.object({
  competencia: Competencia,
  alocacoes: z.array(
    z.object({
      produto: z.enum(PRODUTOS),
      pesoPercent: z.number().int().min(0).max(100),
    })
  ),
});

export async function salvarAlocacao(
  input: z.infer<typeof AlocacaoSchema>
): Promise<Result<CacView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, alocacoes } = AlocacaoSchema.parse(input);
    if (!pesosSomam100(alocacoes)) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Os pesos por produto precisam somar 100%."
      );
    }
    const cacPeriodoId = await upsertPeriodo(competencia, {});
    await database.$transaction([
      database.cacAlocacaoProduto.deleteMany({ where: { cacPeriodoId } }),
      database.cacAlocacaoProduto.createMany({
        data: alocacoes.map((a) => ({
          cacPeriodoId,
          produto: a.produto,
          pesoPercent: a.pesoPercent,
        })),
      }),
    ]);
    await auditar(
      staff,
      "empresa.cac.alocacao",
      competencia,
      alocacoes.map((a) => [a.produto, "", `${a.pesoPercent}%`])
    );
    return await montar(competencia);
  });
}
