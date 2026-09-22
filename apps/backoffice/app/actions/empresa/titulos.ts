"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertContaAtiva,
  type ContaView,
  contasDoPlano,
} from "@/lib/empresa/consultas";
import { competenciaValida } from "@/lib/empresa/financeiro";
import type { TituloRow } from "@/lib/empresa/livro";
import { contaValida } from "@/lib/empresa/plano-de-contas";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { cortar, janela } from "@/lib/paginacao";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Títulos a pagar/receber (spec 2026-09-06 §3): o título é a promessa, o
 * lançamento (livro.ts) é o fato. `baixarTitulo` cria os dois na mesma
 * transação — sem isso, uma falha entre as duas escritas deixaria um título
 * BAIXADO sem o lançamento que prova a baixa, ou um lançamento órfão sem
 * título aberto para o gerar.
 */

const ROTA = "/empresa/financeiro";

const SELECT_TITULO = {
  id: true,
  tipo: true,
  descricao: true,
  contraparte: true,
  conta: true,
  valorCentavos: true,
  emissao: true,
  vencimento: true,
  status: true,
  baixadoEm: true,
  competenciaBaixa: true,
  motivoCancelamento: true,
  clienteSlug: true,
} as const;

function paraLinha(t: {
  id: string;
  tipo: string;
  descricao: string;
  contraparte: string;
  conta: string;
  valorCentavos: number;
  emissao: Date;
  vencimento: Date;
  status: string;
  baixadoEm: Date | null;
  competenciaBaixa: string | null;
  motivoCancelamento: string | null;
  clienteSlug: string | null;
}): TituloRow {
  return {
    id: t.id,
    tipo: t.tipo as TituloRow["tipo"],
    descricao: t.descricao,
    contraparte: t.contraparte,
    conta: t.conta,
    valorCentavos: t.valorCentavos,
    emissao: t.emissao.toISOString().slice(0, 10),
    vencimento: t.vencimento.toISOString().slice(0, 10),
    status: t.status as TituloRow["status"],
    baixadoEm: t.baixadoEm ? t.baixadoEm.toISOString().slice(0, 10) : null,
    competenciaBaixa: t.competenciaBaixa,
    motivoCancelamento: t.motivoCancelamento,
    clienteSlug: t.clienteSlug,
  };
}

const ListarTitulosSchema = z.object({
  tipo: z.enum(["PAGAR", "RECEBER"]).optional(),
  /** Inclui baixados e cancelados mexidos há mais de 90 dias. */
  antigos: z.boolean().optional(),
  pagina: z.number().int().min(1).optional(),
});

const NOVENTA_DIAS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Títulos até o teto (`lib/paginacao.ts`). A lista crescia para sempre: todo
 * título baixado ou cancelado ficava na tela. Por padrão vem o que ainda pede
 * ação — o que está em aberto — e o que foi baixado ou cancelado nos últimos
 * 90 dias (`atualizadoEm`: é a baixa ou o cancelamento que o mexe por último);
 * `antigos` tira o recorte. As duas formas param no teto, e `temMais` diz se
 * há próxima página.
 */
export async function listarTitulos(
  input: z.input<typeof ListarTitulosSchema>
): Promise<
  Result<{ titulos: TituloRow[]; contas: ContaView[]; temMais: boolean }>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const { tipo, antigos, pagina } = ListarTitulosSchema.parse(input);
    const opcoes = { pagina };
    const recorte = antigos
      ? {}
      : {
          OR: [
            { status: "ABERTO" },
            {
              atualizadoEm: {
                gte: new Date(Date.now() - NOVENTA_DIAS_MS),
              },
            },
          ],
        };

    const [linhas, contas] = await Promise.all([
      database.titulo.findMany({
        where: {
          tenantId: SYSTEM_TENANT_ID,
          ...(tipo ? { tipo } : {}),
          ...recorte,
        },
        orderBy: { vencimento: "asc" },
        ...janela(opcoes),
        select: SELECT_TITULO,
      }),
      contasDoPlano(),
    ]);

    const { itens, temMais } = cortar(linhas.map(paraLinha), opcoes);
    return { titulos: itens, contas, temMais };
  });
}

const TituloSchema = z
  .object({
    tipo: z.enum(["PAGAR", "RECEBER"]),
    descricao: z
      .string()
      .trim()
      .min(2, "Descrição com pelo menos 2 caracteres.")
      .max(120, "Descrição com no máximo 120 caracteres."),
    contraparte: z.string().trim().min(1, "Contraparte obrigatória.").max(80),
    conta: z.string().refine(contaValida, "Conta fora do plano de contas."),
    valorCentavos: z
      .number()
      .int()
      .positive("Valor tem que ser maior que zero."),
    emissao: z.iso.date("Data no formato AAAA-MM-DD."),
    vencimento: z.iso.date("Data no formato AAAA-MM-DD."),
    clienteSlug: z.string().trim().max(80).nullable().optional(),
  })
  .refine((d) => d.vencimento >= d.emissao, {
    message: "Vencimento não pode ser antes da emissão.",
    path: ["vencimento"],
  });

