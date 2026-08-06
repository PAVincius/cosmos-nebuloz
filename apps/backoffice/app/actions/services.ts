"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Catálogo do que a Nebuloz vende.
 *
 * É a origem dos itens de uma proposta e do que um engajamento entrega. Sem
 * catálogo, proposta vira texto livre e não sobra eixo para comparar um cliente
 * com outro — que é justamente o que o Benchmark precisa.
 */

const MODALIDADES = ["PROJETO", "RETAINER", "LICENCA"] as const;

export type ServiceRow = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  modalidade: string;
  precoBaseCentavos: number;
  unidade: string;
  ativo: boolean;
};

export async function listServices(): Promise<Result<ServiceRow[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    return await database.service.findMany({
      // Sem filtro de `ativo`: esta é a tela de gestão do catálogo e mostra
      // tudo. Esconder o inativo faria o operador achar que o serviço sumiu e
      // cadastrar um duplicado com o mesmo código.
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: [{ ativo: "desc" }, { codigo: "asc" }],
      select: {
        id: true,
        codigo: true,
        nome: true,
        descricao: true,
        modalidade: true,
        precoBaseCentavos: true,
        unidade: true,
        ativo: true,
      },
    });
  });
}

const CriarSchema = z.object({
  codigo: z.string().min(2).max(20),
  nome: z.string().min(2).max(120),
  descricao: z.string().max(500).optional(),
  modalidade: z.enum(MODALIDADES).optional(),
  /** Centavos. Inteiro e não-negativo — centavo não tem metade, e preço
   *  negativo é erro de digitação que vira desconto silencioso na proposta. */
  precoBaseCentavos: z.number().int().min(0),
  unidade: z.string().max(30).optional(),
});

export async function createServiceAction(
  input: z.input<typeof CriarSchema>
): Promise<Result<{ id: string; codigo: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = CriarSchema.parse(input);
    const codigo = dados.codigo.trim().toUpperCase();

    // Checagem antes do insert para o operador receber a mensagem certa; o
    // unique do banco segue sendo a garantia contra corrida.
    const jaExiste = await database.service.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, codigo },
      select: { id: true },
    });
    if (jaExiste) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Já existe um serviço com o código ${codigo}. Ele aparece em proposta e contrato, então precisa ser único.`
      );
    }

    const criado = await database.service.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        codigo,
        nome: dados.nome,
        descricao: dados.descricao ?? null,
        modalidade: dados.modalidade ?? "PROJETO",
        precoBaseCentavos: dados.precoBaseCentavos,
        unidade: dados.unidade ?? "projeto",
      },
      select: { id: true, codigo: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "service",
      entityId: criado.id,
      target: `${codigo} · ${dados.nome}`,
    });

    revalidatePath("/servicos");
    return criado;
  });
}

const AtivoSchema = z.object({
  id: z.string().min(1),
  ativo: z.boolean(),
});

/**
 * Tira do catálogo (ou devolve) sem apagar.
 *
 * Não existe delete aqui de propósito: proposta antiga aponta para o serviço
 * que existia quando foi feita, e apagar quebraria um documento comercial
 * retroativamente. A FK de `ProposalItem` é RESTRICT pelo mesmo motivo — se
 * alguém tentar apagar pelo banco, falha.
 */
export async function setServiceAtivoAction(
  input: z.input<typeof AtivoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = AtivoSchema.parse(input);

    const atual = await database.service.findFirst({
      where: { id: dados.id, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, codigo: true, nome: true, ativo: true },
    });
    if (!atual) {
      throw new StaffAuthError("FORBIDDEN", "Serviço não encontrado.");
    }

    await database.service.update({
      where: { id: atual.id },
      data: { ativo: dados.ativo },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "service",
      entityId: atual.id,
      target: `${atual.codigo} · ${atual.nome}`,
      diff: [["ativo", String(atual.ativo), String(dados.ativo)]],
    });

    revalidatePath("/servicos");
    return { id: atual.id };
  });
}
