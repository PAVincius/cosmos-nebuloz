"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ContaView, contasDoPlano } from "@/lib/empresa/consultas";
import {
  calcularCaixa,
  calcularDre,
  type LinhaCalculada,
  referenciaPipeline,
  type SemanaCalculada,
  type SemanaEntrada,
  segundaFeira,
  semanaVazia,
  somarMeses,
} from "@/lib/empresa/financeiro";
import { agregarPorMes } from "@/lib/empresa/livro";
import {
  CAMPOS_INTERVALO,
  competenciasNoIntervalo,
  type Intervalo,
  IntervaloSchema,
  REFINE_INTERVALO,
  segundasNoIntervalo,
  utc,
} from "@/lib/empresa/periodo";
import {
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
  semTeto,
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

function competencias(i: Intervalo): string[] {
  return semTeto(() => competenciasNoIntervalo(i));
}

function segundas(i: Intervalo): string[] {
  return semTeto(() => segundasNoIntervalo(i));
}

// ── Plano de contas ──────────────────────────────────────────────────────

// `ContaView` continua re-exportada daqui: os clients (lancamentos.tsx,
// titulos.tsx, lancamento-dialog.tsx, plano.tsx) importam o tipo deste
// caminho, e `import type` some na compilação — só o valor `contasDoPlano`
// precisava sair do módulo "use server" (ver lib/empresa/consultas.ts).
export type { ContaView } from "@/lib/empresa/consultas";

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

const CriarContaSchema = z.object({
  conta: z.string().refine(contaValida, "Conta no formato N.N (grupo 1 a 6)."),
  nome: z.string().trim().min(1).max(120),
});

export async function criarConta(
  input: z.infer<typeof CriarContaSchema>
): Promise<Result<ContaView[]>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { conta, nome } = CriarContaSchema.parse(input);
    // `grupoDoCodigo` só devolve null quando `contaValida` já teria recusado
    // — o schema acima garante o formato antes de chegar aqui.
    const grupo = grupoDoCodigo(conta) as Conta["grupo"];
    const ordem = await proximaOrdem(grupo);

    await database.contaDoPlano.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        conta,
        nome,
        grupo,
        centroDeCusto: centroDoGrupo(grupo),
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
  conta: z.string().refine(contaValida, "Conta fora do plano de contas."),
  nome: z.string().trim().min(1).max(120).optional(),
  ativa: z.boolean().optional(),
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
      select: { nome: true, ativa: true },
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
  const linhasDoLivro = await database.lancamento.findMany({
    where: { tenantId: SYSTEM_TENANT_ID, competencia: { in: comps } },
    select: { competencia: true, conta: true, valorCentavos: true },
  });
  const agregado = agregarPorMes(linhasDoLivro);

  const porMes = comps.map((c) => agregado[c] ?? {});
  const dres: LinhaCalculada[][] = porMes.map((m) =>
    calcularDre(contasPlano, m)
  );
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

  const contasComLancamento = new Set(linhasDoLivro.map((l) => l.conta));
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

// ── Caixa ──────────────────────────────────────────────────────────────────

export type CaixaView = {
  intervalo: Intervalo;
  semanas: SemanaCalculada[];
  referenciaPipelineCentavos: number | null;
  convPropostaAceitaPercent: number | null;
  totalPropostasAbertasCentavos: number;
};

async function montarCaixa(intervalo: Intervalo): Promise<CaixaView> {
  const janela = segundas(intervalo);
  const inicio = janela[0] as string;
  const fim = janela.at(-1) as string;
  const [gravadas, cac, propostas] = await Promise.all([
    database.semanaDeCaixa.findMany({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        semanaInicio: { gte: utc(inicio), lte: utc(fim) },
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

// `saldoInicialCentavos` é o único destes genuinely signed — um saldo inicial
// negativo é um cheque especial de verdade. Os demais são magnitude: o sinal
// (entrada ou saída) vem da coluna em `calcularCaixa`, não do valor digitado.
const CentavosMagnitude = z
  .number()
  .int()
  .nonnegative("Valor não pode ser negativo — o sinal vem da coluna.")
  .nullable()
  .optional();

const SemanaSchema = z
  .object({
    semanaInicio: z.iso
      .date()
      .refine(
        (s) => segundaFeira(utc(s)) === s,
        "A semana começa numa segunda-feira."
      ),
    saldoInicialCentavos: Centavos,
    recebiveisCentavos: CentavosMagnitude,
    contratosAssinadosCentavos: CentavosMagnitude,
    pipelinePonderadoCentavos: CentavosMagnitude,
    saidasPessoalCentavos: CentavosMagnitude,
    saidasFornecedoresCentavos: CentavosMagnitude,
    saidasComercialCentavos: CentavosMagnitude,
    saidasImpostosCentavos: CentavosMagnitude,
    saidasOutrasCentavos: CentavosMagnitude,
    ...CAMPOS_INTERVALO,
  })
  .refine(...REFINE_INTERVALO);

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
    const dia = utc(semanaInicio);
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
