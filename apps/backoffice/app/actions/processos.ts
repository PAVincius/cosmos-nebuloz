"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Dominio, Nivel } from "@/lib/ferramentas/processos";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Actions do mapa de processos (spec §3): CRUD de `StaffProcess` e
 * `StaffProcessEdge`, sempre no tenant `system`.
 *
 * `ProcessoRow`/`LigacaoRow` satisfazem estruturalmente `Processo`/`Ligacao`
 * de `lib/ferramentas/processos.ts` — as telas passam a linha da action
 * direto para o módulo puro, sem função de conversão.
 */

const ROTA_MAPA = "/ferramentas/processos";

const CODIGO = /^PZ-\d{2,3}$/;

const ProcessoSchema = z.object({
  codigo: z.string().trim().regex(CODIGO, "Código no formato PZ-01."),
  nome: z.string().trim().min(2).max(80),
  descricao: z.string().trim().min(1).max(500),
  dominio: z.enum([
    "COMERCIAL",
    "DELIVERY",
    "GOVERNANCA",
    "PLATAFORMA",
    "LAB",
    "MEDICAO",
  ]),
  nivel: z.number().int().min(1).max(3),
  tipo: z.enum(["CORE", "APOIO"]),
  donoNome: z.string().trim().max(60).nullable(),
  revisadoEm: z.iso.date().nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12),
  diagramId: z.string().trim().min(1).nullable(),
  docUrl: z.url().max(500).nullable(),
});

const AtualizarProcessoSchema = ProcessoSchema.extend({
  id: z.string().trim().min(1),
});

const IdSchema = z.object({ id: z.string().trim().min(1) });

const LigacaoSchema = z.object({
  deId: z.string().trim().min(1),
  paraId: z.string().trim().min(1),
  rotulo: z.string().trim().min(2).max(40),
});

export type ProcessoRow = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  dominio: Dominio;
  nivel: Nivel;
  tipo: "CORE" | "APOIO";
  donoNome: string | null;
  revisadoEm: string | null;
  tags: string[];
  diagramId: string | null;
  docUrl: string | null;
  diagram: { id: string; name: string; slug: string } | null;
};

export type LigacaoRow = {
  id: string;
  deId: string;
  paraId: string;
  rotulo: string;
};

export type DiagramaRow = {
  id: string;
  nome: string;
  slug: string;
};

export type PayloadMapa = {
  processos: ProcessoRow[];
  ligacoes: LigacaoRow[];
  diagramas: DiagramaRow[];
};

/** Único lugar que decide se um `diagramId` informado é aceitável — create e
 *  update usam a mesma regra: um processo não pode apontar para um diagrama
 *  MERMAID, só BPMN é modelo de processo. */
async function assertDiagramaBpmn(diagramId: string): Promise<void> {
  const diagrama = await database.staffDiagram.findFirst({
    where: { tenantId: SYSTEM_TENANT_ID, id: diagramId },
    select: { kind: true },
  });
  if (!diagrama || diagrama.kind !== "BPMN") {
    throw new StaffAuthError(
      "FORBIDDEN",
      "O diagrama selecionado precisa ser do tipo BPMN."
    );
  }
}

export async function listarProcessos(): Promise<Result<PayloadMapa>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const [processos, ligacoes, diagramas] = await Promise.all([
      database.staffProcess.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        orderBy: { codigo: "asc" },
        select: {
          id: true,
          codigo: true,
          nome: true,
          descricao: true,
          dominio: true,
          nivel: true,
          tipo: true,
          donoNome: true,
          revisadoEm: true,
          tags: true,
          diagramId: true,
          docUrl: true,
          diagram: { select: { id: true, name: true, slug: true } },
        },
      }),
      database.staffProcessEdge.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        select: { id: true, deId: true, paraId: true, rotulo: true },
      }),
      database.staffDiagram.findMany({
        where: { tenantId: SYSTEM_TENANT_ID, kind: "BPMN" },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    return {
      processos: processos.map((p) => ({
        ...p,
        dominio: p.dominio as Dominio,
        nivel: p.nivel as Nivel,
        tipo: p.tipo as "CORE" | "APOIO",
        revisadoEm: p.revisadoEm ? p.revisadoEm.toISOString() : null,
      })),
      ligacoes,
      diagramas: diagramas.map((d) => ({
        id: d.id,
        nome: d.name,
        slug: d.slug,
      })),
    };
  });
}

