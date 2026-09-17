"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requestPlatformApproval } from "@/app/actions/approvals";
import {
  gerarNumeroProposta,
  LIMITE_DESCONTO_SEM_APROVACAO,
} from "@/lib/comercial";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Propostas comerciais.
 *
 * A regra que carrega este módulo é o gate de desconto: acima do limite a
 * proposta NÃO é enviada no clique — ela entra na mesma fila de
 * `PlatformApproval` das outras operações sensíveis do painel.
 *
 * O gate mora no servidor, não na tela. Um gate que a UI aplica e a action não
 * é pior que gate nenhum: dá a sensação de controle sem o controle, e some no
 * dia em que alguém chamar a action de outro lugar.
 */

export type ProposalRow = {
  id: string;
  numero: string;
  titulo: string;
  cliente: string;
  status: string;
  descontoPercent: number;
  totalCentavos: number;
  /** Gravado no escopo — é o que o funil soma. Nulo nas propostas anteriores
   *  ao gerador, que só tinham itens de serviço. */
  acvCentavos: number;
  criadoEm: string;
};

export async function listProposals(): Promise<Result<ProposalRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const linhas = await database.proposal.findMany({
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        numero: true,
        titulo: true,
        clienteNome: true,
        status: true,
        descontoPercent: true,
        totalCentavos: true,
        acvCentavos: true,
        criadoEm: true,
      },
    });

    return linhas.map((p) => ({
      id: p.id,
      numero: p.numero,
      titulo: p.titulo,
      // Prospect sem tenant ainda é o caso comum — é assim que se ganha o
      // cliente. Sem este fallback a linha apareceria sem dizer para quem é.
      cliente: p.clienteNome ?? "—",
      status: p.status,
      descontoPercent: p.descontoPercent,
      totalCentavos: p.totalCentavos,
      acvCentavos: p.acvCentavos,
      criadoEm: p.criadoEm.toISOString(),
    }));
  });
}

const CriarSchema = z.object({
  titulo: z.string().min(2).max(160),
  clienteNome: z.string().max(160).optional(),
  clienteTenantId: z.string().optional(),
  descontoPercent: z.number().int().min(0).max(100).optional(),
  itens: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        quantidade: z.number().int().min(1).default(1),
      })
    )
    .min(1, "Uma proposta sem item não tem o que aprovar."),
});

/** Soma os itens e aplica o desconto. Em centavos inteiros do começo ao fim —
 *  dividir por 100 no meio do cálculo é como o centavo se perde. */
function calcularTotal(
  itens: { precoUnitCentavos: number; quantidade: number }[],
  descontoPercent: number
): number {
  const bruto = itens.reduce(
    (s, i) => s + i.precoUnitCentavos * i.quantidade,
    0
  );
  return Math.round(bruto * (1 - descontoPercent / 100));
}

export async function createProposalAction(
  input: z.input<typeof CriarSchema>
): Promise<Result<{ id: string; numero: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = CriarSchema.parse(input);
    const desconto = dados.descontoPercent ?? 0;

    const ids = dados.itens.map((i) => i.serviceId);
    const servicos = await database.service.findMany({
      where: { tenantId: SYSTEM_TENANT_ID, id: { in: ids }, ativo: true },
      select: { id: true, nome: true, precoBaseCentavos: true, ativo: true },
    });

    const porId = new Map(servicos.map((s) => [s.id, s]));
    const faltando = ids.filter((id) => !porId.has(id));
    if (faltando.length > 0) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `${faltando.length === 1 ? "1 item aponta" : `${faltando.length} itens apontam`} para serviço que não está no catálogo ativo. Proposta só monta com o que está à venda.`
      );
    }

    // Descrição e preço são COPIADOS aqui, não referenciados. O preço do
    // catálogo muda com o tempo; reler dali faria uma proposta assinada mudar
    // de valor retroativamente.
    const linhas = dados.itens.map((i, ordem) => {
      const s = porId.get(i.serviceId);
      if (!s) {
        throw new StaffAuthError("FORBIDDEN", "Serviço não encontrado.");
      }
      return {
        serviceId: s.id,
        descricao: s.nome,
        quantidade: i.quantidade,
        precoUnitCentavos: s.precoBaseCentavos,
        ordem,
      };
    });

    const total = calcularTotal(linhas, desconto);
    const numero = gerarNumeroProposta();

    const criada = await database.$transaction(async (tx) => {
      const p = await tx.proposal.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          numero,
          titulo: dados.titulo,
          clienteNome: dados.clienteNome ?? null,
          clienteTenantId: dados.clienteTenantId ?? null,
          descontoPercent: desconto,
          totalCentavos: total,
          criadoPorId: staff.userId,
          criadoPorNome: staff.name,
        },
        select: { id: true, numero: true },
      });

      await tx.proposalItem.createMany({
        data: linhas.map((l) => ({ ...l, proposalId: p.id })),
      });

      return p;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "proposal",
      entityId: criada.id,
      target: `${criada.numero} · ${dados.titulo}`,
    });

    revalidatePath("/propostas");
    return criada;
  });
}

