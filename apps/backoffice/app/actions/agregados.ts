"use server";

import { database } from "@repo/database";
import { clientListArgs } from "@/lib/client-queries";
import { requirePlatformStaff, SYSTEM_TENANT_ID } from "@/lib/guard";
import { DIAS_PARA_RENOVACAO, DIAS_SEM_ATIVIDADE } from "@/lib/health";
import { TETO_DA_LISTA } from "@/lib/paginacao";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Os números dos KPIs, contados no banco.
 *
 * As listas saem até o teto de `lib/paginacao.ts`. Enquanto a carteira tinha
 * menos de 100 clientes, KPI calculado sobre a lista e KPI da carteira eram o
 * mesmo número por acaso; com 140, "Clientes na carteira: 100" é dado errado
 * sem erro nenhum — e na página 2 de Saúde, os KPIs viravam os da página 2.
 *
 * Cada tela chama uma leitura daqui em paralelo com a lista. Cada leitura é
 * `count`/`groupBy`/`aggregate` com o mesmo filtro de tenant da lista, em
 * número fixo de consultas: o custo não cresce com a base (teto de requisição
 * no banco, regra do repo — sem cache novo).
 */

const DIA_MS = 86_400_000;

/** O filtro da carteira — o mesmo das listas e da Home. */
function daCarteira() {
  return clientListArgs().where;
}

/** A contagem do grupo que casa; grupo ausente no `groupBy` vale zero. */
function contagem<G extends { _count: { _all: number } }>(
  grupos: G[],
  casa: (g: G) => boolean
): number {
  return grupos.find(casa)?._count._all ?? 0;
}

export type AgregadoDaCarteira = {
  clientes: number;
  modulosAtivos: number;
  trials: number;
  /** Módulos suspensos — o KPI "Exigem atenção". */
  suspensos: number;
};

export async function agregadoDaCarteira(): Promise<
  Result<AgregadoDaCarteira>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const [clientes, porStatus] = await Promise.all([
      database.tenant.count({ where: daCarteira() }),
      database.tenantModule.groupBy({
        by: ["status"],
        where: { tenant: daCarteira() },
        _count: { _all: true },
      }),
    ]);

    const de = (status: string) =>
      contagem(porStatus, (g) => g.status === status);
    return {
      clientes,
      modulosAtivos: de("ACTIVE"),
      trials: de("TRIAL"),
      suspensos: de("SUSPENDED"),
    };
  });
}

export type AgregadoDasContas = {
  risco: number;
  atencao: number;
  renovando: number;
  semSinal: number;
};

const QUEBRADO: ("SUSPENDED" | "CANCELED")[] = ["SUSPENDED", "CANCELED"];

/**
 * Os vereditos de `actions/accounts.ts` escritos como filtro, para contar a
 * carteira inteira sem ler cliente por cliente.
 *
 * As fronteiras de data são as de `diasAte` (arredonda para cima): renovação
 * vencida é `diasAte < 0`, ou seja, expira até um dia antes de agora; a
 * janela de renovação e o silêncio seguem a mesma conta. `resumir` decide
 * na ordem sem módulo → risco → atenção, e os filtros também: atenção exige
 * módulo e nenhum módulo em risco.
 */
export async function agregadoDasContas(
  agora?: Date
): Promise<Result<AgregadoDasContas>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const t = (agora ?? new Date()).getTime();
    const valendo = { status: { notIn: QUEBRADO } };
    const emRisco = {
      OR: [
        { status: { in: QUEBRADO } },
        { ...valendo, expiresAt: { lte: new Date(t - DIA_MS) } },
      ],
    };
    const renovaNaJanela = {
      ...valendo,
      expiresAt: { lte: new Date(t + DIAS_PARA_RENOVACAO * DIA_MS) },
    };
    const silencio = new Date(t - DIAS_SEM_ATIVIDADE * DIA_MS);
    const base = daCarteira();

    const [risco, atencao, renovando, semSinal] = await Promise.all([
      database.tenant.count({ where: { ...base, modules: { some: emRisco } } }),
      database.tenant.count({
        where: {
          ...base,
          modules: { some: {}, none: emRisco },
          OR: [
            { modules: { some: renovaNaJanela } },
            { integrations: { some: { status: "ERROR" } } },
            {
              AND: [
                { auditLogs: { some: {} } },
                { auditLogs: { none: { createdAt: { gt: silencio } } } },
              ],
            },
          ],
        },
      }),
      database.tenant.count({
        where: { ...base, modules: { some: renovaNaJanela } },
      }),
      database.tenant.count({ where: { ...base, modules: { none: {} } } }),
    ]);

    return { risco, atencao, renovando, semSinal };
  });
}

export type AgregadoDasPropostas = {
  total: number;
  abertas: number;
  pipelineAbertoCentavos: number;
  ticketMedioCentavos: number;
  ganhas: number;
  decididas: number;
  naFila: number;
};

