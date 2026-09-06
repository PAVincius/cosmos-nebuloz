"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  calcularCaixa,
  calcularDre,
  competenciasAte,
  competenciaValida,
  janelaDe13,
  type LinhaCalculada,
  referenciaPipeline,
  type SemanaCalculada,
  type SemanaEntrada,
  segundaFeira,
  semanaVazia,
  somarMeses,
} from "@/lib/empresa/financeiro";
import { contaValida, PLANO_DE_CONTAS } from "@/lib/empresa/plano-de-contas";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Base financeira (docs/financeiro): DRE por competência e caixa de 13 semanas.
 * As linhas calculadas nascem de lib/empresa/financeiro; aqui só se lê e
 * grava a entrada.
 */

const ROTA_FINANCEIRO = "/empresa/financeiro";

const MESES_DRE = 3;
const STATUS_PIPELINE = ["ENVIADA", "AGUARDANDO_APROVACAO"];

const Competencia = z
  .string()
  .refine(competenciaValida, "Competência no formato AAAA-MM.");

export type DreView = {
  competencias: string[];
  linhas: {
    id: string;
    rotulo: string;
    calculada: boolean;
    valores: (number | null)[];
    percents?: (number | null)[];
    trimestre: number | null;
    trimestrePercent?: number | null;
  }[];
  contas: {
    conta: string;
    nome: string;
    grupo: number;
    valores: (number | null)[];
  }[];
};

async function montarDre(competenciaFinal: string): Promise<DreView> {
  const competencias = competenciasAte(competenciaFinal, MESES_DRE);
  const lancamentos = await database.lancamentoMensal.findMany({
    where: { tenantId: SYSTEM_TENANT_ID, competencia: { in: competencias } },
    select: { competencia: true, conta: true, valorCentavos: true },
  });

  const porMes = competencias.map((c) =>
    Object.fromEntries(
      lancamentos
        .filter((l) => l.competencia === c)
        .map((l) => [l.conta, l.valorCentavos])
    )
  );
  const dres: LinhaCalculada[][] = porMes.map(calcularDre);
  const trimestre = somarMeses(dres);

  const linhas = trimestre.map((t, i) => {
    const ehPercent = t.percent !== undefined;
    return {
      id: t.id,
      rotulo: t.rotulo,
      calculada: t.calculada,
      valores: dres.map((d) => d[i]?.valorCentavos ?? null),
      ...(ehPercent
        ? { percents: dres.map((d) => d[i]?.percent ?? null) }
        : {}),
      trimestre: t.valorCentavos,
      ...(ehPercent ? { trimestrePercent: t.percent ?? null } : {}),
    };
  });

  const contas = PLANO_DE_CONTAS.map((c) => ({
    conta: c.conta,
    nome: c.nome,
    grupo: c.grupo,
    valores: porMes.map((m) => m[c.conta] ?? null),
  }));

  return { competencias, linhas, contas };
}

export async function lerDre(input: {
  competenciaFinal: string;
}): Promise<Result<DreView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await montarDre(Competencia.parse(input.competenciaFinal));
  });
}

const LancamentoSchema = z.object({
  competencia: Competencia,
  conta: z.string().refine(contaValida, "Conta fora do plano de contas."),
  valorCentavos: z.number().int().nullable(),
});

export async function salvarLancamento(
  input: z.infer<typeof LancamentoSchema>
): Promise<Result<DreView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, conta, valorCentavos } = LancamentoSchema.parse(input);
    const where = { tenantId: SYSTEM_TENANT_ID, competencia, conta };

    if (valorCentavos === null) {
      await database.lancamentoMensal.deleteMany({ where });
    } else {
      await database.lancamentoMensal.upsert({
        where: { tenantId_competencia_conta: where },
        create: { ...where, valorCentavos },
        update: { valorCentavos },
      });
    }
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.lancamento",
      entityType: "LancamentoMensal",
      entityId: `${competencia}/${conta}`,
      target: `conta ${conta} · ${competencia}`,
      diff: [[conta, "", valorCentavos === null ? "" : String(valorCentavos)]],
    });
    revalidatePath(ROTA_FINANCEIRO);
    return await montarDre(competencia);
  });
}

