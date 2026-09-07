"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { competenciaValida } from "@/lib/empresa/financeiro";
import type { LinhaDoLivro } from "@/lib/empresa/livro";
import {
  CAMPOS_INTERVALO,
  competenciasNoIntervalo,
  REFINE_INTERVALO,
} from "@/lib/empresa/periodo";
import { contaValida } from "@/lib/empresa/plano-de-contas";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
  semTeto,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";
import { type ContaView, contasDoPlano } from "./financeiro";

/**
 * Livro-razão (spec 2026-09-06 §3): as linhas de fato, uma por lançamento.
 * `LinhaDoLivro`/`agregarPorMes` (lib/empresa/livro.ts) já existem — aqui só
 * se lê e grava a entrada, igual a `financeiro.ts` faz para o DRE mensal.
 */

const ROTA = "/empresa/financeiro";

const SELECT_LANCAMENTO = {
  id: true,
  competencia: true,
  data: true,
  conta: true,
  descricao: true,
  valorCentavos: true,
  contraparte: true,
  documento: true,
  nota: true,
  tituloId: true,
} as const;

function paraLinha(l: {
  id: string;
  competencia: string;
  data: Date;
  conta: string;
  descricao: string;
  valorCentavos: number;
  contraparte: string | null;
  documento: string | null;
  nota: string | null;
  tituloId: string | null;
}): LinhaDoLivro {
  return {
    id: l.id,
    competencia: l.competencia,
    data: l.data.toISOString().slice(0, 10),
    conta: l.conta,
    descricao: l.descricao,
    valorCentavos: l.valorCentavos,
    contraparte: l.contraparte,
    documento: l.documento,
    nota: l.nota,
    tituloId: l.tituloId,
  };
}

/** A mesma checagem de `salvarLancamento` em financeiro.ts: conta desativada
 *  ou fora do plano não recebe lançamento novo. Exportada porque `titulos.ts`
 *  precisa da mesma garantia — na criação do título e, de novo, na baixa,
 *  já que a conta pode ser desativada entre as duas. */
export async function assertContaAtiva(conta: string): Promise<void> {
  const contaDoPlano = await database.contaDoPlano.findUnique({
    where: { tenantId_conta: { tenantId: SYSTEM_TENANT_ID, conta } },
    select: { ativa: true },
  });
  if (!contaDoPlano?.ativa) {
    throw new StaffAuthError("FORBIDDEN", "Conta desativada ou fora do plano.");
  }
}

const ListarLancamentosSchema = z
  .object({ conta: z.string().optional(), ...CAMPOS_INTERVALO })
  .refine(...REFINE_INTERVALO);

export async function listarLancamentos(
  input: z.input<typeof ListarLancamentosSchema>
): Promise<Result<{ linhas: LinhaDoLivro[]; contas: ContaView[] }>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const { de, ate, conta } = ListarLancamentosSchema.parse(input);
    const comps = semTeto(() => competenciasNoIntervalo({ de, ate }));

    const [linhas, contas] = await Promise.all([
      database.lancamento.findMany({
        where: {
          tenantId: SYSTEM_TENANT_ID,
          competencia: { in: comps },
          ...(conta ? { conta } : {}),
        },
        orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
        select: SELECT_LANCAMENTO,
      }),
      contasDoPlano(),
    ]);

    return { linhas: linhas.map(paraLinha), contas };
  });
}

const LancamentoSchema = z.object({
  competencia: z
    .string()
    .refine(competenciaValida, "Competência no formato AAAA-MM."),
  data: z.iso.date("Data no formato AAAA-MM-DD."),
  conta: z.string().refine(contaValida, "Conta fora do plano de contas."),
  descricao: z
    .string()
    .trim()
    .min(2, "Descrição com pelo menos 2 caracteres.")
    .max(120, "Descrição com no máximo 120 caracteres."),
  valorCentavos: z.number().int().positive("Valor tem que ser maior que zero."),
  contraparte: z.string().trim().max(80).nullable(),
  documento: z.string().trim().max(60).nullable(),
  nota: z.string().trim().max(500).nullable(),
});

export async function criarLancamento(
  input: z.infer<typeof LancamentoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = LancamentoSchema.parse(input);
    await assertContaAtiva(dados.conta);

    const criado = await database.lancamento.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        competencia: dados.competencia,
        data: new Date(`${dados.data}T00:00:00Z`),
        conta: dados.conta,
        descricao: dados.descricao,
        valorCentavos: dados.valorCentavos,
        contraparte: dados.contraparte,
        documento: dados.documento,
        nota: dados.nota,
      },
      select: { id: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.lancamento.criar",
      entityType: "Lancamento",
      entityId: criado.id,
      target: `conta ${dados.conta} · ${dados.competencia}`,
      diff: [["valorCentavos", "", String(dados.valorCentavos)]],
    });
    revalidatePath(ROTA);
    return criado;
  });
}

const AtualizarLancamentoSchema = LancamentoSchema.extend({
  id: z.string().min(1),
});

export async function atualizarLancamento(
  input: z.infer<typeof AtualizarLancamentoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { id, ...dados } = AtualizarLancamentoSchema.parse(input);
    await assertContaAtiva(dados.conta);

    const atualizado = await database.lancamento.updateMany({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      data: {
        competencia: dados.competencia,
        data: new Date(`${dados.data}T00:00:00Z`),
        conta: dados.conta,
        descricao: dados.descricao,
        valorCentavos: dados.valorCentavos,
        contraparte: dados.contraparte,
        documento: dados.documento,
        nota: dados.nota,
      },
    });
    if (atualizado.count === 0) {
      throw new StaffAuthError("FORBIDDEN", "Lançamento não encontrado.");
    }

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.lancamento.atualizar",
      entityType: "Lancamento",
      entityId: id,
      target: `conta ${dados.conta} · ${dados.competencia}`,
      diff: [["valorCentavos", "", String(dados.valorCentavos)]],
    });
    revalidatePath(ROTA);
    return { id };
  });
}

const ExcluirLancamentoSchema = z.object({ id: z.string().min(1) });

export async function excluirLancamento(
  input: z.infer<typeof ExcluirLancamentoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { id } = ExcluirLancamentoSchema.parse(input);

    const linha = await database.lancamento.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      select: { conta: true, competencia: true, tituloId: true },
    });
    if (!linha) {
      throw new StaffAuthError("FORBIDDEN", "Lançamento não encontrado.");
    }
    if (linha.tituloId !== null) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Lançamento veio de um título; cancele o título."
      );
    }

    await database.lancamento.deleteMany({
      where: { id, tenantId: SYSTEM_TENANT_ID },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.lancamento.excluir",
      entityType: "Lancamento",
      entityId: id,
      target: `conta ${linha.conta} · ${linha.competencia}`,
    });
    revalidatePath(ROTA);
    return { id };
  });
}
