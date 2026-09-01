"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { gerarNumeroProposta } from "@/app/actions/proposals";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Funil comercial — a metade que Proposal não cobre: LEAD, DISCOVERY,
 * EVALUATION. Os dois estágios seguintes (enviada, fechada) já são
 * `Proposal.status`.
 *
 * O invariante que carrega este módulo: lead convertido (`propostaId`
 * gravado) ou perdido (`perdidoEm` gravado) não volta a mover de estágio. Sem
 * isso, reabrir um funil que já fechou faria a mesma venda contar duas vezes
 * — ou o pipeline "aberto" incluir o que já morreu.
 */

const ESTAGIOS = ["LEAD", "DISCOVERY", "EVALUATION"] as const;
type Estagio = (typeof ESTAGIOS)[number];

export type LeadRow = {
  id: string;
  nome: string;
  contatoNome: string | null;
  contatoEmail: string | null;
  estagio: string;
  origem: string | null;
  donoNome: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  propostaId: string | null;
  perdidoEm: string | null;
  motivoPerda: string | null;
  criadoEm: string;
};

export async function listarLeads(): Promise<Result<LeadRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const linhas = await database.lead.findMany({
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        nome: true,
        contatoNome: true,
        contatoEmail: true,
        estagio: true,
        origem: true,
        donoNome: true,
        proximaAcao: true,
        proximaAcaoEm: true,
        propostaId: true,
        perdidoEm: true,
        motivoPerda: true,
        criadoEm: true,
      },
    });

    return linhas.map((l) => ({
      ...l,
      proximaAcaoEm: l.proximaAcaoEm ? l.proximaAcaoEm.toISOString() : null,
      perdidoEm: l.perdidoEm ? l.perdidoEm.toISOString() : null,
      criadoEm: l.criadoEm.toISOString(),
    }));
  });
}

const CriarSchema = z.object({
  nome: z.string().min(2).max(160),
  contatoNome: z.string().max(160).optional(),
  contatoEmail: z.string().email().max(160).optional(),
  origem: z.string().max(160).optional(),
});

export async function criarLead(
  input: z.input<typeof CriarSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = CriarSchema.parse(input);

    // `donoId`/`donoNome` seguem `criadoPorId`/`criadoPorNome` de Proposal:
    // quem cria é quem toca, no nascimento. Reatribuir dono é operação que
    // este V1 não oferece — não foi pedida.
    const lead = await database.lead.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        nome: dados.nome,
        contatoNome: dados.contatoNome ?? null,
        contatoEmail: dados.contatoEmail ?? null,
        origem: dados.origem ?? null,
        donoId: staff.userId,
        donoNome: staff.name,
      },
      select: { id: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "lead",
      entityId: lead.id,
      target: dados.nome,
    });

    revalidatePath("/funil");
    return lead;
  });
}

/** Busca o lead escopado ao tenant e recusa se ele já saiu do funil — o
 *  mesmo par de checagem que `moverEstagio`, `registrarProximaAcao` e
 *  `marcarPerdido` fariam cada um por conta própria. Centralizado para as
 *  três mensagens não divergirem sozinhas com o tempo. */
async function buscarLeadAberto(id: string) {
  const lead = await database.lead.findFirst({
    where: { id, tenantId: SYSTEM_TENANT_ID },
    select: {
      id: true,
      nome: true,
      estagio: true,
      contatoEmail: true,
      propostaId: true,
      perdidoEm: true,
    },
  });
  if (!lead) {
    throw new StaffAuthError("FORBIDDEN", "Lead não encontrado.");
  }
  if (lead.propostaId) {
    throw new StaffAuthError(
      "FORBIDDEN",
      `${lead.nome} já foi convertido em proposta — mexer no estágio reabriria um funil que já fechou.`
    );
  }
  if (lead.perdidoEm) {
    throw new StaffAuthError(
      "FORBIDDEN",
      `${lead.nome} foi marcado como perdido — reabrir o funil esconderia por que ele saiu. Crie um lead novo se a conversa recomeçar.`
    );
  }
  return lead;
}

