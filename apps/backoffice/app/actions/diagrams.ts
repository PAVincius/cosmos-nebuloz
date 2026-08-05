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
 * Diagramas do back-office: BPMN e diagrama-como-código.
 *
 * Uma action para os dois tipos porque o dado é o mesmo — texto versionado. A
 * diferença mora só no renderizador da tela.
 *
 * O texto é a fonte da verdade e o canvas reflete o texto, nunca o contrário.
 * É isso que torna o diagrama diffável numa revisão e versionável em git.
 */

const TIPOS = ["BPMN", "MERMAID"] as const;
export type DiagramKind = (typeof TIPOS)[number];

const NAO_ALFANUM = /[^a-z0-9]+/g;
const BORDA_HIFEN = /(^-|-$)/g;

/** Slug a partir do nome. Local de propósito: o slugify do provisioning é de
 *  tenant e carrega regras de reserva que não valem para diagrama. */
function slugificar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(NAO_ALFANUM, "-")
    .replace(BORDA_HIFEN, "");
}

export type DiagramRow = {
  id: string;
  kind: string;
  name: string;
  slug: string;
  descricao: string | null;
  versoes: number;
  atualizadoEm: string;
  criadoPorNome: string | null;
};

export async function listDiagrams(
  kind: DiagramKind
): Promise<Result<DiagramRow[]>> {
  return await safeAction(async () => {
    // Sem assertCanWrite: leitura é de todo staff (FR-0.4).
    await requirePlatformStaff();

    const linhas = await database.staffDiagram.findMany({
      where: { tenantId: SYSTEM_TENANT_ID, kind },
      orderBy: { atualizadoEm: "desc" },
      // `source` fica de fora: a lista não renderiza diagrama nenhum, e um XML
      // BPMN de processo real tem dezenas de KB. Trazer todos para montar uma
      // tabela é payload que ninguém olha.
      select: {
        id: true,
        kind: true,
        name: true,
        slug: true,
        descricao: true,
        atualizadoEm: true,
        criadoPorNome: true,
        _count: { select: { versions: true } },
      },
    });

    return linhas.map((d) => ({
      id: d.id,
      kind: d.kind,
      name: d.name,
      slug: d.slug,
      descricao: d.descricao,
      versoes: d._count.versions,
      atualizadoEm: d.atualizadoEm.toISOString(),
      criadoPorNome: d.criadoPorNome,
    }));
  });
}

export type DiagramDetail = DiagramRow & {
  source: string;
  historico: {
    versao: number;
    nota: string | null;
    autorNome: string | null;
    criadoEm: string;
  }[];
};

export async function getDiagram(id: string): Promise<Result<DiagramDetail>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const d = await database.staffDiagram.findFirst({
      // tenantId no where, não só o id: o id vem do cliente.
      where: { id, tenantId: SYSTEM_TENANT_ID },
      include: {
        versions: { orderBy: { versao: "desc" } },
        _count: { select: { versions: true } },
      },
    });
    if (!d) {
      throw new StaffAuthError("FORBIDDEN", "Diagrama não encontrado.");
    }

    return {
      id: d.id,
      kind: d.kind,
      name: d.name,
      slug: d.slug,
      descricao: d.descricao,
      source: d.source,
      versoes: d._count.versions,
      atualizadoEm: d.atualizadoEm.toISOString(),
      criadoPorNome: d.criadoPorNome,
      historico: d.versions.map((v) => ({
        versao: v.versao,
        nota: v.nota,
        autorNome: v.autorNome,
        criadoEm: v.criadoEm.toISOString(),
      })),
    };
  });
}

const CriarSchema = z.object({
  kind: z.enum(TIPOS),
  name: z.string().min(2).max(120),
  source: z.string().min(1),
  descricao: z.string().max(500).optional(),
});

export async function createDiagramAction(
  input: z.input<typeof CriarSchema>
): Promise<Result<{ id: string; slug: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = CriarSchema.parse(input);
    const slug = slugificar(dados.name);
    if (!slug) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `"${dados.name}" não gera um slug utilizável. Use letras ou números no nome.`
      );
    }

    // Checagem antes do insert para o operador receber a mensagem certa. O
    // unique do banco continua sendo a garantia real contra corrida — este
    // teste só evita que a barreira apareça como erro genérico de constraint.
    const jaExiste = await database.staffDiagram.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, slug },
      select: { id: true },
    });
    if (jaExiste) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Já existe um diagrama com o slug ${slug}. Escolha outro nome.`
      );
    }

    const criado = await database.$transaction(async (tx) => {
      const d = await tx.staffDiagram.create({
        data: {
          tenantId: SYSTEM_TENANT_ID,
          kind: dados.kind,
          name: dados.name,
          slug,
          descricao: dados.descricao ?? null,
          source: dados.source,
          criadoPorId: staff.userId,
          criadoPorNome: staff.name,
        },
        select: { id: true, slug: true },
      });

      // Versão 1 junto com a criação, na mesma transação: um diagrama sem
      // nenhuma revisão seria um histórico que começa no segundo salvamento.
      await tx.staffDiagramVersion.create({
        data: {
          diagramId: d.id,
          versao: 1,
          source: dados.source,
          nota: "Versão inicial",
          autorId: staff.userId,
          autorNome: staff.name,
        },
      });

      return d;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "staff_diagram",
      entityId: criado.id,
      target: `${dados.kind} · ${dados.name}`,
    });

    revalidatePath("/ferramentas/bpmn");
    revalidatePath("/ferramentas/diagramas");
    return criado;
  });
}

const AtualizarSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  nota: z.string().max(300).optional(),
});

export async function updateDiagramAction(
  input: z.input<typeof AtualizarSchema>
): Promise<Result<{ id: string; versao: number | null }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = AtualizarSchema.parse(input);

    const atual = await database.staffDiagram.findFirst({
      where: { id: dados.id, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, slug: true, name: true, source: true },
    });
    if (!atual) {
      throw new StaffAuthError("FORBIDDEN", "Diagrama não encontrado.");
    }

    // Texto idêntico não vira revisão. Salvar duas vezes seguidas encheria o
    // histórico de versões iguais, e um histórico assim deixa de responder "o
    // que mudou" — vira log de cliques.
    if (atual.source === dados.source) {
      return { id: atual.id, versao: null };
    }

    const versao = await database.$transaction(async (tx) => {
      const { _max } = await tx.staffDiagramVersion.aggregate({
        where: { diagramId: atual.id },
        _max: { versao: true },
      });
      const proxima = (_max.versao ?? 0) + 1;

      await tx.staffDiagramVersion.create({
        data: {
          diagramId: atual.id,
          versao: proxima,
          source: dados.source,
          nota: dados.nota ?? null,
          autorId: staff.userId,
          autorNome: staff.name,
        },
      });

      await tx.staffDiagram.update({
        where: { id: atual.id },
        data: { source: dados.source },
      });

      return proxima;
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "updated",
      entityType: "staff_diagram",
      entityId: atual.id,
      target: `${atual.name} → v${versao}`,
      note: dados.nota,
    });

    revalidatePath("/ferramentas/bpmn");
    revalidatePath("/ferramentas/diagramas");
    return { id: atual.id, versao };
  });
}
