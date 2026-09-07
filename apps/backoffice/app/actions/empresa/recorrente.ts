"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contasDoPlano } from "@/lib/empresa/consultas";
import type { LancamentosDoMes } from "@/lib/empresa/financeiro";
import { competenciaValida } from "@/lib/empresa/financeiro";
import { agregarPorMes } from "@/lib/empresa/livro";
import type {
  AssinaturaRow,
  CreditoRow,
  MudancaRow,
  TipoDeMudanca,
} from "@/lib/empresa/recorrente";
import { excedenteDoMes, valorNaCompetencia } from "@/lib/empresa/recorrente";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Receita recorrente (spec 2026-09-06 §1.4, §2–§3): a assinatura é o que se
 * cobra hoje; `MudancaDeAssinatura` é o histórico append-only que sustenta
 * `valorNaCompetencia`/`mrr` (lib/empresa/recorrente.ts) — por isso
 * `criarAssinatura`, `alterarValor` e `encerrarAssinatura` sempre gravam a
 * assinatura e a linha de histórico na mesma `$transaction`: sem a linha, o
 * MRR do mês não teria de onde nascer ou mudar.
 */

const ROTA = "/empresa/financeiro";

const SELECT_ASSINATURA = {
  id: true,
  clienteSlug: true,
  clienteNome: true,
  planoSlug: true,
  valorMensalCentavos: true,
  creditosMesIncluidos: true,
  precoCreditoExtraCentavos: true,
  tetoExcedenteCentavos: true,
  iniciouEm: true,
  encerradaEm: true,
  motivoEncerramento: true,
  propostaId: true,
} as const;

function paraAssinatura(a: {
  id: string;
  clienteSlug: string;
  clienteNome: string;
  planoSlug: string;
  valorMensalCentavos: number;
  creditosMesIncluidos: number;
  precoCreditoExtraCentavos: number;
  tetoExcedenteCentavos: number | null;
  iniciouEm: Date;
  encerradaEm: Date | null;
  motivoEncerramento: string | null;
  propostaId: string | null;
}): AssinaturaRow {
  return {
    id: a.id,
    clienteSlug: a.clienteSlug,
    clienteNome: a.clienteNome,
    planoSlug: a.planoSlug,
    valorMensalCentavos: a.valorMensalCentavos,
    creditosMesIncluidos: a.creditosMesIncluidos,
    precoCreditoExtraCentavos: a.precoCreditoExtraCentavos,
    tetoExcedenteCentavos: a.tetoExcedenteCentavos,
    iniciouEm: a.iniciouEm.toISOString().slice(0, 10),
    encerradaEm: a.encerradaEm
      ? a.encerradaEm.toISOString().slice(0, 10)
      : null,
    motivoEncerramento: a.motivoEncerramento,
    propostaId: a.propostaId,
  };
}

const SELECT_MUDANCA = {
  id: true,
  assinaturaId: true,
  competencia: true,
  tipo: true,
  deCentavos: true,
  paraCentavos: true,
  motivo: true,
  autorNome: true,
  criadoEm: true,
} as const;

function paraMudanca(m: {
  id: string;
  assinaturaId: string;
  competencia: string;
  tipo: string;
  deCentavos: number;
  paraCentavos: number;
  motivo: string;
  autorNome: string | null;
  criadoEm: Date;
}): MudancaRow {
  return {
    id: m.id,
    assinaturaId: m.assinaturaId,
    competencia: m.competencia,
    tipo: m.tipo as TipoDeMudanca,
    deCentavos: m.deCentavos,
    paraCentavos: m.paraCentavos,
    motivo: m.motivo,
    autorNome: m.autorNome,
    criadoEm: m.criadoEm.toISOString(),
  };
}

const SELECT_CREDITO = {
  id: true,
  clienteSlug: true,
  competencia: true,
  franquia: true,
  consumidos: true,
  precoCreditoExtraCentavos: true,
  excedenteCentavos: true,
  excedenteReprimidoCentavos: true,
} as const;

export type RecorrenteView = {
  competencia: string;
  assinaturas: AssinaturaRow[];
  mudancas: MudancaRow[];
  creditos: CreditoRow[];
  /** Só as contas do grupo 1 (receita) — assinatura e serviço juntas, como a
   *  tela precisa para conferir `receitaDeServico` ao lado do MRR. */
  lancamentosDaCompetencia: LancamentosDoMes;
};

