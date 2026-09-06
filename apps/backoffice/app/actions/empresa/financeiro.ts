"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  calcularCaixa,
  calcularDre,
  competenciaValida,
  type LinhaCalculada,
  referenciaPipeline,
  type SemanaCalculada,
  type SemanaEntrada,
  segundaFeira,
  semanaVazia,
  somarMeses,
} from "@/lib/empresa/financeiro";
import {
  competenciasNoIntervalo,
  type Intervalo,
  IntervaloExcedido,
  IntervaloSchema,
  intervaloValido,
  segundasNoIntervalo,
} from "@/lib/empresa/periodo";
import {
  type CentroDeCusto,
  type Conta,
  centroDoGrupo,
  contaValida,
  grupoDoCodigo,
} from "@/lib/empresa/plano-de-contas";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Base financeira (docs/financeiro): DRE e caixa por intervalo de datas
 * escolhido na tela (spec 2026-09-06 §1–§4), mais o CRUD do plano de contas.
 * As linhas calculadas nascem de lib/empresa/financeiro; aqui só se lê e
 * grava a entrada.
 */

const ROTA_FINANCEIRO = "/empresa/financeiro";
const STATUS_PIPELINE = ["ENVIADA", "AGUARDANDO_APROVACAO"];

const Competencia = z
  .string()
  .refine(competenciaValida, "Competência no formato AAAA-MM.");

/** Traduz o teto do lib para o erro que a tela mostra. */
function competencias(i: Intervalo): string[] {
  try {
    return competenciasNoIntervalo(i);
  } catch (e) {
    if (e instanceof IntervaloExcedido) {
      throw new StaffAuthError("FORBIDDEN", e.message);
    }
    throw e;
  }
}

function segundas(i: Intervalo): string[] {
  try {
    return segundasNoIntervalo(i);
  } catch (e) {
    if (e instanceof IntervaloExcedido) {
      throw new StaffAuthError("FORBIDDEN", e.message);
    }
    throw e;
  }
}

// ── Plano de contas ──────────────────────────────────────────────────────

const SELECT_CONTA = {
  conta: true,
  nome: true,
  grupo: true,
  centroDeCusto: true,
  ativa: true,
  ordem: true,
} as const;

export type ContaView = {
  conta: string;
  nome: string;
  grupo: number;
  centroDeCusto: string | null;
  ativa: boolean;
  ordem: number;
};

async function contasDoPlano(): Promise<ContaView[]> {
  return await database.contaDoPlano.findMany({
    where: { tenantId: SYSTEM_TENANT_ID },
    orderBy: [{ grupo: "asc" }, { ordem: "asc" }, { conta: "asc" }],
    select: SELECT_CONTA,
  });
}

function paraConta(c: ContaView): Conta {
  return {
    conta: c.conta,
    nome: c.nome,
    grupo: c.grupo as Conta["grupo"],
    centroDeCusto: c.centroDeCusto as CentroDeCusto | null,
    ativa: c.ativa,
  };
}

export async function listarPlanoDeContas(): Promise<Result<ContaView[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await contasDoPlano();
  });
}

/** Maior `ordem` já usada no grupo, mais um — nova conta some no fim da lista. */
async function proximaOrdem(grupo: number): Promise<number> {
  const doGrupo = (await contasDoPlano()).filter((c) => c.grupo === grupo);
  return doGrupo.length === 0
    ? 0
    : Math.max(...doGrupo.map((c) => c.ordem)) + 1;
}

const CENTROS = ["comercial", "produto-engenharia", "entrega", "ga"] as const;

const CriarContaSchema = z.object({
  conta: z.string().refine(contaValida, "Conta no formato N.N (grupo 1 a 6)."),
  nome: z.string().trim().min(1).max(120),
  centroDeCusto: z.enum(CENTROS).nullable().optional(),
});

