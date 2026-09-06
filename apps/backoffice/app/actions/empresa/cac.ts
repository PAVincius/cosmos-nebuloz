"use server";

import { database, ProductModule } from "@repo/database";
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
import {
  CAMPOS_INTERVALO,
  competenciasNoIntervalo,
  type Intervalo,
  IntervaloSchema,
  REFINE_INTERVALO,
} from "@/lib/empresa/periodo";
import { CONTAS_DO_CAC, type ContaDoCac } from "@/lib/empresa/plano-de-contas";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
  semTeto,
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

export type ConversaoView = {
  convLeadDiscoveryPercent: number | null;
  convDiscoveryEvaluationPercent: number | null;
  convEvaluationPropostaPercent: number | null;
  convPropostaAceitaPercent: number | null;
};

export type CacView = {
  intervalo: Intervalo;
  competencias: string[];
  /** Só um mês no intervalo: as escritas ficam disponíveis. */
  editavel: boolean;
  /** Última competência do intervalo — é nela que as escritas gravam. */
  competenciaEditavel: string;
  parcelas: ParcelasCac;
  conversao: ConversaoView;
  alocacoes: { produto: string; pesoPercent: number }[];
  resultado: ResultadoCac;
  mensalidadeReferenciaCentavos: number | null;
  /** Propostas ACEITA atualizadas no intervalo — sugestão, não valor. */
  sugestaoClientesGanhos: number;
};

const Competencia = z
  .string()
  .refine(competenciaValida, "Competência no formato AAAA-MM.");
const Centavos = z.number().int().min(0).nullable();
const Percent = z.number().int().min(0).max(100).nullable();

function competencias(i: Intervalo): string[] {
  return semTeto(() => competenciasNoIntervalo(i));
}

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

/** Do dia 1 do primeiro mês ao dia 1 do mês seguinte ao último (spec §5.2). */
function limitesDoIntervalo(comps: string[]): { inicio: Date; fim: Date } {
  const [anoIni, mesIni] = (comps[0] as string).split("-").map(Number);
  const [anoFim, mesFim] = (comps.at(-1) as string).split("-").map(Number);
  return {
    inicio: new Date(Date.UTC(anoIni, mesIni - 1, 1)),
    fim: new Date(Date.UTC(anoFim, mesFim, 1)),
  };
}

type LancamentoDoCac = {
  competencia: string;
  conta: string;
  valorCentavos: number;
};
type CacPeriodoDoMes = {
  competencia: string;
  entregaDiagnosticoCentavos: number | null;
  clientesGanhos: number | null;
  convLeadDiscoveryPercent: number | null;
  convDiscoveryEvaluationPercent: number | null;
  convEvaluationPropostaPercent: number | null;
  convPropostaAceitaPercent: number | null;
  alocacoes: { produto: string; pesoPercent: number }[];
};

/** Soma os meses do intervalo — nula se faltar valor em qualquer um deles
 *  (total parcial mentiria com cara de número, spec §5.2). */
function somaOuNula(valores: (number | null | undefined)[]): number | null {
  if (valores.some((v) => v === null || v === undefined)) {
    return null;
  }
  return valores.reduce<number>((acc, v) => acc + (v as number), 0);
}

/** Parcelas do CAC agregadas pelo intervalo: contas 4.x somam os lançamentos,
 *  entrega/clientes somam o `CacPeriodo` de cada mês — nulas se algum mês
 *  faltar (spec §5.2). */
function parcelasAgregadas(
  comps: string[],
  lancamentos: LancamentoDoCac[],
  periodos: CacPeriodoDoMes[]
): ParcelasCac {
  const porContaEMes = new Map<string, Map<string, number>>();
  for (const l of lancamentos) {
    const porMes = porContaEMes.get(l.conta) ?? new Map<string, number>();
    porMes.set(l.competencia, l.valorCentavos);
    porContaEMes.set(l.conta, porMes);
  }
  const porMesPeriodo = new Map(periodos.map((p) => [p.competencia, p]));

  const contas = Object.fromEntries(
    CONTAS_DO_CAC.map((c) => [
      c,
      somaOuNula(comps.map((comp) => porContaEMes.get(c)?.get(comp) ?? null)),
    ])
  ) as Record<ContaDoCac, number | null>;

  return {
    ...contas,
    entregaDiagnosticoCentavos: somaOuNula(
      comps.map(
        (comp) => porMesPeriodo.get(comp)?.entregaDiagnosticoCentavos ?? null
      )
    ),
    clientesGanhos: somaOuNula(
      comps.map((comp) => porMesPeriodo.get(comp)?.clientesGanhos ?? null)
    ),
  };
}