const ListarRecorrenteSchema = z.object({
  competencia: z
    .string()
    .refine(competenciaValida, "Competência no formato AAAA-MM."),
});

export async function listarRecorrente(
  input: z.input<typeof ListarRecorrenteSchema>
): Promise<Result<RecorrenteView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const { competencia } = ListarRecorrenteSchema.parse(input);

    const contas = await contasDoPlano();
    const contasGrupo1 = contas
      .filter((c) => c.grupo === 1)
      .map((c) => c.conta);

    // Assinaturas e mudanças vêm inteiras (sem filtro de competência): `mrr`,
    // `valorNaCompetencia` e `churnDeClientes` (lib/empresa/recorrente.ts)
    // precisam do histórico completo para calcular o mês pedido, não só do
    // que aconteceu nele.
    const [assinaturas, mudancas, creditos, linhas] = await Promise.all([
      database.assinaturaDoTenant.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        select: SELECT_ASSINATURA,
      }),
      database.mudancaDeAssinatura.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        select: SELECT_MUDANCA,
      }),
      database.creditoDoMes.findMany({
        where: { tenantId: SYSTEM_TENANT_ID, competencia },
        select: SELECT_CREDITO,
      }),
      database.lancamento.findMany({
        where: {
          tenantId: SYSTEM_TENANT_ID,
          competencia,
          conta: { in: contasGrupo1 },
        },
        select: { competencia: true, conta: true, valorCentavos: true },
      }),
    ]);

    return {
      competencia,
      assinaturas: assinaturas.map(paraAssinatura),
      mudancas: mudancas.map(paraMudanca),
      creditos,
      lancamentosDaCompetencia: agregarPorMes(linhas)[competencia] ?? {},
    };
  });
}

const CriarAssinaturaSchema = z.object({
  clienteSlug: z.string().trim().min(1, "Cliente obrigatório."),
  clienteNome: z.string().trim().min(1, "Nome do cliente obrigatório."),
  planoSlug: z.string().trim().min(1, "Plano obrigatório."),
  valorMensalCentavos: z
    .number()
    .int()
    .positive("Valor tem que ser maior que zero."),
  creditosMesIncluidos: z.number().int().nonnegative(),
  precoCreditoExtraCentavos: z
    .number()
    .int()
    .nonnegative("Preço do crédito extra não aceita valor negativo."),
  tetoExcedenteCentavos: z.number().int().nonnegative().nullable(),
  iniciouEm: z.iso.date("Data no formato AAAA-MM-DD."),
  propostaId: z.string().trim().min(1).nullable().optional(),
  motivo: z.string().trim().min(10, "Motivo com pelo menos 10 caracteres."),
});

export async function criarAssinatura(
  input: z.infer<typeof CriarAssinaturaSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { motivo, ...dados } = CriarAssinaturaSchema.parse(input);
    const competencia = dados.iniciouEm.slice(0, 7);

    const criada = await database.$transaction(async (tx) => {
      const nova = await tx.assinaturaDoTenant.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          clienteSlug: dados.clienteSlug,
          clienteNome: dados.clienteNome,
          planoSlug: dados.planoSlug,
          valorMensalCentavos: dados.valorMensalCentavos,
          creditosMesIncluidos: dados.creditosMesIncluidos,
          precoCreditoExtraCentavos: dados.precoCreditoExtraCentavos,
          tetoExcedenteCentavos: dados.tetoExcedenteCentavos,
          iniciouEm: new Date(`${dados.iniciouEm}T00:00:00Z`),
          propostaId: dados.propostaId ?? null,
        },
        select: { id: true },
      });
      await tx.mudancaDeAssinatura.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          assinaturaId: nova.id,
          competencia,
          tipo: "NOVO",
          deCentavos: 0,
          paraCentavos: dados.valorMensalCentavos,
          motivo,
          autorId: staff.userId,
          autorNome: staff.name,
        },
      });
      return nova;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.assinatura.criar",
      entityType: "AssinaturaDoTenant",
      entityId: criada.id,
      target: `${dados.clienteSlug} · ${dados.planoSlug}`,
      diff: [["valorMensalCentavos", "", String(dados.valorMensalCentavos)]],
    });
    revalidatePath(ROTA);
    return criada;
  });
}

