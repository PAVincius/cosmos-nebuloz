"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  CRITERIOS,
  pontuar,
  type Resposta,
  RUBRICA_ATUAL,
  rubricaDe,
} from "@/lib/growth/maturidade";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { cortar, janela, type OpcoesDePagina } from "@/lib/paginacao";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Growth · diagnóstico de maturidade de IA. Rubrica e contas em
 * `lib/growth/maturidade.ts` — este módulo só persiste e audita.
 *
 * O invariante que carrega o arquivo: avaliação concluída não aceita mais
 * resposta. Sem isso o `scoreGeral` congelado no fecho passaria a discordar
 * das respostas guardadas, e o número que foi ao cliente viraria ficção — o
 * mesmo motivo pelo qual o funil não deixa lead ganho voltar a mover.
 *
 * `rubricaVersao` é carimbada no nascimento e nunca reescrita: a avaliação
 * pertence à rubrica que a começou, não à que está em vigor quando alguém a
 * reabre.
 */

export type AvaliacaoRow = {
  id: string;
  organizacao: string;
  leadId: string | null;
  leadNome: string | null;
  rubricaVersao: string;
  status: string;
  scoreGeral: number | null;
  nivelGeral: string | null;
  respondidos: number;
  autorNome: string | null;
  concluidaEm: string | null;
  criadoEm: string;
};

export type RespostaRow = {
  criterioId: string;
  nivel: number;
  nota: string | null;
};

export type AvaliacaoDetalhe = AvaliacaoRow & { respostas: RespostaRow[] };

/** Até o teto (`lib/paginacao.ts`); `temMais` diz se há próxima página. */
export async function listarAvaliacoes(opcoes?: OpcoesDePagina): Promise<
  Result<{
    avaliacoes: AvaliacaoRow[];
    totalDeCriterios: number;
    temMais: boolean;
  }>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const linhas = await database.avaliacaoDeMaturidade.findMany({
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: { criadoEm: "desc" },
      ...janela(opcoes),
      select: {
        id: true,
        organizacao: true,
        leadId: true,
        rubricaVersao: true,
        status: true,
        scoreGeral: true,
        nivelGeral: true,
        autorNome: true,
        concluidaEm: true,
        criadoEm: true,
        lead: { select: { nome: true } },
        _count: { select: { respostas: true } },
      },
    });

    const { itens, temMais } = cortar(linhas, opcoes);
    return {
      temMais,
      avaliacoes: itens.map((a) => ({
        id: a.id,
        organizacao: a.organizacao,
        leadId: a.leadId,
        leadNome: a.lead?.nome ?? null,
        rubricaVersao: a.rubricaVersao,
        status: a.status,
        scoreGeral: a.scoreGeral,
        nivelGeral: a.nivelGeral,
        respondidos: a._count.respostas,
        autorNome: a.autorNome,
        concluidaEm: a.concluidaEm ? a.concluidaEm.toISOString() : null,
        criadoEm: a.criadoEm.toISOString(),
      })),
      totalDeCriterios: CRITERIOS.length,
    };
  });
}

export async function lerAvaliacao(
  id: string
): Promise<Result<AvaliacaoDetalhe>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const a = await database.avaliacaoDeMaturidade.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      select: {
        id: true,
        organizacao: true,
        leadId: true,
        rubricaVersao: true,
        status: true,
        scoreGeral: true,
        nivelGeral: true,
        autorNome: true,
        concluidaEm: true,
        criadoEm: true,
        lead: { select: { nome: true } },
        respostas: {
          select: { criterioId: true, nivel: true, nota: true },
        },
      },
    });
    if (!a) {
      throw new StaffAuthError("NOT_FOUND", "Essa avaliação não existe.");
    }

    return {
      id: a.id,
      organizacao: a.organizacao,
      leadId: a.leadId,
      leadNome: a.lead?.nome ?? null,
      rubricaVersao: a.rubricaVersao,
      status: a.status,
      scoreGeral: a.scoreGeral,
      nivelGeral: a.nivelGeral,
      respondidos: a.respostas.length,
      autorNome: a.autorNome,
      concluidaEm: a.concluidaEm ? a.concluidaEm.toISOString() : null,
      criadoEm: a.criadoEm.toISOString(),
      respostas: a.respostas,
    };
  });
}

const CriarSchema = z.object({
  organizacao: z.string().trim().min(2).max(160),
  leadId: z.string().min(1).optional(),
});