const MoverEstagioSchema = z.object({
  id: z.string().min(1),
  estagio: z.enum(ESTAGIOS),
});

export async function moverEstagio(
  input: z.input<typeof MoverEstagioSchema>
): Promise<Result<{ id: string; estagio: Estagio }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = MoverEstagioSchema.parse(input);
    const lead = await buscarLeadAberto(dados.id);

    await database.lead.update({
      where: { id: lead.id },
      data: { estagio: dados.estagio },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "lead",
      entityId: lead.id,
      target: lead.nome,
      diff: [["estagio", lead.estagio, dados.estagio]],
    });

    revalidatePath("/funil");
    return { id: lead.id, estagio: dados.estagio };
  });
}

const ProximaAcaoSchema = z.object({
  id: z.string().min(1),
  proximaAcao: z.string().trim().min(1).max(200),
  proximaAcaoEm: z.coerce.date(),
});

export async function registrarProximaAcao(
  input: z.input<typeof ProximaAcaoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = ProximaAcaoSchema.parse(input);
    const lead = await buscarLeadAberto(dados.id);

    await database.lead.update({
      where: { id: lead.id },
      data: {
        proximaAcao: dados.proximaAcao,
        proximaAcaoEm: dados.proximaAcaoEm,
      },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "lead",
      entityId: lead.id,
      target: lead.nome,
      diff: [["proximaAcao", "—", dados.proximaAcao]],
    });

    revalidatePath("/funil");
    return { id: lead.id };
  });
}

const MarcarPerdidoSchema = z.object({
  id: z.string().min(1),
  motivoPerda: z
    .string()
    .trim()
    .min(
      1,
      "Lead perdido sem motivo não ensina nada sobre preço nem ICP para o próximo."
    )
    .max(500),
});

export async function marcarPerdido(
  input: z.input<typeof MarcarPerdidoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = MarcarPerdidoSchema.parse(input);
    const lead = await buscarLeadAberto(dados.id);

    await database.lead.update({
      where: { id: lead.id },
      data: { perdidoEm: new Date(), motivoPerda: dados.motivoPerda },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "lead",
      entityId: lead.id,
      target: lead.nome,
      diff: [["perdido", "não", dados.motivoPerda]],
    });

    revalidatePath("/funil");
    return { id: lead.id };
  });
}

const ConverterSchema = z.object({ id: z.string().min(1) });

/**
 * Converte o lead numa proposta em rascunho.
 *
 * Nasce sem item: quem escolhe o que vender é o gerador (`/propostas/<id>`),
 * não esta action — ela só fecha o elo comercial (funil → proposta) para
 * ninguém redigitar nome e e-mail do zero. O número vem de
 * `gerarNumeroProposta`, a mesma rotina de `createProposalAction`: dois
 * geradores de número para o mesmo tipo de documento seriam dois jeitos de
 * quebrar um identificador que aparece em contrato.
 */
export async function converterEmProposta(
  input: z.input<typeof ConverterSchema>
): Promise<Result<{ id: string; numero: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = ConverterSchema.parse(input);
    const lead = await buscarLeadAberto(dados.id);

    const numero = gerarNumeroProposta();

    const proposta = await database.$transaction(async (tx) => {
      const p = await tx.proposal.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          numero,
          titulo: lead.nome,
          clienteNome: lead.nome,
          contatoEmail: lead.contatoEmail,
          criadoPorId: staff.userId,
          criadoPorNome: staff.name,
        },
        select: { id: true, numero: true },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { propostaId: p.id },
      });

      return p;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "converted",
      entityType: "lead",
      entityId: lead.id,
      target: `${lead.nome} → ${proposta.numero}`,
      diff: [["propostaId", "—", proposta.id]],
    });

    revalidatePath("/funil");
    revalidatePath("/propostas");
    return proposta;
  });
}