const AlterarValorSchema = z.object({
  id: z.string().min(1),
  valorCentavos: z.number().int().positive("Valor tem que ser maior que zero."),
  motivo: z.string().trim().min(10, "Motivo com pelo menos 10 caracteres."),
  competencia: z
    .string()
    .refine(competenciaValida, "Competência no formato AAAA-MM."),
});

export async function alterarValor(
  input: z.infer<typeof AlterarValorSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { id, valorCentavos, motivo, competencia } =
      AlterarValorSchema.parse(input);

    const assinatura = await database.assinaturaDoTenant.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      select: { valorMensalCentavos: true },
    });
    if (!assinatura) {
      throw new StaffAuthError("FORBIDDEN", "Assinatura não encontrada.");
    }
    const valorColuna = assinatura.valorMensalCentavos;

    // `deCentavos` vem do histórico na competência alvo, não da coluna: a
    // coluna é só o valor corrente, e o diálogo deixa escolher uma
    // competência diferente da que a aba está mostrando (é o uso esperado,
    // não exceção) — gravar numa competência que não é a última tem que
    // comparar com o que valia NAQUELE mês, senão o tipo (expansão/contração)
    // e o `deCentavos` gravados discordam do MRR de verdade.
    const mudancasExistentes = (
      await database.mudancaDeAssinatura.findMany({
        where: { assinaturaId: id, tenantId: SYSTEM_TENANT_ID },
        select: SELECT_MUDANCA,
      })
    ).map(paraMudanca);
    const valorAnterior = valorNaCompetencia(
      id,
      mudancasExistentes,
      competencia
    );
    if (valorCentavos === valorAnterior) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Valor igual ao atual; nada a alterar."
      );
    }
    // Ninguém digita o tipo: EXPANSAO quando o novo valor é maior, CONTRACAO
    // quando é menor — a comparação decide sozinha, contra o valor da
    // competência, não contra a coluna.
    const tipo: Extract<TipoDeMudanca, "EXPANSAO" | "CONTRACAO"> =
      valorCentavos > valorAnterior ? "EXPANSAO" : "CONTRACAO";

    // A coluna só avança quando a competência alvo é a mais recente já
    // registrada: gravar uma correção retroativa (competência anterior à
    // última) não pode mexer no que o cliente paga hoje.
    const maiorCompetenciaRegistrada = mudancasExistentes.reduce(
      (max, mud) => (mud.competencia > max ? mud.competencia : max),
      ""
    );
    const avancaColuna = competencia >= maiorCompetenciaRegistrada;

    await database.$transaction(async (tx) => {
      if (avancaColuna) {
        // Guardado pelo valor lido: fecha a corrida entre a leitura acima e
        // esta escrita, igual a `baixarTitulo`/`cancelarTitulo`. Quando não
        // avança, não há nada para o `updateMany` fazer — a transação segue
        // só com o `create` do histórico.
        const atualizado = await tx.assinaturaDoTenant.updateMany({
          where: {
            id,
            tenantId: SYSTEM_TENANT_ID,
            valorMensalCentavos: valorColuna,
          },
          data: { valorMensalCentavos: valorCentavos },
        });
        if (atualizado.count === 0) {
          throw new StaffAuthError(
            "FORBIDDEN",
            "Assinatura foi alterada por outra operação; recarregue."
          );
        }
      }
      await tx.mudancaDeAssinatura.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          assinaturaId: id,
          competencia,
          tipo,
          deCentavos: valorAnterior,
          paraCentavos: valorCentavos,
          motivo,
          autorId: staff.userId,
          autorNome: staff.name,
        },
      });
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.assinatura.alterarValor",
      entityType: "AssinaturaDoTenant",
      entityId: id,
      target: tipo,
      diff: [
        ["valorMensalCentavos", String(valorAnterior), String(valorCentavos)],
      ],
    });
    revalidatePath(ROTA);
    return { id };
  });
}

const EncerrarAssinaturaSchema = z.object({
  id: z.string().min(1),
  data: z.iso.date("Data no formato AAAA-MM-DD."),
  motivo: z.string().trim().min(10, "Motivo com pelo menos 10 caracteres."),
});