export async function criarTitulo(
  input: z.infer<typeof TituloSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = TituloSchema.parse(input);
    await assertContaAtiva(dados.conta);

    const criado = await database.titulo.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        tipo: dados.tipo,
        descricao: dados.descricao,
        contraparte: dados.contraparte,
        conta: dados.conta,
        valorCentavos: dados.valorCentavos,
        emissao: new Date(`${dados.emissao}T00:00:00Z`),
        vencimento: new Date(`${dados.vencimento}T00:00:00Z`),
        clienteSlug: dados.clienteSlug ?? null,
      },
      select: { id: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.titulo.criar",
      entityType: "Titulo",
      entityId: criado.id,
      target: `${dados.tipo} · ${dados.contraparte} · ${dados.descricao}`,
      diff: [["valorCentavos", "", String(dados.valorCentavos)]],
    });
    revalidatePath(ROTA);
    return criado;
  });
}

const BaixarTituloSchema = z.object({
  id: z.string().min(1),
  data: z.iso.date("Data no formato AAAA-MM-DD."),
  competencia: z
    .string()
    .refine(competenciaValida, "Competência no formato AAAA-MM."),
});

export async function baixarTitulo(
  input: z.infer<typeof BaixarTituloSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { id, data, competencia } = BaixarTituloSchema.parse(input);

    const titulo = await database.titulo.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      select: {
        tipo: true,
        descricao: true,
        contraparte: true,
        conta: true,
        valorCentavos: true,
      },
    });
    if (!titulo) {
      throw new StaffAuthError("FORBIDDEN", "Título não encontrado.");
    }
    await assertContaAtiva(titulo.conta);

    // `updateMany` guardado por `status: "ABERTO"` fecha a corrida entre a
    // leitura de `titulo` acima e esta escrita: duas baixas concorrentes do
    // mesmo título só uma passa. O `lancamento.create` na mesma transação é
    // o que impede um título BAIXADO sem o fato que prova a baixa.
    await database.$transaction(async (tx) => {
      const baixa = await tx.titulo.updateMany({
        where: { id, tenantId: SYSTEM_TENANT_ID, status: "ABERTO" },
        data: {
          status: "BAIXADO",
          baixadoEm: new Date(`${data}T00:00:00Z`),
          competenciaBaixa: competencia,
        },
      });
      if (baixa.count === 0) {
        throw new StaffAuthError(
          "FORBIDDEN",
          "Título já baixado ou cancelado."
        );
      }
      return await tx.lancamento.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          competencia,
          data: new Date(`${data}T00:00:00Z`),
          conta: titulo.conta,
          descricao: titulo.descricao,
          valorCentavos: titulo.valorCentavos,
          contraparte: titulo.contraparte,
          tituloId: id,
        },
      });
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.titulo.baixar",
      entityType: "Titulo",
      entityId: id,
      target: `${titulo.tipo} · ${titulo.contraparte} · ${titulo.descricao}`,
    });
    revalidatePath(ROTA);
    return { id };
  });
}

const CancelarTituloSchema = z.object({
  id: z.string().min(1),
  motivo: z
    .string()
    .trim()
    .min(10, "Motivo do cancelamento com pelo menos 10 caracteres."),
});

export async function cancelarTitulo(
  input: z.infer<typeof CancelarTituloSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { id, motivo } = CancelarTituloSchema.parse(input);

    const titulo = await database.titulo.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      select: { tipo: true, descricao: true, contraparte: true },
    });
    if (!titulo) {
      throw new StaffAuthError("FORBIDDEN", "Título não encontrado.");
    }

    // Mesma proteção de `baixarTitulo`: o `where` guarda `status: "ABERTO"`
    // para não cancelar um título já baixado nem duplicar o cancelamento.
    const atualizado = await database.titulo.updateMany({
      where: { id, tenantId: SYSTEM_TENANT_ID, status: "ABERTO" },
      data: { status: "CANCELADO", motivoCancelamento: motivo },
    });
    if (atualizado.count === 0) {
      throw new StaffAuthError("FORBIDDEN", "Título já baixado ou cancelado.");
    }

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.financeiro.titulo.cancelar",
      entityType: "Titulo",
      entityId: id,
      target: `${titulo.tipo} · ${titulo.contraparte} · ${titulo.descricao}`,
    });
    revalidatePath(ROTA);
    return { id };
  });
}
