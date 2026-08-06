"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  podeIr,
  ROTULO_STATUS,
  STATUS_ENGAJAMENTO,
  type StatusEngajamento,
  TRANSICOES,
} from "@/lib/delivery";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Engajamentos: contratos de serviço por ESCOPO FECHADO.
 *
 * Não há campo de hora aqui de propósito. Valor e entrega são acordados na
 * assinatura e não variam com o esforço gasto — quem mede esforço é a alocação
 * de pessoa, e ela serve para saber se o escopo cabe, não para faturar.
 */

export type EngagementRow = {
  id: string;
  codigo: string;
  nome: string;
  clienteNome: string;
  clienteSlug: string;
  status: string;
  valorCentavos: number;
  inicioEm: string | null;
  fimEm: string | null;
  proximos: string[];
};

export async function listEngagements(): Promise<Result<EngagementRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const linhas = await database.engagement.findMany({
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: [{ status: "asc" }, { criadoEm: "desc" }],
      select: {
        id: true,
        codigo: true,
        nome: true,
        clienteTenantId: true,
        status: true,
        valorCentavos: true,
        inicioEm: true,
        fimEm: true,
      },
    });

    // Nome do cliente numa consulta só, em vez de N+1: `clienteTenantId` não
    // tem relação declarada no schema (é id solto, para o engajamento
    // sobreviver a mudanças do lado do cliente), então o join é feito aqui.
    const ids = [...new Set(linhas.map((e) => e.clienteTenantId))];
    const clientes = await database.tenant.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true, name: true },
    });
    const porId = new Map(clientes.map((c) => [c.id, c]));

    return linhas.map((e) => {
      const c = porId.get(e.clienteTenantId);
      const status = e.status as StatusEngajamento;
      return {
        id: e.id,
        codigo: e.codigo,
        nome: e.nome,
        clienteNome: c?.name ?? "cliente removido",
        clienteSlug: c?.slug ?? "—",
        status: e.status,
        valorCentavos: e.valorCentavos,
        inicioEm: e.inicioEm ? e.inicioEm.toISOString() : null,
        fimEm: e.fimEm ? e.fimEm.toISOString() : null,
        // A tela só oferece o que a action aceita. Botão que propõe transição
        // recusada é pior que botão nenhum.
        proximos: TRANSICOES[status] ?? [],
      };
    });
  });
}

const CriarSchema = z.object({
  nome: z.string().min(2).max(160),
  codigo: z.string().min(2).max(24),
  clienteTenantId: z.string().min(1),
  serviceId: z.string().optional(),
  escopo: z.string().max(4000).optional(),
  valorCentavos: z.number().int().min(0),
  inicioEm: z.string().optional(),
  fimEm: z.string().optional(),
});

export async function createEngagementAction(
  input: z.input<typeof CriarSchema>
): Promise<Result<{ id: string; codigo: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = CriarSchema.parse(input);
    const codigo = dados.codigo.trim().toUpperCase();

    if (dados.clienteTenantId === SYSTEM_TENANT_ID) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "O tenant interno não é cliente. Um engajamento apontado para ele contaminaria o Benchmark com um contrato da Nebuloz com ela mesma."
      );
    }

    const cliente = await database.tenant.findFirst({
      where: { id: dados.clienteTenantId, isSystem: false },
      select: { id: true, slug: true, name: true },
    });
    if (!cliente) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Cliente não encontrado. Engajamento sem cliente real não tem quem entregar."
      );
    }

    const inicio = dados.inicioEm ? new Date(dados.inicioEm) : null;
    const fim = dados.fimEm ? new Date(dados.fimEm) : null;
    if (inicio && fim && fim < inicio) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "O fim não pode ser antes do início. Datas invertidas quebram o cálculo de capacidade no período."
      );
    }

    const jaExiste = await database.engagement.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, codigo },
      select: { id: true },
    });
    if (jaExiste) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Já existe um engajamento com o código ${codigo}.`
      );
    }

    const criado = await database.engagement.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        nome: dados.nome,
        codigo,
        clienteTenantId: cliente.id,
        serviceId: dados.serviceId ?? null,
        escopo: dados.escopo ?? null,
        // Nasce proposto: um contrato não começa ativo por padrão, ele começa
        // negociado. Nascer ATIVO faria a receita entrar antes do aceite.
        status: "PROPOSTO",
        valorCentavos: dados.valorCentavos,
        inicioEm: inicio,
        fimEm: fim,
      },
      select: { id: true, codigo: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "engagement",
      entityId: criado.id,
      target: `${codigo} · ${dados.nome} · ${cliente.slug}`,
    });

    revalidatePath("/delivery");
    return criado;
  });
}

const StatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUS_ENGAJAMENTO),
});

export async function setEngagementStatusAction(
  input: z.input<typeof StatusSchema>
): Promise<Result<{ id: string; status: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = StatusSchema.parse(input);

    const atual = await database.engagement.findFirst({
      where: { id: dados.id, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, codigo: true, nome: true, status: true },
    });
    if (!atual) {
      throw new StaffAuthError("FORBIDDEN", "Engajamento não encontrado.");
    }

    const de = atual.status as StatusEngajamento;
    if (!podeIr(de, dados.status)) {
      const saidas = TRANSICOES[de] ?? [];
      throw new StaffAuthError(
        "FORBIDDEN",
        saidas.length === 0
          ? `${atual.codigo} está ${ROTULO_STATUS[de]}, que é estado final. Reabrir é decisão de negócio: crie um engajamento novo, que preserva o histórico dos dois.`
          : `${atual.codigo} está ${ROTULO_STATUS[de]} e só pode ir para ${saidas.join(", ")}.`
      );
    }

    await database.engagement.update({
      where: { id: atual.id },
      data: { status: dados.status },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "engagement",
      entityId: atual.id,
      target: `${atual.codigo} · ${atual.nome}`,
      diff: [["status", atual.status, dados.status]],
    });

    revalidatePath("/delivery");
    return { id: atual.id, status: dados.status };
  });
}