export async function encerrarAssinatura(
  input: z.infer<typeof EncerrarAssinaturaSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { id, data, motivo } = EncerrarAssinaturaSchema.parse(input);

    const assinatura = await database.assinaturaDoTenant.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      select: { id: true },
    });
    if (!assinatura) {
      throw new StaffAuthError("FORBIDDEN", "Assinatura não encontrada.");
    }
    const competencia = data.slice(0, 7);

    // Mesma regra de `alterarValor`: `deCentavos` vem do histórico na
    // competência do encerramento, não da coluna corrente.
    const mudancasExistentes = (
      await database.mudancaDeAssinatura.findMany({
        where: { assinaturaId: id, tenantId: SYSTEM_TENANT_ID },
        select: SELECT_MUDANCA,
      })
    ).map(paraMudanca);
    const deCentavos = valorNaCompetencia(id, mudancasExistentes, competencia);

    await database.$transaction(async (tx) => {
      // Guardado por `encerradaEm: null`: uma assinatura já encerrada não
      // encerra de novo nem duplica a linha CHURN.
      const encerrada = await tx.assinaturaDoTenant.updateMany({
        where: { id, tenantId: SYSTEM_TENANT_ID, encerradaEm: null },
        data: {
          encerradaEm: new Date(`${data}T00:00:00Z`),
          motivoEncerramento: motivo,
        },
      });
      if (encerrada.count === 0) {
        throw new StaffAuthError("FORBIDDEN", "Assinatura já encerrada.");
      }
      await tx.mudancaDeAssinatura.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          assinaturaId: id,
          competencia,
          tipo: "CHURN",
          deCentavos,
          paraCentavos: 0,
          motivo,
          autorId: staff.userId,
          autorNome: staff.name,
        },
      });
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.assinatura.encerrar",
      entityType: "AssinaturaDoTenant",
      entityId: id,
      target: "CHURN",
    });
    revalidatePath(ROTA);
    return { id };
  });
}

const SalvarCreditoSchema = z.object({
  clienteSlug: z.string().trim().min(1, "Cliente obrigatório."),
  competencia: z
    .string()
    .refine(competenciaValida, "Competência no formato AAAA-MM."),
  consumidos: z
    .number()
    .int()
    .nonnegative("Consumo não aceita valor negativo."),
});

export async function salvarCreditoDoMes(
  input: z.infer<typeof SalvarCreditoSchema>
): Promise<Result<{ clienteSlug: string; competencia: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { clienteSlug, competencia, consumidos } =
      SalvarCreditoSchema.parse(input);

    // Franquia e taxa vêm daqui, nunca do cliente: são o que a assinatura tem
    // hoje, congeladas na linha do mês (mesma ideia de `precoCreditoExtraCentavos`
    // no schema).
    const assinatura = await database.assinaturaDoTenant.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, clienteSlug, encerradaEm: null },
      select: {
        creditosMesIncluidos: true,
        precoCreditoExtraCentavos: true,
        tetoExcedenteCentavos: true,
      },
    });
    if (!assinatura) {
      throw new StaffAuthError("FORBIDDEN", "Cliente sem assinatura ativa.");
    }

    const { cobrado, reprimido } = excedenteDoMes(
      assinatura.creditosMesIncluidos,
      consumidos,
      assinatura.precoCreditoExtraCentavos,
      assinatura.tetoExcedenteCentavos
    );

    await database.creditoDoMes.upsert({
      where: {
        tenantId_clienteSlug_competencia: {
          tenantId: SYSTEM_TENANT_ID,
          clienteSlug,
          competencia,
        },
      },
      create: {
        tenantId: SYSTEM_TENANT_ID,
        clienteSlug,
        competencia,
        franquia: assinatura.creditosMesIncluidos,
        consumidos,
        precoCreditoExtraCentavos: assinatura.precoCreditoExtraCentavos,
        excedenteCentavos: cobrado,
        excedenteReprimidoCentavos: reprimido,
      },
      update: {
        franquia: assinatura.creditosMesIncluidos,
        consumidos,
        precoCreditoExtraCentavos: assinatura.precoCreditoExtraCentavos,
        excedenteCentavos: cobrado,
        excedenteReprimidoCentavos: reprimido,
      },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.credito.salvar",
      entityType: "CreditoDoMes",
      entityId: `${clienteSlug}:${competencia}`,
      target: `${clienteSlug} · ${competencia}`,
      diff: [["consumidos", "", String(consumidos)]],
    });
    revalidatePath(ROTA);
    return { clienteSlug, competencia };
  });
}