export async function criarConta(
  input: z.infer<typeof CriarContaSchema>
): Promise<Result<ContaView[]>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { conta, nome, centroDeCusto } = CriarContaSchema.parse(input);
    const grupo = grupoDoCodigo(conta);
    if (grupo === null) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Conta no formato N.N (grupo 1 a 6)."
      );
    }
    if (grupo <= 2 && centroDeCusto) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Contas de receita e dedução não têm centro de custo."
      );
    }
    const centro = centroDeCusto ?? centroDoGrupo(grupo);
    const ordem = await proximaOrdem(grupo);

    await database.contaDoPlano.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        conta,
        nome,
        grupo,
        centroDeCusto: centro,
        ativa: true,
        ordem,
      },
    });
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.conta.criar",
      entityType: "ContaDoPlano",
      entityId: conta,
      target: `conta ${conta}`,
      diff: [
        ["conta", "", conta],
        ["nome", "", nome],
      ],
    });
    revalidatePath(ROTA_FINANCEIRO);
    return await contasDoPlano();
  });
}

const AtualizarContaSchema = z.object({
  conta: z.string(),
  nome: z.string().trim().min(1).max(120).optional(),
  ativa: z.boolean().optional(),
  centroDeCusto: z.enum(CENTROS).nullable().optional(),
});

export async function atualizarConta(
  input: z.infer<typeof AtualizarContaSchema>
): Promise<Result<ContaView[]>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { conta, ...campos } = AtualizarContaSchema.parse(input);
    const existente = await database.contaDoPlano.findUnique({
      where: { tenantId_conta: { tenantId: SYSTEM_TENANT_ID, conta } },
      select: { nome: true, ativa: true, centroDeCusto: true },
    });
    if (!existente) {
      throw new StaffAuthError("FORBIDDEN", "Conta não encontrada.");
    }
    const data = Object.fromEntries(
      Object.entries(campos).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(data).length === 0) {
      throw new StaffAuthError("FORBIDDEN", "Nada a salvar.");
    }

    await database.contaDoPlano.update({
      where: { tenantId_conta: { tenantId: SYSTEM_TENANT_ID, conta } },
      data,
    });
    const antes = existente as Record<string, unknown>;
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.conta.atualizar",
      entityType: "ContaDoPlano",
      entityId: conta,
      target: `conta ${conta}`,
      diff: Object.entries(data).map(([k, v]) => [
        k,
        String(antes[k] ?? ""),
        String(v ?? ""),
      ]),
    });
    revalidatePath(ROTA_FINANCEIRO);
    return await contasDoPlano();
  });
}

// ── DRE ──────────────────────────────────────────────────────────────────

export type DreView = {
  intervalo: Intervalo;
  competencias: string[];
  linhas: {
    id: string;
    rotulo: string;
    calculada: boolean;
    valores: (number | null)[];
    percents?: (number | null)[];
    total: number | null;
    totalPercent?: number | null;
  }[];
  contas: {
    conta: string;
    nome: string;
    grupo: number;
    centroDeCusto: string | null;
    ativa: boolean;
    valores: (number | null)[];
  }[];
};

async function montarDre(intervalo: Intervalo): Promise<DreView> {
  const comps = competencias(intervalo);
  const contasPlano = await contasDoPlano();
  const contas = contasPlano.map(paraConta);
  const lancamentos = await database.lancamentoMensal.findMany({
    where: { tenantId: SYSTEM_TENANT_ID, competencia: { in: comps } },
    select: { competencia: true, conta: true, valorCentavos: true },
  });

  const porMes = comps.map((c) =>
    Object.fromEntries(
      lancamentos
        .filter((l) => l.competencia === c)
        .map((l) => [l.conta, l.valorCentavos])
    )
  );
  const dres: LinhaCalculada[][] = porMes.map((m) => calcularDre(contas, m));
  const total = somarMeses(dres);

  const linhas = total.map((t, i) => {
    const ehPercent = t.percent !== undefined;
    return {
      id: t.id,
      rotulo: t.rotulo,
      calculada: t.calculada,
      valores: dres.map((d) => d[i]?.valorCentavos ?? null),
      ...(ehPercent
        ? { percents: dres.map((d) => d[i]?.percent ?? null) }
        : {}),
      total: t.valorCentavos,
      ...(ehPercent ? { totalPercent: t.percent ?? null } : {}),
    };
  });

  const contasComLancamento = new Set(lancamentos.map((l) => l.conta));
  const contasView = contasPlano
    .filter((c) => c.ativa || contasComLancamento.has(c.conta))
    .map((c) => ({
      conta: c.conta,
      nome: c.nome,
      grupo: c.grupo,
      centroDeCusto: c.centroDeCusto,
      ativa: c.ativa,
      valores: porMes.map((m) => m[c.conta] ?? null),
    }));

  return { intervalo, competencias: comps, linhas, contas: contasView };
}