async function montar(intervalo: Intervalo): Promise<CacView> {
  const comps = competencias(intervalo);
  const ultima = comps.at(-1) as string;
  const { inicio, fim } = limitesDoIntervalo(comps);
  const [lancamentos, periodos, mensalidade, sugestao] = await Promise.all([
    database.lancamentoMensal.findMany({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        competencia: { in: comps },
        conta: { in: [...CONTAS_DO_CAC] },
      },
      select: { competencia: true, conta: true, valorCentavos: true },
    }),
    database.cacPeriodo.findMany({
      where: { tenantId: SYSTEM_TENANT_ID, competencia: { in: comps } },
      select: {
        id: true,
        competencia: true,
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
      orderBy: { competencia: "asc" },
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

  const parcelas = parcelasAgregadas(comps, lancamentos, periodos);
  const ultimo = periodos.find((p) => p.competencia === ultima);
  const conversao: ConversaoView = {
    convLeadDiscoveryPercent: ultimo?.convLeadDiscoveryPercent ?? null,
    convDiscoveryEvaluationPercent:
      ultimo?.convDiscoveryEvaluationPercent ?? null,
    convEvaluationPropostaPercent:
      ultimo?.convEvaluationPropostaPercent ?? null,
    convPropostaAceitaPercent: ultimo?.convPropostaAceitaPercent ?? null,
  };
  const alocacoes = (ultimo?.alocacoes ?? []).map((a) => ({
    produto: String(a.produto),
    pesoPercent: a.pesoPercent,
  }));

  return {
    intervalo,
    competencias: comps,
    editavel: comps.length === 1,
    competenciaEditavel: ultima,
    parcelas,
    conversao,
    alocacoes,
    resultado: calcularCac(parcelas, alocacoes, mensalidade),
    mensalidadeReferenciaCentavos: mensalidade,
    sugestaoClientesGanhos: sugestao,
  };
}

export async function lerCac(input: {
  de: string;
  ate: string;
}): Promise<Result<CacView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await montar(IntervaloSchema.parse(input));
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

const ParcelasSchema = z
  .object({
    competencia: Competencia,
    contas: z.partialRecord(z.enum(CONTAS_DO_CAC), Centavos).optional(),
    entregaDiagnosticoCentavos: Centavos.optional(),
    clientesGanhos: z.number().int().min(0).nullable().optional(),
    ...CAMPOS_INTERVALO,
  })
  .refine(...REFINE_INTERVALO);

export async function salvarParcelas(
  input: z.infer<typeof ParcelasSchema>
): Promise<Result<CacView>> {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Transaction requires multiple conditional branches
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const {
      competencia,
      contas,
      entregaDiagnosticoCentavos,
      clientesGanhos,
      de,
      ate,
    } = ParcelasSchema.parse(input);
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
    return await montar({ de, ate });
  });
}

const ConversaoSchema = z
  .object({
    competencia: Competencia,
    convLeadDiscoveryPercent: Percent.optional(),
    convDiscoveryEvaluationPercent: Percent.optional(),
    convEvaluationPropostaPercent: Percent.optional(),
    convPropostaAceitaPercent: Percent.optional(),
    ...CAMPOS_INTERVALO,
  })
  .refine(...REFINE_INTERVALO);

export async function salvarConversao(
  input: z.infer<typeof ConversaoSchema>
): Promise<Result<CacView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, de, ate, ...campos } = ConversaoSchema.parse(input);
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
    return await montar({ de, ate });
  });
}

const AlocacaoSchema = z
  .object({
    competencia: Competencia,
    alocacoes: z.array(
      z.object({
        produto: z.enum(ProductModule),
        pesoPercent: z.number().int().min(0).max(100),
      })
    ),
    ...CAMPOS_INTERVALO,
  })
  .refine(...REFINE_INTERVALO);

export async function salvarAlocacao(
  input: z.infer<typeof AlocacaoSchema>
): Promise<Result<CacView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, alocacoes, de, ate } = AlocacaoSchema.parse(input);
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
    return await montar({ de, ate });
  });
}