export async function criarProcesso(
  input: z.input<typeof ProcessoSchema>
): Promise<Result<{ id: string; codigo: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = ProcessoSchema.parse(input);

    const existente = await database.staffProcess.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, codigo: dados.codigo },
      select: { id: true },
    });
    if (existente) {
      throw new StaffAuthError("FORBIDDEN", `Já existe ${dados.codigo}.`);
    }

    if (dados.diagramId) {
      await assertDiagramaBpmn(dados.diagramId);
    }

    const criado = await database.staffProcess.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        codigo: dados.codigo,
        nome: dados.nome,
        descricao: dados.descricao,
        dominio: dados.dominio,
        nivel: dados.nivel,
        tipo: dados.tipo,
        donoNome: dados.donoNome,
        revisadoEm: dados.revisadoEm ? new Date(dados.revisadoEm) : null,
        tags: dados.tags,
        diagramId: dados.diagramId,
        docUrl: dados.docUrl,
      },
      select: { id: true, codigo: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "StaffProcess",
      entityId: criado.id,
      target: criado.codigo,
    });

    revalidatePath(ROTA_MAPA);
    return criado;
  });
}

export async function atualizarProcesso(
  input: z.input<typeof AtualizarProcessoSchema>
): Promise<Result<{ id: string; codigo: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = AtualizarProcessoSchema.parse(input);

    if (dados.diagramId) {
      await assertDiagramaBpmn(dados.diagramId);
    }

    // `updateMany` (não `update`) porque o `where` precisa carregar o
    // `tenantId` — mesma proteção de escopo que o funil v2 adotou.
    const atualizado = await database.staffProcess.updateMany({
      where: { id: dados.id, tenantId: SYSTEM_TENANT_ID },
      data: {
        codigo: dados.codigo,
        nome: dados.nome,
        descricao: dados.descricao,
        dominio: dados.dominio,
        nivel: dados.nivel,
        tipo: dados.tipo,
        donoNome: dados.donoNome,
        revisadoEm: dados.revisadoEm ? new Date(dados.revisadoEm) : null,
        tags: dados.tags,
        diagramId: dados.diagramId,
        docUrl: dados.docUrl,
      },
    });
    if (atualizado.count === 0) {
      throw new StaffAuthError("FORBIDDEN", "Processo não encontrado.");
    }

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "StaffProcess",
      entityId: dados.id,
      target: dados.codigo,
    });

    revalidatePath(ROTA_MAPA);
    return { id: dados.id, codigo: dados.codigo };
  });
}

export async function excluirProcesso(
  input: z.input<typeof IdSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { id } = IdSchema.parse(input);

    const processo = await database.staffProcess.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, codigo: true, nome: true },
    });
    if (!processo) {
      throw new StaffAuthError("FORBIDDEN", "Processo não encontrado.");
    }

    // Sem apagar arestas à mão: o `onDelete: Cascade` do schema já cobre
    // `StaffProcessEdge`.
    await database.staffProcess.delete({ where: { id: processo.id } });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "deleted",
      entityType: "StaffProcess",
      entityId: processo.id,
      target: `${processo.codigo} · ${processo.nome}`,
    });

    revalidatePath(ROTA_MAPA);
    return { id: processo.id };
  });
}

export async function criarLigacao(
  input: z.input<typeof LigacaoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const dados = LigacaoSchema.parse(input);

    if (dados.deId === dados.paraId) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Um processo não pode ligar para si mesmo."
      );
    }

    const existente = await database.staffProcessEdge.findFirst({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        deId: dados.deId,
        paraId: dados.paraId,
      },
      select: { id: true },
    });
    if (existente) {
      throw new StaffAuthError("FORBIDDEN", "Ligação já existe.");
    }

    const criada = await database.staffProcessEdge.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        deId: dados.deId,
        paraId: dados.paraId,
        rotulo: dados.rotulo,
      },
      select: { id: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "StaffProcessEdge",
      entityId: criada.id,
      target: `${dados.deId} → ${dados.paraId}`,
    });

    revalidatePath(ROTA_MAPA);
    return criada;
  });
}

export async function excluirLigacao(
  input: z.input<typeof IdSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { id } = IdSchema.parse(input);

    const ligacao = await database.staffProcessEdge.findFirst({
      where: { id, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, deId: true, paraId: true },
    });
    if (!ligacao) {
      throw new StaffAuthError("FORBIDDEN", "Ligação não encontrada.");
    }

    await database.staffProcessEdge.delete({ where: { id: ligacao.id } });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "deleted",
      entityType: "StaffProcessEdge",
      entityId: ligacao.id,
      target: `${ligacao.deId} → ${ligacao.paraId}`,
    });

    revalidatePath(ROTA_MAPA);
    return { id: ligacao.id };
  });
}