/** Estados que ainda podem virar contrato. */
const EM_ABERTO = new Set(["RASCUNHO", "AGUARDANDO_APROVACAO", "ENVIADA"]);

/** Um `groupBy` por status responde os quatro KPIs de Propostas. O ACV vem
 *  gravado na proposta, não recalculado — ver `propostas/page.tsx`. */
export async function agregadoDasPropostas(): Promise<
  Result<AgregadoDasPropostas>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const grupos = await database.proposal.groupBy({
      by: ["status"],
      where: { tenantId: SYSTEM_TENANT_ID },
      _count: { _all: true },
      _sum: { acvCentavos: true },
    });

    let total = 0;
    let somaAcv = 0;
    let abertas = 0;
    let pipeline = 0;
    for (const g of grupos) {
      const acv = g._sum.acvCentavos ?? 0;
      total += g._count._all;
      somaAcv += acv;
      if (EM_ABERTO.has(g.status)) {
        abertas += g._count._all;
        pipeline += acv;
      }
    }
    const de = (status: string) => contagem(grupos, (g) => g.status === status);
    const ganhas = de("ACEITA");

    return {
      total,
      abertas,
      pipelineAbertoCentavos: pipeline,
      ticketMedioCentavos: total > 0 ? Math.round(somaAcv / total) : 0,
      ganhas,
      decididas: ganhas + de("RECUSADA"),
      naFila: de("AGUARDANDO_APROVACAO"),
    };
  });
}

export type AgregadoDoFunil = {
  ativos: number;
  estagnados: number;
  /** % dos leads com entrada que entraram pelo assessment; nulo sem base. */
  pelaEscada: number | null;
};

/** O ATIVO de `situacaoDe`: não perdido, e proposta nem aceita nem recusada. */
const LEAD_ATIVO = {
  tenantId: SYSTEM_TENANT_ID,
  perdidoEm: null,
  OR: [
    { proposta: { is: null } },
    { proposta: { is: { status: { notIn: ["ACEITA", "RECUSADA"] } } } },
  ],
};

/**
 * O cabeçalho do funil. Estagnado é o de `estagnado` em `lib/comercial/funil`:
 * dias no estágio por fronteira de dia UTC acima do teto do estágio — com
 * meia-noite como fronteira, "mais de N dias" vira `estagioDesde` antes da
 * meia-noite de hoje menos N dias. Estágio sem configuração não estagna.
 */
export async function agregadoDoFunil(
  agora?: Date
): Promise<Result<AgregadoDoFunil>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const hoje = agora ?? new Date();
    const meiaNoite = Date.UTC(
      hoje.getUTCFullYear(),
      hoje.getUTCMonth(),
      hoje.getUTCDate()
    );

    const [estagios, ativos, entradas] = await Promise.all([
      database.estagioDoFunil.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        take: TETO_DA_LISTA,
        select: { codigo: true, tetoDias: true },
      }),
      database.lead.count({ where: LEAD_ATIVO }),
      database.lead.groupBy({
        by: ["entrada"],
        where: { tenantId: SYSTEM_TENANT_ID, entrada: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const estagnados =
      estagios.length === 0
        ? 0
        : await database.lead.count({
            where: {
              AND: [
                LEAD_ATIVO,
                {
                  OR: estagios.map((e) => ({
                    estagio: e.codigo,
                    estagioDesde: {
                      lt: new Date(meiaNoite - e.tetoDias * DIA_MS),
                    },
                  })),
                },
              ],
            },
          });

    const comEntrada = entradas.reduce((s, g) => s + g._count._all, 0);
    const meridian = contagem(entradas, (g) => g.entrada === "MERIDIAN");

    return {
      ativos,
      estagnados,
      pelaEscada:
        comEntrada === 0 ? null : Math.round((meridian / comEntrada) * 100),
    };
  });
}

export type AgregadoDoBenchmark = {
  clientes: number;
  receitaCentavos: number;
  semContrato: number;
};

/** Contrato que conta — o mesmo corte das linhas de `actions/benchmark.ts`:
 *  cancelado fora. */
const ENGAJAMENTO_CONTA = ["ATIVO", "CONCLUIDO", "PAUSADO"];

export async function agregadoDoBenchmark(): Promise<
  Result<AgregadoDoBenchmark>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const conta = {
      tenantId: SYSTEM_TENANT_ID,
      status: { in: ENGAJAMENTO_CONTA },
      clienteTenantId: { not: SYSTEM_TENANT_ID },
    };
    const [clientes, receita, comContrato] = await Promise.all([
      database.tenant.count({ where: daCarteira() }),
      database.engagement.aggregate({
        where: conta,
        _sum: { valorCentavos: true },
      }),
      // Uma linha por cliente com contrato — é o `distinct` que o `count` do
      // Prisma não faz.
      database.engagement.groupBy({ by: ["clienteTenantId"], where: conta }),
    ]);

    return {
      clientes,
      receitaCentavos: receita._sum.valorCentavos ?? 0,
      semContrato: Math.max(0, clientes - comContrato.length),
    };
  });
}