// ── Caixa ──────────────────────────────────────────────────────────────────

export type CaixaView = {
  semanas: SemanaCalculada[];
  referenciaPipelineCentavos: number | null;
  convPropostaAceitaPercent: number | null;
  totalPropostasAbertasCentavos: number;
};

function dataUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

async function montarCaixa(): Promise<CaixaView> {
  const janela = janelaDe13(new Date());
  const [gravadas, cac, propostas] = await Promise.all([
    database.semanaDeCaixa.findMany({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        semanaInicio: { gte: dataUtc(janela[0]), lte: dataUtc(janela[12]) },
      },
      select: {
        semanaInicio: true,
        saldoInicialCentavos: true,
        recebiveisCentavos: true,
        contratosAssinadosCentavos: true,
        pipelinePonderadoCentavos: true,
        saidasPessoalCentavos: true,
        saidasFornecedoresCentavos: true,
        saidasComercialCentavos: true,
        saidasImpostosCentavos: true,
        saidasOutrasCentavos: true,
      },
    }),
    // A conversão mais recente registrada na tela de CAC (caixa-13-semanas.md, regra 4).
    database.cacPeriodo.findFirst({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        convPropostaAceitaPercent: { not: null },
      },
      orderBy: { competencia: "desc" },
      select: { convPropostaAceitaPercent: true },
    }),
    database.proposal.aggregate({
      where: { tenantId: SYSTEM_TENANT_ID, status: { in: STATUS_PIPELINE } },
      _sum: { totalCentavos: true },
    }),
  ]);

  const porSemana = new Map(
    (gravadas as (SemanaEntrada & { semanaInicio: Date })[]).map((g) => [
      g.semanaInicio.toISOString().slice(0, 10),
      g,
    ])
  );
  const entradas: SemanaEntrada[] = janela.map((s) => {
    const g = porSemana.get(s);
    return g ? { ...g, semanaInicio: s } : semanaVazia(s);
  });

  const conv = cac?.convPropostaAceitaPercent ?? null;
  const total = propostas._sum.totalCentavos ?? 0;
  return {
    semanas: calcularCaixa(entradas),
    referenciaPipelineCentavos: referenciaPipeline(total, conv),
    convPropostaAceitaPercent: conv,
    totalPropostasAbertasCentavos: total,
  };
}

export async function lerCaixa(): Promise<Result<CaixaView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await montarCaixa();
  });
}

const Centavos = z.number().int().nullable().optional();

const SemanaSchema = z.object({
  semanaInicio: z.iso
    .date()
    .refine(
      (s) => segundaFeira(dataUtc(s)) === s,
      "A semana começa numa segunda-feira."
    ),
  saldoInicialCentavos: Centavos,
  recebiveisCentavos: Centavos,
  contratosAssinadosCentavos: Centavos,
  pipelinePonderadoCentavos: Centavos,
  saidasPessoalCentavos: Centavos,
  saidasFornecedoresCentavos: Centavos,
  saidasComercialCentavos: Centavos,
  saidasImpostosCentavos: Centavos,
  saidasOutrasCentavos: Centavos,
});

export async function salvarSemana(
  input: z.infer<typeof SemanaSchema>
): Promise<Result<CaixaView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { semanaInicio, ...campos } = SemanaSchema.parse(input);
    const update = Object.fromEntries(
      Object.entries(campos).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(update).length === 0) {
      throw new StaffAuthError("FORBIDDEN", "Nada a salvar.");
    }
    const dia = dataUtc(semanaInicio);
    await database.semanaDeCaixa.upsert({
      where: {
        tenantId_semanaInicio: {
          tenantId: SYSTEM_TENANT_ID,
          semanaInicio: dia,
        },
      },
      create: { tenantId: SYSTEM_TENANT_ID, semanaInicio: dia, ...update },
      update,
    });
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.semana",
      entityType: "SemanaDeCaixa",
      entityId: semanaInicio,
      target: `semana de ${semanaInicio}`,
      diff: Object.entries(update).map(([k, v]) => [k, "", String(v ?? "")]),
    });
    revalidatePath(ROTA_FINANCEIRO);
    return await montarCaixa();
  });
}