export async function criarAvaliacao(
  input: z.input<typeof CriarSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = CriarSchema.parse(input);

    // O lead precisa existir e ser deste back-office: `leadId` vem do cliente,
    // e aceitar id de outro tenant ligaria o diagnóstico ao funil errado.
    if (dados.leadId) {
      const lead = await database.lead.findFirst({
        where: { id: dados.leadId, tenantId: SYSTEM_TENANT_ID },
        select: { id: true },
      });
      if (!lead) {
        throw new StaffAuthError("FORBIDDEN", "Esse lead não existe.");
      }
    }

    const criada = await database.avaliacaoDeMaturidade.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        organizacao: dados.organizacao,
        leadId: dados.leadId ?? null,
        rubricaVersao: RUBRICA_ATUAL,
        autorId: staff.userId,
        autorNome: staff.name,
      },
      select: { id: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "avaliacao_maturidade",
      entityId: criada.id,
      target: dados.organizacao,
    });

    revalidatePath("/growth/readiness");
    return criada;
  });
}

const ResponderSchema = z.object({
  avaliacaoId: z.string().min(1),
  criterioId: z.string().min(1),
  nivel: z.number().int().min(0).max(4),
  nota: z.string().trim().max(600).optional(),
});

export async function responder(
  input: z.input<typeof ResponderSchema>
): Promise<Result<{ criterioId: string; nivel: number }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = ResponderSchema.parse(input);

    if (!CRITERIOS.some((c) => c.id === dados.criterioId)) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Esse critério não existe na rubrica."
      );
    }

    // Lido antes de escrever pelo mesmo motivo do funil: o estado que autoriza
    // a escrita é o que está no banco, não o que a tela achava que estava.
    const avaliacao = await database.avaliacaoDeMaturidade.findFirst({
      where: { id: dados.avaliacaoId, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, status: true },
    });
    if (!avaliacao) {
      throw new StaffAuthError("FORBIDDEN", "Essa avaliação não existe.");
    }
    if (avaliacao.status !== "RASCUNHO") {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Avaliação concluída não aceita mais resposta."
      );
    }

    await database.respostaDeMaturidade.upsert({
      where: {
        avaliacaoId_criterioId: {
          avaliacaoId: avaliacao.id,
          criterioId: dados.criterioId,
        },
      },
      create: {
        avaliacaoId: avaliacao.id,
        tenantId: SYSTEM_TENANT_ID,
        criterioId: dados.criterioId,
        nivel: dados.nivel,
        nota: dados.nota || null,
      },
      update: { nivel: dados.nivel, nota: dados.nota || null },
    });

    revalidatePath("/growth/readiness");
    return { criterioId: dados.criterioId, nivel: dados.nivel };
  });
}

const ConcluirSchema = z.object({ avaliacaoId: z.string().min(1) });

/**
 * Fecha a avaliação e congela score e nível.
 *
 * Congela em vez de recalcular na leitura porque a rubrica evolui: recalcular
 * faria o diagnóstico entregue em março mudar de número em junho, sem ninguém
 * ter respondido nada diferente.
 */
export async function concluirAvaliacao(
  input: z.input<typeof ConcluirSchema>
): Promise<Result<{ id: string; scoreGeral: number; nivelGeral: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { avaliacaoId } = ConcluirSchema.parse(input);

    const avaliacao = await database.avaliacaoDeMaturidade.findFirst({
      where: { id: avaliacaoId, tenantId: SYSTEM_TENANT_ID },
      select: {
        id: true,
        organizacao: true,
        status: true,
        rubricaVersao: true,
        respostas: { select: { criterioId: true, nivel: true } },
      },
    });
    if (!avaliacao) {
      throw new StaffAuthError("FORBIDDEN", "Essa avaliação não existe.");
    }
    if (avaliacao.status !== "RASCUNHO") {
      throw new StaffAuthError("FORBIDDEN", "Essa avaliação já foi concluída.");
    }

    const rubrica = rubricaDe(avaliacao.rubricaVersao);
    if (!rubrica) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `A rubrica ${avaliacao.rubricaVersao} não existe mais nesta versão do código.`
      );
    }

    const resultado = pontuar(avaliacao.respostas as Resposta[], rubrica);
    if (resultado.scoreGeral === null || resultado.nivelGeral === null) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Faltam ${resultado.total - resultado.respondidos} de ${resultado.total} critérios. Avaliação incompleta não vira score.`
      );
    }

    await database.avaliacaoDeMaturidade.update({
      where: { id: avaliacao.id },
      data: {
        status: "CONCLUIDA",
        scoreGeral: resultado.scoreGeral,
        nivelGeral: resultado.nivelGeral,
        concluidaEm: new Date(),
      },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "avaliacao_maturidade",
      entityId: avaliacao.id,
      target: avaliacao.organizacao,
      diff: [["status", "RASCUNHO", `CONCLUIDA · ${resultado.scoreGeral}`]],
    });

    revalidatePath("/growth/readiness");
    return {
      id: avaliacao.id,
      scoreGeral: resultado.scoreGeral,
      nivelGeral: resultado.nivelGeral,
    };
  });
}