const EnviarSchema = z.object({ id: z.string().min(1) });

/**
 * Envia a proposta — ou a manda para a fila, quando o desconto passa do limite.
 *
 * O total não é recalculado aqui: ele foi congelado na criação. Recalcular no
 * envio faria o valor mudar sozinho se o catálogo tivesse mexido no meio, e uma
 * proposta que muda de valor entre montar e enviar é problema contratual.
 */
export async function submitProposalAction(
  input: z.input<typeof EnviarSchema>
): Promise<Result<{ id: string; status: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = EnviarSchema.parse(input);

    const p = await database.proposal.findFirst({
      where: { id: dados.id, tenantId: SYSTEM_TENANT_ID },
      select: {
        id: true,
        numero: true,
        titulo: true,
        status: true,
        descontoPercent: true,
        totalCentavos: true,
        clienteNome: true,
        clienteTenantId: true,
      },
    });
    if (!p) {
      throw new StaffAuthError("FORBIDDEN", "Proposta não encontrada.");
    }
    if (p.status !== "RASCUNHO") {
      throw new StaffAuthError(
        "FORBIDDEN",
        `${p.numero} está em ${p.status}. Só rascunho pode ser enviado — reenviar mudaria o que o cliente já recebeu.`
      );
    }

    const precisaAprovar = p.descontoPercent > LIMITE_DESCONTO_SEM_APROVACAO;
    const novoStatus = precisaAprovar ? "AGUARDANDO_APROVACAO" : "ENVIADA";

    if (precisaAprovar) {
      // FR-8.2 — motivo e impacto vão junto: quem aprova decide na própria
      // linha da fila, sem abrir a proposta para entender o pedido.
      const pedido = await requestPlatformApproval({
        acao: "enviar_proposta_com_desconto",
        alvoTipo: "proposal",
        alvoId: p.id,
        alvoLabel: `${p.numero} · ${p.titulo}`,
        motivo: `Desconto de ${p.descontoPercent}% em ${p.numero}, acima do limite de ${LIMITE_DESCONTO_SEM_APROVACAO}% que dispensa aprovação.`,
        impacto: `${p.descontoPercent}% sobre a proposta — total já com desconto: ${(p.totalCentavos / 100).toFixed(2)}.`,
        // O que a aprovação executa quando alguém liberar. Sem isto o pedido
        // entrava na fila sem dizer o que fazer com ele, e a proposta ficava
        // presa em AGUARDANDO_APROVACAO para sempre.
        payload: { acao: "submitProposal", proposalId: p.id },
        targetTenantId: p.clienteTenantId ?? undefined,
      });
      if (!pedido.ok) {
        throw new StaffAuthError(
          "FORBIDDEN",
          `Não foi possível enfileirar a aprovação: ${pedido.error}`
        );
      }
    }

    await database.proposal.update({
      where: { id: p.id },
      data: { status: novoStatus },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "proposal",
      entityId: p.id,
      target: `${p.numero} · ${p.titulo}`,
      diff: [["status", p.status, novoStatus]],
    });

    revalidatePath("/propostas");
    revalidatePath("/aprovacoes");
    return { id: p.id, status: novoStatus };
  });
}