export async function lerDre(input: {
  de: string;
  ate: string;
}): Promise<Result<DreView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await montarDre(IntervaloSchema.parse(input));
  });
}

const LancamentoSchema = z
  .object({
    competencia: Competencia,
    conta: z.string().refine(contaValida, "Conta fora do plano de contas."),
    valorCentavos: z.number().int().nullable(),
    de: z.iso.date(),
    ate: z.iso.date(),
  })
  .refine(
    (v) => intervaloValido({ de: v.de, ate: v.ate }),
    "Intervalo inválido."
  );

export async function salvarLancamento(
  input: z.infer<typeof LancamentoSchema>
): Promise<Result<DreView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { competencia, conta, valorCentavos, de, ate } =
      LancamentoSchema.parse(input);

    const contaDoPlano = await database.contaDoPlano.findUnique({
      where: { tenantId_conta: { tenantId: SYSTEM_TENANT_ID, conta } },
      select: { ativa: true },
    });
    if (!contaDoPlano?.ativa) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Conta desativada ou fora do plano."
      );
    }

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
    return await montarDre({ de, ate });
  });
}

// ── Caixa ──────────────────────────────────────────────────────────────────

export type CaixaView = {
  intervalo: Intervalo;
  semanas: SemanaCalculada[];
  referenciaPipelineCentavos: number | null;
  convPropostaAceitaPercent: number | null;
  totalPropostasAbertasCentavos: number;
};

function dataUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

async function montarCaixa(intervalo: Intervalo): Promise<CaixaView> {
  const janela = segundas(intervalo);
  const inicio = janela[0] as string;
  const fim = janela.at(-1) as string;
  const [gravadas, cac, propostas] = await Promise.all([
    database.semanaDeCaixa.findMany({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        semanaInicio: { gte: dataUtc(inicio), lte: dataUtc(fim) },
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
  const totalPropostas = propostas._sum.totalCentavos ?? 0;
  return {
    intervalo,
    semanas: calcularCaixa(entradas),
    referenciaPipelineCentavos: referenciaPipeline(totalPropostas, conv),
    convPropostaAceitaPercent: conv,
    totalPropostasAbertasCentavos: totalPropostas,
  };
}

export async function lerCaixa(input: {
  de: string;
  ate: string;
}): Promise<Result<CaixaView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    return await montarCaixa(IntervaloSchema.parse(input));
  });
}

const Centavos = z.number().int().nullable().optional();

const SemanaSchema = z
  .object({
    semanaInicio: z.iso
      .date()
      .refine(
        (s) => segundaFeira(dataUtc(s)) === s,
        "A semana começa numa segunda-feira."
      ),
    de: z.iso.date(),
    ate: z.iso.date(),
    saldoInicialCentavos: Centavos,
    recebiveisCentavos: Centavos,
    contratosAssinadosCentavos: Centavos,
    pipelinePonderadoCentavos: Centavos,
    saidasPessoalCentavos: Centavos,
    saidasFornecedoresCentavos: Centavos,
    saidasComercialCentavos: Centavos,
    saidasImpostosCentavos: Centavos,
    saidasOutrasCentavos: Centavos,
  })
  .refine(
    (v) => intervaloValido({ de: v.de, ate: v.ate }),
    "Intervalo inválido."
  );

export async function salvarSemana(
  input: z.infer<typeof SemanaSchema>
): Promise<Result<CaixaView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { semanaInicio, de, ate, ...campos } = SemanaSchema.parse(input);
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
    return await montarCaixa({ de, ate });
  });
}
